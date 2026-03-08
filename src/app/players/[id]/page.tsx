// @ts-nocheck
import { prisma } from '@/lib/db'
import { getCardImage } from '@/lib/cards'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { UpgradeProgressCard } from '@/components/UpgradeProgressCard'
import { PlayerDebugPanel } from '@/components/PlayerDebugPanel'

export const dynamic = 'force-dynamic'

const GAMES_WINDOW = 4
const ATT_ACTIONS_THRESHOLD = 6
const DEF_ACTIONS_THRESHOLD = 12

function isDefOrGK(pos: string) {
  return ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)
}

// Competitions to exclude from match history and upcoming fixtures
const EXCLUDE_COMPETITION_KEYWORDS = [
  'cup', 'copa', 'coppa', 'coupe', 'taca', 'taça', 'pokal', 'supercup', 'super cup',
  'champions league', 'europa league', 'conference league', 'world cup',
  'friendly', 'international', 'knockout', 'playoff', 'play-off',
  'nations league', 'continental',
]

function isLeagueMatch(league: string | null, competition?: string | null): boolean {
  const check = ((league ?? '') + ' ' + (competition ?? '')).toLowerCase()
  return !EXCLUDE_COMPETITION_KEYWORDS.some(kw => check.includes(kw))
}

// Club name normalization — match.club may use a different spelling than player.club
const CLUB_ALIASES: Record<string, string[]> = {
  'Ajax': ['AFC Ajax'],
  'Al Ahli': ['Al-Ahli'],
  'Barcelona': ['FC Barcelona'],
  'Bayer Leverkusen': ['Bayer 04 Leverkusen'],
  'Bayern Munich (W)': ['FC Bayern München', 'Bayern München'],
  'C.D. Nacional': ['CD Nacional'],
  'Lyon': ['Olympique Lyonnais', 'OL'],
  'Manchester United': ['Manchester Utd'],
  'Manchester City': ['Manchester City WFC'],
  'OM': ['Olympique de Marseille'],
  'Paris SG': ['Paris Saint-Germain'],
  'SL Benfica': ['Benfica'],
  'Spurs': ['Tottenham Hotspur'],
}

function sameClub(playerClub: string, matchClub: string): boolean {
  if (playerClub === matchClub) return true
  const aliases = CLUB_ALIASES[playerClub] ?? []
  return aliases.some(a => a.toLowerCase() === matchClub.toLowerCase())
}

/**
 * Find the date when a cumulative stat first crossed a threshold.
 * Matches should be sorted oldest → newest.
 */
function findDateWhenThresholdCrossed(
  matches: Array<{ goals: number | null; assists: number | null; clean_sheet: boolean | null; attacking_actions: number | null; defensive_actions: number | null; fantasy_fc_matches: { match_date: Date } | null }>,
  stat: 'ga' | 'goals' | 'cs' | 'att_actions' | 'def_actions',
  threshold: number,
): Date | null {
  let cumulative = 0
  for (const pm of matches) {
    if (!pm.fantasy_fc_matches) continue
    if (stat === 'ga') cumulative += (pm.goals ?? 0) + (pm.assists ?? 0)
    else if (stat === 'goals') cumulative += pm.goals ?? 0
    else if (stat === 'cs') cumulative += pm.clean_sheet ? 1 : 0
    else if (stat === 'att_actions') cumulative += pm.attacking_actions ?? 0
    else if (stat === 'def_actions') cumulative += pm.defensive_actions ?? 0
    if (cumulative >= threshold) {
      return new Date(pm.fantasy_fc_matches.match_date)
    }
  }
  return null
}

