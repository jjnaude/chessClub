import type { PropsWithChildren } from 'react'

type Status = 'success' | 'warning' | 'neutral'

export function StatusBadge({ children, status = 'neutral' }: PropsWithChildren<{ status?: Status }>) {
  return <span className={`badge badge-${status}`}>{children}</span>
}
