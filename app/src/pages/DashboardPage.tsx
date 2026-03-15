import { useCallback, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { isSupabaseConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui/Button'

type Session = {
  id: string
  status: 'open' | 'pairing_ready' | 'in_round' | 'completed'
}

type PlayerIdentity = {
  player_id: string
  player: {
    full_name: string
    ladder_rank: number
  }[]
}

type AttendanceRow = {
  player_id: string
  is_present: boolean
  is_available: boolean
}

type AvailabilityState = {
  session: Session | null
  players: Array<{
    id: string
    label: string
    isPresent: boolean
    isAvailable: boolean
  }>
}

function getSessionStatusLabel(status: Session['status']) {
  if (status === 'open') return 'Check-in Open'
  if (status === 'pairing_ready') return 'Pairing Ready'
  if (status === 'in_round') return 'Round In Progress'
  return 'Session Completed'
}

export function DashboardPage() {
  const { user } = useAuth()
  const [availabilityByPlayerId, setAvailabilityByPlayerId] = useState<Record<string, boolean>>({})
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [playerRows, setPlayerRows] = useState<AvailabilityState['players']>([])
  const [isSavingPlayerId, setIsSavingPlayerId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { isLoading, error } = usePageQuery(
    useCallback(async () => {
      const sessionResult = await supabase
        .from('club_sessions')
        .select('id,status')
        .in('status', ['open', 'pairing_ready', 'in_round'])
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionResult.error) {
        throw new Error(sessionResult.error.message)
      }

      const playerAccountsResult = user
        ? await supabase
            .from('player_accounts')
            .select('player_id,player:players(full_name,ladder_rank)')
            .eq('user_id', user.id)
        : { data: [], error: null }

      if (playerAccountsResult.error) {
        throw new Error(playerAccountsResult.error.message)
      }

      const players = (playerAccountsResult.data as PlayerIdentity[]).map((row) => ({
        id: row.player_id,
        label: row.player[0]
          ? `#${row.player[0].ladder_rank} ${row.player[0].full_name}`
          : row.player_id,
      }))

      if (!sessionResult.data || players.length === 0) {
        setActiveSession(sessionResult.data)
        setPlayerRows(
          players.map((player) => ({
            ...player,
            isPresent: false,
            isAvailable: false,
          })),
        )
        setAvailabilityByPlayerId({})
        return
      }

      const attendanceResult = await supabase
        .from('attendance')
        .select('player_id,is_present,is_available')
        .eq('session_id', sessionResult.data.id)
        .in(
          'player_id',
          players.map((player) => player.id),
        )

      if (attendanceResult.error) {
        throw new Error(attendanceResult.error.message)
      }

      const attendanceByPlayerIdMap = new Map(
        (attendanceResult.data as AttendanceRow[]).map((row) => [row.player_id, row]),
      )

      const nextPlayerRows = players.map((player) => {
        const attendance = attendanceByPlayerIdMap.get(player.id)
        return {
          ...player,
          isPresent: attendance?.is_present ?? false,
          isAvailable: attendance?.is_available ?? false,
        }
      })

      setActiveSession(sessionResult.data)
      setPlayerRows(nextPlayerRows)
      setAvailabilityByPlayerId(
        Object.fromEntries(nextPlayerRows.map((player) => [player.id, player.isAvailable])),
      )
    }, [user]),
  )

  const statusLabel = useMemo(
    () => (activeSession ? getSessionStatusLabel(activeSession.status) : 'No Active Session'),
    [activeSession],
  )

  const handleToggleAvailability = async (playerId: string) => {
    if (!user || !activeSession) return

    const nextAvailability = !(availabilityByPlayerId[playerId] ?? false)
    setIsSavingPlayerId(playerId)
    setSaveError(null)

    const { error: upsertError } = await supabase.from('attendance').upsert(
      {
        session_id: activeSession.id,
        player_id: playerId,
        is_present: true,
        is_available: nextAvailability,
        updated_by: user.id,
      },
      { onConflict: 'session_id,player_id' },
    )

    if (upsertError) {
      setSaveError(upsertError.message)
      setIsSavingPlayerId(null)
      return
    }

    setAvailabilityByPlayerId((current) => ({ ...current, [playerId]: nextAvailability }))
    setPlayerRows((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              isPresent: true,
              isAvailable: nextAvailability,
            }
          : player,
      ),
    )
    setIsSavingPlayerId(null)
  }

  return (
    <Card>
      <h2>Dashboard</h2>
      <PageState isLoading={isLoading} error={error}>
        <p>Current activity and match readiness.</p>
        <StatusBadge status={activeSession ? 'success' : 'neutral'}>{statusLabel}</StatusBadge>
        <p>Supabase: {isSupabaseConfigured ? 'configured' : 'missing env vars'}</p>
        {saveError && <p className="page-message page-message-error">{saveError}</p>}

        {!activeSession ? (
          <p className="page-message">No active session is open for availability updates.</p>
        ) : playerRows.length === 0 ? (
          <p className="page-message">Your account is not linked to a player profile yet.</p>
        ) : (
          <div className="availability-list">
            {playerRows.map((player) => {
              const isAvailable = availabilityByPlayerId[player.id] ?? false
              return (
                <div className="availability-row" key={player.id}>
                  <strong>{player.label}</strong>
                  <StatusBadge status={isAvailable ? 'success' : 'warning'}>
                    {isAvailable ? 'Available' : 'Not available'}
                  </StatusBadge>
                  <Button
                    variant="secondary"
                    onClick={() => void handleToggleAvailability(player.id)}
                    disabled={isSavingPlayerId === player.id}
                  >
                    {isSavingPlayerId === player.id
                      ? 'Saving...'
                      : isAvailable
                        ? 'Mark not available'
                        : 'Mark available'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </PageState>
    </Card>
  )
}
