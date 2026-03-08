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

// ─── Comment box ──────────────────────────────────────────────────────────────

function FieldComment({ playerId, field, existingComments }: {
  playerId: number
  field: string
  existingComments: CommentRow[]
}) {
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
        setComments(c => [...c, data.row])
        setText("")
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1.5 space-y-1">
      {comments.map(c => (
        <div key={c.id} className="flex gap-2 items-start text-xs text-amber-300/80 bg-amber-900/20 rounded px-2 py-1">
          <span className="text-amber-400 shrink-0">⚠</span>
          <span className="flex-1">{c.comment}</span>
          <span className="text-white/30 shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Flag an issue with this field…"
          className="flex-1 text-xs bg-black/30 border border-white/10 rounded px-2 py-1 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="text-xs px-2 py-1 rounded bg-amber-600/70 hover:bg-amber-600 text-white disabled:opacity-40 shrink-0"
        >
          {saved ? "✓ saved" : saving ? "…" : "Flag"}
        </button>
      </div>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <div className="pt-5 pb-1 border-t border-white/10 mt-4">
      <span className="text-white/40 text-xs font-semibold uppercase tracking-widest font-mono">{title}</span>
    </div>
  )
}

// ─── A single field row ───────────────────────────────────────────────────────

function FieldRow({ label, value, field, playerId, comments, warn }: {
  label: string
  value: React.ReactNode
  field: string
  playerId: number
  comments: CommentRow[]
  warn?: boolean
}) {
  const [open, setOpen] = useState(comments.length > 0)

  return (
    <div className={`rounded-lg px-3 py-2 ${warn ? "bg-amber-900/20 border border-amber-600/30" : "bg-black/20"}`}>
      <div className="flex items-center gap-2">
        <span className="text-white/35 text-xs font-mono w-40 shrink-0">{label}</span>
        <span className="text-white text-sm flex-1 font-mono break-all">{value ?? <span className="text-white/20 italic">null</span>}</span>
        <button
          onClick={() => setOpen(o => !o)}
          className={`text-xs px-2 py-0.5 rounded shrink-0 transition-colors ${
            comments.length > 0
              ? "bg-amber-600/60 text-amber-200 hover:bg-amber-600"
              : open
              ? "bg-white/10 text-white/50"
              : "bg-white/5 text-white/25 hover:bg-white/10"
          }`}
        >
          {comments.length > 0 ? `⚠ ${comments.length}` : open ? "▲" : "comment"}
        </button>
      </div>
      {open && <FieldComment playerId={playerId} field={field} existingComments={comments} />}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PlayerDebugPanel({ playerId, player, stats, upgrades, matches, hasCardImage }: Props) {
  const [allComments, setAllComments] = useState<CommentRow[]>([])
  const [loaded, setLoaded] = useState(false)

  if (!loaded) {
    setLoaded(true)
    fetch(`/api/admin/player-comments?playerId=${playerId}`)
      .then(r => r.json())
      .then(d => setAllComments(d.comments ?? []))
      .catch(() => {})
  }

  function cf(field: string) {
    return allComments.filter(c => c.field === field)
  }

  const totalFlags = allComments.filter(c => !c.resolved).length

  return (
    <section className="bg-[#0d0d0d] border border-white/10 rounded-xl p-5 space-y-2 font-mono">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">🛠 Data Audit</span>
        <span className="text-white/30 text-xs">#{playerId} — {player.name}</span>
        {totalFlags > 0 && (
          <span className="ml-auto text-xs bg-amber-600/80 text-amber-100 px-2 py-0.5 rounded-full">
            {totalFlags} flag{totalFlags !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Player identity ── */}
      <SectionHead title="Player" />
      <FieldRow label="name" value={player.name} field="name" playerId={playerId} comments={cf("name")} />
      <FieldRow label="club" value={player.club} field="club" playerId={playerId} comments={cf("club")} />
      <FieldRow label="position" value={player.position} field="position" playerId={playerId} comments={cf("position")} />
      <FieldRow label="league" value={player.league} field="league" playerId={playerId} comments={cf("league")} />
      <FieldRow label="team" value={player.team === 1 ? "Team 1" : player.team === 2 ? "Team 2" : `SBC/OBJ (${player.team})`} field="team" playerId={playerId} comments={cf("team")} />
      <FieldRow label="base_rating" value={player.base_rating} field="base_rating" playerId={playerId} comments={cf("base_rating")} />
      <FieldRow label="current_rating" value={player.current_rating} field="current_rating" playerId={playerId} comments={cf("current_rating")} />
      <FieldRow label="is_hero" value={String(player.is_hero)} field="is_hero" playerId={playerId} comments={cf("is_hero")} />
      <FieldRow label="card_type" value={player.card_type} field="card_type" playerId={playerId} comments={cf("card_type")} />
      <FieldRow label="release_date" value={player.release_date} field="release_date" playerId={playerId} comments={cf("release_date")} />

      {/* ── External IDs ── */}
      <SectionHead title="External IDs / Links" />
      <FieldRow label="ea_id" value={player.ea_id ?? "⚠ MISSING"} field="ea_id" playerId={playerId} comments={cf("ea_id")} warn={!player.ea_id} />
      <FieldRow label="futgg_slug" value={player.futgg_slug ?? "⚠ MISSING"} field="futgg_slug" playerId={playerId} comments={cf("futgg_slug")} warn={!player.futgg_slug} />
      <FieldRow label="fifauteam_slug" value={player.fifauteam_slug ?? "⚠ MISSING"} field="fifauteam_slug" playerId={playerId} comments={cf("fifauteam_slug")} warn={!player.fifauteam_slug} />
      <FieldRow
        label="futbin_url"
        value={player.futbin_url
          ? <a href={player.futbin_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{player.futbin_url}</a>
          : "⚠ MISSING"}
        field="futbin_url"
        playerId={playerId}
        comments={cf("futbin_url")}
        warn={!player.futbin_url}
      />

      {/* ── Card image ── */}
      <SectionHead title="Card Image" />
      <FieldRow label="has_card_image" value={hasCardImage ? "✓ yes" : "⚠ MISSING"} field="card_image" playerId={playerId} comments={cf("card_image")} warn={!hasCardImage} />
      <FieldRow label="card_color_primary" value={
        player.card_color_primary
          ? <span className="flex items-center gap-2"><span style={{ background: player.card_color_primary }} className="inline-block w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0" />{player.card_color_primary}</span>
          : "⚠ MISSING"
      } field="card_color_primary" playerId={playerId} comments={cf("card_color_primary")} warn={!player.card_color_primary} />
      <FieldRow label="card_color_secondary" value={
        player.card_color_secondary
          ? <span className="flex items-center gap-2"><span style={{ background: player.card_color_secondary }} className="inline-block w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0" />{player.card_color_secondary}</span>
          : "⚠ MISSING"
      } field="card_color_secondary" playerId={playerId} comments={cf("card_color_secondary")} warn={!player.card_color_secondary} />
      <FieldRow label="card_color_accent" value={
        player.card_color_accent
          ? <span className="flex items-center gap-2"><span style={{ background: player.card_color_accent }} className="inline-block w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0" />{player.card_color_accent}</span>
          : "⚠ MISSING"
      } field="card_color_accent" playerId={playerId} comments={cf("card_color_accent")} warn={!player.card_color_accent} />
      {player.ea_id && (
        <div className="text-xs text-white/25 px-1 pt-1">
          FUT.GG CDN: https://game-assets.fut.gg/…/2026/player-item/26-{player.ea_id}.&#123;hash&#125;.webp
        </div>
      )}

      {/* ── Live stats ── */}
      <SectionHead title="Live Stats (fifauteam)" />
      <FieldRow label="wins" value={`${stats.wins} / 6`} field="stat:wins" playerId={playerId} comments={cf("stat:wins")} />
      <FieldRow label="team_goals" value={`${stats.teamGoals} / 10`} field="stat:team_goals" playerId={playerId} comments={cf("stat:team_goals")} />
      <FieldRow label="ga (G/A)" value={`${stats.ga} / 1`} field="stat:ga" playerId={playerId} comments={cf("stat:ga")} />
      <FieldRow label="cs" value={`${stats.cs} / 1`} field="stat:cs" playerId={playerId} comments={cf("stat:cs")} />
      <FieldRow label="att_actions" value={`${stats.attackingActions} / 6`} field="stat:att_actions" playerId={playerId} comments={cf("stat:att_actions")} />
      <FieldRow label="def_actions" value={`${stats.defensiveActions} / 12`} field="stat:def_actions" playerId={playerId} comments={cf("stat:def_actions")} />

      {/* ── Upgrades ── */}
      <SectionHead title="Upgrades" />
      {upgrades.length === 0 && <div className="text-white/25 text-xs py-2">No upgrade rows in DB.</div>}
      {upgrades.map((u, i) => (
        <div key={i} className="bg-black/20 rounded-lg px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-sm">{u.upgrade_type}</span>
            <span className="text-white/40 text-xs">{u.earned_date}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${u.applied ? "bg-yellow-600/50 text-yellow-200" : "bg-green-700/40 text-green-300"}`}>
              {u.applied ? "APPLIED" : "EARNED"}
            </span>
          </div>
          <FieldComment playerId={playerId} field={`upgrade:${u.upgrade_type}`} existingComments={cf(`upgrade:${u.upgrade_type}`)} />
        </div>
      ))}

      {/* ── Schema ── */}
      <SchemaSection />

      {/* ── Matches ── */}
      <SectionHead title="League Matches" />
      {matches.length === 0 && <div className="text-white/25 text-xs py-2">No league match rows in DB.</div>}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-xs">
          <thead className="bg-white/5 text-white/35 text-left">
            <tr>
              {["date","opponent","H/A","result","score","G","A","CS","ATT","DEF","⚑"].map(h => (
                <th key={h} className="px-2 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <MatchRowEl key={i} m={m} playerId={playerId} comments={cf(`match:${m.match_id}`)} />
            ))}
          </tbody>
        </table>
      </div>

    </section>
  )
}

// ─── Schema section ───────────────────────────────────────────────────────────

const SCHEMA: Record<string, Array<{ col: string; type: string; nullable: boolean; note?: string }>> = {
  "fantasy_fc_players": [
    { col: "id", type: "integer", nullable: false },
    { col: "name", type: "varchar(255)", nullable: false },
    { col: "club", type: "varchar(255)", nullable: false },
    { col: "position", type: "varchar(10)", nullable: false },
    { col: "base_rating", type: "integer", nullable: false },
    { col: "current_rating", type: "integer", nullable: false },
    { col: "is_hero", type: "boolean", nullable: true, note: "default false" },
    { col: "card_type", type: "varchar(50)", nullable: true, note: "default 'standard'" },
    { col: "release_date", type: "date", nullable: true },
    { col: "end_date", type: "date", nullable: true },
    { col: "league", type: "varchar(100)", nullable: true },
    { col: "team", type: "integer", nullable: true, note: "1=T1 2=T2 0=SBC/OBJ" },
    { col: "ea_id", type: "integer", nullable: true },
    { col: "futgg_slug", type: "text", nullable: true },
    { col: "fifauteam_slug", type: "text", nullable: true },
    { col: "futbin_url", type: "text", nullable: true },
    { col: "card_color_primary", type: "varchar(7)", nullable: true },
    { col: "card_color_secondary", type: "varchar(7)", nullable: true },
    { col: "card_color_accent", type: "varchar(7)", nullable: true },
    { col: "sofascore_id", type: "integer", nullable: true },
    { col: "upgrades_applied", type: "integer", nullable: true, note: "default 0" },
    { col: "created_at / updated_at", type: "timestamp", nullable: true },
  ],
  "fantasy_fc_player_stats": [
    { col: "id", type: "integer", nullable: false },
    { col: "player_id", type: "integer", nullable: true, note: "FK → players.id UNIQUE" },
    { col: "goals", type: "integer", nullable: true, note: "default 0 (legacy)" },
    { col: "assists", type: "integer", nullable: true, note: "default 0 (legacy)" },
    { col: "clean_sheets", type: "integer", nullable: true, note: "default 0 (legacy)" },
    { col: "attacking_actions", type: "integer", nullable: true, note: "default 0" },
    { col: "defensive_actions", type: "integer", nullable: true, note: "default 0" },
    { col: "wins", type: "integer", nullable: true, note: "fifauteam team wins → /6" },
    { col: "team_goals", type: "integer", nullable: true, note: "fifauteam team goals → /10" },
    { col: "ga", type: "integer", nullable: true, note: "G/A combined → /1" },
    { col: "cs", type: "integer", nullable: true, note: "clean sheets → /1" },
    { col: "upgrade_goal_assist_earned/applied", type: "boolean", nullable: true, note: "legacy" },
    { col: "upgrade_actions_earned/applied", type: "boolean", nullable: true, note: "legacy" },
    { col: "created_at / updated_at", type: "timestamp", nullable: true },
  ],
  "fantasy_fc_upgrades": [
    { col: "id", type: "integer", nullable: false },
    { col: "player_id", type: "integer", nullable: true, note: "FK → players.id" },
    { col: "upgrade_type", type: "varchar(50)", nullable: false, note: "1G 1A AC DC BC CS 6P TG" },
    { col: "tier", type: "integer", nullable: true },
    { col: "earned_date", type: "date", nullable: false },
    { col: "applied", type: "boolean", nullable: true, note: "default false (EA in-game push)" },
    { col: "ovr_boost", type: "integer", nullable: true },
    { col: "stat_boost / playstyle_boost", type: "varchar(100)", nullable: true },
    { col: "created_at", type: "timestamp", nullable: true },
    { col: "UNIQUE", type: "(player_id, upgrade_type, tier)", nullable: false },
  ],
  "fantasy_fc_matches": [
    { col: "id", type: "integer", nullable: false },
    { col: "club", type: "varchar(255)", nullable: false },
    { col: "opponent", type: "varchar(255)", nullable: false },
    { col: "match_date", type: "date", nullable: false },
    { col: "home_away", type: "varchar(10)", nullable: false },
    { col: "league", type: "varchar(100)", nullable: false },
    { col: "result", type: "varchar(10)", nullable: true, note: "W/D/L" },
    { col: "score_for / score_against", type: "integer", nullable: true },
    { col: "goals_scored", type: "integer", nullable: true, note: "default 0" },
    { col: "clean_sheet", type: "boolean", nullable: true },
    { col: "tracked / processed", type: "boolean", nullable: true },
    { col: "sofascore_id", type: "varchar(50)", nullable: true },
    { col: "created_at / updated_at", type: "timestamp", nullable: true },
  ],
  "fantasy_fc_player_matches": [
    { col: "id", type: "integer", nullable: false },
    { col: "player_id", type: "integer", nullable: true, note: "FK → players.id" },
    { col: "match_id", type: "integer", nullable: true, note: "FK → matches.id" },
    { col: "goals / assists", type: "integer", nullable: true, note: "default 0" },
    { col: "clean_sheet", type: "boolean", nullable: true },
    { col: "attacking_actions / defensive_actions", type: "integer", nullable: true },
    { col: "minutes_played", type: "integer", nullable: true },
    { col: "sofascore_rating", type: "numeric", nullable: true },
    { col: "sofascore_event_id", type: "integer", nullable: true },
    { col: "yellow_card / red_card", type: "boolean", nullable: true },
    { col: "shots / shots_on_target", type: "integer", nullable: true },
    { col: "key_passes / successful_dribbles", type: "integer", nullable: true },
    { col: "touches_in_box", type: "integer", nullable: true },
    { col: "tackles_won / interceptions / clearances / blocks", type: "integer", nullable: true },
    { col: "saves / goals_conceded", type: "integer", nullable: true },
    { col: "created_at", type: "timestamp", nullable: true },
  ],
  "fantasy_fc_upcoming_fixtures": [
    { col: "id", type: "integer", nullable: false },
    { col: "club", type: "varchar(100)", nullable: false },
    { col: "opponent", type: "varchar(100)", nullable: false },
    { col: "match_date", type: "date", nullable: false },
    { col: "competition", type: "varchar(100)", nullable: true },
    { col: "home_away", type: "varchar(10)", nullable: true },
    { col: "league", type: "varchar(100)", nullable: true },
    { col: "created_at / updated_at", type: "timestamp", nullable: true },
  ],
  "player_data_comments": [
    { col: "id", type: "integer", nullable: false },
    { col: "player_id", type: "integer", nullable: false, note: "FK → players.id" },
    { col: "field", type: "text", nullable: false, note: "e.g. 'is_hero', 'stat:wins', 'match:42'" },
    { col: "comment", type: "text", nullable: false },
    { col: "flagged", type: "boolean", nullable: true, note: "default true" },
    { col: "resolved", type: "boolean", nullable: true, note: "default false" },
    { col: "created_at / updated_at", type: "timestamptz", nullable: true },
  ],
}

function SchemaSection() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-white/10 mt-4 pt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-mono uppercase tracking-widest transition-colors"
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>DB Schema</span>
        <span className="text-white/15 normal-case tracking-normal">(7 tables)</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {Object.entries(SCHEMA).map(([table, cols]) => (
            <div key={table}>
              <div className="text-blue-400/70 text-xs font-mono font-semibold mb-1">{table}</div>
              <div className="bg-black/30 rounded-lg overflow-hidden">
                {cols.map((c, i) => (
                  <div key={i} className={`flex items-baseline gap-2 px-3 py-1 text-xs font-mono ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                    <span className="text-white/70 w-64 shrink-0">{c.col}</span>
                    <span className="text-emerald-400/70 w-36 shrink-0">{c.type}</span>
                    <span className={`shrink-0 ${c.nullable ? "text-white/20" : "text-amber-400/60"}`}>
                      {c.nullable ? "null" : "NOT NULL"}
                    </span>
                    {c.note && <span className="text-white/25 truncate">{c.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchRowEl({ m, playerId, comments }: { m: MatchRow; playerId: number; comments: CommentRow[] }) {
  const [open, setOpen] = useState(comments.length > 0)
  return (
    <>
      <tr className="border-t border-white/10 hover:bg-white/5">
        <td className="px-2 py-1.5 text-white/50">{m.date}</td>
        <td className="px-2 py-1.5 text-white">{m.opponent}</td>
        <td className="px-2 py-1.5 text-white/40">{m.home_away}</td>
        <td className={`px-2 py-1.5 font-bold ${m.result === "W" ? "text-green-400" : m.result === "L" ? "text-red-400" : "text-yellow-400"}`}>{m.result}</td>
        <td className="px-2 py-1.5 text-white/50">{m.score_for ?? "?"}-{m.score_against ?? "?"}</td>
        <td className="px-2 py-1.5 text-white">{m.goals}</td>
        <td className="px-2 py-1.5 text-white">{m.assists}</td>
        <td className="px-2 py-1.5 text-white/50">{m.clean_sheet ? "✓" : "–"}</td>
        <td className="px-2 py-1.5 text-white/50">{m.attacking_actions}</td>
        <td className="px-2 py-1.5 text-white/50">{m.defensive_actions}</td>
        <td className="px-2 py-1.5">
          <button
            onClick={() => setOpen(o => !o)}
            className={`text-xs px-1.5 py-0.5 rounded ${comments.length > 0 ? "bg-amber-600/60 text-amber-200" : "text-white/20 hover:text-white/50"}`}
          >
            {comments.length > 0 ? `⚠${comments.length}` : "⚑"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-amber-600/20 bg-amber-900/10">
          <td colSpan={11} className="px-3 py-2">
            <FieldComment playerId={playerId} field={`match:${m.match_id}`} existingComments={comments} />
          </td>
        </tr>
      )}
    </>
  )
}
