// @ts-nocheck
import { PrismaNeonHttp } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined
}

function createPrismaClient() {
  const { PrismaClient } = require('../generated/prisma/client')
  
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  // Use HTTP-based adapter — no WebSocket, perfect for serverless
  const adapter = new PrismaNeonHttp(connectionString)
  
  return new PrismaClient({ adapter })
}

export const prisma: any = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
