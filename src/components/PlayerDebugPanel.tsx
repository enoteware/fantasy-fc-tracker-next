"use client"

import { useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerRaw {
  id: number
  name: string
  club: string
  position: string
  base_rating: number
  current_rating: number
  is_hero: boolean
  card_type: string
  release_date: string
  team: number
  league: string
  ea_id: number | null
  futgg_slug: string | null
  fifauteam_slug: string | null
  futbin_url: string | null
  card_color_primary: string | null
  card_color_secondary: string | null
  card_color_accent: string | null
}

interface StatsRaw {
  wins: number
  teamGoals: number
  ga: number
  cs: number
  attackingActions: number
  defensiveActions: number
}

interface UpgradeRow {
  upgrade_type: string
  earned_date: string
  applied: boolean
}

interface MatchRow {
  match_id: number
  date: string
  club: string
  opponent: string
  home_away: string
  league: string
  result: string
  score_for: number | null
  score_against: number | null
  goals: number
  assists: number
  clean_sheet: boolean
  attacking_actions: number
  defensive_actions: number
}

interface CommentRow {
  id: number
  field: string
  comment: string
  flagged: boolean
  resolved: boolean
  created_at: string
}

interface Props {
  playerId: number
  player: PlayerRaw
  stats: StatsRaw
  upgrades: UpgradeRow[]
  matches: MatchRow[]
  hasCardImage: boolean
}

// ─── Comment box per field ────────────────────────────────────────────────────

function FieldComment({
  playerId,
  field,
  existingComments,
}: {
  playerId: number
  field: string
  existingComments: CommentRow[]
}) {
  const [text, setText] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [comments, setComments] = useState<CommentRow[]>(existingComments)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/player-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, field, comment: text.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setComments((c) => [...c, data.row])
        setText("")
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 items-start text-xs text-amber-300/80 bg-amber-900/20 rounded px-2 py-1 mb-1">
          <span className="text-amber-400">⚠</span>
          <span>{c.comment}</span>
          <span className="ml-auto text-white/30 shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Flag issue..."
          className="flex-1 text-xs bg-black/30 border border-white/10 rounded px-2 py-1 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="text-xs px-2 py-1 rounded bg-amber-600/70 hover:bg-amber-600 text-white disabled:opacity-40"
        >
          {saved ? "✓" : saving ? "..." : "Flag"}
        </button>
      </div>
    </div>
  )
}

// ─── A single data row with field + value + comment box ───────────────────────

