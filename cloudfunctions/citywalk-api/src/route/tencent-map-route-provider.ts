import {
  RouteSegmentSchema,
  type Poi,
  type RouteSegment,
} from '@citywalk/shared'
import { z } from 'zod'
import type {
  DistanceMatrixEntry,
  MapRouteProvider,
} from './map-route-provider.js'
import { MapRouteProviderError } from './map-route-provider.js'

const DEFAULT_ENDPOINT = 'https://apis.map.qq.com/ws/direction/v1/walking'
const DEFAULT_TIMEOUT_MS = 6_000
const POLYLINE_SCALE = 1_000_000

const TencentWalkingResponseSchema = z.object({
  status: z.number().int(),
  message: z.string().optional(),
  result: z
    .object({
      routes: z
        .array(
          z.object({
            distance: z.number().nonnegative(),
            duration: z.number().nonnegative(),
            polyline: z.array(z.number()).min(4),
          }),
        )
        .min(1),
    })
    .optional(),
})

export interface TencentMapRouteProviderOptions {
  apiKey?: string | undefined
  endpoint?: string | undefined
  timeoutMs?: number | undefined
  fetcher?: typeof fetch | undefined
  cache?: Map<string, RouteSegment> | undefined
}

const decodePolyline = (
  compressed: readonly number[],
): RouteSegment['polyline'] => {
  if (compressed.length % 2 !== 0) {
    throw new Error('Tencent polyline must contain coordinate pairs')
  }
  const decoded = [...compressed]
  for (let index = 2; index < decoded.length; index += 1) {
    decoded[index] =
      Number(decoded[index - 2]) + Number(decoded[index]) / POLYLINE_SCALE
  }
  const points: RouteSegment['polyline'] = []
  for (let index = 0; index < decoded.length; index += 2) {
    points.push({
      latitude: Number(decoded[index]),
      longitude: Number(decoded[index + 1]),
    })
  }
  return points
}

export class TencentMapRouteProvider implements MapRouteProvider {
  readonly apiKey: string | undefined
  private readonly endpoint: string
  private readonly timeoutMs: number
  private readonly fetcher: typeof fetch
  private readonly cache: Map<string, RouteSegment>

  constructor(options: TencentMapRouteProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.TENCENT_MAP_SERVER_KEY
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetcher = options.fetcher ?? fetch
    this.cache = options.cache ?? new Map()
  }

  private async requestWalkingRoute(from: Poi, to: Poi): Promise<RouteSegment> {
    if (!this.apiKey) {
      throw new MapRouteProviderError({
        provider: 'tencent_map',
        reason: 'NOT_CONFIGURED',
        message: 'TENCENT_MAP_SERVER_KEY is not configured',
        retryable: false,
      })
    }

    const url = new URL(this.endpoint)
    url.searchParams.set('from', `${from.latitude},${from.longitude}`)
    url.searchParams.set('to', `${to.latitude},${to.longitude}`)
    url.searchParams.set('key', this.apiKey)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new MapRouteProviderError({
          provider: 'tencent_map',
          reason: 'REQUEST_FAILED',
          message: `Tencent map returned HTTP ${response.status}`,
          retryable: response.status >= 500,
        })
      }

      const parsed = TencentWalkingResponseSchema.safeParse(
        await response.json(),
      )
      if (!parsed.success || parsed.data.status !== 0 || !parsed.data.result) {
        throw new MapRouteProviderError({
          provider: 'tencent_map',
          reason: 'INVALID_RESPONSE',
          message: parsed.success
            ? (parsed.data.message ?? `Tencent status ${parsed.data.status}`)
            : 'Tencent response schema validation failed',
          retryable: true,
        })
      }

      const route = parsed.data.result.routes[0]
      if (!route) {
        throw new MapRouteProviderError({
          provider: 'tencent_map',
          reason: 'INVALID_RESPONSE',
          message: 'Tencent response did not contain a route',
          retryable: true,
        })
      }

      return RouteSegmentSchema.parse({
        fromPoiId: from.id,
        toPoiId: to.id,
        walkMeters: Math.round(route.distance),
        walkMinutes:
          route.duration === 0 ? 0 : Math.max(1, Math.ceil(route.duration)),
        polyline: decodePolyline(route.polyline),
        source: 'tencent_map',
      })
    } catch (error) {
      if (controller.signal.aborted) {
        throw new MapRouteProviderError({
          provider: 'tencent_map',
          reason: 'TIMEOUT',
          message: `Tencent walking request exceeded ${this.timeoutMs}ms`,
          retryable: true,
        })
      }
      if (error instanceof MapRouteProviderError) throw error
      throw new MapRouteProviderError({
        provider: 'tencent_map',
        reason: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Unknown map error',
        retryable: true,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  async getWalkingRoute(from: Poi, to: Poi): Promise<RouteSegment> {
    const cacheKey = `${from.id}:${to.id}`
    const cached = this.cache.get(cacheKey)
    if (cached) return structuredClone(cached)

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const route = await this.requestWalkingRoute(from, to)
        this.cache.set(cacheKey, route)
        return structuredClone(route)
      } catch (error) {
        lastError = error
        if (
          error instanceof MapRouteProviderError &&
          (!error.retryable || attempt === 1)
        ) {
          throw error
        }
      }
    }
    throw lastError
  }

  async getDistanceMatrix(
    points: readonly Poi[],
  ): Promise<DistanceMatrixEntry[][]> {
    return Promise.all(
      points.map(async (from) =>
        Promise.all(
          points.map(async (to) => {
            if (from.id === to.id) {
              return {
                fromPoiId: from.id,
                toPoiId: to.id,
                walkMeters: 0,
                walkMinutes: 0,
              }
            }
            const route = await this.getWalkingRoute(from, to)
            return {
              fromPoiId: from.id,
              toPoiId: to.id,
              walkMeters: route.walkMeters,
              walkMinutes: route.walkMinutes,
            }
          }),
        ),
      ),
    )
  }
}
