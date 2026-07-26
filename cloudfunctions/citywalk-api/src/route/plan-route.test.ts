import {
  type JourneyPreferences,
  type Poi,
} from '@citywalk/shared'
import { describe, expect, it } from 'vitest'
import { MockMapRouteProvider } from './mock-map-route-provider.js'
import { planRoute } from './plan-route.js'

const createFixedMockPois = (count = 12): Poi[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `mock_route_${String(index + 1).padStart(2, '0')}`,
    routePackId: 'mock_route_pack',
    name: `固定模拟节点 ${index + 1}`,
    shortName: `模拟 ${index + 1}`,
    address: `固定开发测试地址 ${index + 1}，不对应真实地点`,
    longitude: 121.47 + index * 0.0001,
    latitude: 31.23 + index * 0.0001,
    category: ['public_space', 'gallery', 'cafe'][index % 3] ?? 'public_space',
    indoor: index % 2 === 1,
    publicAccess: true,
    estimatedCostCny: index % 3 === 0 ? 0 : 10,
    stayMinutes: 10,
    walkMinutes: 3,
    tags: [index % 2 === 0 ? 'architecture' : 'nature'],
    moodTags: ['urban'],
    storyHooks: ['mystery'],
    taskHooks: [
      ['observe', 'journal', 'soundscape'][index % 3] ?? 'observe',
      `task-${index % 4}`,
    ],
    observationAnchors: [`anchor-${index + 1}`],
    safetyNotes: ['stay-public'],
    verificationStatus: 'mock',
    verifiedAt: null,
    sourceUrls: [],
    fallbackPoiIds: [
      `mock_route_${String(((index + 1) % count) + 1).padStart(2, '0')}`,
    ],
  }))

const createPreferences = (
  overrides: Partial<JourneyPreferences> = {},
): JourneyPreferences => ({
  routePackId: 'mock_route_pack',
  startPoiId: 'auto',
  durationMinutes: 180,
  companion: 'friends',
  interests: ['architecture', 'nature'],
  genre: 'mystery',
  taskIntensity: 'standard',
  budgetCny: 100,
  indoorPreference: 'balanced',
  photoTasksEnabled: true,
  puzzleTasksEnabled: true,
  storyExplorationRatio: 60,
  ...overrides,
})

const createPlan = (
  preferences: JourneyPreferences,
  options: {
    pois?: Poi[]
    provider?: MockMapRouteProvider
  } = {},
) =>
  planRoute({
    preferences,
    pois: options.pois ?? createFixedMockPois(),
    contentMode: 'mock',
    dataVersion: 'fixed-route-data-v1',
    mapProvider: options.provider ?? new MockMapRouteProvider(),
  })

describe('route duration targets', () => {
  it.each([
    [120, 7],
    [180, 9],
    [240, 10],
  ] as const)(
    'plans %i minutes with %i stops when constraints allow',
    async (durationMinutes, expectedStops) => {
      const route = await createPlan(
        createPreferences({ durationMinutes }),
      )

      expect(route.selectedPois).toHaveLength(expectedStops)
    },
  )
})

describe('route constraints', () => {
  it('never repeats a selected POI', async () => {
    const route = await createPlan(createPreferences())
    const ids = route.selectedPois.map((poi) => poi.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not allow three consecutive POIs of one category', async () => {
    const route = await createPlan(createPreferences())

    route.selectedPois.slice(2).forEach((poi, index) => {
      const previous = route.selectedPois[index + 1]
      const beforePrevious = route.selectedPois[index]
      expect(
        previous?.category === poi.category &&
          beforePrevious?.category === poi.category,
      ).toBe(false)
    })
  })

  it('keeps total time within 108 percent of the requested duration', async () => {
    const preferences = createPreferences({ durationMinutes: 120 })
    const route = await createPlan(preferences)

    expect(route.totalEstimatedMinutes).toBeLessThanOrEqual(
      Math.floor(preferences.durationMinutes * 1.08),
    )
  })

  it('keeps estimated cost within 110 percent of budget', async () => {
    const preferences = createPreferences({ budgetCny: 50 })
    const route = await createPlan(preferences)

    expect(route.estimatedCostCny).toBeLessThanOrEqual(
      preferences.budgetCny * 1.1,
    )
  })

  it('selects more indoor POIs when indoor is preferred than avoided', async () => {
    const [preferred, avoided] = await Promise.all([
      createPlan(createPreferences({ indoorPreference: 'prefer' })),
      createPlan(createPreferences({ indoorPreference: 'avoid' })),
    ])
    const preferredIndoorCount = preferred.selectedPois.filter(
      (poi) => poi.indoor,
    ).length
    const avoidedIndoorCount = avoided.selectedPois.filter(
      (poi) => poi.indoor,
    ).length

    expect(preferredIndoorCount).toBeGreaterThan(avoidedIndoorCount)
  })

  it('uses a specified eligible POI as the first stop', async () => {
    const route = await createPlan(
      createPreferences({ startPoiId: 'mock_route_06' }),
    )

    expect(route.selectedPois[0]?.id).toBe('mock_route_06')
  })

  it('chooses the automatic start deterministically', async () => {
    const preferences = createPreferences({ startPoiId: 'auto' })
    const first = await createPlan(preferences)
    const second = await createPlan(preferences)

    expect(first.selectedPois[0]?.id).toBe(second.selectedPois[0]?.id)
  })

  it('keeps at least two alternative POIs', async () => {
    const route = await createPlan(createPreferences())

    expect(route.alternativePois.length).toBeGreaterThanOrEqual(2)
  })

  it('returns the same route for the same input and data version', async () => {
    const preferences = createPreferences()
    const first = await createPlan(preferences)
    const second = await createPlan(preferences)

    expect(second).toEqual(first)
  })

  it('returns an explicit error when too few POIs are available', async () => {
    await expect(
      createPlan(createPreferences(), {
        pois: createFixedMockPois(2),
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_POIS',
    })
  })
})

describe('map providers and degradation', () => {
  it('provides a deterministic distance matrix in the Mock provider', async () => {
    const points = createFixedMockPois(3)
    const provider = new MockMapRouteProvider()

    const first = await provider.getDistanceMatrix(points)
    const second = await provider.getDistanceMatrix(points)

    expect(second).toEqual(first)
    expect(first).toHaveLength(3)
    expect(first[0]?.[0]?.walkMeters).toBe(0)
  })

  it('degrades to manual walking data when the map service fails', async () => {
    const route = await createPlan(createPreferences({ durationMinutes: 120 }), {
      provider: new MockMapRouteProvider({ failRequests: true }),
    })

    expect(route.degraded).toBe(true)
    expect(route.routeSegments).not.toHaveLength(0)
    route.routeSegments.forEach((segment) => {
      expect(segment.source).toBe('manual')
      expect(segment.polyline).toEqual([])
    })
  })
})
