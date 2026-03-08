import { NextRequest, NextResponse } from "next/server"

import { pool } from "@/lib/db-pg"

interface PlayerStatsPayload {
  playerId: number
  wins: number
  teamGoals: number
  ga: number
  cs: number
  attackingActions: number
  defensiveActions: number
}

function isLocalhostHost(host: string | null): boolean {
  if (!host) return false
  return host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.")
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

function parseBody(body: unknown): PlayerStatsPayload | null {
  if (!body || typeof body !== "object") return null

  const candidate = body as Record<string, unknown>
  const playerId = toInt(candidate.playerId)
  const wins = toInt(candidate.wins)
  const teamGoals = toInt(candidate.teamGoals)
  const ga = toInt(candidate.ga)
  const cs = toInt(candidate.cs)
  const attackingActions = toInt(candidate.attackingActions)
  const defensiveActions = toInt(candidate.defensiveActions)

  if (
    playerId === null ||
    wins === null ||
    teamGoals === null ||
    ga === null ||
    cs === null ||
    attackingActions === null ||
    defensiveActions === null
  ) {
    return null
  }

  return {
    playerId,
    wins,
    teamGoals,
    ga,
    cs,
    attackingActions,
    defensiveActions,
  }
}

export async function POST(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!isLocalhostHost(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const payload = parseBody(await request.json())
    if (!payload) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const {
      playerId,
      wins,
      teamGoals,
      ga,
      cs,
      attackingActions,
      defensiveActions,
    } = payload

    await pool.query(
      `
        INSERT INTO fantasy_fc_player_stats (
          player_id,
          wins,
          team_goals,
          ga,
          cs,
          attacking_actions,
          defensive_actions,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (player_id) DO UPDATE SET
          wins=$2,
          team_goals=$3,
          ga=$4,
          cs=$5,
          attacking_actions=$6,
          defensive_actions=$7,
          updated_at=NOW()
      `,
      [playerId, wins, teamGoals, ga, cs, attackingActions, defensiveActions]
    )

    return NextResponse.json({
      ok: true,
      updated: {
        playerId,
        wins,
        teamGoals,
        ga,
        cs,
        attackingActions,
        defensiveActions,
      },
    })
  } catch (error) {
    console.error("Admin player stats update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
