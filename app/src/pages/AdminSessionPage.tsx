import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Session = {
  id: string
  session_date: string
  status: 'open' | 'pairing_ready' | 'in_round' | 'completed'
}

type Player = {
  id: string
  full_name: string
  ladder_rank: number
}

type AttendanceRow = {
  session_id: string
  player_id: string
  is_present: boolean
  is_available: boolean
}

type AttendanceState = {
  isPresent: boolean
  isAvailable: boolean
}

export function AdminSessionPage() {
  const { user } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, AttendanceState>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [isGeneratingPairings, setIsGeneratingPairings] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)

    const [playersResult, sessionResult] = await Promise.all([
      supabase.from('players').select('id,full_name,ladder_rank').eq('active', true).order('ladder_rank'),
      supabase
        .from('club_sessions')
        .select('id,session_date,status')
        .in('status', ['open', 'pairing_ready', 'in_round'])
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (playersResult.error || sessionResult.error) {
      setError(playersResult.error?.message ?? sessionResult.error?.message ?? 'Failed to load session data.')
      return
    }

    setPlayers(playersResult.data)
    setSession(sessionResult.data)

    if (!sessionResult.data) {
      setAttendanceByPlayerId({})
      return
    }

    const attendanceResult = await supabase
      .from('attendance')
      .select('session_id,player_id,is_present,is_available')
      .eq('session_id', sessionResult.data.id)

    if (attendanceResult.error) {
      setError(attendanceResult.error.message)
      return
    }

    const nextAttendance: Record<string, AttendanceState> = {}
    for (const player of playersResult.data) {
      nextAttendance[player.id] = { isPresent: false, isAvailable: false }
    }

    for (const row of attendanceResult.data as AttendanceRow[]) {
      nextAttendance[row.player_id] = { isPresent: row.is_present, isAvailable: row.is_available }
    }

    setAttendanceByPlayerId(nextAttendance)
  }, [])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      setIsLoading(true)
      await loadData()
      if (active) {
        setIsLoading(false)
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [loadData])

  const availableCount = useMemo(
    () => Object.values(attendanceByPlayerId).filter((row) => row.isAvailable).length,
    [attendanceByPlayerId],
  )

  const presentCount = useMemo(
    () => Object.values(attendanceByPlayerId).filter((row) => row.isPresent).length,
    [attendanceByPlayerId],
  )

  const unavailableCount = useMemo(
    () => Object.values(attendanceByPlayerId).filter((row) => row.isPresent && !row.isAvailable).length,
    [attendanceByPlayerId],
  )

  const handleOpenSession = async () => {
    if (!user) {
      setError('You must be signed in to open a session.')
      return
    }

    setIsOpeningSession(true)
    setError(null)

    const today = new Date().toISOString().slice(0, 10)
    const { error: insertError } = await supabase
      .from('club_sessions')
      .insert({ session_date: today, status: 'open', created_by: user.id })

    if (insertError) {
      setError(insertError.message)
      setIsOpeningSession(false)
      return
    }

    await loadData()
    setIsOpeningSession(false)
  }

  const handleAttendanceToggle = (playerId: string, field: 'isPresent' | 'isAvailable', nextValue: boolean) => {
    setAttendanceByPlayerId((current) => {
      const existing = current[playerId] ?? { isPresent: false, isAvailable: false }

      if (field === 'isPresent' && !nextValue) {
        return {
          ...current,
          [playerId]: { isPresent: false, isAvailable: false },
        }
      }

      if (field === 'isAvailable' && nextValue) {
        return {
          ...current,
          [playerId]: { isPresent: true, isAvailable: true },
        }
      }

      return {
        ...current,
        [playerId]: { ...existing, [field]: nextValue },
      }
    })
  }

  const handleSaveAttendance = async () => {
    if (!session || !user) {
      setError('Open a session before saving attendance.')
      return
    }

    setIsSavingAttendance(true)
    setError(null)

    const payload = players.map((player) => {
      const state = attendanceByPlayerId[player.id] ?? { isPresent: false, isAvailable: false }
      return {
        session_id: session.id,
        player_id: player.id,
        is_present: state.isPresent,
        is_available: state.isAvailable,
        checked_in_at: state.isPresent ? new Date().toISOString() : null,
        updated_by: user.id,
      }
    })

    const { error: upsertError } = await supabase.from('attendance').upsert(payload)

    if (upsertError) {
      setError(upsertError.message)
      setIsSavingAttendance(false)
      return
    }

    await loadData()
    setIsSavingAttendance(false)
  }

  const handleGeneratePairings = async () => {
    if (!session) {
      setError('Open a session before generating pairings.')
      return
    }

    if (availableCount < 2) {
      setError('At least 2 available players are required to generate pairings.')
      return
    }

    setIsGeneratingPairings(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('club_sessions')
      .update({ status: 'pairing_ready' })
      .eq('id', session.id)

    if (updateError) {
      setError(updateError.message)
      setIsGeneratingPairings(false)
      return
    }

    await loadData()
    setIsGeneratingPairings(false)
  }

  return (
    <Card>
      <h2>Admin Session</h2>
      <PageState isLoading={isLoading} error={error}>
        <p>Manage check-in and pairing generation for tonight&apos;s round.</p>

        <div className="session-status-row">
          <StatusBadge status={session ? 'success' : 'warning'}>
            {session ? `Session ${session.status}` : 'No open session'}
          </StatusBadge>
          <Button disabled={Boolean(session) || isOpeningSession} onClick={() => void handleOpenSession()}>
            {isOpeningSession ? 'Opening...' : 'Open Session'}
          </Button>
        </div>

        {session && (
          <>
            <p className="page-message">Session date: {session.session_date}</p>

            <div className="attendance-summary">
              <span>Present: {presentCount}</span>
              <span>Available: {availableCount}</span>
              <span>Unavailable: {unavailableCount}</span>
            </div>

            <div className="attendance-grid" role="table" aria-label="Attendance grid">
              <div className="attendance-grid-row attendance-grid-header" role="row">
                <span>Player</span>
                <span>Present</span>
                <span>Available</span>
              </div>

              {players.map((player) => {
                const playerAttendance = attendanceByPlayerId[player.id] ?? {
                  isPresent: false,
                  isAvailable: false,
                }

                return (
                  <div className="attendance-grid-row" role="row" key={player.id}>
                    <span>
                      #{player.ladder_rank} {player.full_name}
                    </span>
                    <label className="attendance-toggle">
                      <input
                        type="checkbox"
                        checked={playerAttendance.isPresent}
                        onChange={(event) =>
                          handleAttendanceToggle(player.id, 'isPresent', event.target.checked)
                        }
                      />
                    </label>
                    <label className="attendance-toggle">
                      <input
                        type="checkbox"
                        checked={playerAttendance.isAvailable}
                        disabled={!playerAttendance.isPresent}
                        onChange={(event) =>
                          handleAttendanceToggle(player.id, 'isAvailable', event.target.checked)
                        }
                      />
                    </label>
                  </div>
                )
              })}
            </div>

            <div className="button-row">
              <Button disabled={isSavingAttendance} onClick={() => void handleSaveAttendance()}>
                {isSavingAttendance ? 'Saving...' : 'Save attendance'}
              </Button>
              <Button
                variant="secondary"
                disabled={isGeneratingPairings || availableCount < 2}
                onClick={() => void handleGeneratePairings()}
              >
                {isGeneratingPairings ? 'Updating...' : 'Move to pairing generation'}
              </Button>
            </div>

            {availableCount < 2 && (
              <p className="page-message page-message-error">
                You need at least 2 available players before pairing generation.
              </p>
            )}
          </>
        )}
      </PageState>
    </Card>
  )
}
