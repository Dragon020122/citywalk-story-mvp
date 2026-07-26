import { describe, expect, it } from 'vitest'
import { buildTencentNavigationUrl } from './navigation'
import { testGenerationResult } from '../test/generation-fixture'

describe('Tencent navigation link generator', () => {
  it('builds a configurable walking URI without the server key', () => {
    const destination = testGenerationResult.routePlan.selectedPois[0]!
    const result = buildTencentNavigationUrl(destination, {
      baseUrl: 'https://apis.map.qq.com/uri/v1/routeplan',
      referer: 'test-citywalk',
    })
    const url = new URL(result)

    expect(url.searchParams.get('type')).toBe('walk')
    expect(url.searchParams.get('to')).toBe(destination.shortName)
    expect(url.searchParams.get('tocoord')).toBe(
      `${destination.latitude},${destination.longitude}`,
    )
    expect(url.searchParams.get('referer')).toBe('test-citywalk')
    expect(result).not.toContain('TENCENT_MAP_SERVER_KEY')
  })
})
