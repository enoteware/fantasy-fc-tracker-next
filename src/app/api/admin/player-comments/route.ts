import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db-pg'

function isAllowed(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  return host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')
}

// GET /api/admin/player-comments?playerId=74
export async function GET(req: NextRequest) {
  if (!isAllowed(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const playerId = Number(req.nextUrl.searchParams.get('playerId'))
  if (!playerId) return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT id, field, comment, flagged, resolved, created_at
       FROM player_data_comments
       WHERE player_id = $1
       ORDER BY created_at ASC`,
      [playerId]
    )
    return NextResponse.json({ comments: rows })
  } finally {
    client.release()
  }
}

// POST /api/admin/player-comments
// Body: { playerId, field, comment }
export async function POST(req: NextRequest) {
  if (!isAllowed(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { playerId, field, comment } = body

  if (!playerId || !field || !comment?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `INSERT INTO player_data_comments (player_id, field, comment, flagged, resolved)
       VALUES ($1, $2, $3, true, false)
       RETURNING id, field, comment, flagged, resolved, created_at`,
      [playerId, field, comment.trim()]
    )
    return NextResponse.json({ ok: true, row: rows[0] })
  } finally {
    client.release()
  }
}
