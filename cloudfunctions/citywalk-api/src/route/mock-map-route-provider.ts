import type { Poi, RouteSegment } from '@citywalk/shared'
import type {
  DistanceMatrixEntry,
  MapRouteProvider,
} from './map-route-provider.js'
import { MapRouteProviderError } from './map-route-provider.js'

const EARTH_RADIUS_METERS = 6_371_000
const WALKING_METERS_PER_MINUTE = 75

const toRadians = (degrees: number): number =>
  (degrees * Math.PI) / 180

const getStraightLineDistance = (from: Poi, to: Poi): number => {
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return Math.round(
    2 *
      EARTH_RADIUS_METERS *
      Math.asin(Math.min(1, Math.sqrt(haversine))),
  )
}

const getWalkingMetrics = (
  from: Poi,
  to: Poi,
): Pick<RouteSegment, 'walkMeters' | 'walkMinutes'> => {
  const walkMeters = getStraightLineDistance(from, to)
  return {
    walkMeters,
    walkMinutes:
      walkMeters === 0
        ? 0
        : Math.max(1, Math.ceil(walkMeters / WALKING_METERS_PER_MINUTE)),
  }
}

export class MockMapRouteProvider implements MapRouteProvider {
  readonly failRequests: boolean

  constructor(options: { failRequests?: boolean } = {}) {
    this.failRequests = options.failRequests ?? false
  }

  async getWalkingRoute(from: Poi, to: Poi): Promise<RouteSegment> {
    if (this.failRequests) {
      throw new MapRouteProviderError({
        provider: 'mock',
        reason: 'REQUEST_FAILED',
        message: 'Mock provider failure requested by test configuration',
        retryable: true,
      })
    }

    const metrics = getWalkingMetrics(from, to)
    return {
      fromPoiId: from.id,
      toPoiId: to.id,
      ...metrics,
      polyline: [
        { longitude: from.longitude, latitude: from.latitude },
        { longitude: to.longitude, latitude: to.latitude },
      ],
      source: 'manual',
    }
  }

  async getDistanceMatrix(
    points: readonly Poi[],
  ): Promise<DistanceMatrixEntry[][]> {
    if (this.failRequests) {
      throw new MapRouteProviderError({
        provider: 'mock',
        reason: 'REQUEST_FAILED',
        message: 'Mock provider failure requested by test configuration',
        retryable: true,
      })
    }

    return points.map((from) =>
      points.map((to) => ({
        fromPoiId: from.id,
        toPoiId: to.id,
        ...getWalkingMetrics(from, to),
      })),
    )
  }
}
