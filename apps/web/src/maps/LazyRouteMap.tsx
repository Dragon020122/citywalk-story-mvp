import type { Poi, RoutePlan } from '@citywalk/shared'
import { lazy, Suspense } from 'react'

const RouteMap = lazy(() =>
  import('./RouteMap').then((module) => ({ default: module.RouteMap })),
)

interface LazyRouteMapProps {
  routePlan: RoutePlan
  currentPoiId?: string | undefined
  nextPoiId?: string | undefined
  onSelectPoi?: ((poi: Poi) => void) | undefined
}

export function LazyRouteMap(props: LazyRouteMapProps) {
  return (
    <Suspense
      fallback={
        <section className="route-map-loading" role="status">
          正在准备地图组件…
        </section>
      }
    >
      <RouteMap {...props} />
    </Suspense>
  )
}
