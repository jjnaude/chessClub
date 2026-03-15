export type OpponentHistoryEntry = {
  whitePlayerId: string
  blackPlayerId: string
  playedAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function recentOpponentWeight(
  history: OpponentHistoryEntry[],
  playerAId: string,
  playerBId: string,
  now = new Date(),
): number {
  return history
    .filter((entry) => {
      const isPair =
        (entry.whitePlayerId === playerAId && entry.blackPlayerId === playerBId) ||
        (entry.whitePlayerId === playerBId && entry.blackPlayerId === playerAId)
      return isPair
    })
    .reduce((sum, entry) => {
      const ageInDays = Math.max(0, (now.getTime() - new Date(entry.playedAt).getTime()) / DAY_MS)
      return sum + 1 / (1 + ageInDays)
    }, 0)
}
