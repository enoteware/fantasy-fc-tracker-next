// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
})

const EXCLUDE_COMPETITION_KEYWORDS = [
  'cup', 'copa', 'coppa', 'coupe', 'taca', 'taça', 'pokal', 'supercup', 'super cup',
  'champions league', 'europa league', 'conference league', 'world cup',
  'friendly', 'international', 'knockout', 'playoff', 'play-off',
  'nations league', 'continental',
]

function isLeagueFixture(league: string | null, competition: string | null): boolean {
  const check = ((league ?? '') + ' ' + (competition ?? '')).toLowerCase()
  return !EXCLUDE_COMPETITION_KEYWORDS.some(kw => check.includes(kw))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params)
    const playerId = parseInt(id)

    const player = await prisma.fantasy_fc_players.findUnique({
      where: { id: playerId },
      select: { club: true },
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const allFixtures = await prisma.fantasy_fc_upcoming_fixtures.findMany({
      where: { club: player.club },
      orderBy: { match_date: 'asc' },
      take: 10,
    })

    // Filter to league-only competitions
    const fixtures = allFixtures
      .filter(f => isLeagueFixture(f.league, f.competition))
      .slice(0, 5)

    return NextResponse.json(fixtures)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }
    console.error('Player fixtures API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
