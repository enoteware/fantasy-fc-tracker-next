'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

// Position category helpers
function isDefOrGK(pos: string) {
  return ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)
}
function isFwdOrMid(pos: string) {
  return ['ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'CM', 'CAM', 'CDM', 'LM', 'RM'].includes(pos)
}

// Upgrade thresholds
const ATT_ACTIONS_THRESHOLD = 6
const DEF_ACTIONS_THRESHOLD = 12
const GAMES_WINDOW = 4

function getBorderStyle(
  position: string,
  gamesPlayed: number,
  goals: number,
  assists: number,
  cleanSheets: number,
  attackingActions: number,
  defensiveActions: number,
) {
  const defender = isDefOrGK(position)
  const actionsThreshold = defender ? DEF_ACTIONS_THRESHOLD : ATT_ACTIONS_THRESHOLD
  const relevantActions = defender ? defensiveActions : attackingActions

  const achievedGA = goals + assists >= 1
  const achievedCS = defender && cleanSheets >= 1
  const achievedActions = relevantActions >= actionsThreshold
  const achieved = achievedGA || achievedCS || achievedActions

  if (achieved) {
    return 'ring-2 ring-green-500 ring-offset-1 ring-offset-[#0f0f0f]'
  }
  if (gamesPlayed >= GAMES_WINDOW && !achieved) {
    return 'ring-2 ring-red-500 ring-offset-1 ring-offset-[#0f0f0f]'
  }
  return 'ring-1 ring-white/5'
}

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
  games_played: number
  stats: {
    goals: number
    assists: number
    clean_sheets: number
    attacking_actions: number
    defensive_actions: number
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

function GamesProgress({ gamesPlayed }: { gamesPlayed: number }) {
  const clamped = Math.min(gamesPlayed, GAMES_WINDOW)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: GAMES_WINDOW }).map((_, i) => (
        <span key={i} className={`text-[10px] ${i < clamped ? 'text-blue-400' : 'text-white/20'}`}>
          {i < clamped ? '■' : '□'}
        </span>
      ))}
      <span className="text-[10px] text-white/40 ml-1">{clamped}/{GAMES_WINDOW}</span>
    </div>
  )
}

export function PlayerCard({ player }: { player: Player }) {
  const upgradeCount = player.upgrades_applied ?? 0
  const hasUpgrades = upgradeCount > 0
  const gamesPlayed = player.games_played ?? 0
  const stats = player.stats
  const position = player.position
  const defender = isDefOrGK(position)

  const goals = stats?.goals ?? 0
  const assists = stats?.assists ?? 0
  const cleanSheets = stats?.clean_sheets ?? 0
  const attackingActions = stats?.attacking_actions ?? 0
  const defensiveActions = stats?.defensive_actions ?? 0

  const borderClass = getBorderStyle(
    position, gamesPlayed, goals, assists, cleanSheets, attackingActions, defensiveActions
  )

  // Progress text lines for card bottom
  const gaProgress = `${goals + assists}/1 G+A`
  const gaAchieved = goals + assists >= 1

  const actionsThreshold = defender ? DEF_ACTIONS_THRESHOLD : ATT_ACTIONS_THRESHOLD
  const relevantActions = defender ? defensiveActions : attackingActions
  const actionsLabel = defender ? '🛡️' : '⚡'
  const actionsProgress = `${relevantActions}/${actionsThreshold} ${actionsLabel}`
  const actionsAchieved = relevantActions >= actionsThreshold

  const csAchieved = defender && cleanSheets >= 1

  return (
    <Link href={`/players/${player.id}`} className="group block">
      <div className={`relative rounded-xl overflow-hidden bg-[#1a1a1a] hover:border-blue-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 ${borderClass}`}>

        {/* Card Image — min 120px wide via aspect ratio + full-width container */}
        <div className="relative aspect-[2/3] bg-gradient-to-b from-[#1e2a3a] to-[#111] overflow-hidden">
          {player.card_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.card_image}
              alt={player.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-blue-900/40 to-[#111]">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xl sm:text-2xl font-bold text-white/60">
                  {player.position}
                </span>
              </div>
              <span className="text-white/40 text-xs text-center px-2">{player.name}</span>
              {/* Fallback rating display */}
              <div className="text-white font-bold text-2xl">{player.current_rating}</div>
            </div>
          )}

          {/* Rating Badge */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
            <div className="bg-black/80 backdrop-blur-sm text-white font-bold text-sm px-1.5 py-0.5 rounded-md shadow-lg">
              {player.current_rating}
            </div>
          </div>

          {/* Position Badge */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
            <div className="bg-blue-600/90 backdrop-blur-sm text-white font-bold text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded shadow-lg">
              {player.position}
            </div>
          </div>

          {/* SBC / OBJ badge */}
          {player.team === 0 && (
            <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2">
              <Badge className="bg-yellow-500/90 text-black text-[9px] border-0 px-1 py-0 shadow-lg font-bold">
                SBC/OBJ
              </Badge>
            </div>
          )}

          {/* Upgrade Badge */}
          {hasUpgrades && (
            <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2">
              <Badge className="bg-blue-500 text-white text-xs border-0 px-1.5 py-0 shadow-lg">
                +{upgradeCount}
              </Badge>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="p-2 sm:p-3 space-y-1.5">
          <div>
            {/* Player name: 1 line, truncate */}
            <h3 className="text-white font-semibold text-xs sm:text-sm truncate leading-tight">{player.name}</h3>
            {/* Club always visible */}
            <p className="text-white/40 text-xs truncate">{player.club}</p>
          </div>

          {/* Games Progress */}
          <GamesProgress gamesPlayed={gamesPlayed} />

          {/* Stats Row */}
          <div className="flex items-center justify-between min-h-[20px]">
            <div className="flex gap-2 text-xs font-semibold">
              {stats ? (
                <>
                  <span title="Goals" className="text-white">
                    <span className="text-white/50">G</span>
                    <span className="text-white ml-0.5">{goals}</span>
                  </span>
                  <span title="Assists" className="text-white">
                    <span className="text-white/50">A</span>
                    <span className="text-white ml-0.5">{assists}</span>
                  </span>
                  {defender && (
                    <span title="Clean Sheets" className="text-white">
                      <span className="text-white/50">CS</span>
                      <span className="text-white ml-0.5">{cleanSheets}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-white/20 text-xs">No data</span>
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

          {/* Upgrade Progress Row */}
          {stats && (
            <div className="flex flex-wrap gap-1 pt-0.5 border-t border-white/5">
              {/* G+A progress */}
              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                gaAchieved
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/5 text-white/30'
              }`}>
                {gaProgress}
              </span>

              {/* Actions progress */}
              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                actionsAchieved
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/5 text-white/30'
              }`}>
                {actionsProgress}
              </span>

              {/* CS badge for DEF/GK only */}
              {defender && (
                <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                  csAchieved
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/5 text-white/30'
                }`}>
                  {cleanSheets}/1 CS {csAchieved ? '✅' : ''}
                </span>
              )}
            </div>
          )}

          {/* +1 OVR badge if any upgrade earned */}
          {stats && (gaAchieved || actionsAchieved || csAchieved) && (
            <div className="flex gap-1 flex-wrap">
              {gaAchieved && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                  stats.upgrade_goal_assist_applied
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  {stats.upgrade_goal_assist_applied ? '✓ G/A' : '⏳ G/A'}
                </span>
              )}
              {actionsAchieved && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                  stats.upgrade_actions_applied
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  {stats.upgrade_actions_applied ? '✓ ACT' : '⏳ ACT'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
