export type LadderEntry = {
  playerId: string
  rank: number
  points: number
}

export type MatchResult = {
  winnerId: string | null
  loserId: string | null
  isDraw?: boolean
}

export function updateLadder(entries: LadderEntry[], results: MatchResult[]): LadderEntry[] {
  const next = entries.map((entry) => ({ ...entry }))
  const byId = new Map(next.map((entry) => [entry.playerId, entry]))

  results.forEach((result) => {
    if (result.isDraw && result.winnerId && result.loserId) {
      byId.get(result.winnerId)!.points += 1
      byId.get(result.loserId)!.points += 1
      return
    }

    if (result.winnerId) {
      byId.get(result.winnerId)!.points += 3
    }
  })

  return next
    .sort((a, b) => b.points - a.points || a.rank - b.rank)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
