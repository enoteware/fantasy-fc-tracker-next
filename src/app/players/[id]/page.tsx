// @ts-nocheck
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export const dynamic = 'force-dynamic'

async function getPlayer(id: number) {
  const player = await prisma.fantasy_fc_players.findUnique({
    where: { id },
    include: {
      fantasy_fc_player_stats: true,
      fantasy_fc_upgrades: { orderBy: { earned_date: 'desc' } },
      fantasy_fc_player_matches: {
        include: { fantasy_fc_matches: true },
        orderBy: { id: 'desc' },
        take: 10,
      },
    },
  })
  if (!player) return null

  const fixtures = await prisma.fantasy_fc_upcoming_fixtures.findMany({
    where: { club: player.club },
    orderBy: { match_date: 'asc' },
    take: 5,
  })

  return { player, fixtures, card_image: getCardImage(player.name) }
}

function StatBar({ label, value, max = 99 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100)
  const color = value >= 85 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : 'bg-red-500'
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/40 text-xs w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-white font-bold text-sm w-6 text-right">{value}</span>
    </div>
  )
}

function ResultChip({ result }: { result: string | null }) {
  const map = {
    win: { label: 'W', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    loss: { label: 'L', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    draw: { label: 'D', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  }
  const r = map[(result ?? 'draw') as keyof typeof map] ?? map.draw
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${r.cls}`}>
      {r.label}
    </span>
  )
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) notFound()

  const data = await getPlayer(numId)
  if (!data) notFound()

  const { player, fixtures, card_image } = data
  const stats = player.fantasy_fc_player_stats

  // Fake attribute estimates based on position + rating (real data not in DB)
  const baseRating = player.current_rating
  const positionAttrs: Record<string, Record<string, number>> = {
    default: { PAC: baseRating - 2, SHO: baseRating - 3, PAS: baseRating - 1, DRI: baseRating - 2, DEF: baseRating - 8, PHY: baseRating - 4 },
    GK: { DIV: baseRating - 1, HAN: baseRating - 2, KIC: baseRating - 3, REF: baseRating - 1, SPD: baseRating - 5, POS: baseRating - 2 },
    CB: { PAC: baseRating - 8, SHO: baseRating - 12, PAS: baseRating - 5, DRI: baseRating - 7, DEF: baseRating + 2, PHY: baseRating - 1 },
    LB: { PAC: baseRating - 2, SHO: baseRating - 8, PAS: baseRating - 4, DRI: baseRating - 5, DEF: baseRating - 1, PHY: baseRating - 4 },
    RB: { PAC: baseRating - 2, SHO: baseRating - 8, PAS: baseRating - 4, DRI: baseRating - 5, DEF: baseRating - 1, PHY: baseRating - 4 },
    CDM: { PAC: baseRating - 4, SHO: baseRating - 6, PAS: baseRating - 2, DRI: baseRating - 3, DEF: baseRating - 1, PHY: baseRating - 2 },
    CM: { PAC: baseRating - 4, SHO: baseRating - 4, PAS: baseRating - 1, DRI: baseRating - 3, DEF: baseRating - 5, PHY: baseRating - 4 },
    CAM: { PAC: baseRating - 3, SHO: baseRating - 2, PAS: baseRating - 1, DRI: baseRating - 1, DEF: baseRating - 10, PHY: baseRating - 6 },
    LW: { PAC: baseRating, SHO: baseRating - 2, PAS: baseRating - 3, DRI: baseRating, DEF: baseRating - 12, PHY: baseRating - 7 },
    RW: { PAC: baseRating, SHO: baseRating - 2, PAS: baseRating - 3, DRI: baseRating, DEF: baseRating - 12, PHY: baseRating - 7 },
    ST: { PAC: baseRating - 2, SHO: baseRating + 1, PAS: baseRating - 6, DRI: baseRating - 2, DEF: baseRating - 14, PHY: baseRating - 3 },
    CF: { PAC: baseRating - 2, SHO: baseRating, PAS: baseRating - 3, DRI: baseRating - 1, DEF: baseRating - 12, PHY: baseRating - 5 },
  }

  const attrs = positionAttrs[player.position] ?? positionAttrs.default
  const clamp = (v: number) => Math.max(60, Math.min(99, v))
  const clamped = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, clamp(v)]))

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-white/40 hover:text-white transition-colors text-sm">
            ← Dashboard
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/60 text-sm truncate">{player.name}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Card + Attributes */}
          <div className="space-y-6">
            {/* FC Card */}
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#1a1a1a] shadow-2xl shadow-black/50">
              {card_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card_image} alt={player.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-3xl text-white/20">{player.position}</span>
                  </div>
                  <span className="text-white/30">{player.name}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-black/70 text-white font-bold px-2 py-1 rounded-lg text-lg">
                {player.current_rating}
              </div>
              {player.base_rating !== player.current_rating && (
                <div className="absolute top-3 right-3 bg-green-500/80 text-white font-bold px-2 py-1 rounded-lg text-sm">
                  +{player.current_rating - player.base_rating}
                </div>
              )}
            </div>
            
            {/* Player Meta */}
            <div className="space-y-1">
              <h1 className="text-white font-bold text-2xl">{player.name}</h1>
              <p className="text-white/50">{player.position} · {player.club}</p>
              {player.league && <p className="text-white/30 text-sm">{player.league}</p>}
              <div className="flex gap-2 pt-1">
                <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 border">
                  Team {player.team}
                </Badge>
                {(player.upgrades_applied ?? 0) > 0 && (
                  <Badge className="bg-green-600/20 text-green-400 border-green-500/30 border">
                    +{player.upgrades_applied} upgrades
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Attributes */}
            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
              <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Attributes</h2>
              {Object.entries(clamped).map(([label, value]) => (
                <StatBar key={label} label={label} value={value} />
              ))}
            </div>
          </div>

          {/* Right: Stats, Matches, Fixtures */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Season Stats */}
            <div className="bg-[#1a1a1a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Season Stats</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Goals', value: stats?.goals ?? 0, emoji: '⚽' },
                  { label: 'Assists', value: stats?.assists ?? 0, emoji: '🅰️' },
                  { label: 'Clean Sheets', value: stats?.clean_sheets ?? 0, emoji: '🧤' },
                  { label: 'Att. Actions', value: stats?.attacking_actions ?? 0, emoji: '⚡' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl mb-1">{s.emoji}</div>
                    <div className="text-white font-bold text-xl">{s.value}</div>
                    <div className="text-white/40 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>
              
              {/* Upgrade Status */}
              {stats && (stats.upgrade_goal_assist_earned || stats.upgrade_actions_earned) && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                  <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Upgrade Status</h3>
                  {stats.upgrade_goal_assist_earned && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Goal/Assist Upgrade</span>
                      <span className={`font-semibold ${stats.upgrade_goal_assist_applied ? 'text-green-400' : 'text-yellow-400'}`}>
                        {stats.upgrade_goal_assist_applied ? '✓ Applied' : '⏳ Earned — Pending'}
                      </span>
                    </div>
                  )}
                  {stats.upgrade_actions_earned && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Actions Upgrade</span>
                      <span className={`font-semibold ${stats.upgrade_actions_applied ? 'text-green-400' : 'text-yellow-400'}`}>
                        {stats.upgrade_actions_applied ? '✓ Applied' : '⏳ Earned — Pending'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upgrade Timeline */}
            {player.fantasy_fc_upgrades.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4">Upgrade History</h2>
                <div className="space-y-2">
                  {player.fantasy_fc_upgrades.map(u => (
                    <div key={u.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${u.applied ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <div>
                          <span className="text-white font-medium">{u.upgrade_type}</span>
                          {u.ovr_boost && u.ovr_boost > 0 && (
                            <span className="text-green-400 ml-2">+{u.ovr_boost} OVR</span>
                          )}
                          {u.stat_boost && (
                            <span className="text-blue-400 ml-2 text-xs">{u.stat_boost}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white/40 text-xs">{formatDate(u.earned_date)}</div>
                        <div className={`text-xs ${u.applied ? 'text-green-400' : 'text-yellow-400'}`}>
                          {u.applied ? 'Applied' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Matches */}
            <div className="bg-[#1a1a1a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Recent Matches</h2>
              {player.fantasy_fc_player_matches.length > 0 ? (
                <div className="space-y-2">
                  {player.fantasy_fc_player_matches.map(pm => {
                    const m = pm.fantasy_fc_matches
                    if (!m) return null
                    return (
                      <div key={pm.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <ResultChip result={m.result} />
                          <div>
                            <span className="text-white">vs {m.opponent}</span>
                            <span className="text-white/40 ml-2 text-xs">{m.score_for}–{m.score_against}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          {pm.goals !== null && pm.goals > 0 && (
                            <span className="text-white">⚽ {pm.goals}</span>
                          )}
                          {pm.assists !== null && pm.assists > 0 && (
                            <span className="text-white">🅰️ {pm.assists}</span>
                          )}
                          {pm.clean_sheet && <span className="text-green-400">CS</span>}
                          <span>{formatDate(m.match_date)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-white/30 text-sm">No match data yet — scraper will populate on next run</p>
              )}
            </div>

            {/* Upcoming Fixtures */}
            <div className="bg-[#1a1a1a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Upcoming Fixtures</h2>
              {fixtures.length > 0 ? (
                <div className="space-y-2">
                  {fixtures.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                      <div>
                        <span className="text-white">vs {f.opponent}</span>
                        <span className="text-white/30 ml-2 text-xs">
                          {f.home_away === 'home' ? 'H' : 'A'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-white/40 text-xs">{formatDate(f.match_date)}</div>
                        {f.competition && (
                          <div className="text-white/20 text-xs">{f.competition}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/30 text-sm">No fixtures data yet</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
