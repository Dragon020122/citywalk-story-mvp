import { useEffect } from 'react'
import type { Poi, RouteSegment } from '@citywalk/shared'
import type { TencentMapNamespace, TMapInstance } from './tencent-map-types'

interface RoutePolylineProps {
  tmap: TencentMapNamespace
  map: TMapInstance
  segments: readonly RouteSegment[]
  pois: readonly Poi[]
}

export function RoutePolyline({
  tmap,
  map,
  segments,
  pois,
}: RoutePolylineProps) {
  useEffect(() => {
    const routePoints = segments.flatMap((segment) => segment.polyline)
    const points =
      routePoints.length >= 2
        ? routePoints
        : pois.map((poi) => ({
            latitude: poi.latitude,
            longitude: poi.longitude,
          }))
    if (points.length < 2) return

    const layer = new tmap.MultiPolyline({
      id: 'citywalk-main-route',
      map,
      styles: {
        route: new tmap.PolylineStyle({
          color: '#d84a3a',
          width: 7,
          borderWidth: 2,
          borderColor: '#f1ede4',
          lineCap: 'round',
          showArrow: true,
        }),
      },
      geometries: [
        {
          id: 'main-route',
          styleId: 'route',
          paths: points.map(
            (point) => new tmap.LatLng(point.latitude, point.longitude),
          ),
        },
      ],
    })
    return () => layer.setMap(null)
  }, [map, pois, segments, tmap])

  return null
}
