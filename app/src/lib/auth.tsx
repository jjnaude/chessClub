/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AppRole = 'admin' | 'player'

export type Profile = {
  user_id: string
  display_name: string
  role: AppRole
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function getDefaultDisplayName(user: User) {
  const fromMeta = user.user_metadata?.full_name
  if (typeof fromMeta === 'string' && fromMeta.trim().length > 0) {
    return fromMeta.trim()
  }

  if (user.email) {
    return user.email.split('@')[0]
  }

  return 'New Player'
}

async function bootstrapProfile(user: User): Promise<Profile> {
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('user_id,display_name,role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load profile: ${existingError.message}`)
  }

  if (existing) {
    return existing
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    user_id: user.id,
    display_name: getDefaultDisplayName(user),
    role: 'player',
  })

  if (insertError) {
    throw new Error(`Failed to create profile: ${insertError.message}`)
  }

  const { data: created, error: createdError } = await supabase
    .from('profiles')
    .select('user_id,display_name,role')
    .eq('user_id', user.id)
    .single()

  if (createdError) {
    throw new Error(`Failed to reload profile: ${createdError.message}`)
  }

  return created
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      return
    }

    const loadedProfile = await bootstrapProfile(user)
    setProfile(loadedProfile)
  }, [])

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      setIsLoading(true)
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!isMounted) {
        return
      }

      if (sessionError) {
        setError(sessionError.message)
      }

      setSession(data.session)

      try {
        await loadProfile(data.session?.user ?? null)
      } catch (profileError) {
        if (profileError instanceof Error) {
          setError(profileError.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setError(null)
      void loadProfile(nextSession?.user ?? null).catch((profileError: unknown) => {
        if (profileError instanceof Error) {
          setError(profileError.message)
        }
      })
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      throw new Error(signInError.message)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      throw new Error(signOutError.message)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [loadProfile, session?.user])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      error,
      signIn,
      signOut,
      refreshProfile,
    }),
    [error, isLoading, profile, refreshProfile, session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

export function useRoleAccess(requiredRoles: AppRole[]) {
  const { profile, isLoading } = useAuth()

  if (isLoading) {
    return { hasAccess: false, isLoading: true }
  }

  const hasAccess = profile ? requiredRoles.includes(profile.role) : false
  return { hasAccess, isLoading: false }
}
