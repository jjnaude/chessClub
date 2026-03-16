export type PairConstraint = {
  constraintType: 'force_pair' | 'forbid_pair'
  playerAId: string
  playerBId: string
}

export function validatePairingConstraints(availablePlayerIds: string[], constraints: PairConstraint[]): string[] {
  const available = new Set(availablePlayerIds)
  const errors: string[] = []

  constraints.forEach((constraint, index) => {
    const label = `Constraint ${index + 1}`
    if (!constraint.playerAId || !constraint.playerBId) {
      errors.push(`${label}: both players are required.`)
      return
    }

    if (constraint.playerAId === constraint.playerBId) {
      errors.push(`${label}: a player cannot be paired with themselves.`)
    }

    if (!available.has(constraint.playerAId) || !available.has(constraint.playerBId)) {
      errors.push(`${label}: both players must be available.`)
    }
  })

  return errors
}
