import { useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { TableRow } from '../components/ui/TableRow'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { waitFor } from '../lib/mockApi'

const pairings = [
  ['Alice', 'Ben', 'Board 1'],
  ['Chris', 'Dana', 'Board 2'],
]

export function CurrentRoundPage() {
  const { isLoading, error } = usePageQuery(useCallback(() => waitFor(pairings), []))

  return (
    <Card>
      <h2>Current Round</h2>
      <PageState isLoading={isLoading} error={error}>
        {pairings.map(([white, black, board]) => (
          <TableRow key={board}>
            <strong>{white}</strong>
            <span>vs</span>
            <strong>{black}</strong>
            <span>{board}</span>
            <StatusBadge status="warning">Playing</StatusBadge>
          </TableRow>
        ))}
      </PageState>
    </Card>
  )
}
