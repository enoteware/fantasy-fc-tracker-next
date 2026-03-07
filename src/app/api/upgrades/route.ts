// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  since: z.string().optional().default('7d'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { since } = querySchema.parse(Object.fromEntries(searchParams))

    const now = new Date()
    let startDate = new Date(now)
    
    if (since === '24h') startDate.setHours(now.getHours() - 24)
    else if (since === '7d') startDate.setDate(now.getDate() - 7)
    else if (since === '30d') startDate.setDate(now.getDate() - 30)
    else startDate = new Date('2026-01-01')

    const upgrades = await prisma.fantasy_fc_upgrades.findMany({
      where: {
        earned_date: { gte: startDate },
      },
      include: {
        fantasy_fc_players: {
          select: { id: true, name: true, club: true, position: true, team: true },
        },
      },
      orderBy: { earned_date: 'desc' },
      take: 50,
    })

    return NextResponse.json(upgrades.map(u => ({
      id: u.id,
      upgrade_type: u.upgrade_type,
      tier: u.tier,
      ovr_boost: u.ovr_boost,
      stat_boost: u.stat_boost,
      playstyle_boost: u.playstyle_boost,
      earned_date: u.earned_date,
      applied: u.applied,
      player: u.fantasy_fc_players,
    })))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.issues }, { status: 400 })
    }
    console.error('Upgrades API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
