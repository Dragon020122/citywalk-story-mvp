import type { ReactNode } from 'react'
import { AlertTriangle, ArchiveX, WifiOff } from 'lucide-react'
import { Card } from './Card'

interface StateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <Card className="state-card">
      <ArchiveX aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </Card>
  )
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <Card className="state-card state-card--error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </Card>
  )
}

export function OfflineBanner() {
  return (
    <div className="offline-banner" role="status">
      <WifiOff aria-hidden="true" />
      当前离线 · 已缓存的档案仍可阅读
    </div>
  )
}
