// @ts-nocheck
import { neon, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

// Use HTTP fetch mode for serverless (no WebSocket required)
neonConfig.fetchConnectionCache = true

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined
}

function createPrismaClient() {
  const { PrismaClient } = require('../generated/prisma/client')
  
  // Use neon() HTTP client for serverless — much simpler than Pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  // NeonHttp adapter approach
  const { Pool } = require('@neondatabase/serverless')
  const pool = new Pool({ connectionString })
  const adapter = new PrismaNeon(pool)
  
  return new PrismaClient({ adapter })
}

export const prisma: any = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