async function getPlayer(id: number) {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? ''
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')

  const player = await prisma.fantasy_fc_players.findUnique({
    where: { id },
    include: {
      fantasy_fc_player_stats: true,
      fantasy_fc_upgrades: { orderBy: { earned_date: 'desc' } },
      fantasy_fc_player_matches: {
        include: { fantasy_fc_matches: true },
        orderBy: { id: 'desc' },
        take: 20, // fetch more, will filter below
      },
    },
  })
  if (!player) return null

  const fixtures = await prisma.fantasy_fc_upcoming_fixtures.findMany({
    where: { club: player.club },
    orderBy: { match_date: 'asc' },
    take: 10, // fetch more, filter below
  })

  // Count games played (each row in player_matches = 1 game)
  const gamesPlayedCount = await prisma.fantasy_fc_player_matches.count({
    where: { player_id: id },
  })

  // Filter fixtures to league-only competitions
  const leagueFixtures = fixtures.filter(f => isLeagueMatch(f.league, f.competition)).slice(0, 5)

  // Filter player matches to league-only, and fix perspective when club names differ
  const leagueMatches = player.fantasy_fc_player_matches
    .filter(pm => {
      const m = pm.fantasy_fc_matches
      if (!m) return false
      return isLeagueMatch(m.league)
    })
    .map(pm => {
      const m = pm.fantasy_fc_matches!
      // If the match record is from the opponent's perspective (scraper bug fallback),
      // flip the data so we always show from the player's club's view
      if (!sameClub(player.club, m.club)) {
        return {
          ...pm,
          fantasy_fc_matches: {
            ...m,
            club: player.club,
            opponent: m.club,       // the stored "club" is actually the opponent
            score_for: m.score_against,
            score_against: m.score_for,
            result: m.result === 'win' ? 'loss' : m.result === 'loss' ? 'win' : 'draw',
          }
        }
      }
      return pm
    })
    .slice(0, 10)

  // Build oldest→newest sorted matches for threshold date computation
  const allLeagueMatchesSorted = player.fantasy_fc_player_matches
    .filter(pm => {
      const m = pm.fantasy_fc_matches
      if (!m) return false
      return isLeagueMatch(m.league)
    })
    .sort((a, b) => {
      const da = new Date(a.fantasy_fc_matches!.match_date).getTime()
      const db = new Date(b.fantasy_fc_matches!.match_date).getTime()
      return da - db
    })

  return {
    player,
    fixtures: leagueFixtures,
    leagueMatches,
    card_image: getCardImage(player.name),
    gamesPlayed: gamesPlayedCount,
    allLeagueMatchesSorted,
    isLocalhost,
  }
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

function GamesProgressBar({ gamesPlayed }: { gamesPlayed: number }) {
  const clamped = Math.min(gamesPlayed, GAMES_WINDOW)
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: GAMES_WINDOW }).map((_, i) => (
        <span
          key={i}
          className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${
            i < clamped
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-white/20'
          }`}
        >
          {i < clamped ? '✓' : '○'}
        </span>
      ))}
      <span className="text-white/50 text-sm ml-1">{clamped} / {GAMES_WINDOW} games</span>
    </div>
  )
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) notFound()

  const data = await getPlayer(numId)
  if (!data) notFound()

  const { player, fixtures, leagueMatches, card_image, gamesPlayed, allLeagueMatchesSorted, isLocalhost } = data
  const stats = player.fantasy_fc_player_stats
  const position = player.position
  const defender = isDefOrGK(position)

  // Stats come from fifauteam scraper (live, updated 2x/day)
  // ga = Goals/Assists combined counter (threshold 1 → PS+)
  // team_goals = team's total goals in window (threshold 10 → Face Stat 99)
  // wins = team wins in window (threshold 6 → +1 OVR)
  const ga = (stats as any)?.ga ?? stats?.goals ?? 0
  const goals = ga  // used for G/A threshold check
  const assists = stats?.assists ?? 0
  const cleanSheets = (stats as any)?.cs ?? stats?.clean_sheets ?? 0
  const teamGoals = (stats as any)?.team_goals ?? 0
  const wins = (stats as any)?.wins ?? 0
  const attackingActions = stats?.attacking_actions ?? 0
  const defensiveActions = stats?.defensive_actions ?? 0

  const actionsThreshold = defender ? DEF_ACTIONS_THRESHOLD : ATT_ACTIONS_THRESHOLD
  const relevantActions = defender ? defensiveActions : attackingActions
  const actionsLabel = defender ? '🛡️ Def. Actions' : '⚡ Att. Actions'
  const actionsEmoji = defender ? '🛡️' : '⚡'

  // ── Upgrade earned dates (derived from match history) ──
  const gaEarnedAt = (goals + assists >= 1)
    ? findDateWhenThresholdCrossed(allLeagueMatchesSorted, 'ga', 1)
    : null
  const csEarnedAt = (cleanSheets >= 1)
    ? findDateWhenThresholdCrossed(allLeagueMatchesSorted, 'cs', 1)
    : null
  const attActionsEarnedAt = (attackingActions >= ATT_ACTIONS_THRESHOLD)
    ? findDateWhenThresholdCrossed(allLeagueMatchesSorted, 'att_actions', ATT_ACTIONS_THRESHOLD)
    : null
  const defActionsEarnedAt = (defensiveActions >= DEF_ACTIONS_THRESHOLD)
    ? findDateWhenThresholdCrossed(allLeagueMatchesSorted, 'def_actions', DEF_ACTIONS_THRESHOLD)
    : null
  const goalsEarnedAt = (teamGoals >= 10)
    ? findDateWhenThresholdCrossed(allLeagueMatchesSorted, 'goals', 10)
    : null

  const actionsEarnedAt = defender ? defActionsEarnedAt : attActionsEarnedAt
  const primaryUpgradeEarnedAt = defender ? csEarnedAt : gaEarnedAt

  // ── Upgrade applied dates — from fantasy_fc_upgrades rows ──
  // Map upgrade_type strings to our upgrade categories
  function findAppliedDate(type: string): Date | null {
    const upgrade = player.fantasy_fc_upgrades.find(u => {
      const t = (u.upgrade_type ?? '').toLowerCase()
      return t.includes(type)
    })
    if (!upgrade || !upgrade.applied) return null
    // No applied_at timestamp in schema — use earned_date if applied
    return upgrade.applied ? new Date(upgrade.earned_date) : null
  }

  const gaAppliedAt = findAppliedDate('goal')
  const csAppliedAt = findAppliedDate('clean')
  const actionsAppliedAt = findAppliedDate('action')
  const goalsAppliedAt = findAppliedDate('10') // e.g. "10 Goals"

  // Also check player_stats applied booleans as fallback
  const gaApplied = stats?.upgrade_goal_assist_applied ?? false
  const actionsApplied = stats?.upgrade_actions_applied ?? false

  // Merge: if stats says applied, treat as applied (use earned date as proxy)
  const primaryAppliedAt = (defender ? csAppliedAt : gaAppliedAt) ??
    (gaApplied && gaEarnedAt ? gaEarnedAt : null)
  const actionsAppliedAtFinal = actionsAppliedAt ??
    (actionsApplied && actionsEarnedAt ? actionsEarnedAt : null)

  // Border logic
  const achievedGA = goals + assists >= 1
  const achievedCS = defender && cleanSheets >= 1
  const achievedActions = relevantActions >= actionsThreshold
  const achieved = achievedGA || achievedCS || achievedActions
  const borderClass = achieved
    ? 'ring-4 ring-green-500/60'
    : (gamesPlayed >= GAMES_WINDOW && !achieved)
    ? 'ring-4 ring-red-500/60'
    : ''

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
      <header className="border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-white/40 hover:text-white transition-colors text-sm">
            ← Dashboard
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/60 text-sm truncate">{player.name}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Mobile: vertical stack. Desktop: 3-col grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8">

          {/* Card + Meta — full-width on mobile, left col on desktop */}
          <div className="space-y-4 sm:space-y-6">
            {/* FC Card — full width on mobile, capped on desktop */}
            <div className={`relative mx-auto w-full max-w-[280px] sm:max-w-none aspect-[2/3] rounded-2xl overflow-hidden bg-gradient-to-b from-[#1e2a3a] to-[#111] shadow-2xl shadow-black/50 ${borderClass}`}>
              {card_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card_image} alt={player.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-blue-900/40 to-[#111]">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-3xl text-white/40">{player.position}</span>
                  </div>
                  <span className="text-white/30">{player.name}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-black/80 text-white font-bold px-2 py-1 rounded-lg text-lg shadow-lg">
                {player.current_rating}
              </div>
              {player.base_rating !== player.current_rating && (
                <div className="absolute top-3 right-3 bg-green-500/80 text-white font-bold px-2 py-1 rounded-lg text-sm shadow-lg">
                  +{player.current_rating - player.base_rating}
                </div>
              )}
              {/* Border legend */}
              {achieved && (
                <div className="absolute bottom-3 left-3 right-3 text-center">
                  <span className="text-[11px] bg-green-500/80 text-white px-2 py-0.5 rounded-full font-semibold">
                    ✓ Upgrade Earned
                  </span>
                </div>
              )}
              {!achieved && gamesPlayed >= GAMES_WINDOW && (
                <div className="absolute bottom-3 left-3 right-3 text-center">
                  <span className="text-[11px] bg-red-500/80 text-white px-2 py-0.5 rounded-full font-semibold">
                    ✗ Window Closed
                  </span>
                </div>
              )}
            </div>

            {/* Player Meta */}
            <div className="space-y-1">
              <h1 className="text-white font-bold text-2xl">{player.name}</h1>
              <p className="text-white/50">{player.position} · {player.club}</p>
              {player.league && <p className="text-white/30 text-sm">{player.league}</p>}
              <div className="flex gap-2 pt-1 flex-wrap">
                <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 border">
                  Team {player.team}
                </Badge>
                {(player.upgrades_applied ?? 0) > 0 && (
                  <Badge className="bg-green-600/20 text-green-400 border-green-500/30 border">
                    +{player.upgrades_applied} upgrades
                  </Badge>
                )}
                {achieved && (
                  <Badge className="bg-green-600/20 text-green-400 border-green-500/30 border">
                    🟢 Upgrade Ready
                  </Badge>
                )}
                {!achieved && gamesPlayed >= GAMES_WINDOW && (
                  <Badge className="bg-red-600/20 text-red-400 border-red-500/30 border">
                    🔴 Window Closed
                  </Badge>
                )}
              </div>
            </div>

            {/* External Links */}
            {(() => {
              const slug = (player as any).futgg_slug as string | null
              const fifauteamSlug = (player as any).fifauteam_slug as string | null
              const futbinUrl = (player as any).futbin_url as string | null
              const nameParts = player.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-')
              const futggUrl = slug ? `https://www.fut.gg/players/26-fantasy-fc-${slug}/` : `https://www.fut.gg/players/?page=1&rarity_id=%5B135%2C111%5D&search=${encodeURIComponent(player.name)}`
              const futbinLink = futbinUrl || `https://www.futbin.com/search?term=${encodeURIComponent(player.name)}`
              const fifauteamLink = `https://fifauteam.com/fc-26-fantasy-tracker/`
              return (
                <div className="bg-[#1a1a1a] rounded-xl p-4">
                  <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Compare Data</h2>
                  <div className="flex flex-col gap-2">
                    <a href={futggUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⚽</span>
                        <span className="text-white/80 text-sm font-medium">FUT.GG</span>
                      </div>
                      <span className="text-white/30 text-xs group-hover:text-white/60">Player page →</span>
                    </a>
                    <a href={futbinLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📊</span>
                        <span className="text-white/80 text-sm font-medium">FUTBIN</span>
                      </div>
                      <span className="text-white/30 text-xs group-hover:text-white/60">Player page →</span>
                    </a>
                    <a href={fifauteamLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📈</span>
                        <span className="text-white/80 text-sm font-medium">fifauteam Tracker</span>
                      </div>
                      <span className="text-white/30 text-xs group-hover:text-white/60">Live upgrades →</span>
                    </a>
                  </div>
                </div>
              )
            })()}

            {/* Attributes */}
            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
              <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Attributes</h2>
              {Object.entries(clamped).map(([label, value]) => (
                <StatBar key={label} label={label} value={value} />
              ))}
            </div>
          </div>

          {/* Right: Stats, Matches, Fixtures — full width mobile, 2-col on desktop */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            
            {/* Games Progress */}
            <div className="bg-[#1a1a1a] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold">Tracking Window</h2>
                <span className="text-white/40 text-xs">4-game Fantasy FC window</span>
              </div>
              <GamesProgressBar gamesPlayed={gamesPlayed} />
              {gamesPlayed > GAMES_WINDOW && (
                <p className="text-white/30 text-xs mt-2">
                  {gamesPlayed} total games tracked (window = last {GAMES_WINDOW})
                </p>
              )}
            </div>

            {/* Season Stats */}
            <div className="bg-[#1a1a1a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Season Stats</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Games */}
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">📅</div>
                  <div className="text-white font-bold text-xl">
                    {Math.min(gamesPlayed, GAMES_WINDOW)}
                    <span className="text-white/30 text-base"> / {GAMES_WINDOW}</span>
                  </div>
                  <div className="text-white/40 text-xs">Games</div>
                </div>

                {/* G/A combined */}
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">⚽</div>
                  <div className="text-white font-bold text-xl">
                    {ga}
                    <span className="text-white/30 text-base"> / 1</span>
                  </div>
                  <div className="text-white/40 text-xs">G/A</div>
                </div>

                {/* Wins */}
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">🏆</div>
                  <div className="text-white font-bold text-xl">
                    {wins}
                    <span className="text-white/30 text-base"> / 6</span>
                  </div>
                  <div className="text-white/40 text-xs">Wins</div>
                </div>

                {/* Position-specific: CS for defenders/GK, else Actions */}
                {defender ? (
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl mb-1">🧤</div>
                    <div className="text-white font-bold text-xl">{cleanSheets}</div>
                    <div className="text-white/40 text-xs">Clean Sheets</div>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl mb-1">{actionsEmoji}</div>
                    <div className="text-white font-bold text-xl">
                      {relevantActions}
                      <span className="text-white/30 text-base"> / {actionsThreshold}</span>
                    </div>
                    <div className="text-white/40 text-xs">{actionsLabel}</div>
                  </div>
                )}
              </div>

              {/* Upgrade Progress Cards — new two-status design */}
              <div className="mt-5 space-y-3">
                <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Upgrade Progress</h3>

                {/* Upgrade 1: G/A (FWD/MID) or Clean Sheet (DEF/GK) */}
                {defender ? (
                  <UpgradeProgressCard
                    type="Clean Sheet"
                    icon="🧤"
                    threshold={1}
                    current={cleanSheets}
                    unit="clean sheets needed"
                    reward="2nd PlayStyle+"
                    earnedAt={csEarnedAt}
                    appliedAt={csAppliedAt}
                    gamesPlayed={Math.min(gamesPlayed, GAMES_WINDOW)}
                  />
                ) : (
                  <UpgradeProgressCard
                    type="G/A"
                    icon="⚽"
                    threshold={1}
                    current={ga}
                    unit="goals + assists needed"
                    reward="2nd PlayStyle+"
                    earnedAt={gaEarnedAt}
                    appliedAt={primaryAppliedAt}
                    gamesPlayed={Math.min(gamesPlayed, GAMES_WINDOW)}
                  />
                )}

                {/* Upgrade 2: Actions */}
                <UpgradeProgressCard
                  type={defender ? 'Def. Actions' : 'Att. Actions'}
                  icon={defender ? '🛡️' : '⚡'}
                  threshold={actionsThreshold}
                  current={relevantActions}
                  unit={`${defender ? 'defensive' : 'attacking'} actions needed`}
                  reward="5★ Skill Move or Weak Foot"
                  earnedAt={actionsEarnedAt}
                  appliedAt={actionsAppliedAtFinal}
                  gamesPlayed={Math.min(gamesPlayed, GAMES_WINDOW)}
                />

                {/* Upgrade 3: 6 Wins → +1 OVR */}
                <UpgradeProgressCard
                  type="6 Wins"
                  icon="🏆"
                  threshold={6}
                  current={wins}
                  unit="wins needed"
                  reward="+1 OVR"
                  earnedAt={null}
                  appliedAt={null}
                  gamesPlayed={Math.min(gamesPlayed, GAMES_WINDOW)}
                />

                {/* Upgrade 4: Team 10 Goals — same for all */}
                <UpgradeProgressCard
                  type="10 Goals (Team)"
                  icon="🔥"
                  threshold={10}
                  current={teamGoals}
                  unit="team goals needed"
                  reward="Face Stat 99"
                  earnedAt={goalsEarnedAt}
                  appliedAt={goalsAppliedAt}
                  gamesPlayed={Math.min(gamesPlayed, GAMES_WINDOW)}
                />
              </div>
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
              {leagueMatches.length > 0 ? (
                <div className="space-y-2">
                  {leagueMatches.map(pm => {
                    const m = pm.fantasy_fc_matches
                    if (!m) return null
                    return (
                      <div key={pm.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <ResultChip result={m.result} />
                          <div className="min-w-0">
                            <span className="text-white truncate block max-w-[120px] sm:max-w-none">vs {m.opponent}</span>
                            <span className="text-white/40 text-xs">{m.score_for}–{m.score_against}</span>
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

            {isLocalhost && (
              <PlayerDebugPanel
                playerId={player.id}
                playerName={player.name}
                initialStats={{
                  wins,
                  teamGoals,
                  ga,
                  cs: cleanSheets,
                  attackingActions,
                  defensiveActions,
                }}
                upgrades={player.fantasy_fc_upgrades.map(u => ({
                  upgrade_type: u.upgrade_type,
                  earned_date: String(u.earned_date),
                  applied: u.applied ?? false,
                }))}
                rawMatchData={leagueMatches.map(pm => ({
                  date: String(pm.fantasy_fc_matches?.match_date),
                  opponent: pm.fantasy_fc_matches?.opponent ?? '',
                  result: pm.fantasy_fc_matches?.result ?? '',
                  goals: pm.goals ?? 0,
                  assists: pm.assists ?? 0,
                }))}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
