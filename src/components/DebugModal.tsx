'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SchemaColumn { name: string; type: string; nullable: boolean; default: string | null }
interface SchemaTable { columns: SchemaColumn[]; rowCount: number }
interface SchemaData { tables: Record<string, SchemaTable>; generatedAt: string }

interface CoverageData {
  totalPlayers: number
  byTeam: { team1: number; team2: number; sbc: number; obj: number }
  withMatchData: number; withoutMatchData: string[]
  withCardImage: number; withoutCardImage: string[]
  withFixtures: number; withoutFixtures: string[]
  generatedAt: string
}

interface RawData {
  [table: string]: unknown[] | string
  generatedAt: string
}

type TabKey = 'schema' | 'coverage' | 'raw'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function copyToClipboard(data: unknown) {
  navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => {})
}

function Loading() {
  return <div className="text-white/40 text-sm py-8 text-center animate-pulse">Loading…</div>
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div className="text-red-400 text-sm py-4 font-mono">{msg}</div>
}

// ─── Schema Tab ───────────────────────────────────────────────────────────────
function SchemaTab({ data }: { data: SchemaData | null }) {
  if (!data) return <Loading />
  return (
    <div className="space-y-4">
      {Object.entries(data.tables).map(([tableName, table]) => (
        <div key={tableName} className="rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/5">
            <span className="font-mono text-sm text-green-400">{tableName}</span>
            <span className="text-xs text-white/40">{table.rowCount.toLocaleString()} rows</span>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-1.5 text-white/40 font-normal">column</th>
                <th className="text-left px-4 py-1.5 text-white/40 font-normal">type</th>
                <th className="text-left px-4 py-1.5 text-white/40 font-normal">nullable</th>
                <th className="text-left px-4 py-1.5 text-white/40 font-normal">default</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-1 text-white">{col.name}</td>
                  <td className="px-4 py-1 text-blue-400">{col.type}</td>
                  <td className="px-4 py-1 text-white/50">{col.nullable ? 'YES' : 'NO'}</td>
                  <td className="px-4 py-1 text-white/30 truncate max-w-[160px]">{col.default ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-white/20 text-xs">Generated {new Date(data.generatedAt).toLocaleString()}</p>
    </div>
  )
}

// ─── Coverage Tab ─────────────────────────────────────────────────────────────
function CoverageTab({ data }: { data: CoverageData | null }) {
  if (!data) return <Loading />
  const pct = (n: number) => data.totalPlayers > 0 ? Math.round((n / data.totalPlayers) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Total Players" value={data.totalPlayers} />
        <Tile label="T1" value={data.byTeam.team1} />
        <Tile label="T2" value={data.byTeam.team2} />
        <Tile label="SBC+OBJ" value={data.byTeam.sbc + data.byTeam.obj} />
      </div>

      {/* Coverage bars */}
      <CoverageBar label="Match Data" has={data.withMatchData} total={data.totalPlayers} pct={pct(data.withMatchData)} />
      <CoverageBar label="Card Images" has={data.withCardImage} total={data.totalPlayers} pct={pct(data.withCardImage)} />
      <CoverageBar label="Upcoming Fixtures" has={data.withFixtures} total={data.totalPlayers} pct={pct(data.withFixtures)} />

      {/* Missing lists */}
      {data.withoutMatchData.length > 0 && (
        <MissingList label="No Match Data" items={data.withoutMatchData} />
      )}
      {data.withoutCardImage.length > 0 && (
        <MissingList label="No Card Image" items={data.withoutCardImage} />
      )}

      <p className="text-white/20 text-xs">Generated {new Date(data.generatedAt).toLocaleString()}</p>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 text-center">
      <div className="text-white font-bold text-xl">{value}</div>
      <div className="text-white/40 text-xs mt-0.5">{label}</div>
    </div>
  )
}

function CoverageBar({ label, has, total, pct }: { label: string; has: number; total: number; pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">{label}</span>
        <span className={cn('font-mono', pct >= 90 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400')}>
          {has} / {total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MissingList({ label, items }: { label: string; items: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 5)
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-red-400 font-semibold">⚠ {label} ({items.length})</span>
        {items.length > 5 && (
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-white/40 hover:text-white">
            {expanded ? 'Show less' : `+${items.length - 5} more`}
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {shown.map(name => (
          <div key={name} className="text-xs font-mono text-white/50">{name}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Raw Tab ──────────────────────────────────────────────────────────────────
function RawTab({ data }: { data: RawData | null }) {
  if (!data) return <Loading />
  const tables = Object.entries(data).filter(([k]) => k !== 'generatedAt')
  return (
    <div className="space-y-4">
      {tables.map(([tableName, rows]) => (
        <div key={tableName} className="rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/5">
            <span className="font-mono text-sm text-blue-400">{tableName}</span>
            <span className="text-xs text-white/40">{(rows as unknown[]).length} rows shown</span>
          </div>
          <pre className="p-3 text-xs font-mono text-white/60 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
            {JSON.stringify(rows, null, 2)}
          </pre>
        </div>
      ))}
      <p className="text-white/20 text-xs">Generated {new Date(data.generatedAt).toLocaleString()}</p>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function DebugModal() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('schema')
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null)
  const [coverageData, setCoverageData] = useState<CoverageData | null>(null)
  const [rawData, setRawData] = useState<RawData | null>(null)
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({ schema: false, coverage: false, raw: false })
  const [errors, setErrors] = useState<Record<TabKey, string | null>>({ schema: null, coverage: null, raw: null })

  const fetchTab = useCallback(async (tab: TabKey) => {
    const setters: Record<TabKey, (d: unknown) => void> = {
      schema: d => setSchemaData(d as SchemaData),
      coverage: d => setCoverageData(d as CoverageData),
      raw: d => setRawData(d as RawData),
    }
    const current = { schema: schemaData, coverage: coverageData, raw: rawData }[tab]
    if (current) return // already loaded

    setLoading(l => ({ ...l, [tab]: true }))
    setErrors(e => ({ ...e, [tab]: null }))
    try {
      const res = await fetch(`/api/debug/${tab}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setters[tab](data)
    } catch (e) {
      setErrors(err => ({ ...err, [tab]: String(e) }))
    } finally {
      setLoading(l => ({ ...l, [tab]: false }))
    }
  }, [schemaData, coverageData, rawData])

  const handleOpen = () => {
    setOpen(true)
    fetchTab('schema')
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabKey)
    fetchTab(tab as TabKey)
  }

  const currentData = { schema: schemaData, coverage: coverageData, raw: rawData }[activeTab]

  return (
    <>
      {/* Fixed debug button — desktop only */}
      <div className="fixed bottom-4 right-4 z-50 hidden md:block">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="bg-[#1a1a1a] border-white/20 text-white/50 hover:text-white hover:border-white/40 text-xs"
        >
          ⚙️ Debug
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-4xl w-full max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white font-semibold">⚙️ Debug Panel</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(currentData)}
                  className="text-white/40 hover:text-white text-xs h-7 px-2"
                >
                  Copy JSON
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Refresh current tab
                    const setters: Record<TabKey, () => void> = {
                      schema: () => setSchemaData(null),
                      coverage: () => setCoverageData(null),
                      raw: () => setRawData(null),
                    }
                    setters[activeTab]()
                    setTimeout(() => fetchTab(activeTab), 50)
                  }}
                  className="text-white/40 hover:text-white text-xs h-7 px-2"
                >
                  ↻ Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white h-7 w-7 p-0"
                >✕</Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-5 mt-3 mb-0 shrink-0 bg-white/5 w-fit">
              <TabsTrigger value="schema" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
                Schema
              </TabsTrigger>
              <TabsTrigger value="coverage" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
                Coverage
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
                Raw SQL
              </TabsTrigger>
            </TabsList>

            {(['schema', 'coverage', 'raw'] as TabKey[]).map(tab => (
              <TabsContent key={tab} value={tab} className="flex-1 overflow-y-auto px-5 py-4 mt-0">
                {loading[tab] ? (
                  <Loading />
                ) : errors[tab] ? (
                  <ErrorMsg msg={errors[tab]!} />
                ) : tab === 'schema' ? (
                  <SchemaTab data={schemaData} />
                ) : tab === 'coverage' ? (
                  <CoverageTab data={coverageData} />
                ) : (
                  <RawTab data={rawData} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
