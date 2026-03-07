// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'

const querySchema = z.object({
  team: z.string().optional(),
  league: z.string().optional(),
  position: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['rating', 'upgrades', 'name']).optional().default('rating'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))

    const where: Record<string, unknown> = {}
    
    if (query.team) where.team = parseInt(query.team)
    if (query.league) where.league = query.league
    if (query.position) where.position = query.position
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' }
    }

    const orderBy = query.sort === 'name' 
      ? { name: 'asc' as const }
      : query.sort === 'upgrades'
      ? { upgrades_applied: 'desc' as const }
      : { current_rating: 'desc' as const }

    const players = await prisma.fantasy_fc_players.findMany({
      where,
      orderBy,
      include: {
        fantasy_fc_player_stats: true,
        fantasy_fc_upgrades: {
          orderBy: { earned_date: 'desc' },
          take: 3,
        },
      },
    })

    // Get recent match results for each player's club
    const clubs = [...new Set(players.map(p => p.club))]
    const recentMatches = await prisma.fantasy_fc_matches.findMany({
      where: { club: { in: clubs } },
      orderBy: { match_date: 'desc' },
      take: clubs.length * 5,
    })

    // Build club -> last match map
    const clubLastMatch: Record<string, typeof recentMatches[0]> = {}
    for (const match of recentMatches) {
      if (!clubLastMatch[match.club]) {
        clubLastMatch[match.club] = match
      }
    }

    const enriched = players.map(player => ({
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
      stats: player.fantasy_fc_player_stats ? {
        goals: player.fantasy_fc_player_stats.goals ?? 0,
        assists: player.fantasy_fc_player_stats.assists ?? 0,
        clean_sheets: player.fantasy_fc_player_stats.clean_sheets ?? 0,
        attacking_actions: player.fantasy_fc_player_stats.attacking_actions ?? 0,
        defensive_actions: player.fantasy_fc_player_stats.defensive_actions ?? 0,
        upgrade_goal_assist_earned: player.fantasy_fc_player_stats.upgrade_goal_assist_earned ?? false,
        upgrade_actions_earned: player.fantasy_fc_player_stats.upgrade_actions_earned ?? false,
        upgrade_goal_assist_applied: player.fantasy_fc_player_stats.upgrade_goal_assist_applied ?? false,
        upgrade_actions_applied: player.fantasy_fc_player_stats.upgrade_actions_applied ?? false,
      } : null,
      recent_upgrades: player.fantasy_fc_upgrades.map(u => ({
        id: u.id,
        type: u.upgrade_type,
        tier: u.tier,
        ovr_boost: u.ovr_boost,
        earned_date: u.earned_date,
        applied: u.applied,
      })),
      last_match: clubLastMatch[player.club] ? {
        opponent: clubLastMatch[player.club].opponent,
        result: clubLastMatch[player.club].result,
        score_for: clubLastMatch[player.club].score_for,
        score_against: clubLastMatch[player.club].score_against,
        date: clubLastMatch[player.club].match_date,
      } : null,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.issues }, { status: 400 })
    }
    console.error('Players API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
