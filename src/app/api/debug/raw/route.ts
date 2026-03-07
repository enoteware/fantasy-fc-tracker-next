import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [players, matches, playerMatches, stats, fixtures, upgrades] = await Promise.all([
      prisma.fantasy_fc_players.findMany({ take: 5, orderBy: { id: 'desc' }, select: { id: true, name: true, club: true, position: true, base_rating: true, current_rating: true, team: true, card_type: true, is_hero: true, league: true } }),
      prisma.fantasy_fc_matches.findMany({ take: 5, orderBy: { id: 'desc' } }),
      prisma.fantasy_fc_player_matches.findMany({ take: 5, orderBy: { id: 'desc' }, include: { fantasy_fc_players: { select: { name: true } }, fantasy_fc_matches: { select: { club: true, opponent: true, match_date: true, result: true } } } }),
      prisma.fantasy_fc_player_stats.findMany({ take: 5, orderBy: { id: 'desc' }, include: { fantasy_fc_players: { select: { name: true } } } }),
      prisma.fantasy_fc_upcoming_fixtures.findMany({ take: 5, orderBy: { match_date: 'asc' } }),
      prisma.fantasy_fc_upgrades.findMany({ take: 5, orderBy: { id: 'desc' }, include: { fantasy_fc_players: { select: { name: true } } } }),
    ])

    return NextResponse.json({
      fantasy_fc_players: players,
      fantasy_fc_matches: matches,
      fantasy_fc_player_matches: playerMatches,
      fantasy_fc_player_stats: stats,
      fantasy_fc_upcoming_fixtures: fixtures,
      fantasy_fc_upgrades: upgrades,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
