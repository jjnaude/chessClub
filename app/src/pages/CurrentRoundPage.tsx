import { useCallback, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { TableRow } from '../components/ui/TableRow'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Session = {
  id: string
  status: 'open' | 'pairing_ready' | 'in_round' | 'completed'
}

type Round = {
  id: string
  round_number: number
  status: 'draft' | 'published' | 'completed'
}

type PlayerSummary = { id: string; full_name: string; ladder_rank: number }

type PairingRow = {
  id: string
  board_number: number
  white_player_id: string
  black_player_id: string
  white_player: PlayerSummary[] | PlayerSummary | null
  black_player: PlayerSummary[] | PlayerSummary | null
}

type ResultCode = '1-0' | '0-1' | '1/2-1/2' | 'void'

type ResultRow = {
  pairing_id: string
  result_code: ResultCode
}

const resultOptions: Array<{ value: ResultCode; label: string }> = [
  { value: '1-0', label: '1-0 (White wins)' },
  { value: '0-1', label: '0-1 (Black wins)' },
  { value: '1/2-1/2', label: '1/2-1/2 (Draw)' },
  { value: 'void', label: 'void (No game)' },
]

function getRoundStatusBadgeStatus(status: Round['status']) {
  if (status === 'draft') {
    return 'warning' as const
  }

  if (status === 'published') {
    return 'success' as const
  }

  return 'neutral' as const
}

function getSinglePlayer(player: PairingRow['white_player']) {
  if (!player) {
    return null
  }

  return Array.isArray(player) ? (player[0] ?? null) : player
}

export function CurrentRoundPage() {
  const { user } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [pairings, setPairings] = useState<PairingRow[]>([])
  const [myPlayerIds, setMyPlayerIds] = useState<string[]>([])
  const [resultByPairingId, setResultByPairingId] = useState<Record<string, ResultCode>>({})
  const [isSubmittingPairingId, setIsSubmittingPairingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { isLoading, error } = usePageQuery(
    useCallback(async () => {
      const sessionResult = await supabase
        .from('club_sessions')
        .select('id,status')
        .eq('status', 'in_round')
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionResult.error) {
        throw new Error(sessionResult.error.message)
      }

      setSession(sessionResult.data)

      const playerAccountsResult = user
        ? await supabase.from('player_accounts').select('player_id').eq('user_id', user.id)
        : { data: [], error: null }

      if (playerAccountsResult.error) {
        throw new Error(playerAccountsResult.error.message)
      }

      setMyPlayerIds((playerAccountsResult.data ?? []).map((row) => row.player_id))

      if (!sessionResult.data) {
        setRound(null)
        setPairings([])
        setResultByPairingId({})
        return
      }

      const roundResult = await supabase
        .from('rounds')
        .select('id,round_number,status')
        .eq('session_id', sessionResult.data.id)
        .eq('status', 'published')
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (roundResult.error) {
        throw new Error(roundResult.error.message)
      }

      setRound(roundResult.data)

      if (!roundResult.data) {
        setPairings([])
        setResultByPairingId({})
        return
      }

      const pairingsResult = await supabase
        .from('pairings')
        .select(
          'id,board_number,white_player_id,black_player_id,white_player:players!pairings_white_player_id_fkey(id,full_name,ladder_rank),black_player:players!pairings_black_player_id_fkey(id,full_name,ladder_rank)',
        )
        .eq('round_id', roundResult.data.id)
        .eq('state', 'published')
        .order('board_number', { ascending: true })

      if (pairingsResult.error) {
        throw new Error(pairingsResult.error.message)
      }

      const loadedPairings = pairingsResult.data as PairingRow[]
      setPairings(loadedPairings)

      const pairingIds = loadedPairings.map((pairing) => pairing.id)
      if (pairingIds.length === 0) {
        setResultByPairingId({})
        return
      }

      const resultsForPairingsResult = await supabase
        .from('results')
        .select('pairing_id,result_code')
        .in('pairing_id', pairingIds)

      if (resultsForPairingsResult.error) {
        throw new Error(resultsForPairingsResult.error.message)
      }

      const nextResultByPairingId: Record<string, ResultCode> = {}
      for (const row of resultsForPairingsResult.data as ResultRow[]) {
        nextResultByPairingId[row.pairing_id] = row.result_code
      }

      setResultByPairingId(nextResultByPairingId)
    }, [user]),
  )

  const roundDescription = useMemo(() => {
    if (!session || !round) {
      return null
    }

    return `Session ${session.status} · Round #${round.round_number}`
  }, [round, session])

  const handleSubmitResult = async (pairing: PairingRow) => {
    if (!user) {
      return
    }

    const resultCode = resultByPairingId[pairing.id]
    if (!resultCode) {
      return
    }

    setIsSubmittingPairingId(pairing.id)
    setSubmitError(null)

    const { error: insertError } = await supabase.from('results').insert({
      pairing_id: pairing.id,
      result_code: resultCode,
      submitted_by: user.id,
      updated_by: user.id,
    })

    if (insertError) {
      setSubmitError(insertError.message)
      setIsSubmittingPairingId(null)
      return
    }

    setResultByPairingId((current) => ({ ...current, [pairing.id]: resultCode }))
    setIsSubmittingPairingId(null)
  }

  return (
    <Card>
      <h2>Current Round</h2>
      <PageState isLoading={isLoading} error={error}>
        {!session && <p className="page-message">No active in-round session is currently available.</p>}

        {session && !round && <p className="page-message">No published round is available yet.</p>}
        {submitError && <p className="page-message page-message-error">{submitError}</p>}

        {session && round && (
          <>
            <div className="round-status-row">
              <p className="page-message">{roundDescription}</p>
              <StatusBadge status={getRoundStatusBadgeStatus(round.status)}>{round.status}</StatusBadge>
            </div>

            {pairings.length === 0 ? (
              <p className="page-message">No published pairings found for the current round.</p>
            ) : (
              pairings.map((pairing) => {
                const whitePlayer = getSinglePlayer(pairing.white_player)
                const blackPlayer = getSinglePlayer(pairing.black_player)
                const canSubmitOwnResult =
                  myPlayerIds.includes(pairing.white_player_id) || myPlayerIds.includes(pairing.black_player_id)
                const selectedResult = resultByPairingId[pairing.id] ?? '1/2-1/2'

                return (
                  <TableRow key={pairing.id}>
                    <strong>{whitePlayer ? `#${whitePlayer.ladder_rank} ${whitePlayer.full_name}` : 'Unknown player'}</strong>
                    <span>vs</span>
                    <strong>{blackPlayer ? `#${blackPlayer.ladder_rank} ${blackPlayer.full_name}` : 'Unknown player'}</strong>
                    <span>Board {pairing.board_number}</span>
                    {canSubmitOwnResult ? (
                      <div className="result-submit-row">
                        <select
                          value={selectedResult}
                          onChange={(event) =>
                            setResultByPairingId((current) => ({
                              ...current,
                              [pairing.id]: event.target.value as ResultCode,
                            }))
                          }
                        >
                          {resultOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          disabled={isSubmittingPairingId === pairing.id}
                          onClick={() => void handleSubmitResult(pairing)}
                        >
                          {isSubmittingPairingId === pairing.id ? 'Submitting...' : 'Submit result'}
                        </Button>
                      </div>
                    ) : (
                      <StatusBadge status="success">Published</StatusBadge>
                    )}
                  </TableRow>
                )
              })
            )}
          </>
        )}
      </PageState>
    </Card>
  )
}
