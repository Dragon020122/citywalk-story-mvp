import type { PropsWithChildren } from 'react'
import { clsx } from 'clsx'

export function Chip({ children }: PropsWithChildren) {
  return <span className="chip">{children}</span>
}

interface StatusBadgeProps extends PropsWithChildren {
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={clsx('status-badge', `status-badge--${tone}`)}>
      <span className="status-badge__mark" aria-hidden="true" />
      {children}
    </span>
  )
}

export function ArchiveLabel({ children }: PropsWithChildren) {
  return <span className="archive-label">{children}</span>
}
