export type SessionPhase = 'open' | 'attendance' | 'paired' | 'published' | 'resulted' | 'finalized'

export type SessionLifecycleState = {
  phase: SessionPhase
  attendanceMarked: boolean
  pairingPublished: boolean
  resultsSubmitted: boolean
}

export type SessionAction = 'mark_attendance' | 'pair_round' | 'publish_pairings' | 'submit_results' | 'finalize_round'

export function createSessionLifecycleState(): SessionLifecycleState {
  return {
    phase: 'open',
    attendanceMarked: false,
    pairingPublished: false,
    resultsSubmitted: false,
  }
}

export function transitionSessionLifecycle(current: SessionLifecycleState, action: SessionAction): SessionLifecycleState {
  switch (action) {
    case 'mark_attendance':
      if (current.phase !== 'open') throw new Error('Attendance can only be marked from open.')
      return { ...current, phase: 'attendance', attendanceMarked: true }
    case 'pair_round':
      if (current.phase !== 'attendance') throw new Error('Pairing requires attendance step first.')
      return { ...current, phase: 'paired' }
    case 'publish_pairings':
      if (current.phase !== 'paired') throw new Error('Publishing requires paired phase first.')
      return { ...current, phase: 'published', pairingPublished: true }
    case 'submit_results':
      if (current.phase !== 'published') throw new Error('Results can only be submitted after publish.')
      return { ...current, phase: 'resulted', resultsSubmitted: true }
    case 'finalize_round':
      if (current.phase !== 'resulted') throw new Error('Finalize requires submitted results.')
      return { ...current, phase: 'finalized' }
    default:
      return current
  }
}
