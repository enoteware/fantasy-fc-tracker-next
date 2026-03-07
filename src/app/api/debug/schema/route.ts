import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TRACKED_TABLES = [
  'fantasy_fc_players',
  'fantasy_fc_matches',
  'fantasy_fc_player_matches',
  'fantasy_fc_player_stats',
  'fantasy_fc_upcoming_fixtures',
  'fantasy_fc_upgrades',
]

export async function GET() {
  try {
    // Get column info
    const columns = await prisma.$queryRaw`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY(${TRACKED_TABLES})
      ORDER BY table_name, ordinal_position
    ` as Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>

    // Get row counts per table
    const countQueries = TRACKED_TABLES.map(t =>
      prisma.$queryRawUnsafe(`SELECT '${t}' as table_name, COUNT(*)::int as row_count FROM ${t}`)
    )
    const countResults = await Promise.all(countQueries)
    const rowCounts: Record<string, number> = {}
    countResults.forEach(r => {
      const row = (r as Array<{ table_name: string; row_count: number }>)[0]
      rowCounts[row.table_name] = row.row_count
    })

    // Group columns by table
    const tables: Record<string, { columns: Array<{ name: string; type: string; nullable: boolean; default: string | null }>; rowCount: number }> = {}
    for (const col of columns) {
      if (!tables[col.table_name]) {
        tables[col.table_name] = { columns: [], rowCount: rowCounts[col.table_name] ?? 0 }
      }
      tables[col.table_name].columns.push({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
      })
    }

    return NextResponse.json({ tables, generatedAt: new Date().toISOString() })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
