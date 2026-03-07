// Load card images from the base64 JSON
// This is a server-side module - the JSON is ~15MB, loaded once at startup

let cardsCache: Record<string, string> | null = null

export function getCardImage(playerName: string): string | null {
  if (!cardsCache) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cardsCache = require('@/data/fantasy-cards.json')
    } catch {
      cardsCache = {}
    }
  }
  
  const key = playerName.toLowerCase().trim()
  
  // Try exact match first
  if (cardsCache![key]) return cardsCache![key]
  
  // Try partial match (first word)
  const firstName = key.split(' ')[0]
  const partialMatch = Object.entries(cardsCache!).find(([k]) => 
    k.includes(firstName) || firstName.includes(k.split(' ')[0])
  )
  
  return partialMatch ? partialMatch[1] : null
}

export function getAllCardKeys(): string[] {
  if (!cardsCache) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cardsCache = require('@/data/fantasy-cards.json')
    } catch {
      cardsCache = {}
    }
  }
  return Object.keys(cardsCache!)
}
