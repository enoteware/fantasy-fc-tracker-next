// @ts-nocheck
import { NextResponse } from 'next/server'

export async function GET() {
  const info: Record<string, unknown> = {
    nodeVersion: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? '***SET***' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
    },
    dbUrlLength: process.env.DATABASE_URL?.length,
    dbUrlStart: process.env.DATABASE_URL?.substring(0, 20),
    dbUrlEnd: process.env.DATABASE_URL?.slice(-10),
    connectionTest: null,
    error: null,
  }

  try {
    const { PrismaNeonHttp } = require('@prisma/adapter-neon')
    info.hasAdapter = true

    const { PrismaClient } = require('../../../generated/prisma/client')
    info.hasPrismaClient = true

    if (process.env.DATABASE_URL) {
      const adapter = new PrismaNeonHttp(process.env.DATABASE_URL)
      const prisma = new PrismaClient({ adapter })
      
      const count = await prisma.fantasy_fc_players.count()
      info.connectionTest = `success: ${count} players`
      await prisma.$disconnect()
    }
  } catch (e) {
    info.error = String(e)
  }

  return NextResponse.json(info)
}
