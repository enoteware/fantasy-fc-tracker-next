/**
 * fetch-missing-card-urls.mjs
 * Uses a headless browser (via playwright) to scrape FUT.GG card image URLs
 * for the 23 missing Fantasy FC players.
 * 
 * Requires: npm install playwright && npx playwright install chromium
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const MISSING = [
  { name: 'Diego Forlán',        search: 'forlan',          normalKey: 'diego forlan' },
  { name: 'Gervinho',            search: 'gervinho',        normalKey: 'gervinho' },
  { name: 'Gianluca Scamacca',   search: 'scamacca',        normalKey: 'gianluca scamacca' },
  { name: 'Hidemasa Morita',     search: 'morita',          normalKey: 'hidemasa morita' },
  { name: 'Joey Veerman',        search: 'veerman',         normalKey: 'joey veerman' },
  { name: 'João Cancelo',        search: 'cancelo',         normalKey: 'joao cancelo' },
  { name: 'Jørgen Strand Larsen',search: 'larsen',          normalKey: 'jorgen strand larsen' },
  { name: 'Kalidou Koulibaly',   search: 'koulibaly',       normalKey: 'kalidou koulibaly' },
  { name: 'Kristin Kogel',       search: 'kogel',           normalKey: 'kristin kogel' },
  { name: 'Luis Henrique',       search: 'luis henrique',   normalKey: 'luis henrique' },
  { name: 'Matteo Ruggeri',      search: 'ruggeri',         normalKey: 'matteo ruggeri' },
  { name: 'Medina Dešić',        search: 'desic',           normalKey: 'medina desic' },
  { name: 'Nelson Deossa',       search: 'deossa',          normalKey: 'nelson deossa' },
  { name: 'Niclas Füllkrug',     search: 'fullkrug',        normalKey: 'niclas fullkrug' },
  { name: 'Odsonne Édouard',     search: 'edouard',         normalKey: 'odsonne edouard' },
  { name: 'Orkun Kökçü',         search: 'kokcu',           normalKey: 'orkun kokcu' },
  { name: 'Raheem Sterling',     search: 'sterling',        normalKey: 'raheem sterling' },
  { name: 'Sam Coffey',          search: 'coffey',          normalKey: 'sam coffey' },
  { name: 'Sandie Toletti',      search: 'toletti',         normalKey: 'sandie toletti' },
  { name: 'Sheraldo Becker',     search: 'becker',          normalKey: 'sheraldo becker' },
  { name: 'Tyrique George',      search: 'tyrique george',  normalKey: 'tyrique george' },
  { name: 'Víctor Ibarbo',       search: 'ibarbo',          normalKey: 'victor ibarbo' },
  { name: 'Waldemar Anton',      search: 'waldemar anton',  normalKey: 'waldemar anton' },
];

const OUTPUT = './scripts/missing-card-urls.json';
const BASE_URL = 'https://www.fut.gg/players/?page=1&rarity_id=%5B135%2C111%5D&search=';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

const results = {};

for (const player of MISSING) {
  const url = BASE_URL + encodeURIComponent(player.search);
  console.log(`\n🔍 ${player.name}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    
    const cards = await page.evaluate(() => {
      return [...document.querySelectorAll('a[href*="/players/"]')]
        .map(a => ({
          href: a.href,
          img: a.querySelector('img[src*="futgg-player-item-card"]')?.src ||
               a.querySelector('img[src*="player-item"]')?.src
        }))
        .filter(x => x.img)
        .slice(0, 5);
    });
    
    if (cards.length > 0) {
      console.log(`  Found ${cards.length} cards:`);
      cards.forEach(c => console.log(`  - ${c.href.split('/').slice(-3,-1).join('/')} | ${c.img.slice(0,100)}`));
      results[player.normalKey] = { name: player.name, cards };
    } else {
      console.log(`  ❌ No cards found`);
      results[player.normalKey] = { name: player.name, cards: [] };
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    results[player.normalKey] = { name: player.name, error: e.message, cards: [] };
  }
  
  await page.waitForTimeout(500);
}

await browser.close();
writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
console.log(`\n✅ Saved to ${OUTPUT}`);
