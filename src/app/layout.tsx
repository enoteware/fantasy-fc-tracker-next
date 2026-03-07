import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fantasy FC Tracker',
  description: 'Track your Fantasy FC Ultimate Team player upgrades and performance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0f0f0f] text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
