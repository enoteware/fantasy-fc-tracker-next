// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

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

    const stats = await prisma.fantasy_fc_player_stats.findUnique({
      where: { player_id: playerId },
    })

    if (!stats) {
      return NextResponse.json({
        player_id: playerId,
        goals: 0,
        assists: 0,
        clean_sheets: 0,
        attacking_actions: 0,
        defensive_actions: 0,
        upgrade_goal_assist_earned: false,
        upgrade_actions_earned: false,
        upgrade_goal_assist_applied: false,
        upgrade_actions_applied: false,
      })
    }

    return NextResponse.json(stats)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }
    console.error('Player stats API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
