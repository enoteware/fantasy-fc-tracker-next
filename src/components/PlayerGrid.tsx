'use client'

import { useState, useMemo } from 'react'
import { PlayerCard } from './PlayerCard'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, UserX, Search, SlidersHorizontal } from 'lucide-react'

type Player = {
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

function Grid({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-20 text-white/30">
        <div className="text-4xl mb-3">⚽</div>
        <p className="text-lg">No players found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {players.map(player => (
        <PlayerCard key={player.id} player={player} />
      ))}
    </div>
  )
}

type TabValue = 'all' | 'team1' | 'team2'

export function PlayerGrid({ players }: { players: Player[] }) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<string>('all')
  const [league, setLeague] = useState<string>('all')
  const [sort, setSort] = useState<string>('rating')
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const leagues = useMemo(() => {
    const set = new Set(players.map(p => p.league).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [players])

  const filterAndSort = (playerList: Player[]) => {
    let filtered = playerList

    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.club.toLowerCase().includes(q)
      )
    }

    if (position !== 'all') {
      filtered = filtered.filter(p => {
        if (position === 'GK') return p.position === 'GK'
        if (position === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)
        if (position === 'MID') return ['CM', 'CAM', 'CDM', 'LM', 'RM'].includes(p.position)
        if (position === 'FWD') return ['ST', 'LW', 'RW', 'CF', 'LF', 'RF'].includes(p.position)
        return true
      })
    }

    if (league !== 'all') {
      filtered = filtered.filter(p => p.league === league)
    }

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'upgrades') return (b.upgrades_applied ?? 0) - (a.upgrades_applied ?? 0)
      return b.current_rating - a.current_rating
    })
  }

  const team1 = useMemo(() => players.filter(p => p.team === 1), [players])
  const team2 = useMemo(() => players.filter(p => p.team === 2), [players])

  const currentPlayers = activeTab === 'all' ? players : activeTab === 'team1' ? team1 : team2

  const activeFiltersCount = [
    position !== 'all',
    league !== 'all',
    sort !== 'rating',
  ].filter(Boolean).length

  return (
    // Extra bottom padding on mobile to clear fixed bottom nav
    <div className="space-y-4 pb-20 md:pb-0">

      {/* ── Desktop filters (hidden on mobile) ── */}
      <div className="hidden md:flex flex-wrap gap-3">
        <Input
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52 bg-[#1a1a1a] border-white/10 text-white placeholder:text-white/30"
        />

        <Select value={position} onValueChange={v => setPosition(v ?? 'all')}>
          <SelectTrigger className="w-36 bg-[#1a1a1a] border-white/10 text-white">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="GK">GK</SelectItem>
            <SelectItem value="DEF">Defenders</SelectItem>
            <SelectItem value="MID">Midfielders</SelectItem>
            <SelectItem value="FWD">Forwards</SelectItem>
          </SelectContent>
        </Select>

        <Select value={league} onValueChange={v => setLeague(v ?? 'all')}>
          <SelectTrigger className="w-48 bg-[#1a1a1a] border-white/10 text-white">
            <SelectValue placeholder="League" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="all">All Leagues</SelectItem>
            {leagues.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={v => setSort(v ?? 'rating')}>
          <SelectTrigger className="w-36 bg-[#1a1a1a] border-white/10 text-white">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="rating">By Rating</SelectItem>
            <SelectItem value="upgrades">By Upgrades</SelectItem>
            <SelectItem value="name">By Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Mobile filter bar (search + filters button) ── */}
      <div className="flex md:hidden gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#1a1a1a] border-white/10 text-white placeholder:text-white/30 w-full"
          />
        </div>

        {/* Filters bottom sheet */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger
            className="relative inline-flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:bg-[#222] shrink-0 min-w-[44px] min-h-[44px] rounded-md transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="bg-[#1a1a1a] border-white/10 rounded-t-2xl pb-8"
          >
            <SheetHeader className="mb-4">
              <SheetTitle className="text-white text-left">Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-4">
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Position</label>
                <Select value={position} onValueChange={v => setPosition(v ?? 'all')}>
                  <SelectTrigger className="w-full bg-[#222] border-white/10 text-white h-12">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="all">All Positions</SelectItem>
                    <SelectItem value="GK">GK</SelectItem>
                    <SelectItem value="DEF">Defenders</SelectItem>
                    <SelectItem value="MID">Midfielders</SelectItem>
                    <SelectItem value="FWD">Forwards</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">League</label>
                <Select value={league} onValueChange={v => setLeague(v ?? 'all')}>
                  <SelectTrigger className="w-full bg-[#222] border-white/10 text-white h-12">
                    <SelectValue placeholder="League" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="all">All Leagues</SelectItem>
                    {leagues.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Sort by</label>
                <Select value={sort} onValueChange={v => setSort(v ?? 'rating')}>
                  <SelectTrigger className="w-full bg-[#222] border-white/10 text-white h-12">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="rating">By Rating</SelectItem>
                    <SelectItem value="upgrades">By Upgrades</SelectItem>
                    <SelectItem value="name">By Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => setFiltersOpen(false)}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-2"
              >
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Desktop tabs (hidden on mobile — bottom nav handles it) ── */}
      <div className="hidden md:block">
        <div className="flex gap-1 bg-[#1a1a1a] border border-white/10 rounded-lg p-1 w-fit">
          {(['all', 'team1', 'team2'] as TabValue[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab === 'all' ? `All (${players.length})` : tab === 'team1' ? `Team 1 (${team1.length})` : `Team 2 (${team2.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Player grid ── */}
      <div className="mt-2">
        <Grid players={filterAndSort(currentPlayers)} />
      </div>

      {/* ── Bottom Nav (mobile only, fixed) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0f0f0f] border-t border-white/10">
        <div className="flex items-stretch h-16">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              activeTab === 'all' ? 'text-blue-400' : 'text-white/40'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>All</span>
          </button>
          <button
            onClick={() => setActiveTab('team1')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              activeTab === 'team1' ? 'text-blue-400' : 'text-white/40'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <span>Team 1</span>
          </button>
          <button
            onClick={() => setActiveTab('team2')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              activeTab === 'team2' ? 'text-blue-400' : 'text-white/40'
            }`}
          >
            <UserX className="w-5 h-5" />
            <span>Team 2</span>
          </button>
          <button
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[placeholder="Search players..."]')
              input?.focus()
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium text-white/40"
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
