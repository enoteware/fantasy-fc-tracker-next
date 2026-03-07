// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
})

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
          take: 10,
        },
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Get upcoming fixtures for this player's club
    const fixtures = await prisma.fantasy_fc_upcoming_fixtures.findMany({
      where: { club: player.club },
      orderBy: { match_date: 'asc' },
      take: 5,
    })

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recent_matches: player.fantasy_fc_player_matches.map((pm: any) => ({
        ...pm,
        match: pm.fantasy_fc_matches,
      })),
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
