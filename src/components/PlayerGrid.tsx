'use client'

import { useState, useMemo } from 'react'
import { PlayerCard } from './PlayerCard'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

export function PlayerGrid({ players }: { players: Player[] }) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<string>('all')
  const [league, setLeague] = useState<string>('all')
  const [sort, setSort] = useState<string>('rating')

  // Get unique leagues from players
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52 bg-[#1a1a1a] border-white/10 text-white placeholder:text-white/30"
        />
        
        <Select value={position} onValueChange={(v) => setPosition(v ?? 'all')}>
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
        
        <Select value={league} onValueChange={(v) => setLeague(v ?? 'all')}>
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
        
        <Select value={sort} onValueChange={(v) => setSort(v ?? 'rating')}>
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

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="bg-[#1a1a1a] border border-white/10">
          <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            All ({players.length})
          </TabsTrigger>
          <TabsTrigger value="team1" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Team 1 ({team1.length})
          </TabsTrigger>
          <TabsTrigger value="team2" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Team 2 ({team2.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-4">
          <Grid players={filterAndSort(players)} />
        </TabsContent>
        
        <TabsContent value="team1" className="mt-4">
          <Grid players={filterAndSort(team1)} />
        </TabsContent>
        
        <TabsContent value="team2" className="mt-4">
          <Grid players={filterAndSort(team2)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
