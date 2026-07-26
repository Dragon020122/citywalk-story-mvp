interface RouteStepProps {
  number: string
  title: string
  meta: string
  active?: boolean
}

export function RouteStep({
  number,
  title,
  meta,
  active = false,
}: RouteStepProps) {
  return (
    <div className="route-step" aria-current={active ? 'step' : undefined}>
      <span className="route-step__number">{number}</span>
      <span>
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
      <span className="route-step__state">{active ? '当前' : '待解锁'}</span>
    </div>
  )
}
