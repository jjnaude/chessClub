import { useCallback, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { TableRow } from '../components/ui/TableRow'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { usePageQuery } from '../lib/usePageQuery'
import { supabase } from '../lib/supabase'

type Session = {
  id: string
  status: 'open' | 'pairing_ready' | 'in_round' | 'completed'
}

type Round = {
  id: string
  round_number: number
  status: 'draft' | 'published' | 'completed'
}

type PlayerSummary = { full_name: string; ladder_rank: number }

type PairingRow = {
  board_number: number
  white_player: PlayerSummary[] | PlayerSummary | null
  black_player: PlayerSummary[] | PlayerSummary | null
}

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
  const [session, setSession] = useState<Session | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [pairings, setPairings] = useState<PairingRow[]>([])

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

      if (!sessionResult.data) {
        setRound(null)
        setPairings([])
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
        return
      }

      const pairingsResult = await supabase
        .from('pairings')
        .select(
          'board_number,white_player:players!pairings_white_player_id_fkey(full_name,ladder_rank),black_player:players!pairings_black_player_id_fkey(full_name,ladder_rank)',
        )
        .eq('round_id', roundResult.data.id)
        .eq('state', 'published')
        .order('board_number', { ascending: true })

      if (pairingsResult.error) {
        throw new Error(pairingsResult.error.message)
      }

      setPairings(pairingsResult.data as PairingRow[])
    }, []),
  )

  const roundDescription = useMemo(() => {
    if (!session || !round) {
      return null
    }

    return `Session ${session.status} · Round #${round.round_number}`
  }, [round, session])

  return (
    <Card>
      <h2>Current Round</h2>
      <PageState isLoading={isLoading} error={error}>
        {!session && <p className="page-message">No active in-round session is currently available.</p>}

        {session && !round && <p className="page-message">No published round is available yet.</p>}

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

                return (
                  <TableRow key={pairing.board_number}>
                    <strong>{whitePlayer ? `#${whitePlayer.ladder_rank} ${whitePlayer.full_name}` : 'Unknown player'}</strong>
                    <span>vs</span>
                    <strong>{blackPlayer ? `#${blackPlayer.ladder_rank} ${blackPlayer.full_name}` : 'Unknown player'}</strong>
                    <span>Board {pairing.board_number}</span>
                    <StatusBadge status="success">Published</StatusBadge>
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
