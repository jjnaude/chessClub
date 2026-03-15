import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (authError) {
      if (authError instanceof Error) {
        setError(authError.message)
      } else {
        setError(mode === 'signin' ? 'Unable to sign in.' : 'Unable to create account.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <h2>{mode === 'signin' ? 'Login' : 'Create account'}</h2>
      <p>{mode === 'signin' ? 'Sign in to access pairings, standings, and admin controls.' : 'Create a new account to access your club dashboard.'}</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="page-message page-message-error">{error}</p>}
        {mode === 'signup' && (
          <p className="page-message">
            If email confirmation is enabled in Supabase, verify your email before logging in.
          </p>
        )}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? (mode === 'signin' ? 'Signing in...' : 'Creating account...') : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        <p className="page-message">
          {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}{' '}
          <Link
            to="#"
            onClick={(event) => {
              event.preventDefault()
              setMode((currentMode) => (currentMode === 'signin' ? 'signup' : 'signin'))
              setError(null)
            }}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </Link>
        </p>
      </form>
    </Card>
  )
}
