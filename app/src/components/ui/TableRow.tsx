import type { PropsWithChildren } from 'react'

export function TableRow({ children }: PropsWithChildren) {
  return <div className="table-row">{children}</div>
}
