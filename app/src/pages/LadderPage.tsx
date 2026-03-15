import { useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { TableRow } from '../components/ui/TableRow'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { waitFor } from '../lib/mockApi'

const ladder = [
  { rank: 1, player: 'Alice', points: 12 },
  { rank: 2, player: 'Ben', points: 10 },
  { rank: 3, player: 'Dana', points: 8 },
]

export function LadderPage() {
  const { isLoading, error } = usePageQuery(useCallback(() => waitFor(ladder), []))

  return (
    <Card>
      <h2>Ladder</h2>
      <PageState isLoading={isLoading} error={error}>
        {ladder.map((entry) => (
          <TableRow key={entry.rank}>
            <strong>#{entry.rank}</strong>
            <span>{entry.player}</span>
            <span>{entry.points} pts</span>
          </TableRow>
        ))}
      </PageState>
    </Card>
  )
}
