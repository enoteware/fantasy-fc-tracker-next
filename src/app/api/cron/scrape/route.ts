import { NextRequest, NextResponse } from "next/server";

import { pool } from "@/lib/db-pg";
import {
  SOFASCORE_HEADERS,
  SOFASCORE_MATCH_CUTOFF,
  computeMatchStats,
  delay,
  findLineupPlayer,
  getEventDate,
  isLeagueEvent,
  normalizeText,
} from "@/lib/sofascore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbPlayer = {
  id: number;
  name: string;
  club: string;
  position: string;
  sofascore_id: number | null;
};

type ScrapeResults = {
  timestamp: string;
  playersChecked: number;
  matchesAdded: number;
  upgradesDetected: number;
  errors: string[];
};

const REQUEST_DELAY_MS = 200;

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: SOFASCORE_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SofaScore ${response.status} for ${url}: ${body.slice(0, 300)}`);
  }

  return response.json();
}

function getScoreForSide(event: any, side: "home" | "away") {
  const homeScore =
    event?.homeScore?.current ??
    event?.homeScore?.display ??
    event?.homeScore?.normaltime ??
    null;
  const awayScore =
    event?.awayScore?.current ??
    event?.awayScore?.display ??
    event?.awayScore?.normaltime ??
    null;

  if (side === "home") {
    return { scoreFor: homeScore, scoreAgainst: awayScore };
  }

  return { scoreFor: awayScore, scoreAgainst: homeScore };
}

function getMatchResult(scoreFor: number | null, scoreAgainst: number | null) {
  if (scoreFor == null || scoreAgainst == null) {
    return null;
  }
  if (scoreFor > scoreAgainst) {
    return "W";
  }
  if (scoreFor < scoreAgainst) {
    return "L";
  }
  return "D";
}

function resolveClubContext(player: DbPlayer, event: any, lineupSide: "home" | "away") {
  const homeName = event?.homeTeam?.name ?? "Unknown";
  const awayName = event?.awayTeam?.name ?? "Unknown";
  const homeNormalized = normalizeText(homeName);
  const awayNormalized = normalizeText(awayName);
  const playerClub = normalizeText(player.club);

  if (playerClub && playerClub === homeNormalized) {
    return { side: "home" as const, club: homeName, opponent: awayName };
  }

  if (playerClub && playerClub === awayNormalized) {
    return { side: "away" as const, club: awayName, opponent: homeName };
  }

  return lineupSide === "home"
    ? { side: "home" as const, club: homeName, opponent: awayName }
    : { side: "away" as const, club: awayName, opponent: homeName };
}

async function upsertMatch(client: any, player: DbPlayer, event: any, lineupSide: "home" | "away") {
  const eventId = Number(event?.id);
  const eventDate = getEventDate(event);
  if (!eventId || !eventDate) {
    throw new Error(`Missing event id/date for ${player.name}`);
  }

  const context = resolveClubContext(player, event, lineupSide);
  const { scoreFor, scoreAgainst } = getScoreForSide(event, context.side);
  const result = getMatchResult(scoreFor, scoreAgainst);
  const cleanSheet = scoreAgainst === 0;

  const existing = await client.query(
    `SELECT id
     FROM fantasy_fc_matches
     WHERE sofascore_id = $1
        OR (club = $2 AND match_date = $3::date AND opponent = $4)
     ORDER BY id ASC
     LIMIT 1`,
    [String(eventId), context.club, eventDate.toISOString().slice(0, 10), context.opponent],
  );

  if (existing.rowCount > 0) {
    const matchId = existing.rows[0].id;
    await client.query(
      `UPDATE fantasy_fc_matches
       SET club = $1,
           opponent = $2,
           match_date = $3::date,
           home_away = $4,
           league = $5,
           result = $6,
           score_for = $7,
           score_against = $8,
           goals_scored = COALESCE($7, 0),
           clean_sheet = $9,
           tracked = TRUE,
           processed = TRUE,
           sofascore_id = $10,
           updated_at = NOW()
       WHERE id = $11`,
      [
        context.club,
        context.opponent,
        eventDate.toISOString().slice(0, 10),
        context.side === "home" ? "home" : "away",
        event?.tournament?.uniqueTournament?.name ?? event?.tournament?.name ?? "League",
        result,
        scoreFor,
        scoreAgainst,
        cleanSheet,
        String(eventId),
        matchId,
      ],
    );
    return matchId;
  }

  const inserted = await client.query(
    `INSERT INTO fantasy_fc_matches (
       club,
       opponent,
       match_date,
       home_away,
       league,
       result,
       score_for,
       score_against,
       goals_scored,
       clean_sheet,
       tracked,
       processed,
       sofascore_id,
       created_at,
       updated_at
     ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, COALESCE($7, 0), $9, TRUE, TRUE, $10, NOW(), NOW())
     RETURNING id`,
    [
      context.club,
      context.opponent,
      eventDate.toISOString().slice(0, 10),
      context.side === "home" ? "home" : "away",
      event?.tournament?.uniqueTournament?.name ?? event?.tournament?.name ?? "League",
      result,
      scoreFor,
      scoreAgainst,
      cleanSheet,
      String(eventId),
    ],
  );

  return inserted.rows[0].id as number;
}

async function upsertPlayerMatch(
  client: any,
  player: DbPlayer,
  matchId: number,
  eventId: number,
  stats: ReturnType<typeof computeMatchStats>,
) {
  const existing = await client.query(
    `SELECT id
     FROM fantasy_fc_player_matches
     WHERE player_id = $1
       AND sofascore_event_id = $2
     ORDER BY id ASC
     LIMIT 1`,
    [player.id, eventId],
  );

  if (existing.rowCount > 0) {
    await client.query(
      `UPDATE fantasy_fc_player_matches
       SET match_id = $1,
           goals = $2,
           assists = $3,
           clean_sheet = $4,
           attacking_actions = $5,
           defensive_actions = $6,
           minutes_played = $7,
           sofascore_rating = $8,
           yellow_card = $9,
           red_card = $10,
           shots = $11,
           shots_on_target = $12,
           key_passes = $13,
           successful_dribbles = $14,
           touches_in_box = $15,
           tackles_won = $16,
           interceptions = $17,
           clearances = $18,
           blocks = $19,
           saves = $20,
           goals_conceded = $21
       WHERE id = $22`,
      [
        matchId,
        stats.goals,
        stats.assists,
        stats.clean_sheet,
        stats.attacking_actions,
        stats.defensive_actions,
        stats.minutes_played,
        stats.sofascore_rating,
        stats.yellow_card,
        stats.red_card,
        stats.shots,
        stats.shots_on_target,
        stats.key_passes,
        stats.successful_dribbles,
        stats.touches_in_box,
        stats.tackles_won,
        stats.interceptions,
        stats.clearances,
        stats.blocks,
        stats.saves,
        stats.goals_conceded,
        existing.rows[0].id,
      ],
    );
    return false;
  }

  await client.query(
    `INSERT INTO fantasy_fc_player_matches (
       player_id,
       match_id,
       goals,
       assists,
       clean_sheet,
       attacking_actions,
       defensive_actions,
       created_at,
       minutes_played,
       sofascore_rating,
       yellow_card,
       red_card,
       sofascore_event_id,
       shots,
       shots_on_target,
       key_passes,
       successful_dribbles,
       touches_in_box,
       tackles_won,
       interceptions,
       clearances,
       blocks,
       saves,
       goals_conceded
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
     )`,
    [
      player.id,
      matchId,
      stats.goals,
      stats.assists,
      stats.clean_sheet,
      stats.attacking_actions,
      stats.defensive_actions,
      stats.minutes_played,
      stats.sofascore_rating,
      stats.yellow_card,
      stats.red_card,
      eventId,
      stats.shots,
      stats.shots_on_target,
      stats.key_passes,
      stats.successful_dribbles,
      stats.touches_in_box,
      stats.tackles_won,
      stats.interceptions,
      stats.clearances,
      stats.blocks,
      stats.saves,
      stats.goals_conceded,
    ],
  );

  return true;
}

async function refreshAggregateStats(client: any) {
  await client.query(
    `INSERT INTO fantasy_fc_player_stats (
       player_id,
       goals,
       assists,
       clean_sheets,
       attacking_actions,
       defensive_actions,
       created_at,
       updated_at
     )
     SELECT
       p.id AS player_id,
       COALESCE(SUM(pm.goals), 0) AS goals,
       COALESCE(SUM(pm.assists), 0) AS assists,
       COALESCE(SUM(CASE WHEN pm.clean_sheet THEN 1 ELSE 0 END), 0) AS clean_sheets,
       COALESCE(SUM(pm.attacking_actions), 0) AS attacking_actions,
       COALESCE(SUM(pm.defensive_actions), 0) AS defensive_actions,
       NOW(),
       NOW()
     FROM fantasy_fc_players p
     LEFT JOIN fantasy_fc_player_matches pm ON pm.player_id = p.id
     GROUP BY p.id
     ON CONFLICT (player_id) DO UPDATE SET
       goals = EXCLUDED.goals,
       assists = EXCLUDED.assists,
       clean_sheets = EXCLUDED.clean_sheets,
       attacking_actions = EXCLUDED.attacking_actions,
       defensive_actions = EXCLUDED.defensive_actions,
       updated_at = NOW()`,
  );
}

async function sendDiscordNotification(results: ScrapeResults) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: [
          `⚽ **Fantasy FC Update** — ${new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Los_Angeles",
          })} PT`,
          ``,
          `📊 **Status:**`,
          `• Players tracked: ${results.playersChecked}`,
          `• Matches added: ${results.matchesAdded}`,
          `• Upgrades detected: ${results.upgradesDetected}`,
          `• Errors: ${results.errors.length}`,
        ].join("\n"),
      }),
    });
  } catch (error) {
    results.errors.push(`Discord webhook failed: ${String(error)}`);
  }
}

async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const secretParam = new URL(request.url).searchParams.get("secret");
    if (secretParam !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: ScrapeResults = {
    timestamp: new Date().toISOString(),
    playersChecked: 0,
    matchesAdded: 0,
    upgradesDetected: 0,
    errors: [],
  };

  const client = await pool.connect();

  try {
    const playerResult = await client.query<DbPlayer>(
      `SELECT id, name, club, position, sofascore_id
       FROM fantasy_fc_players
       WHERE sofascore_id IS NOT NULL
       ORDER BY id ASC`,
    );

    const players = playerResult.rows;
    results.playersChecked = players.length;

    for (const player of players) {
      try {
        const eventPayload = await fetchJson(
          `https://api.sofascore.com/api/v1/player/${player.sofascore_id}/events/last/0`,
        );

        await delay(REQUEST_DELAY_MS);

        const events = Array.isArray(eventPayload?.events) ? eventPayload.events : [];
        const relevantEvents = events.filter((event: any) => {
          const eventDate = getEventDate(event);
          return Boolean(eventDate && eventDate > SOFASCORE_MATCH_CUTOFF && isLeagueEvent(event));
        });

        for (const event of relevantEvents) {
          const eventId = Number(event?.id);
          if (!eventId) {
            continue;
          }

          const lineups = await fetchJson(
            `https://api.sofascore.com/api/v1/event/${eventId}/lineups`,
          );
          const lineupEntry = findLineupPlayer(lineups, Number(player.sofascore_id));

          await delay(REQUEST_DELAY_MS);

          if (!lineupEntry) {
            results.errors.push(`Player ${player.name} not found in lineups for event ${eventId}`);
            continue;
          }

          const stats = computeMatchStats(lineupEntry, player.position);
          const matchId = await upsertMatch(client, player, event, lineupEntry.side);
          const inserted = await upsertPlayerMatch(client, player, matchId, eventId, stats);

          if (inserted) {
            results.matchesAdded += 1;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors.push(`${player.name}: ${message}`);
      }
    }

    await refreshAggregateStats(client);
    await sendDiscordNotification(results);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Cron scrape error:", error);
    return NextResponse.json(
      {
        error: "Scrape failed",
        details: String(error),
        ...results,
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
