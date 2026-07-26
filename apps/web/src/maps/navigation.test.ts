import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTencentNavigationUrl,
  copyPoiAddress,
  openTencentNavigation,
} from './navigation'
import { testGenerationResult } from '../test/generation-fixture'

describe('Tencent navigation link generator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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

  it('opens Tencent navigation in a protected new window', async () => {
    const destination = testGenerationResult.routePlan.selectedPois[0]!
    const open = vi.spyOn(window, 'open').mockReturnValue(window)
    await expect(openTencentNavigation(destination)).resolves.toBe('opened')
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('apis.map.qq.com'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('falls back to clipboard and reports clipboard failures', async () => {
    const destination = testGenerationResult.routePlan.selectedPois[0]!
    vi.spyOn(window, 'open').mockReturnValue(null)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(openTencentNavigation(destination)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(destination.address)

    writeText.mockRejectedValueOnce(new Error('denied'))
    await expect(copyPoiAddress(destination)).resolves.toBe(false)
    vi.stubGlobal('navigator', {})
    await expect(copyPoiAddress(destination)).resolves.toBe(false)
  })
})
