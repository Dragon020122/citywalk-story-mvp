import type { Poi, RouteSegment } from '@citywalk/shared'
import type {
  DistanceMatrixEntry,
  MapRouteProvider,
} from './map-route-provider.js'
import { MapRouteProviderError } from './map-route-provider.js'

export interface TencentMapRouteProviderOptions {
  apiKey?: string | undefined
}

export class TencentMapRouteProvider implements MapRouteProvider {
  readonly apiKey: string | undefined

  constructor(options: TencentMapRouteProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.TENCENT_MAP_KEY
  }

  private createUnavailableError(): MapRouteProviderError {
    if (!this.apiKey) {
      return new MapRouteProviderError({
        provider: 'tencent_map',
        reason: 'NOT_CONFIGURED',
        message: 'TENCENT_MAP_KEY is not configured',
        retryable: false,
      })
    }

    return new MapRouteProviderError({
      provider: 'tencent_map',
      reason: 'NOT_IMPLEMENTED',
      message: 'Tencent walking route requests are disabled in this stage',
      retryable: false,
    })
  }

  async getWalkingRoute(from: Poi, to: Poi): Promise<RouteSegment> {
    void from
    void to
    throw this.createUnavailableError()
  }

  async getDistanceMatrix(
    points: readonly Poi[],
  ): Promise<DistanceMatrixEntry[][]> {
    void points
    throw this.createUnavailableError()
  }
}
