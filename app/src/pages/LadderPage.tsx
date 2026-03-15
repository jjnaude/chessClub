import { useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { TableRow } from '../components/ui/TableRow'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { supabase } from '../lib/supabase'

type LadderEntry = {
  id: string
  full_name: string
  ladder_rank: number
}

export function LadderPage() {
  const { isLoading, error, data } = usePageQuery(
    useCallback(async () => {
      const result = await supabase
        .from('players')
        .select('id,full_name,ladder_rank')
        .eq('active', true)
        .order('ladder_rank', { ascending: true })

      if (result.error) {
        throw new Error(result.error.message)
      }

      return (result.data ?? []) as LadderEntry[]
    }, []),
  )

  const ladder = data ?? []

  return (
    <Card>
      <h2>Ladder</h2>
      <PageState isLoading={isLoading} error={error}>
        {ladder.length === 0 ? (
          <p className="page-message">No active players are available in the ladder yet.</p>
        ) : (
          ladder.map((entry) => (
            <TableRow key={entry.id}>
              <strong>#{entry.ladder_rank}</strong>
              <span>{entry.full_name}</span>
              <span>Active</span>
            </TableRow>
          ))
        )}
      </PageState>
    </Card>
  )
}
