import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, useRoleAccess, type AppRole } from '../../lib/auth'

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <p className="page-message">Loading session...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

type RequireRoleProps = PropsWithChildren<{
  roles: AppRole[]
}>

export function RequireRole({ children, roles }: RequireRoleProps) {
  const { hasAccess, isLoading } = useRoleAccess(roles)

  if (isLoading) {
    return <p className="page-message">Checking permissions...</p>
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
