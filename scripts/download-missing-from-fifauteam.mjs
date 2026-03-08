/**
 * Download 23 missing Fantasy FC card images from fifauteam.com
 * and add to fantasy-cards-mapped.json in both repos.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE = 'https://fifauteam.com';
const IMAGES_DIR = '/Users/elliot/code/fc_planner/fantasy-fc-tracker/images/fantasy-cards';
const LEGACY_JSON = '/Users/elliot/code/fc_planner/fantasy-fc-tracker/scripts/fantasy-cards-mapped.json';
const NEXT_JSON = '/Users/elliot/code/fc_planner/fantasy-fc-tracker-next/scripts/fantasy-cards-mapped.json';

// Map: normalizedKey -> fifauteam image path (base rating card)
const MISSING_PLAYERS = [
  { key: 'diego forlan',      path: '/images/items/heroes/fc26/items/forlan-91.webp' },
  { key: 'gervinho',          path: '/images/items/heroes/fc26/items/gervinho-89.webp' },
  { key: 'victor ibarbo',     path: '/images/items/heroes/fc26/items/ibarbo-91.webp' },
  { key: 'joao cancelo',      path: '/images/events/fantasyfut/fc26/items/cancelo-89.webp' },
  { key: 'raheem sterling',   path: '/images/events/fantasyfut/fc26/items/sterling-89.webp' },
  { key: 'matteo ruggeri',    path: '/images/events/fantasyfut/fc26/items/ruggeri-89.webp' },
  { key: 'kalidou koulibaly', path: '/images/events/fantasyfut/fc26/items/koulibaly-88.webp' },
  { key: 'waldemar anton',    path: '/images/events/fantasyfut/fc26/items/anton-88.webp' },
  { key: 'tyrique george',    path: '/images/events/fantasyfut/fc26/items/george-88.webp' },
  { key: 'sheraldo becker',   path: '/images/events/fantasyfut/fc26/items/becker-88.webp' },
  { key: 'joey veerman',      path: '/images/events/fantasyfut/fc26/items/veerman-88.webp' },
  { key: 'sam coffey',        path: '/images/events/fantasyfut/fc26/items/coffey-88.webp' },
  { key: 'niclas fullkrug',   path: '/images/events/fantasyfut/fc26/items/fullkrug-88.webp' },
  { key: 'orkun kokcu',       path: '/images/events/fantasyfut/fc26/items/kokcu-88.webp' },
  { key: 'gianluca scamacca', path: '/images/events/fantasyfut/fc26/items/scamacca-87.webp' },
  { key: 'sandie toletti',    path: '/images/events/fantasyfut/fc26/items/toletti-87.webp' },
  { key: 'odsonne edouard',   path: '/images/events/fantasyfut/fc26/items/edouard-88.webp' },
  { key: 'nelson deossa',     path: '/images/events/fantasyfut/fc26/items/deossa-87.webp' },
  { key: 'medina desic',      path: '/images/events/fantasyfut/fc26/items/desic-87.webp' },
  { key: 'luis henrique',     path: '/images/events/fantasyfut/fc26/items/luishenrique-87.webp' },
  { key: 'hidemasa morita',   path: '/images/events/fantasyfut/fc26/items/morita-87.webp' },
  // T2 players that also appear missing
  { key: 'jorgen strand larsen', path: '/images/events/fantasyfut/fc26/items/larsen-88.webp' },
];

if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

const legacyCards = JSON.parse(readFileSync(LEGACY_JSON, 'utf8'));
const nextCards = JSON.parse(readFileSync(NEXT_JSON, 'utf8'));

let added = 0;
for (const { key, path } of MISSING_PLAYERS) {
  const url = BASE + path;
  const filename = key.replace(/\s+/g, '-') + '-fantasy.webp';
  const filePath = `${IMAGES_DIR}/${filename}`;

  process.stdout.write(`⬇️  ${key}... `);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://fifauteam.com/',
      }
    });
    if (!res.ok) { console.log(`❌ HTTP ${res.status}`); continue; }
    
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(filePath, buf);
    
    const b64 = 'data:image/webp;base64,' + buf.toString('base64');
    legacyCards[key] = b64;
    nextCards[key] = b64;
    added++;
    console.log(`✅ (${Math.round(buf.length/1024)}KB)`);
  } catch (e) {
    console.log(`❌ ${e.message}`);
  }
  
  await new Promise(r => setTimeout(r, 300));
}

writeFileSync(LEGACY_JSON, JSON.stringify(legacyCards, null, 2));
writeFileSync(NEXT_JSON, JSON.stringify(nextCards, null, 2));
console.log(`\n✅ Added ${added} cards. Legacy: ${Object.keys(legacyCards).length} | Next: ${Object.keys(nextCards).length} total`);
