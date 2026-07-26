import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: ReactNode
}

export function IconButton({
  label,
  icon,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button className="icon-button" type={type} aria-label={label} {...props}>
      {icon}
    </button>
  )
}
