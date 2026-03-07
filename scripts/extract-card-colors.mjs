/**
 * extract-card-colors.mjs
 * 
 * Extracts dominant palette colors from every player's FC card image
 * (base64 in fantasy-cards.json) using node-vibrant.
 * 
 * Writes results to scripts/card-colors.json AND updates the DB columns:
 *   card_color_primary   — DarkVibrant hex (bg gradient top)
 *   card_color_secondary — DarkMuted hex   (bg gradient bottom)
 *   card_color_accent    — Vibrant hex     (glow color)
 */

import { Vibrant } from 'node-vibrant/node'
import sharp from 'sharp'
import { neon } from '@neondatabase/serverless'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB = 'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require'
const sql = neon(DB)

const CARDS_JSON = join(__dirname, '../src/data/fantasy-cards.json')
const COLORS_JSON = join(__dirname, 'card-colors.json')

// Load existing colors if any (so we can resume)
let existingColors = {}
if (existsSync(COLORS_JSON)) {
  existingColors = JSON.parse(readFileSync(COLORS_JSON, 'utf8'))
  console.log(`📦 Loaded ${Object.keys(existingColors).length} existing color entries\n`)
}

// Load cards
const cards = JSON.parse(readFileSync(CARDS_JSON, 'utf8'))
const playerNames = Object.keys(cards)
console.log(`🎨 Extracting colors for ${playerNames.length} players...\n`)

/**
 * Extract palette from a base64 data URL using node-vibrant
 * webp images are converted to PNG via sharp first (node-vibrant doesn't support webp)
 */
async function extractColors(base64DataUrl) {
  // Strip the data:image/webp;base64, prefix
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '')
  let buffer = Buffer.from(base64, 'base64')

  // Convert webp → PNG so node-vibrant can process it
  if (base64DataUrl.startsWith('data:image/webp')) {
    buffer = await sharp(buffer).png().toBuffer()
  }
  
  const palette = await Vibrant.from(buffer).getPalette()
  
  // Priority order for primary/background: DarkVibrant > DarkMuted > Muted
  const primary = palette.DarkVibrant?.hex 
    ?? palette.DarkMuted?.hex 
    ?? palette.Muted?.hex
    ?? '#1a1a1a'
  
  // Secondary: DarkMuted or second darkest
  const secondary = palette.DarkMuted?.hex 
    ?? palette.Muted?.hex 
    ?? palette.DarkVibrant?.hex
    ?? '#0f0f0f'
  
  // Accent/glow: Vibrant (bright, saturated)
  const accent = palette.Vibrant?.hex 
    ?? palette.LightVibrant?.hex 
    ?? palette.LightMuted?.hex
    ?? '#4a90d9'

  return { primary, secondary, accent }
}

// Get all players from DB to map name → id
const dbPlayers = await sql`SELECT id, name, card_color_primary FROM fantasy_fc_players ORDER BY name`
const nameToId = {}
for (const p of dbPlayers) {
  nameToId[p.name.toLowerCase().trim()] = p.id
}

const results = { ok: 0, skip: 0, fail: 0 }
const colorMap = { ...existingColors }

for (const [playerKey, base64] of Object.entries(cards)) {
  // Skip if already done
  if (existingColors[playerKey]) {
    results.skip++
    continue
  }

  process.stdout.write(`  ${playerKey}... `)
  
  try {
    const colors = await extractColors(base64)
    colorMap[playerKey] = colors

    // Find DB player id
    const playerId = nameToId[playerKey]
    if (playerId) {
      await sql`
        UPDATE fantasy_fc_players SET
          card_color_primary   = ${colors.primary},
          card_color_secondary = ${colors.secondary},
          card_color_accent    = ${colors.accent}
        WHERE id = ${playerId}
      `
    }

    console.log(`✓ primary:${colors.primary} accent:${colors.accent}${!playerId ? ' (no DB match)' : ''}`)
    results.ok++
  } catch (e) {
    console.log(`✗ ${e.message}`)
    results.fail++
    // Store fallback
    colorMap[playerKey] = { primary: '#1a1a1a', secondary: '#0f0f0f', accent: '#4a90d9' }
  }

  // Save progress every 10 players
  if ((results.ok + results.fail) % 10 === 0) {
    writeFileSync(COLORS_JSON, JSON.stringify(colorMap, null, 2))
  }
}

// Final save
writeFileSync(COLORS_JSON, JSON.stringify(colorMap, null, 2))

console.log(`\n📊 Results:`)
console.log(`  ✓ Processed: ${results.ok}`)
console.log(`  ⏭ Skipped (cached): ${results.skip}`)
console.log(`  ✗ Failed: ${results.fail}`)
console.log(`\n💾 Saved to ${COLORS_JSON}`)
console.log(`📋 DB updated for ${Object.keys(nameToId).length} matched players`)
