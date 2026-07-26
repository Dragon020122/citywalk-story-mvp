import { describe, expect, it } from 'vitest'
import {
  filterPoisForContentMode,
  InsufficientPoiContentError,
  parseContentMode,
  selectRoutePackPois,
  type Poi,
} from './index.js'

const createFixedPoi = (
  id: string,
): Poi => ({
  id,
  routePackId: 'mock_route_pack',
  name: `固定测试节点 ${id}`,
  shortName: id,
  address: '固定开发测试地址，不对应真实地点',
  longitude: 121.47,
  latitude: 31.23,
  category: 'mock',
  indoor: false,
  publicAccess: true,
  estimatedCostCny: 0,
  stayMinutes: 15,
  walkMinutes: 5,
  tags: ['development'],
  moodTags: ['quiet'],
  storyHooks: ['fiction-only'],
  taskHooks: ['observe', 'journal'],
  observationAnchors: ['shape'],
  safetyNotes: ['stay-public'],
  verificationStatus: 'mock',
  verifiedAt: null,
  sourceUrls: [],
  fallbackPoiIds: ['mock_fallback'],
})

const fixedPois = [
  createFixedPoi('mock_fixed_1'),
  createFixedPoi('mock_fixed_2'),
] as const

describe('content mode', () => {
  it('defaults to mock mode', () => {
    expect(parseContentMode(undefined)).toBe('mock')
  })

  it('loads only mock POIs in mock mode', () => {
    const selected = filterPoisForContentMode(fixedPois, 'mock')

    expect(selected.map((poi) => poi.id)).toEqual([
      'mock_fixed_1',
      'mock_fixed_2',
    ])
  })

  it('does not expose fixed mock POIs in verified mode', () => {
    const selected = filterPoisForContentMode(fixedPois, 'verified')

    expect(selected).toEqual([])
  })

  it('does not fall back to mock data when verified POIs are insufficient', () => {
    expect(() =>
      selectRoutePackPois({
        pois: fixedPois,
        routePackId: 'mock_route_pack',
        contentMode: 'verified',
        minimumPoiCount: 1,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<InsufficientPoiContentError>>({
        code: 'INSUFFICIENT_VERIFIED_POIS',
        availableCount: 0,
      }),
    )
  })
})
