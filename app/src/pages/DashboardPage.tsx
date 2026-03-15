import { useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { waitFor } from '../lib/mockApi'
import { isSupabaseConfigured } from '../lib/env'

export function DashboardPage() {
  const { isLoading, error } = usePageQuery(
    useCallback(() => waitFor({ round: 'Round 6', playersOnline: 24 }), []),
  )

  return (
    <Card>
      <h2>Dashboard</h2>
      <PageState isLoading={isLoading} error={error}>
        <p>Current activity and match readiness.</p>
        <StatusBadge status="success">Round In Progress</StatusBadge>
        <p>Supabase: {isSupabaseConfigured ? 'configured' : 'missing env vars'}</p>
      </PageState>
    </Card>
  )
}
