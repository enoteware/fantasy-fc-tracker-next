"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  playerId: number
  playerName: string
  initialStats: {
    wins: number
    teamGoals: number
    ga: number
    cs: number
    attackingActions: number
    defensiveActions: number
  }
  upgrades: Array<{ upgrade_type: string; earned_date: string; applied: boolean }>
  rawMatchData: Array<{ date: string; opponent: string; result: string; goals: number; assists: number }>
}

type Status =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null

type StatKey = keyof Props["initialStats"]

const FIELD_CONFIG: Array<{
  key: StatKey
  label: string
  min: number
  max: number
}> = [
  { key: "wins", label: "Wins", min: 0, max: 10 },
  { key: "teamGoals", label: "Team Goals", min: 0, max: 20 },
  { key: "ga", label: "G/A", min: 0, max: 10 },
  { key: "cs", label: "Clean Sheets", min: 0, max: 10 },
  { key: "attackingActions", label: "Att. Actions", min: 0, max: 30 },
  { key: "defensiveActions", label: "Def. Actions", min: 0, max: 30 },
]

export function PlayerDebugPanel({
  playerId,
  playerName,
  initialStats,
  upgrades,
  rawMatchData,
}: Props) {
  const [stats, setStats] = useState(initialStats)
  const [status, setStatus] = useState<Status>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setStatus(null)

    try {
      const response = await fetch("/api/admin/player-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          ...stats,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed")
      }

      setStatus({
        type: "success",
        message: `Saved corrected stats for ${playerName}.`,
      })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Save failed",
      })
    } finally {
      setSaving(false)
    }
  }

  function updateStat(key: StatKey, value: string, min: number, max: number) {
    const parsed = value === "" ? 0 : Number(value)
    const nextValue = Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, Math.trunc(parsed)))
      : 0

    setStats((current) => ({
      ...current,
      [key]: nextValue,
    }))
  }

  return (
    <section className="bg-[#1a1a1a] rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            🛠 Debug / Edit Stats
          </p>
          <p className="text-white/35 text-xs mt-1">
            Localhost-only manual overrides for fifauteam live stats.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-600/50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELD_CONFIG.map((field) => (
          <label key={field.key} className="space-y-1.5">
            <span className="text-xs text-white/55">{field.label}</span>
            <Input
              type="number"
              min={field.min}
              max={field.max}
              value={stats[field.key]}
              onChange={(event) =>
                updateStat(field.key, event.target.value, field.min, field.max)
              }
              className="h-10 border-white/10 bg-black/20 text-white"
            />
          </label>
        ))}
      </div>

      {status && (
        <p
          className={
            status.type === "success"
              ? "text-sm text-green-400"
              : "text-sm text-red-400"
          }
        >
          {status.message}
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">
          Upgrade Rows
        </h3>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">type</th>
                <th className="px-3 py-2 font-medium">earned_date</th>
                <th className="px-3 py-2 font-medium">applied</th>
              </tr>
            </thead>
            <tbody>
              {upgrades.length > 0 ? (
                upgrades.map((upgrade, index) => (
                  <tr key={`${upgrade.upgrade_type}-${upgrade.earned_date}-${index}`} className="border-t border-white/10">
                    <td className="px-3 py-2 text-white">{upgrade.upgrade_type}</td>
                    <td className="px-3 py-2 text-white/65">{upgrade.earned_date}</td>
                    <td className="px-3 py-2 text-white/65">{String(upgrade.applied)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-white/35">
                    No upgrade rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">
          Raw Match Data
        </h3>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">date</th>
                <th className="px-3 py-2 font-medium">opponent</th>
                <th className="px-3 py-2 font-medium">result</th>
                <th className="px-3 py-2 font-medium">goals</th>
                <th className="px-3 py-2 font-medium">assists</th>
              </tr>
            </thead>
            <tbody>
              {rawMatchData.length > 0 ? (
                rawMatchData.map((match, index) => (
                  <tr key={`${match.date}-${match.opponent}-${index}`} className="border-t border-white/10">
                    <td className="px-3 py-2 text-white/65">{match.date}</td>
                    <td className="px-3 py-2 text-white">{match.opponent}</td>
                    <td className="px-3 py-2 text-white/65">{match.result}</td>
                    <td className="px-3 py-2 text-white/65">{match.goals}</td>
                    <td className="px-3 py-2 text-white/65">{match.assists}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-white/35">
                    No league match rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
