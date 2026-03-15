import type { PropsWithChildren } from 'react'

export function PageState({ isLoading, error, children }: PropsWithChildren<{ isLoading: boolean; error: string | null }>) {
  if (isLoading) return <p className="page-message">Loading...</p>
  if (error) return <p className="page-message page-message-error">{error}</p>
  return <>{children}</>
}
