import { useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { waitFor } from '../lib/mockApi'

export function LoginPage() {
  const { isLoading, error } = usePageQuery(
    useCallback(() => waitFor({ ok: true }), []),
  )

  return (
    <Card>
      <h2>Login</h2>
      <PageState isLoading={isLoading} error={error}>
        <p>Sign in to access pairings, standings, and admin controls.</p>
        <Button>Sign in</Button>
      </PageState>
    </Card>
  )
}
