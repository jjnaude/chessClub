import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageState } from '../components/PageState'
import { supabase } from '../lib/supabase'

type Player = {
  id: string
  full_name: string
  ladder_rank: number
}

type Profile = {
  user_id: string
  display_name: string
  role: 'admin' | 'player'
}

type PlayerAccount = {
  player_id: string
  user_id: string
  players: { full_name: string }[] | null
}

export function AdminPlayerAccountsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [accounts, setAccounts] = useState<PlayerAccount[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerNotes, setNewPlayerNotes] = useState('')
  const [selectedRankPlayer, setSelectedRankPlayer] = useState('')
  const [targetRank, setTargetRank] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false)
  const [isUpdatingRank, setIsUpdatingRank] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)

    const [playersResult, profilesResult, accountsResult] = await Promise.all([
      supabase.from('players').select('id,full_name,ladder_rank').order('full_name'),
      supabase.from('profiles').select('user_id,display_name,role').order('display_name'),
      supabase
        .from('player_accounts')
        .select('player_id,user_id,players(full_name)'),
    ])

    if (playersResult.error || profilesResult.error || accountsResult.error) {
      setError(
        playersResult.error?.message ??
          profilesResult.error?.message ??
          accountsResult.error?.message ??
          'Failed to load player account mappings.',
      )
      return
    }

    setPlayers(playersResult.data)
    setProfiles(profilesResult.data)
    setAccounts(accountsResult.data as unknown as PlayerAccount[])
  }, [])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      await loadData()

      if (!active) {
        return
      }

      setIsLoading(false)
    }

    void initialize()

    return () => {
      active = false
    }
  }, [loadData])

  const handleCreatePlayer = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = newPlayerName.trim()
    if (!trimmedName) {
      return
    }

    const nextRank = Math.max(0, ...players.map((player) => player.ladder_rank)) + 1

    setIsCreatingPlayer(true)
    setError(null)

    const { error: createError } = await supabase.from('players').insert({
      full_name: trimmedName,
      ladder_rank: nextRank,
      active: true,
      notes: newPlayerNotes.trim() || null,
    })

    if (createError) {
      setError(createError.message)
      setIsCreatingPlayer(false)
      return
    }

    setNewPlayerName('')
    setNewPlayerNotes('')
    await loadData()
    setIsCreatingPlayer(false)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedPlayer || !selectedUser) {
      return
    }

    setIsSaving(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('player_accounts')
      .insert({ player_id: selectedPlayer, user_id: selectedUser })

    if (insertError) {
      setError(insertError.message)
      setIsSaving(false)
      return
    }

    setSelectedPlayer('')
    setSelectedUser('')
    await loadData()
    setIsSaving(false)
  }

  const handleRankUpdate = async (event: FormEvent) => {
    event.preventDefault()

    if (!selectedRankPlayer || !targetRank) {
      return
    }

    const parsedRank = Number(targetRank)
    if (!Number.isInteger(parsedRank)) {
      setError('Rank must be a whole number.')
      return
    }

    const playersByRank = [...players].sort((left, right) => left.ladder_rank - right.ladder_rank)
    const boundedTargetRank = Math.min(Math.max(parsedRank, 1), playersByRank.length)
    const selected = playersByRank.find((player) => player.id === selectedRankPlayer)

    if (!selected) {
      setError('Selected player could not be found.')
      return
    }

    if (selected.ladder_rank === boundedTargetRank) {
      setTargetRank(String(boundedTargetRank))
      return
    }

    const updates = playersByRank
      .map((player) => {
        if (player.id === selected.id) {
          return { id: player.id, ladder_rank: boundedTargetRank }
        }

        if (boundedTargetRank < selected.ladder_rank) {
          if (player.ladder_rank >= boundedTargetRank && player.ladder_rank < selected.ladder_rank) {
            return { id: player.id, ladder_rank: player.ladder_rank + 1 }
          }
          return null
        }

        if (player.ladder_rank <= boundedTargetRank && player.ladder_rank > selected.ladder_rank) {
          return { id: player.id, ladder_rank: player.ladder_rank - 1 }
        }

        return null
      })
      .filter((value): value is { id: string; ladder_rank: number } => value !== null)

    setIsUpdatingRank(true)
    setError(null)

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('players')
        .update({ ladder_rank: update.ladder_rank })
        .eq('id', update.id)

      if (updateError) {
        setError(updateError.message)
        setIsUpdatingRank(false)
        return
      }
    }

    setTargetRank('')
    setSelectedRankPlayer('')
    await loadData()
    setIsUpdatingRank(false)
  }

  const handleDelete = async (playerId: string, userId: string) => {
    setError(null)
    const { error: deleteError } = await supabase
      .from('player_accounts')
      .delete()
      .eq('player_id', playerId)
      .eq('user_id', userId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await loadData()
  }

  return (
    <Card>
      <h2>User → Player Mapping</h2>
      <PageState isLoading={isLoading} error={error}>
        <form className="auth-form" onSubmit={handleCreatePlayer}>
          <label>
            New player name
            <input
              required
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
            />
          </label>

          <label>
            Notes (optional)
            <textarea
              rows={3}
              value={newPlayerNotes}
              onChange={(event) => setNewPlayerNotes(event.target.value)}
            />
          </label>

          <Button disabled={isCreatingPlayer} type="submit">
            {isCreatingPlayer ? 'Creating player...' : 'Create player'}
          </Button>
        </form>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Player
            <select
              required
              value={selectedPlayer}
              onChange={(event) => setSelectedPlayer(event.target.value)}
            >
              <option value="">Select a player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.full_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            User profile
            <select required value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="">Select a user</option>
              {profiles.map((profile) => (
                <option key={profile.user_id} value={profile.user_id}>
                  {profile.display_name} ({profile.role})
                </option>
              ))}
            </select>
          </label>

          <Button disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Add mapping'}
          </Button>
        </form>

        <form className="auth-form" onSubmit={handleRankUpdate}>
          <label>
            Player to re-rank
            <select
              required
              value={selectedRankPlayer}
              onChange={(event) => setSelectedRankPlayer(event.target.value)}
            >
              <option value="">Select a player</option>
              {[...players]
                .sort((left, right) => left.ladder_rank - right.ladder_rank)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.ladder_rank} {player.full_name}
                  </option>
                ))}
            </select>
          </label>

          <label>
            New ladder rank
            <input
              required
              min={1}
              max={Math.max(players.length, 1)}
              step={1}
              type="number"
              value={targetRank}
              onChange={(event) => setTargetRank(event.target.value)}
            />
          </label>

          <Button disabled={isUpdatingRank} type="submit">
            {isUpdatingRank ? 'Updating rank...' : 'Update rank'}
          </Button>
        </form>

        <div className="mapping-list">
          {accounts.map((account) => (
            <div className="mapping-row" key={`${account.player_id}:${account.user_id}`}>
              <span>
                {profiles.find((profile) => profile.user_id === account.user_id)?.display_name ?? account.user_id}
              </span>
              <span>→</span>
              <span>{account.players?.[0]?.full_name ?? account.player_id}</span>
              <Button variant="secondary" onClick={() => void handleDelete(account.player_id, account.user_id)}>
                Remove
              </Button>
            </div>
          ))}
          {accounts.length === 0 && <p className="page-message">No mappings yet.</p>}
        </div>
      </PageState>
    </Card>
  )
}
