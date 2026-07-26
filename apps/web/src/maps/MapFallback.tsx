import type { Poi, RoutePlan } from '@citywalk/shared'
import { MapPinned } from 'lucide-react'

interface MapFallbackProps {
  routePlan: RoutePlan
  currentPoiId?: string | undefined
  nextPoiId?: string | undefined
  reason: 'missing-key' | 'load-error'
  onSelectPoi?: ((poi: Poi) => void) | undefined
  onRetry?: (() => void) | undefined
}

export function MapFallback({
  routePlan,
  currentPoiId,
  nextPoiId,
  reason,
  onSelectPoi,
  onRetry,
}: MapFallbackProps) {
  return (
    <section className="route-map-fallback" aria-label="抽象路线图">
      <div className="route-map-fallback__heading">
        <MapPinned aria-hidden="true" />
        <span>
          <strong>抽象路线模式</strong>
          {reason === 'missing-key'
            ? '浏览器地图 Key 未配置'
            : '腾讯地图加载失败'}
        </span>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            重试
          </button>
        )}
      </div>
      <ol className="abstract-route">
        {routePlan.selectedPois.map((poi, index) => (
          <li
            className={
              poi.id === currentPoiId
                ? 'is-current'
                : poi.id === nextPoiId
                  ? 'is-next'
                  : undefined
            }
            key={poi.id}
          >
            <button type="button" onClick={() => onSelectPoi?.(poi)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{poi.shortName}</strong>
              <small>
                {poi.id === currentPoiId
                  ? '当前点'
                  : poi.id === nextPoiId
                    ? '下一点'
                    : `${poi.stayMinutes} 分钟`}
              </small>
            </button>
          </li>
        ))}
      </ol>
      {routePlan.alternativePois.length > 0 && (
        <div className="abstract-alternatives">
          <span>备用节点</span>
          {routePlan.alternativePois.map((poi) => (
            <button
              type="button"
              key={poi.id}
              onClick={() => onSelectPoi?.(poi)}
            >
              {poi.shortName}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
