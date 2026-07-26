import type { Poi, RouteSegment } from '@citywalk/shared'

export interface DistanceMatrixEntry {
  fromPoiId: string
  toPoiId: string
  walkMeters: number
  walkMinutes: number
}

export interface MapRouteProvider {
  getWalkingRoute(from: Poi, to: Poi): Promise<RouteSegment>
  getDistanceMatrix(
    points: readonly Poi[],
  ): Promise<DistanceMatrixEntry[][]>
}

export type MapRouteProviderErrorReason =
  | 'NOT_CONFIGURED'
  | 'NOT_IMPLEMENTED'
  | 'REQUEST_FAILED'
  | 'INVALID_RESPONSE'

export class MapRouteProviderError extends Error {
  readonly code = 'MAP_SERVICE_ERROR'
  readonly provider: 'tencent_map' | 'mock'
  readonly reason: MapRouteProviderErrorReason
  readonly retryable: boolean

  constructor(options: {
    provider: 'tencent_map' | 'mock'
    reason: MapRouteProviderErrorReason
    message: string
    retryable: boolean
  }) {
    super(`${options.reason}: ${options.message}`)
    this.name = 'MapRouteProviderError'
    this.provider = options.provider
    this.reason = options.reason
    this.retryable = options.retryable
  }
}
