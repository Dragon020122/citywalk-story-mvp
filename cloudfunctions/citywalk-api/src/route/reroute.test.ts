import type { Poi, RoutePlan, StoryGraph } from '@citywalk/shared'
import { describe, expect, it } from 'vitest'
import { MockMapRouteProvider } from './mock-map-route-provider.js'
import { rerouteUnavailablePoi } from './reroute.js'

const poi = (id: string, fallbackPoiIds: string[] = []): Poi => ({
  id,
  routePackId: 'mock_pack',
  name: id,
  shortName: id,
  address: '测试地址，不对应真实地点',
  longitude: 121.47,
  latitude: 31.23,
  category: 'mock',
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
  fallbackPoiIds,
})

const current = poi('mock_current', ['mock_fallback'])
const next = poi('mock_next')
const fallback = poi('mock_fallback')
const routePlan: RoutePlan = {
  routeId: 'route_original',
  routePackId: 'mock_pack',
  selectedPois: [current, next],
  alternativePois: [fallback],
  routeSegments: [],
  totalWalkMeters: 0,
  totalWalkMinutes: 0,
  totalStayMinutes: 20,
  totalEstimatedMinutes: 20,
  estimatedCostCny: 0,
  degraded: false,
}
const emptyState = {
  minimumScores: {},
  clues: [],
  items: [],
  flags: {},
}
const storyGraph: StoryGraph = {
  entryNodeId: 'node_1',
  nodes: [
    {
      id: 'node_1',
      poiId: current.id,
      type: 'intro',
      title: '测试节点',
      storyText: '测试剧情。',
      arrivalText: null,
      task: null,
      choices: [],
      rewards: { scores: {}, clues: [], items: [], flags: {} },
      requiredState: emptyState,
      next: null,
      fallbackNext: null,
      estimatedMinutes: 5,
      safetyNotice: null,
    },
  ],
  endings: [
    {
      id: 'ending_1',
      title: '测试结局',
      summary: '测试完成。',
      requiredState: emptyState,
    },
  ],
  hiddenEnding: null,
  stateDefinition: {
    initialEffectScores: {
      truth: 0,
      memory: 0,
      empathy: 0,
      courage: 0,
      connection: 0,
    },
    initialClues: [],
    initialItems: [],
    initialFlags: {},
  },
}

describe('rerouteUnavailablePoi', () => {
  it('replaces the unavailable stop with its curated fallback', async () => {
    const result = await rerouteUnavailablePoi({
      routePlan,
      storyGraph,
      allPois: [current, next, fallback],
      currentPoiId: current.id,
      unavailablePoiIds: [current.id],
      mapProvider: new MockMapRouteProvider(),
    })

    expect(result.routePlan.selectedPois[0]?.id).toBe('mock_fallback')
    expect(result.storyGraph.nodes[0]?.poiId).toBe('mock_fallback')
    expect(result.routePlan.alternativePois).not.toContainEqual(fallback)
  })

  it('degrades replacement segments when map routing fails', async () => {
    const result = await rerouteUnavailablePoi({
      routePlan,
      storyGraph,
      allPois: [current, next, fallback],
      currentPoiId: current.id,
      unavailablePoiIds: [current.id],
      mapProvider: new MockMapRouteProvider({ failRequests: true }),
    })

    expect(result.routePlan.degraded).toBe(true)
    expect(result.routePlan.routeSegments[0]?.source).toBe('manual')
  })
})
