export type SharePairing = {
  boardNumber: number
  whitePlayerName: string
  blackPlayerName: string
}

export function formatRoundPairingsForWhatsApp(roundNumber: number, pairings: SharePairing[]): string {
  const sortedPairings = [...pairings].sort((a, b) => a.boardNumber - b.boardNumber)

  const lines = [
    `♟️ Chess Club - Round ${roundNumber} Pairings`,
    '',
    'Pairings:',
    ...sortedPairings.map(
      (pairing) => `Board ${pairing.boardNumber}: ${pairing.whitePlayerName} (White) vs ${pairing.blackPlayerName} (Black)`,
    ),
    '',
    'Board list:',
    ...sortedPairings.map((pairing) => `• Board ${pairing.boardNumber}: ${pairing.whitePlayerName} vs ${pairing.blackPlayerName}`),
  ]

  return lines.join('\n')
}
