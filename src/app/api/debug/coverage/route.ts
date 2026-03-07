// @ts-nocheck
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const players = await prisma.fantasy_fc_players.findMany({
      select: { id: true, name: true, club: true, team: true, card_type: true },
      orderBy: { name: 'asc' },
    })

    // Players with match data
    const playersWithMatches = await prisma.$queryRaw`
      SELECT DISTINCT player_id FROM fantasy_fc_player_matches
    ` as Array<{ player_id: number }>
    const withMatchSet = new Set(playersWithMatches.map(r => r.player_id))

    // Players with upcoming fixtures (by club)
    const clubs = [...new Set(players.map((p: { id: number; name: string; club: string; team: number | null; card_type: string | null }) => p.club))]
    const fixtureClubs = await prisma.$queryRaw`
      SELECT DISTINCT club FROM fantasy_fc_upcoming_fixtures
    ` as Array<{ club: string }>
    const fixtureClubSet = new Set(fixtureClubs.map(r => r.club))

    const withoutMatchData: string[] = []
    const withoutCardImage: string[] = []
    const withoutFixtures: string[] = []
    let withMatchData = 0
    let withCardImage = 0
    let withFixtures = 0

    for (const p of players) {
      const hasMatch = withMatchSet.has(p.id)
      const hasCard = !!getCardImage(p.name)
      const hasFixture = fixtureClubSet.has(p.club)

      if (hasMatch) withMatchData++
      else withoutMatchData.push(`${p.name} (${p.club})`)

      if (hasCard) withCardImage++
      else withoutCardImage.push(`${p.name} (${p.club})`)

      if (hasFixture) withFixtures++
      else withoutFixtures.push(`${p.name} (${p.club})`)
    }

    return NextResponse.json({
      totalPlayers: players.length,
      byTeam: {
        team1: players.filter(p => p.team === 1).length,
        team2: players.filter(p => p.team === 2).length,
        sbc: players.filter(p => p.team === 0 && p.card_type === 'SBC').length,
        obj: players.filter(p => p.team === 0 && p.card_type === 'OBJ').length,
      },
      withMatchData,
      withoutMatchData,
      withCardImage,
      withoutCardImage,
      withFixtures,
      withoutFixtures,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
