import { describe, expect, it } from 'vitest'
import { recentOpponentWeight } from '../recentOpponentWeight'

describe('recentOpponentWeight', () => {
  it('gives higher weight to fresher repeat opponents', () => {
    const now = new Date('2026-03-15T00:00:00.000Z')
    const weight = recentOpponentWeight(
      [
        { whitePlayerId: 'a', blackPlayerId: 'b', playedAt: '2026-03-14T00:00:00.000Z' },
        { whitePlayerId: 'b', blackPlayerId: 'a', playedAt: '2026-03-05T00:00:00.000Z' },
        { whitePlayerId: 'a', blackPlayerId: 'c', playedAt: '2026-03-14T00:00:00.000Z' },
      ],
      'a',
      'b',
      now,
    )

    expect(weight).toBeCloseTo(0.5909, 3)
  })
})
