/**
 * add-sbc-obj-players.mjs
 * 
 * 1. Fetches FUT.GG og:image URLs for all SBC/OBJ Fantasy FC players
 * 2. Downloads card webp images
 * 3. Converts to base64 and adds to fantasy-cards.json
 * 4. Inserts player rows into DB
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB = 'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require'
const sql = neon(DB)

const CARDS_JSON = join(__dirname, '../src/data/fantasy-cards.json')

// All SBC/OBJ Fantasy FC players with known data
// eaId = EA's internal player ID (used in FUT.GG URLs)
// format: slug = futgg URL slug (number-name)
const SBC_OBJ_PLAYERS = [
  // ── HEROES (is_hero=true) ──────────────────────────────────────────
  { name: 'Diego Forlán',      club: 'HERO',         league: null,              position: 'CAM', rating: 91, isHero: true,  cardType: 'SBC', futggSlug: '20801-diego-forlan' },
  { name: 'Gervinho',          club: 'HERO',         league: null,              position: 'RW',  rating: 90, isHero: true,  cardType: 'SBC', futggSlug: '170733-gervinho' },
  { name: 'Víctor Ibarbo',     club: 'HERO',         league: null,              position: 'RW',  rating: 91, isHero: true,  cardType: 'OBJ', futggSlug: '204550-victor-ibarbo' },

  // ── SBC PLAYERS ────────────────────────────────────────────────────
  { name: 'João Cancelo',      club: 'FC Barcelona', league: 'La Liga',         position: 'RB',  rating: 90, isHero: false, cardType: 'SBC', futggSlug: '210514-joao-cancelo' },
  { name: 'Raheem Sterling',   club: 'Feyenoord',    league: 'Eredivisie',      position: 'LW',  rating: 89, isHero: false, cardType: 'SBC', futggSlug: '202652-raheem-sterling' },
  { name: 'Matteo Ruggeri',    club: 'Atalanta',     league: 'Serie A',         position: 'LB',  rating: 89, isHero: false, cardType: 'SBC', futggSlug: '250862-matteo-ruggeri' },
  { name: 'Kalidou Koulibaly', club: 'Al Hilal',     league: 'Saudi Pro League',position: 'CB',  rating: 88, isHero: false, cardType: 'SBC', futggSlug: '200751-kalidou-koulibaly' },
  { name: 'Waldemar Anton',    club: 'Borussia Dortmund', league: 'Bundesliga', position: 'CB',  rating: 89, isHero: false, cardType: 'SBC', futggSlug: '229476-waldemar-anton' },
  { name: 'Tyrique George',    club: 'Everton',      league: 'Premier League',  position: 'LM',  rating: 88, isHero: false, cardType: 'SBC', futggSlug: '71998-tyrique-george' },
  { name: 'Sheraldo Becker',   club: '1. FSV Mainz 05', league: 'Bundesliga',  position: 'ST',  rating: 88, isHero: false, cardType: 'SBC', futggSlug: '223790-sheraldo-becker' },
  { name: 'Joey Veerman',      club: 'PSV',          league: 'Eredivisie',      position: 'CM',  rating: 88, isHero: false, cardType: 'SBC', futggSlug: '253220-joey-veerman' },
  { name: 'Sam Coffey',        club: 'Portland Thorns (W)', league: 'NWSL',    position: 'CM',  rating: 88, isHero: false, cardType: 'SBC', futggSlug: '267217-sam-coffey' },
  { name: 'Niclas Füllkrug',   club: 'AC Milan',     league: 'Serie A',         position: 'ST',  rating: 88, isHero: false, cardType: 'SBC', futggSlug: '205431-niclas-fullkrug' },
  { name: 'Orkun Kökçü',       club: 'SL Benfica',   league: 'Primeira Liga',   position: 'CAM', rating: 88, isHero: false, cardType: 'SBC', futggSlug: '242527-orkun-kokcu' },
  { name: 'Gianluca Scamacca', club: 'Atalanta',     league: 'Serie A',         position: 'ST',  rating: 87, isHero: false, cardType: 'SBC', futggSlug: '240026-gianluca-scamacca' },
  { name: 'Sandie Toletti',    club: 'Real Madrid (W)', league: 'Liga F',       position: 'CM',  rating: 87, isHero: false, cardType: 'SBC', futggSlug: '262185-sandie-toletti' },

  // ── OBJECTIVES PLAYERS ─────────────────────────────────────────────
  { name: 'Odsonne Édouard',   club: 'Crystal Palace','league': 'Premier League',position: 'ST', rating: 88, isHero: false, cardType: 'OBJ', futggSlug: '241306-odsonne-edouard' },
  { name: 'Nelson Deossa',     club: 'Real Betis',   league: 'La Liga',         position: 'CM',  rating: 87, isHero: false, cardType: 'OBJ', futggSlug: '267430-nelson-deossa' },
  { name: 'Medina Dešić',      club: 'FC Basel',     league: 'Super League',    position: 'GK',  rating: 87, isHero: false, cardType: 'OBJ', futggSlug: '261963-medina-desic' },
  { name: 'Luis Henrique',     club: 'OM',           league: 'Ligue 1',         position: 'RM',  rating: 87, isHero: false, cardType: 'OBJ', futggSlug: '256632-luis-henrique' },
  { name: 'Hidemasa Morita',   club: 'Sporting CP',  league: 'Primeira Liga',   position: 'CM',  rating: 87, isHero: false, cardType: 'OBJ', futggSlug: '256416-hidemasa-morita' },
]

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchWithUA(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.fut.gg/' } })
  return r
}

async function getCardUrl(futggSlug) {
  try {
    const url = `https://www.fut.gg/players/${futggSlug}/`
    const res = await fetchWithUA(url)
    const html = await res.text()
    const match = html.match(/"og:image" content="([^"]+)"/)
    if (match) return match[1]
    // Also try property= format
    const match2 = html.match(/property="og:image" content="([^"]+)"/)
    if (match2) return match2[1]
    return null
  } catch (e) {
    return null
  }
}

async function downloadCardAsBase64(imageUrl) {
  try {
    // Use higher quality version
    const hqUrl = imageUrl.replace('player-item-social-small', 'player-item')
                          .replace('quality=85,format=auto', 'quality=85,format=auto,width=400')
    const res = await fetchWithUA(hqUrl)
    if (!res.ok) {
      // Fall back to original
      const res2 = await fetchWithUA(imageUrl)
      if (!res2.ok) return null
      const buf = await res2.arrayBuffer()
      return 'data:image/webp;base64,' + Buffer.from(buf).toString('base64')
    }
    const buf = await res.arrayBuffer()
    return 'data:image/webp;base64,' + Buffer.from(buf).toString('base64')
  } catch (e) {
    return null
  }
}

async function insertPlayer(p) {
  try {
    await sql`
      INSERT INTO fantasy_fc_players 
        (name, club, league, position, base_rating, current_rating, is_hero, card_type, team, release_date)
      VALUES 
        (${p.name}, ${p.club}, ${p.league}, ${p.position}, ${p.rating}, ${p.rating},
         ${p.isHero}, ${p.cardType}, 0, '2026-02-20'::date)
      ON CONFLICT (name, club) DO UPDATE SET
        card_type = EXCLUDED.card_type,
        team = 0,
        is_hero = EXCLUDED.is_hero,
        league = EXCLUDED.league,
        current_rating = EXCLUDED.current_rating
    `
    return true
  } catch (e) {
    console.error(`  ✗ DB error for ${p.name}:`, e.message)
    return false
  }
}

async function main() {
  console.log('🚀 Adding SBC/OBJ Fantasy FC players...\n')
  
  // Load existing cards JSON
  let cards = {}
  if (existsSync(CARDS_JSON)) {
    cards = JSON.parse(readFileSync(CARDS_JSON, 'utf8'))
    console.log(`📦 Existing cards JSON: ${Object.keys(cards).length} entries\n`)
  }

  const results = { dbOk: 0, dbFail: 0, cardOk: 0, cardFail: 0 }
  const cardUpdates = {}

  for (const player of SBC_OBJ_PLAYERS) {
    process.stdout.write(`Processing ${player.name}...`)
    
    // 1. Insert into DB
    const dbOk = await insertPlayer(player)
    if (dbOk) results.dbOk++
    else results.dbFail++

    // 2. Fetch card image
    const cardKey = player.name.toLowerCase().trim()
    if (cards[cardKey]) {
      process.stdout.write(` DB:${dbOk?'✓':'✗'} Card:already_exists\n`)
      continue
    }

    const cardUrl = await getCardUrl(player.futggSlug)
    if (!cardUrl) {
      process.stdout.write(` DB:${dbOk?'✓':'✗'} Card:no_url\n`)
      results.cardFail++
      continue
    }

    const base64 = await downloadCardAsBase64(cardUrl)
    if (!base64) {
      process.stdout.write(` DB:${dbOk?'✓':'✗'} Card:download_fail\n`)
      results.cardFail++
      continue
    }

    cardUpdates[cardKey] = base64
    results.cardOk++
    process.stdout.write(` DB:${dbOk?'✓':'✗'} Card:✓ (${Math.round(base64.length/1024)}KB)\n`)

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  // Also try Kristin Kögel (missing card but in DB already)
  const kogelKey = 'kristin kogel'
  if (!cards[kogelKey]) {
    process.stdout.write(`Processing Kristin Kögel (card only)...`)
    const cardUrl = await getCardUrl('264988-kristin-kogel')
    if (cardUrl) {
      const base64 = await downloadCardAsBase64(cardUrl)
      if (base64) {
        cardUpdates[kogelKey] = base64
        // Also try alternate spelling
        cardUpdates['kristin kögel'] = base64
        results.cardOk++
        process.stdout.write(` Card:✓ (${Math.round(base64.length/1024)}KB)\n`)
      } else {
        process.stdout.write(` Card:download_fail\n`)
        results.cardFail++
      }
    } else {
      process.stdout.write(` Card:no_url\n`)
      results.cardFail++
    }
  }

  // Save updated cards JSON
  if (Object.keys(cardUpdates).length > 0) {
    const updated = { ...cards, ...cardUpdates }
    writeFileSync(CARDS_JSON, JSON.stringify(updated, null, 0))
    console.log(`\n💾 Saved ${Object.keys(cardUpdates).length} new cards to fantasy-cards.json`)
    console.log(`   Total entries now: ${Object.keys(updated).length}`)
  }

  console.log('\n📊 Results:')
  console.log(`  DB inserts: ${results.dbOk} ok, ${results.dbFail} failed`)
  console.log(`  Card downloads: ${results.cardOk} ok, ${results.cardFail} failed`)

  // Verify DB state
  const counts = await sql`SELECT team, card_type, COUNT(*) as count FROM fantasy_fc_players GROUP BY team, card_type ORDER BY team, card_type`
  console.log('\n📋 DB player counts:')
  counts.forEach(r => console.log(`  Team ${r.team} | ${r.card_type || 'standard'}: ${r.count}`))
  const total = await sql`SELECT COUNT(*) as total FROM fantasy_fc_players`
  console.log(`  TOTAL: ${total[0].total}`)
}

main().catch(console.error)
