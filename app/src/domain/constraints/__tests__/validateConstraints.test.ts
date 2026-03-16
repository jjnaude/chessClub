import { describe, expect, it } from 'vitest'
import { validatePairingConstraints } from '../validateConstraints'

describe('validatePairingConstraints', () => {
  it('returns no errors for valid constraints', () => {
    const errors = validatePairingConstraints(['a', 'b', 'c'], [
      { constraintType: 'force_pair', playerAId: 'a', playerBId: 'b' },
    ])

    expect(errors).toEqual([])
  })

  it('flags invalid/self-pair and unavailable players', () => {
    const errors = validatePairingConstraints(['a', 'b'], [
      { constraintType: 'forbid_pair', playerAId: 'a', playerBId: 'a' },
      { constraintType: 'force_pair', playerAId: 'a', playerBId: 'z' },
    ])

    expect(errors).toContain('Constraint 1: a player cannot be paired with themselves.')
    expect(errors).toContain('Constraint 2: both players must be available.')
  })
})
