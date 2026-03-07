// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}

async function handler(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also accept as query param
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    if (secretParam !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results = {
    timestamp: new Date().toISOString(),
    playersChecked: 0,
    matchesAdded: 0,
    upgradesDetected: 0,
    errors: [] as string[],
  }

  try {
    // Get all players
    const players = await prisma.fantasy_fc_players.findMany({
      include: { fantasy_fc_player_stats: true },
    })
    results.playersChecked = players.length

    // TODO: Implement actual SofaScore scraping
    // For now, just return the status
    // This will be implemented in Phase 3

    // Send Discord notification if webhook is configured
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: [
              `⚽ **Fantasy FC Update** — ${new Date().toLocaleDateString('en-US', { 
                month: 'long', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' 
              })} PT`,
              ``,
              `📊 **Status:**`,
              `• Players tracked: ${results.playersChecked}`,
              `• Matches added: ${results.matchesAdded}`,
              `• Upgrades detected: ${results.upgradesDetected}`,
            ].join('\n'),
          }),
        })
      } catch (e) {
        results.errors.push(`Discord webhook failed: ${e}`)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Cron scrape error:', error)
    return NextResponse.json({ 
      error: 'Scrape failed', 
      details: String(error),
      ...results 
    }, { status: 500 })
  }
}
