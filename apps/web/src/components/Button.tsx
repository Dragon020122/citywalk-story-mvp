import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
> {
  variant?: 'primary' | 'secondary' | 'quiet'
  fullWidth?: boolean
}

export function Button({
  children,
  className,
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'button',
        `button--${variant}`,
        fullWidth && 'button--full',
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
