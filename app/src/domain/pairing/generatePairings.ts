export type PairingPlayer = {
  id: string
  fullName: string
  ladderRank: number
}

export type PairingAttendance = {
  playerId: string
  isAvailable: boolean
}

export type PairingHistoryEntry = {
  whitePlayerId: string
  blackPlayerId: string
  playedAt: string
}

export type PairingConstraint = {
  id?: string
  constraintType: 'force_pair' | 'forbid_pair'
  playerAId: string
  playerBId: string
}

export type PairingProposal = {
  boardNumber: number
  whitePlayerId: string
  blackPlayerId: string
}

export type PairingGenerationResult = {
  proposal: PairingProposal[]
  unpairedPlayerIds: string[]
  warnings: string[]
}

const pairKey = (playerAId: string, playerBId: string) =>
  [playerAId, playerBId].sort((a, b) => a.localeCompare(b)).join('::')

export function generatePairings(args: {
  players: PairingPlayer[]
  attendance: PairingAttendance[]
  pairingHistory: PairingHistoryEntry[]
  pairingConstraints: PairingConstraint[]
}): PairingGenerationResult {
  const { players, attendance, pairingHistory, pairingConstraints } = args

  const availableIds = new Set(
    attendance.filter((row) => row.isAvailable).map((row) => row.playerId),
  )

  const availablePlayers = players
    .filter((player) => availableIds.has(player.id))
    .sort((a, b) => a.ladderRank - b.ladderRank)

  const playerById = new Map(players.map((player) => [player.id, player]))
  const proposal: PairingProposal[] = []
  const warnings: string[] = []
  const pairedPlayerIds = new Set<string>()

  const forcedPairs = pairingConstraints.filter((entry) => entry.constraintType === 'force_pair')
  const forbiddenPairKeys = new Set(
    pairingConstraints
      .filter((entry) => entry.constraintType === 'forbid_pair')
      .map((entry) => pairKey(entry.playerAId, entry.playerBId)),
  )

  for (const forcedPair of forcedPairs) {
    const { playerAId, playerBId } = forcedPair

    if (!availableIds.has(playerAId) || !availableIds.has(playerBId)) {
      warnings.push('Skipped a force pair because one or both players are not available.')
      continue
    }

    if (pairedPlayerIds.has(playerAId) || pairedPlayerIds.has(playerBId)) {
      warnings.push('Skipped a force pair because one or both players were already paired.')
      continue
    }

    proposal.push({
      boardNumber: proposal.length + 1,
      whitePlayerId: playerAId,
      blackPlayerId: playerBId,
    })
    pairedPlayerIds.add(playerAId)
    pairedPlayerIds.add(playerBId)
  }

  const remainingPlayers = availablePlayers.filter((player) => !pairedPlayerIds.has(player.id))

  const hasPlayedRecently = (playerAId: string, playerBId: string) => {
    const key = pairKey(playerAId, playerBId)
    return pairingHistory.some((entry) => pairKey(entry.whitePlayerId, entry.blackPlayerId) === key)
  }

  for (let index = 0; index < remainingPlayers.length - 1; index += 2) {
    const first = remainingPlayers[index]
    let second = remainingPlayers[index + 1]

    const isForbidden = (candidate: PairingPlayer) =>
      forbiddenPairKeys.has(pairKey(first.id, candidate.id))

    if (isForbidden(second) && index + 2 < remainingPlayers.length) {
      const alternative = remainingPlayers[index + 2]
      if (!isForbidden(alternative)) {
        remainingPlayers[index + 1] = alternative
        remainingPlayers[index + 2] = second
        second = alternative
      }
    }

    if (isForbidden(second)) {
      warnings.push('A forbidden pair could not be avoided with the placeholder heuristic.')
    }

    if (hasPlayedRecently(first.id, second.id)) {
      warnings.push('A repeat pairing from history was included by the placeholder heuristic.')
    }

    proposal.push({
      boardNumber: proposal.length + 1,
      whitePlayerId: first.id,
      blackPlayerId: second.id,
    })
    pairedPlayerIds.add(first.id)
    pairedPlayerIds.add(second.id)
  }

  const unpairedPlayerIds = availablePlayers
    .filter((player) => !pairedPlayerIds.has(player.id))
    .map((player) => player.id)

  if (unpairedPlayerIds.length > 0) {
    const names = unpairedPlayerIds
      .map((playerId) => playerById.get(playerId)?.fullName ?? 'Unknown player')
      .join(', ')
    warnings.push(`Unpaired player(s): ${names}.`)
  }

  return {
    proposal,
    unpairedPlayerIds,
    warnings,
  }
}
