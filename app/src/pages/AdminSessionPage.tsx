import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageState } from '../components/PageState'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  generatePairings,
  type PairingConstraint,
  type PairingGenerationResult,
  type PairingHistoryEntry,
  type PairingProposal,
} from '../domain/pairing/generatePairings'
import { formatRoundPairingsForWhatsApp } from '../domain/pairing/shareFormatter'

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

type Round = {
  id: string
  round_number: number
  status: 'draft' | 'published' | 'completed'
}

type PairingRow = {
  board_number: number
  white_player_id: string
  black_player_id: string
  state: 'proposed' | 'approved' | 'published' | 'finished'
}

type ConstraintRow = {
  id: string
  constraint_type: 'force_pair' | 'forbid_pair'
  player_a_id: string
  player_b_id: string
}

const defaultConstraintForm = {
  constraintType: 'forbid_pair' as PairingConstraint['constraintType'],
  playerAId: '',
  playerBId: '',
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

function validateProposal(proposal: PairingProposal[]) {
  const errors: string[] = []
  const seenPlayerIds = new Set<string>()

  const boards = [...proposal.map((entry) => entry.boardNumber)].sort((a, b) => a - b)
  for (let index = 0; index < boards.length; index += 1) {
    if (boards[index] !== index + 1) {
      errors.push('Board numbers must be contiguous starting at 1.')
      break
    }
  }

  for (const entry of proposal) {
    if (entry.whitePlayerId === entry.blackPlayerId) {
      errors.push(`Board ${entry.boardNumber} has a self-pairing.`)
    }

    if (seenPlayerIds.has(entry.whitePlayerId)) {
      errors.push(`Player assigned as white on board ${entry.boardNumber} appears multiple times.`)
    }
    if (seenPlayerIds.has(entry.blackPlayerId)) {
      errors.push(`Player assigned as black on board ${entry.boardNumber} appears multiple times.`)
    }

    seenPlayerIds.add(entry.whitePlayerId)
    seenPlayerIds.add(entry.blackPlayerId)
  }

  return errors
}

export function AdminSessionPage() {
  const { user } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, AttendanceState>>({})
  const [pairingHistory, setPairingHistory] = useState<PairingHistoryEntry[]>([])
  const [activeRound, setActiveRound] = useState<Round | null>(null)
  const [proposalPairings, setProposalPairings] = useState<PairingProposal[]>([])
  const [pairingConstraints, setPairingConstraints] = useState<PairingConstraint[]>([])
  const [constraintForm, setConstraintForm] = useState(defaultConstraintForm)
  const [pairingWarnings, setPairingWarnings] = useState<string[]>([])
  const [pairingValidationErrors, setPairingValidationErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpeningSession, setIsOpeningSession] = useState(false)
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isPublishingRound, setIsPublishingRound] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)

    const [playersResult, sessionResult, historyResult] = await Promise.all([
      supabase.from('players').select('id,full_name,ladder_rank').eq('active', true).order('ladder_rank'),
      supabase
        .from('club_sessions')
        .select('id,session_date,status')
        .in('status', ['open', 'pairing_ready', 'in_round'])
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('pairing_history')
        .select('white_player_id,black_player_id,played_at')
        .order('played_at', { ascending: false })
        .limit(200),
    ])

    if (playersResult.error || sessionResult.error || historyResult.error) {
      setError(
        playersResult.error?.message ??
          sessionResult.error?.message ??
          historyResult.error?.message ??
          'Failed to load session data.',
      )
      return
    }

    setPlayers(playersResult.data)
    setSession(sessionResult.data)
    setPairingHistory(
      historyResult.data.map((row) => ({
        whitePlayerId: row.white_player_id,
        blackPlayerId: row.black_player_id,
        playedAt: row.played_at,
      })),
    )

    if (!sessionResult.data) {
      setAttendanceByPlayerId({})
      setActiveRound(null)
      setProposalPairings([])
      setPairingConstraints([])
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

    const activeRoundResult = await supabase
      .from('rounds')
      .select('id,round_number,status')
      .eq('session_id', sessionResult.data.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeRoundResult.error) {
      setError(activeRoundResult.error.message)
      return
    }

    setActiveRound(activeRoundResult.data)

    if (!activeRoundResult.data) {
      setProposalPairings([])
      setPairingConstraints([])
      return
    }

    const [pairingsResult, constraintsResult] = await Promise.all([
      supabase
        .from('pairings')
        .select('board_number,white_player_id,black_player_id,state')
        .eq('round_id', activeRoundResult.data.id)
        .order('board_number'),
      supabase
        .from('pairing_constraints')
        .select('id,constraint_type,player_a_id,player_b_id')
        .eq('round_id', activeRoundResult.data.id)
        .order('created_at'),
    ])

    if (pairingsResult.error || constraintsResult.error) {
      setError(pairingsResult.error?.message ?? constraintsResult.error?.message ?? 'Failed to load round draft.')
      return
    }

    setProposalPairings(
      (pairingsResult.data as PairingRow[]).map((row) => ({
        boardNumber: row.board_number,
        whitePlayerId: row.white_player_id,
        blackPlayerId: row.black_player_id,
      })),
    )

    setPairingConstraints(
      (constraintsResult.data as ConstraintRow[]).map((row) => ({
        id: row.id,
        constraintType: row.constraint_type,
        playerAId: row.player_a_id,
        playerBId: row.player_b_id,
      })),
    )
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

  const availablePlayerIds = useMemo(
    () =>
      players
        .filter((player) => attendanceByPlayerId[player.id]?.isAvailable)
        .map((player) => player.id),
    [attendanceByPlayerId, players],
  )

  const availableCount = availablePlayerIds.length

  const presentCount = useMemo(
    () => Object.values(attendanceByPlayerId).filter((row) => row.isPresent).length,
    [attendanceByPlayerId],
  )

  const unavailableCount = useMemo(
    () => Object.values(attendanceByPlayerId).filter((row) => row.isPresent && !row.isAvailable).length,
    [attendanceByPlayerId],
  )

  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, `#${player.ladder_rank} ${player.full_name}`])),
    [players],
  )

  const shareText = useMemo(() => {
    if (!activeRound || proposalPairings.length === 0) {
      return ''
    }

    return formatRoundPairingsForWhatsApp(
      activeRound.round_number,
      proposalPairings
        .filter((pairing) => pairing.whitePlayerId && pairing.blackPlayerId)
        .map((pairing) => ({
          boardNumber: pairing.boardNumber,
          whitePlayerName: playerNameById.get(pairing.whitePlayerId) ?? pairing.whitePlayerId,
          blackPlayerName: playerNameById.get(pairing.blackPlayerId) ?? pairing.blackPlayerId,
        })),
    )
  }, [activeRound, playerNameById, proposalPairings])

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

  const handleGenerateProposal = () => {
    const result: PairingGenerationResult = generatePairings({
      players: players.map((player) => ({
        id: player.id,
        fullName: player.full_name,
        ladderRank: player.ladder_rank,
      })),
      attendance: availablePlayerIds.map((playerId) => ({ playerId, isAvailable: true })),
      pairingHistory,
      pairingConstraints,
    })

    setProposalPairings(result.proposal)
    setPairingWarnings(result.warnings)
    setPairingValidationErrors(validateProposal(result.proposal))
  }

  const handlePairingChange = (
    index: number,
    field: 'boardNumber' | 'whitePlayerId' | 'blackPlayerId',
    value: number | string,
  ) => {
    setProposalPairings((current) =>
      current.map((entry, currentIndex) =>
        currentIndex === index
          ? {
              ...entry,
              [field]: value,
            }
          : entry,
      ),
    )
  }

  const ensureDraftRoundId = async () => {
    if (!session || !user) {
      throw new Error('Open a session and sign in before saving pairings.')
    }

    if (activeRound?.status === 'draft') {
      return activeRound.id
    }

    const latestRoundResult = await supabase
      .from('rounds')
      .select('round_number')
      .eq('session_id', session.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestRoundResult.error) {
      throw new Error(latestRoundResult.error.message)
    }

    const roundNumber = (latestRoundResult.data?.round_number ?? 0) + 1
    const draftRoundResult = await supabase
      .from('rounds')
      .insert({
        session_id: session.id,
        round_number: roundNumber,
        status: 'draft',
      })
      .select('id,round_number,status')
      .single()

    if (draftRoundResult.error) {
      throw new Error(draftRoundResult.error.message)
    }

    setActiveRound(draftRoundResult.data)
    return draftRoundResult.data.id
  }

  const handleSaveDraft = async () => {
    if (!user) {
      setError('You must be signed in to save a draft round.')
      return
    }

    const validationErrors = validateProposal(proposalPairings)
    setPairingValidationErrors(validationErrors)

    if (validationErrors.length > 0) {
      setError('Fix validation errors before saving.')
      return
    }

    setIsSavingDraft(true)
    setError(null)

    try {
      const roundId = await ensureDraftRoundId()

      const { error: deletePairingsError } = await supabase.from('pairings').delete().eq('round_id', roundId)
      if (deletePairingsError) {
        throw new Error(deletePairingsError.message)
      }

      const pairingsPayload = proposalPairings.map((entry) => ({
        round_id: roundId,
        board_number: entry.boardNumber,
        white_player_id: entry.whitePlayerId,
        black_player_id: entry.blackPlayerId,
        state: 'proposed' as const,
        created_by: user.id,
      }))

      if (pairingsPayload.length > 0) {
        const { error: insertPairingsError } = await supabase.from('pairings').insert(pairingsPayload)
        if (insertPairingsError) {
          throw new Error(insertPairingsError.message)
        }
      }

      const { error: deleteConstraintsError } = await supabase
        .from('pairing_constraints')
        .delete()
        .eq('round_id', roundId)

      if (deleteConstraintsError) {
        throw new Error(deleteConstraintsError.message)
      }

      const constraintsPayload = pairingConstraints.map((entry) => ({
        round_id: roundId,
        constraint_type: entry.constraintType,
        player_a_id: entry.playerAId,
        player_b_id: entry.playerBId,
        created_by: user.id,
      }))

      if (constraintsPayload.length > 0) {
        const { error: insertConstraintsError } = await supabase
          .from('pairing_constraints')
          .insert(constraintsPayload)
        if (insertConstraintsError) {
          throw new Error(insertConstraintsError.message)
        }
      }

      if (session?.status === 'open') {
        const { error: sessionError } = await supabase
          .from('club_sessions')
          .update({ status: 'pairing_ready' })
          .eq('id', session.id)

        if (sessionError) {
          throw new Error(sessionError.message)
        }
      }

      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save draft pairings.')
    }

    setIsSavingDraft(false)
  }

  const handlePublishRound = async () => {
    if (!activeRound || activeRound.status !== 'draft') {
      setError('Save a draft round before publishing.')
      return
    }

    const validationErrors = validateProposal(proposalPairings)
    setPairingValidationErrors(validationErrors)

    if (validationErrors.length > 0) {
      setError('Fix validation errors before publishing.')
      return
    }

    setIsPublishingRound(true)
    setError(null)

    const [{ error: roundError }, { error: pairingsError }, { error: sessionError }] = await Promise.all([
      supabase.from('rounds').update({ status: 'published' }).eq('id', activeRound.id),
      supabase.from('pairings').update({ state: 'published' }).eq('round_id', activeRound.id).eq('state', 'proposed'),
      session
        ? supabase.from('club_sessions').update({ status: 'in_round' }).eq('id', session.id)
        : Promise.resolve({ error: null }),
    ])

    if (roundError || pairingsError || sessionError) {
      setError(roundError?.message ?? pairingsError?.message ?? sessionError?.message ?? 'Failed to publish round.')
      setIsPublishingRound(false)
      return
    }

    await loadData()
    setIsPublishingRound(false)
  }

  const handleAddConstraint = () => {
    if (!constraintForm.playerAId || !constraintForm.playerBId) {
      setError('Choose both players before adding a constraint.')
      return
    }

    if (constraintForm.playerAId === constraintForm.playerBId) {
      setError('Constraint players must be different.')
      return
    }

    setError(null)
    setPairingConstraints((current) => [
      ...current,
      {
        constraintType: constraintForm.constraintType,
        playerAId: constraintForm.playerAId,
        playerBId: constraintForm.playerBId,
      },
    ])
    setConstraintForm(defaultConstraintForm)
  }

  const handleCopyShareText = async () => {
    if (!shareText) {
      return
    }

    await navigator.clipboard.writeText(shareText)
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
            </div>

            <section className="pairing-editor">
              <h3>Round pairing proposal</h3>
              {activeRound && (
                <div className="round-status-row">
                  <p className="page-message">Round #{activeRound.round_number}</p>
                  <StatusBadge status={getRoundStatusBadgeStatus(activeRound.status)}>{activeRound.status}</StatusBadge>
                </div>
              )}
              <div className="button-row">
                <Button
                  variant="secondary"
                  disabled={availableCount < 2}
                  onClick={() => handleGenerateProposal()}
                >
                  Generate proposal
                </Button>
                <Button
                  disabled={isSavingDraft || proposalPairings.length === 0 || activeRound?.status === 'published'}
                  onClick={() => void handleSaveDraft()}
                >
                  {isSavingDraft ? 'Saving draft...' : 'Save draft round'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={isPublishingRound || activeRound?.status !== 'draft' || proposalPairings.length === 0}
                  onClick={() => void handlePublishRound()}
                >
                  {isPublishingRound ? 'Publishing...' : 'Publish round'}
                </Button>
                <Button variant="secondary" disabled={!shareText} onClick={() => void handleCopyShareText()}>
                  Copy WhatsApp share text
                </Button>
                {shareText && (
                  <a
                    className="btn btn-secondary"
                    href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open in WhatsApp
                  </a>
                )}
              </div>

              {pairingWarnings.length > 0 && (
                <ul className="pairing-note-list">
                  {pairingWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              {pairingValidationErrors.length > 0 && (
                <ul className="pairing-error-list">
                  {pairingValidationErrors.map((validationError) => (
                    <li key={validationError}>{validationError}</li>
                  ))}
                </ul>
              )}

              <div className="pairing-grid" role="table" aria-label="Pairing proposal table">
                <div className="pairing-grid-row pairing-grid-header" role="row">
                  <span>Board</span>
                  <span>White</span>
                  <span>Black</span>
                  <span>Actions</span>
                </div>

                {proposalPairings.map((pairing, index) => (
                  <div className="pairing-grid-row" role="row" key={`${pairing.boardNumber}-${index}`}>
                    <input
                      type="number"
                      min={1}
                      value={pairing.boardNumber}
                      onChange={(event) =>
                        handlePairingChange(index, 'boardNumber', Number.parseInt(event.target.value, 10) || 1)
                      }
                    />
                    <select
                      value={pairing.whitePlayerId}
                      onChange={(event) => handlePairingChange(index, 'whitePlayerId', event.target.value)}
                    >
                      <option value="">Select player</option>
                      {availablePlayerIds.map((playerId) => (
                        <option key={`${playerId}-white`} value={playerId}>
                          {playerNameById.get(playerId)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={pairing.blackPlayerId}
                      onChange={(event) => handlePairingChange(index, 'blackPlayerId', event.target.value)}
                    >
                      <option value="">Select player</option>
                      {availablePlayerIds.map((playerId) => (
                        <option key={`${playerId}-black`} value={playerId}>
                          {playerNameById.get(playerId)}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setProposalPairings((current) => current.filter((_, currentIndex) => currentIndex !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="secondary"
                onClick={() =>
                  setProposalPairings((current) => [
                    ...current,
                    { boardNumber: current.length + 1, whitePlayerId: '', blackPlayerId: '' },
                  ])
                }
              >
                Add board pairing
              </Button>

              <div className="constraints-panel">
                <h4>Pairing constraints</h4>
                <div className="constraints-form">
                  <select
                    value={constraintForm.constraintType}
                    onChange={(event) =>
                      setConstraintForm((current) => ({
                        ...current,
                        constraintType: event.target.value as PairingConstraint['constraintType'],
                      }))
                    }
                  >
                    <option value="force_pair">force_pair</option>
                    <option value="forbid_pair">forbid_pair</option>
                  </select>
                  <select
                    value={constraintForm.playerAId}
                    onChange={(event) =>
                      setConstraintForm((current) => ({ ...current, playerAId: event.target.value }))
                    }
                  >
                    <option value="">Player A</option>
                    {availablePlayerIds.map((playerId) => (
                      <option key={`${playerId}-constraint-a`} value={playerId}>
                        {playerNameById.get(playerId)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={constraintForm.playerBId}
                    onChange={(event) =>
                      setConstraintForm((current) => ({ ...current, playerBId: event.target.value }))
                    }
                  >
                    <option value="">Player B</option>
                    {availablePlayerIds.map((playerId) => (
                      <option key={`${playerId}-constraint-b`} value={playerId}>
                        {playerNameById.get(playerId)}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => handleAddConstraint()}>
                    Add constraint
                  </Button>
                </div>

                <ul className="constraint-list">
                  {pairingConstraints.map((constraint, index) => (
                    <li key={`${constraint.constraintType}-${constraint.playerAId}-${constraint.playerBId}-${index}`}>
                      <span>
                        {constraint.constraintType}: {playerNameById.get(constraint.playerAId)} ↔{' '}
                        {playerNameById.get(constraint.playerBId)}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setPairingConstraints((current) =>
                            current.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

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
