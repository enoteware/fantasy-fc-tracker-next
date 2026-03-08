import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

const SEARCH_URL = "https://api.sofascore.com/api/v1/search/all?q=";
const REQUEST_DELAY_MS = 600;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
  Accept: "application/json",
  Referer: "https://www.sofascore.com/",
};

const pool = new Pool({ connectionString: DATABASE_URL });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function getLastName(name) {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

function extractEntities(payload) {
  const groups = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.groups)
      ? payload.groups
      : [];

  const entities = [];
  for (const group of groups) {
    const items = Array.isArray(group?.entities)
      ? group.entities
      : Array.isArray(group?.results)
        ? group.results
        : Array.isArray(group?.items)
          ? group.items
          : [];

    for (const item of items) {
      entities.push(item?.entity ?? item);
    }
  }

  return entities;
}

function isPlayerEntity(entity) {
  const type = normalizeText(entity?.type ?? entity?.entityType ?? "");
  return type.includes("player") || Boolean(entity?.position) || Boolean(entity?.slug);
}

function formatCandidate(entity) {
  const type = entity?.type ?? entity?.entityType ?? "unknown";
  return `- ${entity?.name ?? "unknown"} | type=${type} | id=${entity?.id ?? "n/a"}`;
}

async function lookupPlayer(client, player) {
  const url = `${SEARCH_URL}${encodeURIComponent(player.name)}`;
  const response = await fetch(url, { headers: HEADERS });
  const text = await response.text();

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  const entities = payload ? extractEntities(payload) : [];
  const candidates = entities.filter(isPlayerEntity);
  const lastName = getLastName(player.name);
  const match =
    candidates.find((entity) => getLastName(entity?.name) === lastName) ??
    candidates.find((entity) => normalizeText(entity?.name).includes(lastName)) ??
    null;

  console.log(`\n[PLAYER] ${player.id} ${player.name} (${player.club})`);
  console.log(`[HTTP] ${response.status} ${response.statusText}`);
  if (candidates.length > 0) {
    console.log("[CANDIDATES]");
    for (const candidate of candidates.slice(0, 10)) {
      console.log(formatCandidate(candidate));
    }
  } else {
    console.log("[CANDIDATES] none");
  }

  if (!response.ok || !match?.id) {
    console.log("[MATCH] none");
    return false;
  }

  await client.query(
    "UPDATE fantasy_fc_players SET sofascore_id = $1, updated_at = NOW() WHERE id = $2",
    [Number(match.id), player.id],
  );

  console.log(`[MATCH] ${match.name} -> sofascore_id=${match.id}`);
  return true;
}

async function main() {
  const client = await pool.connect();

  try {
    const { rows: players } = await client.query(
      `SELECT id, name, club
       FROM fantasy_fc_players
       WHERE sofascore_id IS NULL
       ORDER BY name ASC`,
    );

    console.log(`Looking up SofaScore IDs for ${players.length} players`);

    let updated = 0;
    for (const player of players) {
      try {
        const didUpdate = await lookupPlayer(client, player);
        if (didUpdate) {
          updated += 1;
        }
      } catch (error) {
        console.error(`[ERROR] ${player.name}:`, error);
      }

      await delay(REQUEST_DELAY_MS);
    }

    console.log(`\nComplete. Updated ${updated} of ${players.length} players.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
