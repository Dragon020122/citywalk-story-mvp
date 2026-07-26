import type { Poi } from '@citywalk/shared'
import { describe, expect, it, vi } from 'vitest'
import { TencentMapRouteProvider } from './tencent-map-route-provider.js'

const createPoi = (id: string, offset: number): Poi => ({
  id,
  routePackId: 'mock_route_pack',
  name: `模拟节点 ${id}`,
  shortName: id,
  address: '不对应真实地点的测试地址',
  longitude: 121.47 + offset,
  latitude: 31.23 + offset,
  category: 'mock_outdoor',
  indoor: false,
  publicAccess: true,
  estimatedCostCny: 0,
  stayMinutes: 10,
  walkMinutes: 5,
  tags: ['mock'],
  moodTags: ['urban'],
  storyHooks: ['fiction'],
  taskHooks: ['observe'],
  observationAnchors: ['shape'],
  safetyNotes: ['stay-public'],
  verificationStatus: 'mock',
  verifiedAt: null,
  sourceUrls: [],
  fallbackPoiIds: [],
})

const from = createPoi('mock_from', 0)
const to = createPoi('mock_to', 0.01)

const successResponse = () =>
  new Response(
    JSON.stringify({
      status: 0,
      message: 'query ok',
      result: {
        routes: [
          {
            distance: 1350,
            duration: 18,
            polyline: [31.23, 121.47, 100, 200],
          },
        ],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

describe('TencentMapRouteProvider', () => {
  it('returns walking distance, duration and decoded polyline', async () => {
    const fetcher = vi.fn().mockResolvedValue(successResponse())
    const provider = new TencentMapRouteProvider({
      apiKey: 'server-key-only',
      fetcher,
    })

    const route = await provider.getWalkingRoute(from, to)

    expect(route).toMatchObject({
      fromPoiId: 'mock_from',
      toPoiId: 'mock_to',
      walkMeters: 1350,
      walkMinutes: 18,
      source: 'tencent_map',
    })
    expect(route.polyline).toEqual([
      { latitude: 31.23, longitude: 121.47 },
      { latitude: 31.2301, longitude: 121.4702 },
    ])
    const requestedUrl = String(fetcher.mock.calls[0]?.[0])
    expect(requestedUrl).toContain('/ws/direction/v1/walking')
    expect(requestedUrl).toContain('key=server-key-only')
  })

  it('retries once after a transient failure', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(successResponse())
    const provider = new TencentMapRouteProvider({
      apiKey: 'server-key-only',
      fetcher,
    })

    await expect(provider.getWalkingRoute(from, to)).resolves.toMatchObject({
      walkMeters: 1350,
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('times out and aborts both attempts', async () => {
    const fetcher = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const provider = new TencentMapRouteProvider({
      apiKey: 'server-key-only',
      timeoutMs: 5,
      fetcher,
    })

    await expect(provider.getWalkingRoute(from, to)).rejects.toMatchObject({
      reason: 'TIMEOUT',
      retryable: true,
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('caches identical POI pairs', async () => {
    const fetcher = vi.fn().mockResolvedValue(successResponse())
    const provider = new TencentMapRouteProvider({
      apiKey: 'server-key-only',
      fetcher,
    })

    const first = await provider.getWalkingRoute(from, to)
    const second = await provider.getWalkingRoute(from, to)

    expect(second).toEqual(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not read the browser key when the server key is missing', async () => {
    const provider = new TencentMapRouteProvider({
      apiKey: undefined,
      fetcher: vi.fn(),
    })

    await expect(provider.getWalkingRoute(from, to)).rejects.toMatchObject({
      reason: 'NOT_CONFIGURED',
    })
  })
})
