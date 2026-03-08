/**
 * scrape-fifauteam.mjs
 * Scrapes fifauteam.com Fantasy FC tracker for upgrade progress.
 * 
 * HTML structure per player row:
 *   - Player name in: <img data-lazy-src="/images/players/fc26/{slug}.webp"><br> FIRST <strong>LAST</strong>
 *   - Stats: data-title="Team Points: 6 neeeded">X/6  (wins)
 *             data-title="Team Goals: 10 needed">X/10  (team goals)
 *             data-title="Contributions: 6 needed">X/6  (att actions FWD/MID)
 *             data-title="Def. Actions: 12 needed">X/12  (def actions DEF/GK)
 *             data-title="Goals/Assists: 1 needed">X/1  (G/A)
 *             data-title="Clean Sheets: 1 needed">X/1  (CS)
 *   - Upgrade badges in promo-note spans: T1, T2, SBC, OBJ, 1G, 1A, AC, DC, BC, CS, 6P, TG
 * 
 * Run: node scripts/scrape-fifauteam.mjs [--dry-run]
 */

import pg from 'pg';
const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL ??
  'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

const FIFAUTEAM_URL = 'https://fifauteam.com/fc-26-fantasy-tracker/';
const DRY_RUN = process.argv.includes('--dry-run');

const UPGRADE_BADGES = new Set(['1G', '1A', 'AC', 'DC', 'BC', 'CS', '6P', 'TG']);
const TEAM_TAGS = new Set(['T1', 'T2', 'SBC', 'OBJ', 'PLO', 'FAN']);

const pool = new Pool({ connectionString: DB_URL });

async function fetchPage() {
  const res = await fetch(FIFAUTEAM_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Referer': 'https://www.google.com/',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseHtml(html) {
  const players = [];

  // Each player block starts with their image slug like /images/players/fc26/brunofernandes.webp
  // Split on that pattern to get per-player sections
  const playerImgPattern = /data-lazy-src="\/images\/players\/fc26\/([^"]+\.webp)"/g;
  const positions = [];
  let m;
  while ((m = playerImgPattern.exec(html)) !== null) {
    positions.push({ idx: m.index, slug: m[1].replace('.webp', '') });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = positions[i + 1]?.idx ?? html.length;
    const block = html.slice(start, end);
    const slug = positions[i].slug;

    // Extract player name: <br> FIRST <strong>LAST </strong>
    const nameMatch = block.match(/<br>\s*([^<]+?)\s*<strong>([^<]+?)\s*<\/strong>/);
    if (!nameMatch) continue;
    const name = `${nameMatch[1].trim()} ${nameMatch[2].trim()}`.trim();

    // Extract stats counters
    const stats = { wins: 0, teamGoals: 0, contributions: 0, ga: 0, cs: 0, defActions: 0 };
    const counterRe = /data-title="([^"]+)"[^>]*>(\d+)\/(\d+)<\/a>/g;
    let cm;
    while ((cm = counterRe.exec(block)) !== null) {
      const [, title, cur, thresh] = cm;
      const t = title.toLowerCase();
      const val = parseInt(cur);
      if (t.includes('points')) stats.wins = val;
      else if (t.includes('goals') && !t.includes('assist')) stats.teamGoals = val;
      else if (t.includes('contribution')) stats.contributions = val;
      else if (t.includes('def')) stats.defActions = val;
      else if (t.includes('goals/assist') || t.includes('assist')) stats.ga = val;
      else if (t.includes('clean')) stats.cs = val;
    }

    // Extract promo-note badges
    const noteRe = /<span class="promo-note">([^<]+)<\/span>/g;
    const badges = [];
    let nm;
    while ((nm = noteRe.exec(block)) !== null) {
      const note = nm[1].trim();
      if (UPGRADE_BADGES.has(note)) badges.push(note);
    }

    // Extract team tag (first promo-note that is T1/T2/SBC/OBJ)
    const allNotes = [...block.matchAll(/<span class="promo-note">([^<]+)<\/span>/g)].map(x => x[1].trim());
    const teamTag = allNotes.find(n => TEAM_TAGS.has(n)) ?? null;

    // Skip PLO/FAN (FPL Live — not tracked)
    if (teamTag === 'PLO' || teamTag === 'FAN') continue;

    players.push({ slug, name, teamTag, stats, upgrades: [...new Set(badges)] });
  }

  return players;
}

async function main() {
  console.log(`🔍 Fetching fifauteam tracker...${DRY_RUN ? ' [DRY RUN]' : ''}`);
  const html = await fetchPage();
  console.log(`📄 ${Math.round(html.length / 1024)}KB fetched`);

  const players = parseHtml(html);
  console.log(`👥 Parsed ${players.length} players\n`);

  if (players.length === 0) {
    console.error('❌ Zero players parsed — check HTML structure');
    process.exit(1);
  }

  // Show sample
  players.slice(0, 8).forEach(p => {
    console.log(`  ${p.name} [${p.teamTag}] wins:${p.stats.wins} goals:${p.stats.teamGoals} att:${p.stats.contributions} ga:${p.stats.ga} cs:${p.stats.cs} → [${p.upgrades.join(',')}]`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('Dry run complete.');
    await pool.end();
    return;
  }

  // Upsert to DB
  const client = await pool.connect();
  let updated = 0, notFound = 0;
  try {
    for (const p of players) {
      // Find player by name or slug
      const lastName = p.name.split(' ').slice(-1)[0];
      const { rows } = await client.query(
        `SELECT id, name, position FROM fantasy_fc_players WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 1`,
        [`%${p.name}%`, `%${lastName}%`]
      );
      if (!rows.length) { notFound++; continue; }
      const player = rows[0];

      // Upsert earned upgrade badges into fantasy_fc_upgrades
      for (const badge of p.upgrades) {
        await client.query(`
          INSERT INTO fantasy_fc_upgrades (player_id, upgrade_type, earned_date, tier)
          VALUES ($1, $2, CURRENT_DATE, 1)
          ON CONFLICT (player_id, upgrade_type, tier) DO NOTHING
        `, [player.id, badge]);
      }
      updated++;
    }
  } finally {
    client.release();
  }

  console.log(`✅ Done: ${updated} updated, ${notFound} not found in DB`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
