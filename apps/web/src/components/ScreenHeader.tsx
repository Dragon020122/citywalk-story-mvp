import { ArrowLeft, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from './IconButton'

interface ScreenHeaderProps {
  title: string
  eyebrow?: string
  back?: boolean
  onMenu?: () => void
}

export function ScreenHeader({
  title,
  eyebrow,
  back = false,
  onMenu,
}: ScreenHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="screen-header">
      <div className="screen-header__side">
        {back ? (
          <IconButton
            label="返回上一页"
            icon={<ArrowLeft aria-hidden="true" />}
            onClick={() => navigate(-1)}
          />
        ) : (
          <span className="brand-mark" aria-hidden="true">
            CW
          </span>
        )}
      </div>
      <div className="screen-header__title">
        {eyebrow && <span>{eyebrow}</span>}
        <strong>{title}</strong>
      </div>
      <div className="screen-header__side screen-header__side--end">
        {onMenu && (
          <IconButton
            label="打开导航菜单"
            icon={<Menu aria-hidden="true" />}
            onClick={onMenu}
          />
        )}
      </div>
    </header>
  )
}
