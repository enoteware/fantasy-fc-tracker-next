// @ts-nocheck
import { NextResponse } from 'next/server'

export async function GET() {
  const info: Record<string, unknown> = {
    nodeVersion: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? '***SET***' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
    },
    hasPool: false,
    hasPrismaClient: false,
    connectionTest: null,
    error: null,
  }

  try {
    const { Pool } = require('@neondatabase/serverless')
    info.hasPool = true

    const { PrismaNeon } = require('@prisma/adapter-neon')
    info.hasPrismaAdapter = true

    // Try loading the generated client
    try {
      const generatedClient = require('../../../generated/prisma/client')
      info.hasPrismaClient = typeof generatedClient.PrismaClient === 'function'
    } catch (e) {
      info.prismaClientError = String(e)
    }

    if (process.env.DATABASE_URL) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL })
      const adapter = new PrismaNeon(pool)
      
      const { PrismaClient } = require('../../../generated/prisma/client')
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