function DataRow({
  label,
  value,
  field,
  playerId,
  comments,
  warn,
}: {
  label: string
  value: React.ReactNode
  field: string
  playerId: number
  comments: CommentRow[]
  warn?: boolean
}) {
  const [open, setOpen] = useState(comments.length > 0)
  const hasComments = comments.length > 0

  return (
    <div className={`rounded-lg px-3 py-2 ${warn ? "bg-amber-900/20 border border-amber-600/30" : "bg-black/20"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-white/40 text-xs font-mono w-36 shrink-0">{label}</span>
        <span className="text-white text-sm flex-1 truncate font-mono">{value ?? <span className="text-white/20">null</span>}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`text-xs px-2 py-0.5 rounded shrink-0 ${
            hasComments
              ? "bg-amber-600/60 text-amber-200 hover:bg-amber-600"
              : "bg-white/5 text-white/30 hover:bg-white/10"
          }`}
        >
          {hasComments ? `⚠ ${comments.length}` : open ? "▲" : "comment"}
        </button>
      </div>
      {open && (
        <FieldComment playerId={playerId} field={field} existingComments={comments} />
      )}
    </div>
  )
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

type Tab = "player" | "stats" | "upgrades" | "matches" | "image"

const TABS: { key: Tab; label: string }[] = [
  { key: "player", label: "Player" },
  { key: "stats", label: "Stats" },
  { key: "upgrades", label: "Upgrades" },
  { key: "matches", label: "Matches" },
  { key: "image", label: "Card Image" },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function PlayerDebugPanel({ playerId, player, stats, upgrades, matches, hasCardImage }: Props) {
  const [tab, setTab] = useState<Tab>("player")
  const [allComments, setAllComments] = useState<CommentRow[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load comments on first render
  if (!loaded) {
    setLoaded(true)
    fetch(`/api/admin/player-comments?playerId=${playerId}`)
      .then((r) => r.json())
      .then((d) => setAllComments(d.comments ?? []))
      .catch(() => {})
  }

  function commentsFor(field: string) {
    return allComments.filter((c) => c.field === field)
  }

  function totalFlags() {
    return allComments.filter((c) => !c.resolved).length
  }

  return (
    <section className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/30">
        <span className="text-xs font-mono text-white/40">🛠 DATA AUDIT</span>
        <span className="text-xs text-white/60 font-semibold">{player.name}</span>
        <span className="text-xs text-white/30">id:{playerId}</span>
        {totalFlags() > 0 && (
          <span className="ml-auto text-xs bg-amber-600/80 text-amber-100 px-2 py-0.5 rounded-full">
            {totalFlags()} flag{totalFlags() !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "text-white border-b-2 border-blue-500 bg-white/5"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">

        {/* ── Player tab ── */}
        {tab === "player" && (
          <>
            <DataRow label="name" value={player.name} field="name" playerId={playerId} comments={commentsFor("name")} />
            <DataRow label="club" value={player.club} field="club" playerId={playerId} comments={commentsFor("club")} />
            <DataRow label="position" value={player.position} field="position" playerId={playerId} comments={commentsFor("position")} />
            <DataRow label="base_rating" value={player.base_rating} field="base_rating" playerId={playerId} comments={commentsFor("base_rating")} />
            <DataRow label="current_rating" value={player.current_rating} field="current_rating" playerId={playerId} comments={commentsFor("current_rating")} />
            <DataRow label="league" value={player.league} field="league" playerId={playerId} comments={commentsFor("league")} />
            <DataRow label="team" value={player.team === 1 ? "Team 1" : player.team === 2 ? "Team 2" : "SBC/OBJ"} field="team" playerId={playerId} comments={commentsFor("team")} />
            <DataRow label="is_hero" value={String(player.is_hero)} field="is_hero" playerId={playerId} comments={commentsFor("is_hero")} />
            <DataRow label="card_type" value={player.card_type} field="card_type" playerId={playerId} comments={commentsFor("card_type")} />
            <DataRow label="release_date" value={player.release_date} field="release_date" playerId={playerId} comments={commentsFor("release_date")} />
            <DataRow label="ea_id" value={player.ea_id ?? "MISSING"} field="ea_id" playerId={playerId} comments={commentsFor("ea_id")} warn={!player.ea_id} />
            <DataRow label="futgg_slug" value={player.futgg_slug ?? "MISSING"} field="futgg_slug" playerId={playerId} comments={commentsFor("futgg_slug")} warn={!player.futgg_slug} />
            <DataRow label="fifauteam_slug" value={player.fifauteam_slug ?? "MISSING"} field="fifauteam_slug" playerId={playerId} comments={commentsFor("fifauteam_slug")} warn={!player.fifauteam_slug} />
            <DataRow label="futbin_url" value={player.futbin_url ? <a href={player.futbin_url} target="_blank" className="text-blue-400 hover:underline truncate">{player.futbin_url}</a> : "MISSING"} field="futbin_url" playerId={playerId} comments={commentsFor("futbin_url")} warn={!player.futbin_url} />
            <DataRow label="card_color_primary" value={player.card_color_primary ? <span className="flex items-center gap-2"><span style={{ background: player.card_color_primary }} className="inline-block w-4 h-4 rounded-sm border border-white/20" />{player.card_color_primary}</span> : "MISSING"} field="card_color_primary" playerId={playerId} comments={commentsFor("card_color_primary")} warn={!player.card_color_primary} />
          </>
        )}

        {/* ── Stats tab ── */}
        {tab === "stats" && (
          <>
            <div className="text-xs text-white/30 mb-3 font-mono">Source: fifauteam scraper (updated 2x/day). These are the live values written to the DB.</div>
            <DataRow label="wins" value={`${stats.wins} / 6`} field="stat:wins" playerId={playerId} comments={commentsFor("stat:wins")} />
            <DataRow label="team_goals" value={`${stats.teamGoals} / 10`} field="stat:team_goals" playerId={playerId} comments={commentsFor("stat:team_goals")} />
            <DataRow label="ga (G/A)" value={`${stats.ga} / 1`} field="stat:ga" playerId={playerId} comments={commentsFor("stat:ga")} />
            <DataRow label="cs (clean sheets)" value={`${stats.cs} / 1`} field="stat:cs" playerId={playerId} comments={commentsFor("stat:cs")} />
            <DataRow label="att_actions" value={`${stats.attackingActions} / 6`} field="stat:att_actions" playerId={playerId} comments={commentsFor("stat:att_actions")} />
            <DataRow label="def_actions" value={`${stats.defensiveActions} / 12`} field="stat:def_actions" playerId={playerId} comments={commentsFor("stat:def_actions")} />
          </>
        )}

        {/* ── Upgrades tab ── */}
        {tab === "upgrades" && (
          <>
            {upgrades.length === 0 && (
              <div className="text-white/30 text-sm py-4 text-center">No upgrades in DB yet.</div>
            )}
            {upgrades.map((u, i) => (
              <div key={i} className="bg-black/20 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-white font-mono text-sm font-bold">{u.upgrade_type}</span>
                  <span className="text-white/40 text-xs">{u.earned_date}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${u.applied ? "bg-yellow-600/60 text-yellow-200" : "bg-green-600/40 text-green-300"}`}>
                    {u.applied ? "APPLIED" : "EARNED"}
                  </span>
                </div>
                <FieldComment playerId={playerId} field={`upgrade:${u.upgrade_type}`} existingComments={commentsFor(`upgrade:${u.upgrade_type}`)} />
              </div>
            ))}
          </>
        )}

        {/* ── Matches tab ── */}
        {tab === "matches" && (
          <>
            {matches.length === 0 && (
              <div className="text-white/30 text-sm py-4 text-center">No league match rows in DB.</div>
            )}
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-white/5 text-left text-white/40">
                  <tr>
                    <th className="px-2 py-2">date</th>
                    <th className="px-2 py-2">opponent</th>
                    <th className="px-2 py-2">H/A</th>
                    <th className="px-2 py-2">result</th>
                    <th className="px-2 py-2">score</th>
                    <th className="px-2 py-2">G</th>
                    <th className="px-2 py-2">A</th>
                    <th className="px-2 py-2">CS</th>
                    <th className="px-2 py-2">ATT</th>
                    <th className="px-2 py-2">DEF</th>
                    <th className="px-2 py-2">flag</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-2 py-1.5 text-white/60">{m.date}</td>
                      <td className="px-2 py-1.5 text-white">{m.opponent}</td>
                      <td className="px-2 py-1.5 text-white/50">{m.home_away}</td>
                      <td className={`px-2 py-1.5 font-bold ${m.result === "W" ? "text-green-400" : m.result === "L" ? "text-red-400" : "text-yellow-400"}`}>{m.result}</td>
                      <td className="px-2 py-1.5 text-white/60">{m.score_for ?? "?"}-{m.score_against ?? "?"}</td>
                      <td className="px-2 py-1.5 text-white">{m.goals}</td>
                      <td className="px-2 py-1.5 text-white">{m.assists}</td>
                      <td className="px-2 py-1.5 text-white/60">{m.clean_sheet ? "✓" : "-"}</td>
                      <td className="px-2 py-1.5 text-white/60">{m.attacking_actions}</td>
                      <td className="px-2 py-1.5 text-white/60">{m.defensive_actions}</td>
                      <td className="px-2 py-1.5">
                        <InlineMatchFlag playerId={playerId} matchId={m.match_id} existingComments={commentsFor(`match:${m.match_id}`)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Card Image tab ── */}
        {tab === "image" && (
          <>
            <DataRow
              label="has_card_image"
              value={hasCardImage ? "✓ yes" : "✗ MISSING"}
              field="card_image"
              playerId={playerId}
              comments={commentsFor("card_image")}
              warn={!hasCardImage}
            />
            <DataRow label="card_color_primary" value={player.card_color_primary ?? "null"} field="card_color_primary" playerId={playerId} comments={commentsFor("card_color_primary")} warn={!player.card_color_primary} />
            <DataRow label="card_color_secondary" value={player.card_color_secondary ?? "null"} field="card_color_secondary" playerId={playerId} comments={commentsFor("card_color_secondary")} warn={!player.card_color_secondary} />
            <DataRow label="card_color_accent" value={player.card_color_accent ?? "null"} field="card_color_accent" playerId={playerId} comments={commentsFor("card_color_accent")} warn={!player.card_color_accent} />
            {player.ea_id && (
              <div className="mt-3 text-xs text-white/40 font-mono">
                FUT.GG CDN pattern:<br/>
                <span className="text-blue-400 break-all">https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=400/2026/player-item/26-{player.ea_id}.&#123;hash&#125;.webp</span>
              </div>
            )}
          </>
        )}

      </div>
    </section>
  )
}

// ─── Inline flag button for match rows ───────────────────────────────────────

function InlineMatchFlag({ playerId, matchId, existingComments }: { playerId: number; matchId: number; existingComments: CommentRow[] }) {
  const [open, setOpen] = useState(false)
  const hasFlags = existingComments.length > 0

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`text-xs px-1.5 py-0.5 rounded ${hasFlags ? "bg-amber-600/60 text-amber-200" : "text-white/20 hover:text-white/50"}`}
      >
        {hasFlags ? `⚠${existingComments.length}` : "⚑"}
      </button>
      {open && (
        <FieldComment playerId={playerId} field={`match:${matchId}`} existingComments={existingComments} />
      )}
    </div>
  )
}
