// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db-pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FIFAUTEAM_URL = 'https://fifauteam.com/fc-26-fantasy-tracker/'
const UPGRADE_BADGES = new Set(['1G', '1A', 'AC', 'DC', 'BC', 'CS', '6P', 'TG'])
const TEAM_TAGS = new Set(['T1', 'T2', 'SBC', 'OBJ', 'PLO', 'FAN'])
const SKIP_TAGS = new Set(['PLO', 'FAN']) // FPL Live — not tracked

export async function GET(request: NextRequest) { return handler(request) }
export async function POST(request: NextRequest) { return handler(request) }

async function fetchFifauteam(): Promise<string> {
  const res = await fetch(FIFAUTEAM_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Referer': 'https://www.google.com/',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`fifauteam HTTP ${res.status}`)
  return res.text()
}

function parseHtml(html: string) {
  const players: Array<{
    slug: string
    name: string
    teamTag: string | null
    stats: { wins: number; teamGoals: number; contributions: number; defActions: number; ga: number; cs: number }
    upgrades: string[]
  }> = []

  const playerImgPattern = /data-lazy-src="\/images\/players\/fc26\/([^"]+\.webp)"/g
  const positions: Array<{ idx: number; slug: string }> = []
  let m: RegExpExecArray | null
  while ((m = playerImgPattern.exec(html)) !== null) {
    positions.push({ idx: m.index, slug: m[1].replace('.webp', '') })
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx
    const end = positions[i + 1]?.idx ?? html.length
    const block = html.slice(start, end)
    const slug = positions[i].slug

    const nameMatch = block.match(/<br>\s*([^<]+?)\s*<strong>([^<]+?)\s*<\/strong>/)
    if (!nameMatch) continue
    const name = `${nameMatch[1].trim()} ${nameMatch[2].trim()}`.trim()

    const stats = { wins: 0, teamGoals: 0, contributions: 0, defActions: 0, ga: 0, cs: 0 }
    const counterRe = /data-title="([^"]+)"[^>]*>(\d+)\/(\d+)<\/a>/g
    let cm: RegExpExecArray | null
    while ((cm = counterRe.exec(block)) !== null) {
      const [, title, cur] = cm
      const t = title.toLowerCase()
      const val = parseInt(cur)
      if (t.includes('points')) stats.wins = val
      else if (t.includes('goals') && !t.includes('assist')) stats.teamGoals = val
      else if (t.includes('contribution')) stats.contributions = val
      else if (t.includes('def')) stats.defActions = val
      else if (t.includes('goals/assist') || t.includes('assist')) stats.ga = val
      else if (t.includes('clean')) stats.cs = val
    }

    const noteRe = /<span class="promo-note">([^<]+)<\/span>/g
    const badges: string[] = []
    let nm: RegExpExecArray | null
    while ((nm = noteRe.exec(block)) !== null) {
      const note = nm[1].trim()
      if (UPGRADE_BADGES.has(note)) badges.push(note)
    }

    const allNotes = [...block.matchAll(/<span class="promo-note">([^<]+)<\/span>/g)].map(x => x[1].trim())
    const teamTag = allNotes.find(n => TEAM_TAGS.has(n)) ?? null

    if (teamTag && SKIP_TAGS.has(teamTag)) continue

    players.push({ slug, name, teamTag, stats, upgrades: [...new Set(badges)] })
  }

  return players
}

async function sendDiscordNotification(
  newUpgrades: Array<{ playerName: string; badges: string[] }>,
  summary: { checked: number; upgraded: number; errors: number }
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  const upgradeLines = newUpgrades.map(u =>
    `🔥 **${u.playerName}** earned: ${u.badges.join(', ')}`
  )

  const lines = [
    `⚽ **Fantasy FC Auto-Update** — ${new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles'
    })} PT`,
    '',
    ...(upgradeLines.length > 0 ? upgradeLines : ['No new upgrades detected.']),
    '',
    `📊 ${summary.checked} players checked · ${summary.upgraded} new upgrades · ${summary.errors} errors`,
    `🔗 https://fc.noteware.dev`,
  ]

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: lines.join('\n') }),
  })
}

async function handler(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const secretParam = new URL(request.url).searchParams.get('secret')
    if (secretParam !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results = {
    timestamp: new Date().toISOString(),
    playersChecked: 0,
    newUpgradesTotal: 0,
    errors: [] as string[],
  }

  const newUpgradesList: Array<{ playerName: string; badges: string[] }> = []

  const client = await pool.connect()
  try {
    // 1. Scrape fifauteam
    const html = await fetchFifauteam()
    const players = parseHtml(html)
    results.playersChecked = players.length

    // 2. For each player, look up in DB and upsert new upgrades
    for (const p of players) {
      try {
        const lastName = p.name.split(' ').slice(-1)[0]
        const { rows } = await client.query(
          `SELECT id, name FROM fantasy_fc_players WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 1`,
          [`%${p.name}%`, `%${lastName}%`]
        )
        if (!rows.length) continue

        const player = rows[0]
        const newBadges: string[] = []

        for (const badge of p.upgrades) {
          const insertResult = await client.query(
            `INSERT INTO fantasy_fc_upgrades (player_id, upgrade_type, earned_date, tier)
             VALUES ($1, $2, CURRENT_DATE, 1)
             ON CONFLICT (player_id, upgrade_type, tier) DO NOTHING
             RETURNING id`,
            [player.id, badge]
          )
          if ((insertResult.rowCount ?? 0) > 0) {
            newBadges.push(badge)
            results.newUpgradesTotal++
          }
        }

        if (newBadges.length > 0) {
          newUpgradesList.push({ playerName: player.name, badges: newBadges })
        }
      } catch (err) {
        results.errors.push(`${p.name}: ${String(err)}`)
      }
    }

    // 3. Discord notification
    await sendDiscordNotification(newUpgradesList, {
      checked: results.playersChecked,
      upgraded: results.newUpgradesTotal,
      errors: results.errors.length,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: String(error), ...results }, { status: 500 })
  } finally {
    client.release()
  }
}
