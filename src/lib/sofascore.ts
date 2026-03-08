export const SOFASCORE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
  Accept: "application/json",
  Referer: "https://www.sofascore.com/",
} as const;

const EXCLUDED_COMPETITION_TERMS = [
  "cup",
  "knockout",
  "champions league",
  "europa",
  "conference",
  "world cup",
  "friendly",
  "international",
];

export const SOFASCORE_MATCH_CUTOFF = new Date("2026-02-21T23:59:59.999Z");

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function getLastName(name: string) {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

export function extractSearchEntities(payload: any) {
  const buckets = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.groups)
      ? payload.groups
      : [];

  const entities: any[] = [];
  for (const bucket of buckets) {
    const items = Array.isArray(bucket?.entities)
      ? bucket.entities
      : Array.isArray(bucket?.results)
        ? bucket.results
        : Array.isArray(bucket?.items)
          ? bucket.items
          : [];

    for (const item of items) {
      if (item?.entity) {
        entities.push(item.entity);
      } else {
        entities.push(item);
      }
    }
  }

  return entities;
}

export function isPlayerSearchEntity(entity: any) {
  const type = normalizeText(
    entity?.type ?? entity?.entityType ?? entity?.groupName ?? entity?.sport ?? "",
  );

  return type.includes("player") || entity?.slug || entity?.position;
}

export function findMatchingPlayerEntity(entities: any[], playerName: string) {
  const playerLastName = getLastName(playerName);

  return (
    entities.find((entity) => {
      if (!isPlayerSearchEntity(entity)) {
        return false;
      }

      const entityName = normalizeText(entity?.name ?? entity?.slug ?? "");
      const entityLastName = getLastName(entity?.name ?? entity?.slug ?? "");

      return entityLastName === playerLastName || entityName.includes(playerLastName);
    }) ?? null
  );
}

export function getEventDate(event: any) {
  const timestamp = Number(event?.startTimestamp ?? 0);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000)
    : null;
}

export function isLeagueEvent(event: any) {
  const competitionText = [
    event?.tournament?.name,
    event?.tournament?.slug,
    event?.tournament?.uniqueTournament?.name,
    event?.tournament?.uniqueTournament?.slug,
    event?.season?.name,
  ]
    .filter(Boolean)
    .join(" ");

  const normalized = normalizeText(competitionText);
  return !EXCLUDED_COMPETITION_TERMS.some((term) => normalized.includes(term));
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

export function getLineupEntries(payload: any) {
  const entries: Array<{ side: "home" | "away"; item: any }> = [];

  for (const side of ["home", "away"] as const) {
    const block = payload?.[side];
    const players = [
      ...asArray(block?.players),
      ...asArray(block?.starters),
      ...asArray(block?.substitutes),
      ...asArray(block?.missingPlayers),
    ];

    for (const item of players) {
      entries.push({ side, item });
    }
  }

  return entries;
}

export function findLineupPlayer(payload: any, sofascorePlayerId: number) {
  return (
    getLineupEntries(payload).find(({ item }) => {
      const playerId = Number(item?.player?.id ?? item?.id ?? 0);
      return playerId === sofascorePlayerId;
    }) ?? null
  );
}

function getNumberStat(source: any, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function getRating(entry: any, stats: any) {
  const candidates = [
    entry?.ratingVersions?.original,
    entry?.ratingVersions?.alternative,
    entry?.statistics?.rating,
    stats?.rating,
  ];

  for (const value of candidates) {
    if (typeof value === "number") {
      return Number(value.toFixed(2));
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return Number(parsed.toFixed(2));
      }
    }
  }

  return null;
}

export function computeMatchStats(entry: any, position: string) {
  const stats = entry?.item?.statistics ?? entry?.statistics ?? {};

  const shotsOnTarget = getNumberStat(stats, "onTargetScoringAttempt");
  const shotsOffTarget = getNumberStat(stats, "shotOffTarget");
  const keyPasses = getNumberStat(stats, "keyPass");
  const successfulDribbles = getNumberStat(stats, "successfulDribble");
  const touchesInBox = getNumberStat(stats, "touchInBox");
  const tacklesWon = getNumberStat(stats, "wonTackle");
  const interceptions = getNumberStat(stats, "interceptionWon");
  const clearances = getNumberStat(stats, "totalClearance");
  const blocks = getNumberStat(stats, "blockedScoringAttempt");
  const saves = getNumberStat(stats, "saves");
  const minutesPlayed = getNumberStat(stats, "minutesPlayed");
  const goalsConceded = getNumberStat(stats, "goalsConceded");
  const goals = getNumberStat(stats, "goals", "goal");
  const assists = getNumberStat(stats, "assists", "assist");
  const yellowCards = getNumberStat(stats, "yellowCards", "yellowCard");
  const redCards = getNumberStat(stats, "redCards", "redCard");
  const normalizedPosition = normalizeText(position);
  const isDefensive = normalizedPosition === "def" || normalizedPosition === "gk";

  return {
    goals,
    assists,
    minutes_played: minutesPlayed,
    sofascore_rating: getRating(entry?.item ?? entry, stats),
    yellow_card: yellowCards > 0,
    red_card: redCards > 0,
    shots: shotsOnTarget + shotsOffTarget,
    shots_on_target: shotsOnTarget,
    key_passes: keyPasses,
    successful_dribbles: successfulDribbles,
    touches_in_box: touchesInBox,
    tackles_won: tacklesWon,
    interceptions,
    clearances,
    blocks,
    saves,
    goals_conceded: goalsConceded,
    clean_sheet: goalsConceded === 0 && minutesPlayed >= 60,
    attacking_actions: isDefensive
      ? 0
      : shotsOnTarget + shotsOffTarget + keyPasses + successfulDribbles + touchesInBox,
    defensive_actions: isDefensive
      ? tacklesWon + interceptions + clearances + blocks + saves
      : 0,
  };
}
