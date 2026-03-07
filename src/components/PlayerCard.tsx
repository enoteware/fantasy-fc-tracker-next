'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface Player {
  id: number
  name: string
  club: string
  league: string | null
  position: string
  base_rating: number
  current_rating: number
  team: number | null
  upgrades_applied: number
  card_image: string | null
  stats: {
    goals: number
    assists: number
    clean_sheets: number
    upgrade_goal_assist_earned: boolean
    upgrade_actions_earned: boolean
    upgrade_goal_assist_applied: boolean
    upgrade_actions_applied: boolean
  } | null
  recent_upgrades: Array<{
    id: number
    type: string
    ovr_boost: number | null
    earned_date: string | Date
    applied: boolean | null
  }>
  last_match: {
    opponent: string
    result: string | null
    score_for: number | null
    score_against: number | null
    date: string | Date
  } | null
}

function ResultBadge({ result, scoreFor, scoreAgainst }: {
  result: string | null
  scoreFor: number | null
  scoreAgainst: number | null
}) {
  if (!result) return null

  const colors = {
    win: 'bg-green-500/20 text-green-400 border-green-500/30',
    loss: 'bg-red-500/20 text-red-400 border-red-500/30',
    draw: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }

  const color = colors[result as keyof typeof colors] ?? colors.draw
  const label = result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D'

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${color}`}>
      {label} {scoreFor}-{scoreAgainst}
    </span>
  )
}

export function PlayerCard({ player }: { player: Player }) {
  const upgradeCount = player.upgrades_applied ?? 0
  const hasUpgrades = upgradeCount > 0

  return (
    <Link href={`/players/${player.id}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/5 hover:border-blue-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5">

        {/* Card Image — min 120px wide via aspect ratio + full-width container */}
        <div className="relative aspect-[2/3] bg-[#111] overflow-hidden">
          {player.card_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.card_image}
              alt={player.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xl sm:text-2xl font-bold text-white/30">
                  {player.position}
                </span>
              </div>
              <span className="text-white/20 text-xs">{player.name}</span>
            </div>
          )}

          {/* Rating Badge */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
            <div className="bg-black/70 backdrop-blur-sm text-white font-bold text-sm px-1.5 py-0.5 rounded-md">
              {player.current_rating}
            </div>
          </div>

          {/* Position Badge */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
            <div className="bg-blue-600/80 backdrop-blur-sm text-white font-bold text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded">
              {player.position}
            </div>
          </div>

          {/* Upgrade Badge */}
          {hasUpgrades && (
            <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2">
              <Badge className="bg-blue-500 text-white text-xs border-0 px-1.5 py-0">
                +{upgradeCount}
              </Badge>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
          <div>
            {/* Player name: 1 line, truncate */}
            <h3 className="text-white font-semibold text-xs sm:text-sm truncate leading-tight">{player.name}</h3>
            {/* Club always visible; league hidden on mobile */}
            <p className="text-white/40 text-xs truncate">{player.club}</p>
            {player.league && (
              <p className="hidden md:block text-white/25 text-xs truncate">{player.league}</p>
            )}
          </div>

          {/* Stats Row — bigger touch targets on mobile */}
          <div className="flex items-center justify-between min-h-[20px]">
            <div className="flex gap-2 text-xs text-white/60 font-medium">
              {player.stats && (
                <>
                  <span title="Goals" className="text-xs sm:text-[13px]">⚽{player.stats.goals}</span>
                  <span title="Assists" className="text-xs sm:text-[13px]">🅰️{player.stats.assists}</span>
                  {player.position === 'GK' && (
                    <span title="Clean Sheets" className="text-xs sm:text-[13px]">🧤{player.stats.clean_sheets}</span>
                  )}
                </>
              )}
            </div>
            {player.last_match && (
              <ResultBadge
                result={player.last_match.result}
                scoreFor={player.last_match.score_for}
                scoreAgainst={player.last_match.score_against}
              />
            )}
          </div>

          {/* Upgrade Indicators */}
          {player.stats && (player.stats.upgrade_goal_assist_earned || player.stats.upgrade_actions_earned) && (
            <div className="flex gap-1 flex-wrap">
              {player.stats.upgrade_goal_assist_earned && (
                <span className={`text-xs px-1.5 py-0.5 rounded border ${
                  player.stats.upgrade_goal_assist_applied
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  {player.stats.upgrade_goal_assist_applied ? '✓' : '⏳'} G/A
                </span>
              )}
              {player.stats.upgrade_actions_earned && (
                <span className={`text-xs px-1.5 py-0.5 rounded border ${
                  player.stats.upgrade_actions_applied
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  {player.stats.upgrade_actions_applied ? '✓' : '⏳'} ACT
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
