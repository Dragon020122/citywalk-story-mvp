import { describe, expect, it } from 'vitest'
import {
  estimateManualDuration,
  estimateRouteCost,
  getTargetStopCount,
  RoutePlanningError,
  selectRoutePois,
  type JourneyPreferences,
  type Poi,
} from './index.js'

const preferences: JourneyPreferences = {
  routePackId: 'mock_release_route',
  startPoiId: 'auto',
  durationMinutes: 120,
  companion: 'solo',
  interests: ['architecture'],
  genre: 'mystery',
  taskIntensity: 'standard',
  budgetCny: 100,
  indoorPreference: 'balanced',
  photoTasksEnabled: true,
  puzzleTasksEnabled: true,
  storyExplorationRatio: 60,
}

function poi(index: number, overrides: Partial<Poi> = {}): Poi {
  return {
    id: `mock_release_${index}`,
    routePackId: preferences.routePackId,
    name: `发布测试节点 ${index}`,
    shortName: `节点 ${index}`,
    address: '固定开发测试地址，不对应真实地点',
    longitude: 121.47 + index * 0.001,
    latitude: 31.23 + index * 0.001,
    category: `category_${index % 3}`,
    indoor: index % 2 === 0,
    publicAccess: true,
    estimatedCostCny: 5,
    stayMinutes: 10,
    walkMinutes: 3,
    tags: index === 1 ? ['architecture'] : ['history'],
    moodTags: ['quiet'],
    storyHooks: index === 2 ? ['mystery'] : ['memory'],
    taskHooks: [`task_${index % 4}`],
    observationAnchors: index === 3 ? [] : ['shape'],
    safetyNotes: ['stay-public'],
    verificationStatus: 'mock',
    verifiedAt: null,
    sourceUrls: [],
    fallbackPoiIds: [],
    ...overrides,
  }
}

describe('route engine release coverage', () => {
  it('calculates deterministic targets, duration and cost', () => {
    expect(getTargetStopCount(120)).toBe(7)
    expect(getTargetStopCount(180)).toBe(9)
    expect(getTargetStopCount(240)).toBe(10)
    expect(
      estimateManualDuration([
        poi(1, { stayMinutes: 10, walkMinutes: 99 }),
        poi(2, { stayMinutes: 20, walkMinutes: 5 }),
      ]),
    ).toBe(35)
    expect(
      estimateRouteCost([
        poi(1, { estimatedCostCny: 10 }),
        poi(2, { estimatedCostCny: 20 }),
      ]),
    ).toBe(30)
  })

  it.each(['avoid', 'balanced', 'prefer'] as const)(
    'selects a stable route for %s indoor preference',
    (indoorPreference) => {
      const result = selectRoutePois({
        preferences: { ...preferences, indoorPreference },
        pois: Array.from({ length: 12 }, (_, index) => poi(index + 1)),
        contentMode: 'mock',
      })

      expect(result.selectedPois).toHaveLength(7)
      expect(result.alternativePois).toHaveLength(2)
      expect(
        result.selectedPois.some(
          (candidate) => candidate.publicAccess && !candidate.indoor,
        ),
      ).toBe(true)
      expect(
        result.selectedPois.some(
          (candidate) => candidate.observationAnchors.length > 0,
        ),
      ).toBe(true)
    },
  )

  it('honors an explicit start and deterministic id tie breaking', () => {
    const result = selectRoutePois({
      preferences: {
        ...preferences,
        startPoiId: 'mock_release_5',
      },
      pois: Array.from({ length: 12 }, (_, index) =>
        poi(index + 1, { tags: [], storyHooks: [], taskHooks: [] }),
      ),
      contentMode: 'mock',
    })
    expect(result.selectedPois[0]?.id).toBe('mock_release_5')
  })

  it('rejects insufficient content and unavailable starts', () => {
    expect(() =>
      selectRoutePois({
        preferences,
        pois: [poi(1), poi(2)],
        contentMode: 'mock',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RoutePlanningError>>({
        code: 'INSUFFICIENT_POIS',
      }),
    )
    expect(() =>
      selectRoutePois({
        preferences: { ...preferences, startPoiId: 'mock_missing' },
        pois: Array.from({ length: 5 }, (_, index) => poi(index + 1)),
        contentMode: 'mock',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RoutePlanningError>>({
        code: 'START_POI_NOT_AVAILABLE',
      }),
    )
  })

  it('rejects starts and routes that cannot satisfy constraints', () => {
    expect(() =>
      selectRoutePois({
        preferences: { ...preferences, startPoiId: 'mock_release_1' },
        pois: [
          poi(1, { stayMinutes: 130 }),
          ...Array.from({ length: 5 }, (_, index) => poi(index + 2)),
        ],
        contentMode: 'mock',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RoutePlanningError>>({
        code: 'ROUTE_CONSTRAINTS_UNSATISFIED',
      }),
    )

    expect(() =>
      selectRoutePois({
        preferences,
        pois: Array.from({ length: 6 }, (_, index) =>
          poi(index + 1, {
            indoor: true,
            observationAnchors: [],
          }),
        ),
        contentMode: 'mock',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RoutePlanningError>>({
        code: 'ROUTE_CONSTRAINTS_UNSATISFIED',
      }),
    )
  })

  it('preserves two alternatives even when only one main stop fits', () => {
    const result = selectRoutePois({
      preferences,
      pois: [
        poi(1, { stayMinutes: 100, indoor: false }),
        poi(2, { stayMinutes: 100 }),
        poi(3, { stayMinutes: 100 }),
      ],
      contentMode: 'mock',
    })
    expect(result.selectedPois).toHaveLength(1)
    expect(result.alternativePois).toHaveLength(2)
  })

  it('accepts a zero budget and only selects free POIs', () => {
    const result = selectRoutePois({
      preferences: { ...preferences, budgetCny: 0 },
      pois: [
        ...Array.from({ length: 12 }, (_, index) =>
          poi(index + 1, { estimatedCostCny: 0 }),
        ),
        poi(13, { estimatedCostCny: 1 }),
      ],
      contentMode: 'mock',
    })

    expect(
      [...result.selectedPois, ...result.alternativePois].every(
        (candidate) => candidate.estimatedCostCny === 0,
      ),
    ).toBe(true)
  })

  it('reports a route planning error when free POIs are insufficient', () => {
    expect(() =>
      selectRoutePois({
        preferences: { ...preferences, budgetCny: 0 },
        pois: [
          poi(1, { estimatedCostCny: 0 }),
          poi(2, { estimatedCostCny: 0 }),
          ...Array.from({ length: 4 }, (_, index) =>
            poi(index + 3, { estimatedCostCny: 1 }),
          ),
        ],
        contentMode: 'mock',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<RoutePlanningError>>({
        code: 'INSUFFICIENT_POIS',
      }),
    )
  })
})
