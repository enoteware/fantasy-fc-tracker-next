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
      const dbUrl = process.env.DATABASE_URL
      info.dbUrlLength = dbUrl.length
      info.dbUrlStart = dbUrl.substring(0, 20)
      info.dbUrlEnd = dbUrl.substring(dbUrl.length - 10)
      
      try {
        const pool = new Pool({ connectionString: dbUrl })
        info.poolCreated = true
        const adapter = new PrismaNeon(pool)
        
        const { PrismaClient } = require('../../../generated/prisma/client')
        const prisma = new PrismaClient({ adapter })
        
        const count = await prisma.fantasy_fc_players.count()
        info.connectionTest = `success: ${count} players`
        await prisma.$disconnect()
      } catch (dbErr) {
        info.dbError = String(dbErr)
      }
    }
  } catch (e) {
    info.error = String(e)
  }

  return NextResponse.json(info)
}
