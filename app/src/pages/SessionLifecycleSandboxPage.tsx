import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import {
  createSessionLifecycleState,
  transitionSessionLifecycle,
  type SessionAction,
  type SessionLifecycleState,
} from '../domain/session/lifecycle'

export function SessionLifecycleSandboxPage() {
  const [state, setState] = useState<SessionLifecycleState>(() => createSessionLifecycleState())
  const [log, setLog] = useState<string[]>([])

  const role = useMemo(() => (state.phase === 'published' ? 'player + admin' : 'admin'), [state.phase])

  const runAction = (action: SessionAction) => {
    try {
      setState((current) => transitionSessionLifecycle(current, action))
      setLog((current) => [...current, action])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown transition error'
      setLog((current) => [...current, message])
    }
  }

  return (
    <section>
      <h2>Session lifecycle sandbox</h2>
      <p>Role in control: <strong>{role}</strong></p>
      <p data-testid="session-phase">Current phase: <strong>{state.phase}</strong></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => runAction('mark_attendance')}>Mark attendance</Button>
        <Button onClick={() => runAction('pair_round')}>Pair round</Button>
        <Button onClick={() => runAction('publish_pairings')}>Publish pairings</Button>
        <Button onClick={() => runAction('submit_results')}>Submit result</Button>
        <Button onClick={() => runAction('finalize_round')}>Finalize round</Button>
      </div>
      <ol>
        {log.map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ol>
    </section>
  )
}
