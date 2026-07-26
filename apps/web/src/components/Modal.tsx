import { useEffect, type PropsWithChildren } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

interface ModalProps extends PropsWithChildren {
  open: boolean
  title: string
  onClose: () => void
}

export function Modal({ open, title, onClose, children }: ModalProps) {
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
    <div className="overlay overlay--center" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <IconButton
            label="关闭对话框"
            icon={<X aria-hidden="true" />}
            onClick={onClose}
            autoFocus
          />
        </div>
        {children}
      </section>
    </div>
  )
}
