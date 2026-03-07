// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../generated/prisma/client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaNeon } = require('@prisma/adapter-neon')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('@neondatabase/serverless')

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any | undefined
}

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaNeon(pool)
  return new PrismaClient({ adapter })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
