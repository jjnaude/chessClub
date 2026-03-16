import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Card } from '../components/ui/Card'
import { TableRow } from '../components/ui/TableRow'
import { Button } from '../components/ui/Button'
import { PageState } from '../components/PageState'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Ladder = {
  id: string
  name: string
  description: string | null
}

type LadderEntry = {
  player_id: string
  full_name: string
  rank_position: number
}

export function LadderPage() {
  const { profile, user } = useAuth()
  const [ladders, setLadders] = useState<Ladder[]>([])
  const [selectedLadderId, setSelectedLadderId] = useState('')
  const [ladderEntries, setLadderEntries] = useState<LadderEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newLadderName, setNewLadderName] = useState('')
  const [newLadderDescription, setNewLadderDescription] = useState('')
  const [sourceLadderId, setSourceLadderId] = useState('')
  const [isCreatingLadder, setIsCreatingLadder] = useState(false)

  const selectedLadder = useMemo(
    () => ladders.find((ladder) => ladder.id === selectedLadderId) ?? null,
    [ladders, selectedLadderId],
  )

  const loadLadders = useCallback(async () => {
    const laddersResult = await supabase
      .from('ladders')
      .select('id,name,description')
      .order('name', { ascending: true })

    if (laddersResult.error) {
      throw new Error(laddersResult.error.message)
    }

    const ladderRows = (laddersResult.data ?? []) as Ladder[]
    setLadders(ladderRows)
    setSelectedLadderId((current) => {
      if (current && ladderRows.some((ladder) => ladder.id === current)) {
        return current
      }
      return ladderRows[0]?.id ?? ''
    })
    setSourceLadderId((current) => {
      if (current && ladderRows.some((ladder) => ladder.id === current)) {
        return current
      }
      return ladderRows[0]?.id ?? ''
    })
  }, [])

  const loadEntries = useCallback(async (ladderId: string) => {
    if (!ladderId) {
      setLadderEntries([])
      return
    }

    const entriesResult = await supabase
      .from('ladder_rankings')
      .select('player_id,rank_position,players!inner(id,full_name,active)')
      .eq('ladder_id', ladderId)
      .eq('players.active', true)
      .order('rank_position', { ascending: true })

    if (entriesResult.error) {
      throw new Error(entriesResult.error.message)
    }

    const mappedEntries = (entriesResult.data ?? []).map((row) => {
      const playerRelation = row.players as { id: string; full_name: string } | { id: string; full_name: string }[] | null
      const player = Array.isArray(playerRelation) ? (playerRelation[0] ?? null) : playerRelation
      return {
        player_id: row.player_id,
        rank_position: row.rank_position,
        full_name: player?.full_name ?? row.player_id,
      }
    })

    setLadderEntries(mappedEntries)
  }, [])

  const loadData = useCallback(async () => {
    setError(null)
    await loadLadders()
  }, [loadLadders])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      try {
        await loadData()
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [loadData])

  useEffect(() => {
    let active = true

    const refresh = async () => {
      try {
        setError(null)
        await loadEntries(selectedLadderId)
      } catch (loadError) {
        if (active && loadError instanceof Error) {
          setError(loadError.message)
        }
      }
    }

    void refresh()

    return () => {
      active = false
    }
  }, [loadEntries, selectedLadderId])

  const handleCreateLadder = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || profile?.role !== 'admin') return

    const trimmedName = newLadderName.trim()
    if (!trimmedName || !sourceLadderId) {
      setError('Ladder name and source ladder are required.')
      return
    }

    setIsCreatingLadder(true)
    setError(null)

    const { data, error: createError } = await supabase.rpc('admin_create_ladder_from_existing', {
      ladder_name: trimmedName,
      source_ladder_id: sourceLadderId,
      ladder_description: newLadderDescription.trim() || null,
      actor_id: user.id,
    })

    if (createError) {
      setError(createError.message)
      setIsCreatingLadder(false)
      return
    }

    const createdId = String(data)
    setNewLadderName('')
    setNewLadderDescription('')
    await loadLadders()
    setSelectedLadderId(createdId)
    setIsCreatingLadder(false)
  }

  return (
    <Card>
      <h2>Ladders</h2>
      <PageState isLoading={isLoading} error={error}>
        <label>
          Ladder
          <select value={selectedLadderId} onChange={(event) => setSelectedLadderId(event.target.value)}>
            {ladders.map((ladder) => (
              <option key={ladder.id} value={ladder.id}>
                {ladder.name}
              </option>
            ))}
          </select>
        </label>

        {selectedLadder?.description && <p className="page-message">{selectedLadder.description}</p>}

        {ladderEntries.length === 0 ? (
          <p className="page-message">No active players are ranked in this ladder yet.</p>
        ) : (
          ladderEntries.map((entry) => (
            <TableRow key={`${selectedLadderId}:${entry.player_id}`}>
              <strong>#{entry.rank_position}</strong>
              <span>{entry.full_name}</span>
              <span>Active</span>
            </TableRow>
          ))
        )}

        {profile?.role === 'admin' && (
          <form className="auth-form" onSubmit={handleCreateLadder}>
            <h3>Create ladder</h3>
            <label>
              New ladder name
              <input required value={newLadderName} onChange={(event) => setNewLadderName(event.target.value)} />
            </label>
            <label>
              Description (optional)
              <textarea rows={2} value={newLadderDescription} onChange={(event) => setNewLadderDescription(event.target.value)} />
            </label>
            <label>
              Copy initial rankings from
              <select required value={sourceLadderId} onChange={(event) => setSourceLadderId(event.target.value)}>
                <option value="">Select source ladder</option>
                {ladders.map((ladder) => (
                  <option key={`${ladder.id}-source`} value={ladder.id}>
                    {ladder.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={isCreatingLadder || ladders.length === 0}>
              {isCreatingLadder ? 'Creating ladder...' : 'Create ladder'}
            </Button>
          </form>
        )}
      </PageState>
    </Card>
  )
}
