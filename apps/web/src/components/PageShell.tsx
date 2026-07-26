import type { PropsWithChildren, ReactNode } from 'react'
import { BottomActionBar } from './BottomActionBar'
import { ScreenHeader } from './ScreenHeader'

interface PageShellProps extends PropsWithChildren {
  title: string
  eyebrow: string
  action?: ReactNode
  onBack?: () => void
}

export function PageShell({
  title,
  eyebrow,
  action,
  onBack,
  children,
}: PageShellProps) {
  return (
    <>
      <ScreenHeader
        title={title}
        eyebrow={eyebrow}
        back
        {...(onBack ? { onBack } : {})}
      />
      <main className="screen route-page">{children}</main>
      {action && <BottomActionBar>{action}</BottomActionBar>}
    </>
  )
}
