import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@neondatabase/serverless', 'ws'],
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.futwiz.com',
      },
      {
        protocol: 'https',
        hostname: 'fut.gg',
      },
    ],
  },
}

export default nextConfig
