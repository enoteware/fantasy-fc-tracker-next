// @ts-nocheck
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'
import { PlayerGrid } from '@/components/PlayerGrid'

export const dynamic = 'force-dynamic'

async function getPlayers() {
  const players = await prisma.fantasy_fc_players.findMany({
    orderBy: { current_rating: 'desc' },
    include: {
      fantasy_fc_player_stats: true,
      fantasy_fc_upgrades: {
        orderBy: { earned_date: 'desc' },
        take: 3,
      },
    },
  })

  // Get recent matches for all clubs
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

  return players.map(player => ({
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
}

export default async function DashboardPage() {
  const players = await getPlayers()
  
  const team1Count = players.filter(p => p.team === 1).length
  const team2Count = players.filter(p => p.team === 2).length
  const totalUpgrades = players.reduce((sum, p) => sum + (p.upgrades_applied ?? 0), 0)
  
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FC</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">Fantasy FC Tracker</h1>
                <p className="text-white/30 text-xs mt-0.5">EA FC 25 Ultimate Team</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-white/40">
              <div className="hidden sm:flex items-center gap-4">
                <span>{players.length} players</span>
                <span>{totalUpgrades} upgrades</span>
              </div>
              <div className="text-xs text-white/20">
                Updates 8am & 8pm PT
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-white/5 bg-[#111]">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex gap-6 text-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-white/60 shrink-0">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="text-white">{team1Count}</span> Team 1 players
            </div>
            <div className="flex items-center gap-2 text-white/60 shrink-0">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span className="text-white">{team2Count}</span> Team 2 players
            </div>
            <div className="flex items-center gap-2 text-white/60 shrink-0">
              <span>⚡</span>
              <span className="text-white">{totalUpgrades}</span> total upgrades applied
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        <PlayerGrid players={players} />
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-[1600px] mx-auto px-4 py-4 text-center text-white/20 text-xs">
          Fantasy FC Tracker · Data updates 2x daily · Not affiliated with EA Sports
        </div>
      </footer>
    </div>
  )
}
