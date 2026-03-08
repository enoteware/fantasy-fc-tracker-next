/**
 * populate-futbin-urls.mjs
 * Scrapes FUTBIN fantasy tracker page and matches players to DB,
 * then populates futbin_url for all matched players.
 * 
 * Run: node scripts/populate-futbin-urls.mjs [--dry-run]
 */

import pg from 'pg';
const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL ??
  'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

const FUTBIN_BASE = 'https://www.futbin.com';
const FUTBIN_URL = 'https://www.futbin.com/dynamic-players/fantasy';
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({ connectionString: DB_URL });

// Normalize name for fuzzy matching
function normName(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build lookup tokens from a slug like "cole-palmer" or "rafael-da-conceicao-leao"
function slugToTokens(slug) {
  return slug.replace(/-/g, ' ').split(' ').filter(Boolean);
}

async function main() {
  console.log(`🔍 Fetching FUTBIN fantasy tracker...${DRY_RUN ? ' [DRY RUN]' : ''}`);
  
  const res = await fetch(FUTBIN_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36' }
  });
  const html = await res.text();
  
  // Extract all fantasy player links
  const linkRe = /\/dynamic-players\/fantasy\/(\d+)\/([a-z-]+)/g;
  const links = [];
  let m;
  const seen = new Set();
  while ((m = linkRe.exec(html)) !== null) {
    const key = m[0];
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      futbinId: m[1],
      slug: m[2],
      url: `${FUTBIN_BASE}${m[0]}`,
    });
  }
  console.log(`📄 Found ${links.length} FUTBIN fantasy player links`);

  // Load all players from DB
  const client = await pool.connect();
  const { rows: players } = await client.query(
    `SELECT id, name FROM fantasy_fc_players ORDER BY id`
  );
  console.log(`👥 ${players.length} players in DB\n`);

  let matched = 0, unmatched = 0;
  const updates = [];

  for (const link of links) {
    const tokens = slugToTokens(link.slug);
    const lastName = tokens[tokens.length - 1];
    const firstName = tokens[0];

    // Try to match: last name token must appear in normalized DB name
    let best = null;
    let bestScore = 0;

    for (const p of players) {
      const norm = normName(p.name);
      const normTokens = norm.split(' ');
      
      // Score: count how many slug tokens appear in the player name
      let score = 0;
      for (const t of tokens) {
        if (normTokens.some(nt => nt === t || nt.startsWith(t) || t.startsWith(nt))) score++;
      }
      
      // Boost if last name matches exactly
      if (normTokens[normTokens.length - 1] === lastName) score += 2;
      if (normTokens[0] === firstName) score += 1;

      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    // Require score ≥ 2 to avoid bad matches
    if (best && bestScore >= 2) {
      updates.push({ player: best, link });
      matched++;
      console.log(`  ✅ ${link.slug.padEnd(45)} → ${best.name} (score ${bestScore})`);
    } else {
      unmatched++;
      console.log(`  ❌ ${link.slug.padEnd(45)} → NO MATCH (best: ${best?.name ?? 'none'}, score ${bestScore})`);
    }
  }

  console.log(`\n📊 Matched: ${matched} | Unmatched: ${unmatched}`);

  if (DRY_RUN) {
    console.log('\nDry run — no DB writes.');
    await client.release();
    await pool.end();
    return;
  }

  // Write to DB
  let written = 0;
  for (const { player, link } of updates) {
    await client.query(
      `UPDATE fantasy_fc_players SET futbin_url = $1 WHERE id = $2`,
      [link.url, player.id]
    );
    written++;
  }
  client.release();

  console.log(`\n✅ Updated ${written} futbin_url entries in DB`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
