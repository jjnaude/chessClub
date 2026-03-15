import { useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { waitFor } from '../lib/mockApi'

export function AdminSessionPage() {
  const { isLoading, error } = usePageQuery(
    useCallback(() => waitFor({ sessionOpen: true }), []),
  )

  return (
    <Card>
      <h2>Admin Session</h2>
      <PageState isLoading={isLoading} error={error}>
        <p>Manage check-in and pairing generation for tonight's round.</p>
        <StatusBadge status="neutral">Ready</StatusBadge>
        <div className="button-row">
          <Button>Start Session</Button>
          <Button variant="secondary">Close Session</Button>
        </div>
      </PageState>
    </Card>
  )
}
