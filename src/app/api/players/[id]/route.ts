// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
})

// Keywords that indicate non-league competitions to exclude
const EXCLUDE_COMPETITION_KEYWORDS = [
  'cup', 'copa', 'coppa', 'coupe', 'taca', 'taça', 'pokal', 'supercup', 'super cup',
  'champions league', 'europa league', 'conference league', 'world cup',
  'friendly', 'international', 'knockout', 'playoff', 'play-off',
  'nations league', 'continental',
]

function isLeagueMatch(league: string | null, competition?: string | null): boolean {
  const check = ((league ?? '') + ' ' + (competition ?? '')).toLowerCase()
  return !EXCLUDE_COMPETITION_KEYWORDS.some(kw => check.includes(kw))
}

// Club name aliases — match.club may use different spelling than player.club
const CLUB_ALIASES: Record<string, string[]> = {
  'Ajax': ['AFC Ajax'],
  'Al Ahli': ['Al-Ahli'],
  'Barcelona': ['FC Barcelona'],
  'Bayer Leverkusen': ['Bayer 04 Leverkusen'],
  'Bayern Munich (W)': ['FC Bayern München', 'Bayern München'],
  'C.D. Nacional': ['CD Nacional'],
  'Lyon': ['Olympique Lyonnais', 'OL'],
  'Manchester United': ['Manchester Utd'],
  'OM': ['Olympique de Marseille'],
  'Paris SG': ['Paris Saint-Germain'],
  'SL Benfica': ['Benfica'],
  'Spurs': ['Tottenham Hotspur'],
}

function sameClub(playerClub: string, matchClub: string): boolean {
  if (playerClub === matchClub) return true
  const aliases = CLUB_ALIASES[playerClub] ?? []
  return aliases.some(a => a.toLowerCase() === matchClub.toLowerCase())
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
      include: {
        fantasy_fc_player_stats: true,
        fantasy_fc_upgrades: {
          orderBy: { earned_date: 'desc' },
        },
        fantasy_fc_player_matches: {
          include: {
            fantasy_fc_matches: true,
          },
          orderBy: { id: 'desc' },
          take: 20, // fetch more, filter below
        },
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Get upcoming fixtures, then filter to league-only
    const allFixtures = await prisma.fantasy_fc_upcoming_fixtures.findMany({
      where: { club: player.club },
      orderBy: { match_date: 'asc' },
      take: 10,
    })
    const fixtures = allFixtures.filter(f => isLeagueMatch(f.league, f.competition)).slice(0, 5)

    // Filter matches to league-only and fix perspective when club names differ
    const recent_matches = player.fantasy_fc_player_matches
      .filter(pm => {
        const m = pm.fantasy_fc_matches
        if (!m) return false
        return isLeagueMatch(m.league)
      })
      .map(pm => {
        const m = pm.fantasy_fc_matches
        // If the match record is from the opponent's perspective, flip it
        if (m && !sameClub(player.club, m.club)) {
          return {
            ...pm,
            match: {
              ...m,
              club: player.club,
              opponent: m.club,
              score_for: m.score_against,
              score_against: m.score_for,
              result: m.result === 'win' ? 'loss' : m.result === 'loss' ? 'win' : 'draw',
            }
          }
        }
        return { ...pm, match: m }
      })
      .slice(0, 10)

    return NextResponse.json({
      id: player.id,
      name: player.name,
      club: player.club,
      league: player.league,
      position: player.position,
      base_rating: player.base_rating,
      current_rating: player.current_rating,
      team: player.team,
      upgrades_applied: player.upgrades_applied ?? 0,
      card_image: getCardImage(player.name),
      stats: player.fantasy_fc_player_stats,
      upgrades: player.fantasy_fc_upgrades,
      recent_matches,
      upcoming_fixtures: fixtures,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }
    console.error('Player detail API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
