import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageState } from '../components/PageState'
import { supabase } from '../lib/supabase'

type Player = {
  id: string
  full_name: string
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
  profiles: { display_name: string }[] | null
}

export function AdminPlayerAccountsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [accounts, setAccounts] = useState<PlayerAccount[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)

    const [playersResult, profilesResult, accountsResult] = await Promise.all([
      supabase.from('players').select('id,full_name').order('full_name'),
      supabase.from('profiles').select('user_id,display_name,role').order('display_name'),
      supabase
        .from('player_accounts')
        .select('player_id,user_id,players(full_name),profiles(display_name)'),
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
      const [playersResult, profilesResult, accountsResult] = await Promise.all([
        supabase.from('players').select('id,full_name').order('full_name'),
        supabase.from('profiles').select('user_id,display_name,role').order('display_name'),
        supabase
          .from('player_accounts')
          .select('player_id,user_id,players(full_name),profiles(display_name)'),
      ])

      if (!active) {
        return
      }

      if (playersResult.error || profilesResult.error || accountsResult.error) {
        setError(
          playersResult.error?.message ??
            profilesResult.error?.message ??
            accountsResult.error?.message ??
            'Failed to load player account mappings.',
        )
        setIsLoading(false)
        return
      }

      setPlayers(playersResult.data)
      setProfiles(profilesResult.data)
      setAccounts(accountsResult.data as unknown as PlayerAccount[])
      setIsLoading(false)
    }

    void initialize()

    return () => {
      active = false
    }
  }, [])

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

        <div className="mapping-list">
          {accounts.map((account) => (
            <div className="mapping-row" key={`${account.player_id}:${account.user_id}`}>
              <span>{account.profiles?.[0]?.display_name ?? account.user_id}</span>
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
