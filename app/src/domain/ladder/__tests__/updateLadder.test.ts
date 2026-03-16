import { describe, expect, it } from 'vitest'
import { updateLadder } from '../updateLadder'

describe('updateLadder', () => {
  it('awards win and draw points and reranks', () => {
    const next = updateLadder(
      [
        { playerId: 'p1', rank: 1, points: 10 },
        { playerId: 'p2', rank: 2, points: 8 },
        { playerId: 'p3', rank: 3, points: 8 },
      ],
      [
        { winnerId: 'p2', loserId: 'p1' },
        { winnerId: 'p3', loserId: 'p1', isDraw: true },
      ],
    )

    expect(next.map((entry) => `${entry.playerId}:${entry.rank}:${entry.points}`)).toEqual([
      'p1:1:11',
      'p2:2:11',
      'p3:3:9',
    ])
  })
})
