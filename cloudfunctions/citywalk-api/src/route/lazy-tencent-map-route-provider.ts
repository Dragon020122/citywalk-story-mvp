import type { Poi, RouteSegment } from '@citywalk/shared'
import type {
  DistanceMatrixEntry,
  MapRouteProvider,
} from './map-route-provider.js'
import type { TencentMapRouteProviderOptions } from './tencent-map-route-provider.js'

export class LazyTencentMapRouteProvider implements MapRouteProvider {
  private provider: Promise<MapRouteProvider> | undefined

  constructor(private readonly options: TencentMapRouteProviderOptions = {}) {}

  private getProvider(): Promise<MapRouteProvider> {
    this.provider ??= import('./tencent-map-route-provider.js').then(
      ({ TencentMapRouteProvider }) =>
        new TencentMapRouteProvider(this.options),
    )
    return this.provider
  }

  async getWalkingRoute(from: Poi, to: Poi): Promise<RouteSegment> {
    return (await this.getProvider()).getWalkingRoute(from, to)
  }

  async getDistanceMatrix(
    points: readonly Poi[],
  ): Promise<DistanceMatrixEntry[][]> {
    return (await this.getProvider()).getDistanceMatrix(points)
  }
}
