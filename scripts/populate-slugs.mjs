import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require' });

// Fetch fifauteam page and extract name→slug mappings
const res = await fetch('https://fifauteam.com/fc-26-fantasy-tracker/', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html' }
});
const html = await res.text();

const playerImgPattern = /data-lazy-src="\/images\/players\/fc26\/([^"]+\.webp)"/g;
const positions = [];
let m;
while ((m = playerImgPattern.exec(html)) !== null) {
  positions.push({ idx: m.index, slug: m[1].replace('.webp', '') });
}

const slugMap = []; // [{name, slug}]
for (let i = 0; i < positions.length; i++) {
  const start = positions[i].idx;
  const end = positions[i+1]?.idx ?? html.length;
  const block = html.slice(start, end);
  const slug = positions[i].slug;
  const nameMatch = block.match(/<br>\s*([^<]+?)\s*<strong>([^<]+?)\s*<\/strong>/);
  if (!nameMatch) continue;
  const name = `${nameMatch[1].trim()} ${nameMatch[2].trim()}`.trim();
  slugMap.push({ name, slug });
}

// SBC/OBJ futgg slugs from script data
const futggSlugs = {
  'Diego Forlán': '20801-diego-forlan',
  'Gervinho': '170733-gervinho',
  'Víctor Ibarbo': '204550-victor-ibarbo',
  'João Cancelo': '210514-joao-cancelo',
  'Raheem Sterling': '202652-raheem-sterling',
  'Matteo Ruggeri': '250862-matteo-ruggeri',
  'Kalidou Koulibaly': '200751-kalidou-koulibaly',
  'Waldemar Anton': '229476-waldemar-anton',
  'Tyrique George': '71998-tyrique-george',
  'Sheraldo Becker': '223790-sheraldo-becker',
  'Joey Veerman': '253220-joey-veerman',
  'Sam Coffey': '267217-sam-coffey',
  'Niclas Füllkrug': '205431-niclas-fullkrug',
  'Orkun Kökçü': '242527-orkun-kokcu',
  'Gianluca Scamacca': '240026-gianluca-scamacca',
  'Sandie Toletti': '262185-sandie-toletti',
  "Odsonne Édouard": '241306-odsonne-edouard',
  'Nelson Deossa': '267430-nelson-deossa',
  'Medina Dešić': '261963-medina-desic',
  'Luis Henrique': '256632-luis-henrique',
  'Hidemasa Morita': '256416-hidemasa-morita',
};

const client = await pool.connect();
let updated = 0;

for (const { name, slug } of slugMap) {
  const lastName = name.split(' ').slice(-1)[0];
  const { rows } = await client.query(
    `SELECT id FROM fantasy_fc_players WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 1`,
    [`%${name}%`, `%${lastName}%`]
  );
  if (!rows.length) { console.log(`❓ ${name}`); continue; }

  const futggSlug = futggSlugs[name] ?? null;
  const eaId = futggSlug ? parseInt(futggSlug.split('-')[0]) : null;

  await client.query(
    `UPDATE fantasy_fc_players SET fifauteam_slug=$1, futgg_slug=$2, ea_id=$3 WHERE id=$4`,
    [slug, futggSlug, eaId, rows[0].id]
  );
  console.log(`✅ ${name} → fifauteam:${slug} futgg:${futggSlug ?? 'none'}`);
  updated++;
}

client.release();
await pool.end();
console.log(`\nDone: ${updated} updated`);
