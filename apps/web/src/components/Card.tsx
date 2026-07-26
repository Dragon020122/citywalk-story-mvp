import type { AriaRole, PropsWithChildren } from 'react'
import { clsx } from 'clsx'

interface CardProps extends PropsWithChildren {
  className?: string
  as?: 'article' | 'section' | 'div'
  role?: AriaRole
}

export function Card({
  children,
  className,
  as: Element = 'article',
  role,
}: CardProps) {
  return (
    <Element className={clsx('card', className)} role={role}>
      {children}
    </Element>
  )
}
