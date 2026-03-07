// @ts-nocheck
'use client'

import { cn } from '@/lib/utils'

interface UpgradeCardProps {
  type: string        // 'G/A', 'Clean Sheet', 'Actions', 'Goals'
  icon: string        // emoji
  threshold: number   // e.g. 1
  current: number     // e.g. 2
  unit: string        // 'goals+assists', 'att. actions', 'goals'
  reward: string      // '2nd PlayStyle+', '5★ Skill Move', 'Face Stat 99'
  earnedAt: Date | null
  appliedAt: Date | null
  gamesPlayed: number // out of 4
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function UpgradeProgressCard({
  type,
  icon,
  threshold,
  current,
  unit,
  reward,
  earnedAt,
  appliedAt,
  gamesPlayed,
}: UpgradeCardProps) {
  const earned = !!earnedAt
  const applied = !!appliedAt
  const missed = gamesPlayed >= 4 && !earned

  // Border color for the bottom card
  const borderClass = missed
    ? 'border-red-500/50'
    : earned
    ? 'border-green-500/50'
    : 'border-white/10'

  // Top row border (surrounds both halves)
  const topBorderClass = missed
    ? 'ring-1 ring-red-500/40'
    : earned
    ? 'ring-1 ring-green-500/40'
    : 'ring-1 ring-white/10'

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Split status row */}
      <div className={cn('grid grid-cols-2 rounded-t-lg overflow-hidden', topBorderClass)}>
        {/* Left: EARNED */}
        <div
          className={cn(
            'p-3 text-center',
            earned
              ? 'bg-green-500/20'
              : 'bg-white/5'
          )}
        >
          <div
            className={cn(
              'text-xs font-bold tracking-wide',
              earned ? 'text-green-400' : 'text-white/30'
            )}
          >
            {earned ? '✓ EARNED' : '○ EARNED'}
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">
            {earnedAt ? formatShortDate(earnedAt) : 'Pending'}
          </div>
        </div>

        {/* Divider */}
        <div
          className={cn(
            'p-3 text-center border-l border-white/10',
            applied
              ? 'bg-yellow-500/15'
              : 'bg-white/5'
          )}
        >
          <div
            className={cn(
              'text-xs font-bold tracking-wide',
              applied ? 'text-yellow-400' : 'text-white/30'
            )}
          >
            {applied ? '✓ APPLIED' : '○ APPLIED'}
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">
            {appliedAt ? formatShortDate(appliedAt) : 'Pending'}
          </div>
        </div>
      </div>

      {/* Bottom: upgrade info + progress */}
      <div
        className={cn(
          'p-3 rounded-b-lg border border-t-0',
          borderClass
        )}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm text-white">
            {icon} {type} Upgrade
          </span>
          <span className="text-sm font-bold text-white">
            {current}
            <span className="text-white/40 font-normal"> / {threshold}</span>
          </span>
        </div>
        <div className="text-[11px] text-white/40 mt-1">
          {unit} needed → <span className="text-white/60">{reward}</span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              missed ? 'bg-red-500' : earned ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${Math.min((current / threshold) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
