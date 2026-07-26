interface SkeletonProps {
  lines?: number
}

export function Skeleton({ lines = 3 }: SkeletonProps) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={`skeleton-${index}`} />
      ))}
    </div>
  )
}
