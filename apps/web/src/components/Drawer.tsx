import { useEffect, type PropsWithChildren } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

interface DrawerProps extends PropsWithChildren {
  open: boolean
  title: string
  onClose: () => void
}

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer__header">
          <h2 id="drawer-title">{title}</h2>
          <IconButton
            label="关闭导航菜单"
            icon={<X aria-hidden="true" />}
            onClick={onClose}
            autoFocus
          />
        </div>
        {children}
      </aside>
    </div>
  )
}
