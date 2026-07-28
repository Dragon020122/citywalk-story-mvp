import { afterEach, describe, expect, it, vi } from 'vitest'

const originalUrl = window.location.href

async function loadApiBase(path: string) {
  window.history.replaceState({}, '', path)
  vi.resetModules()
  return import('./api-base')
}

afterEach(() => {
  window.history.replaceState({}, '', originalUrl)
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('EdgeOne preview token API URL handling', () => {
  it('leaves same-origin API URLs unchanged without a preview token', async () => {
    const { buildApiUrl } = await loadApiBase('/create')
    expect(buildApiUrl('/health')).toBe('/api/health')
  })

  it('adds the initial preview token while preserving existing API parameters', async () => {
    const { buildApiUrl } = await loadApiBase('/?eo_token=test-token')
    expect(buildApiUrl('/health?debug=1')).toBe(
      '/api/health?debug=1&eo_token=test-token',
    )
  })

  it('replaces rather than duplicates an existing preview-token parameter', async () => {
    const { buildApiUrl } = await loadApiBase('/?eo_token=test-token')
    expect(buildApiUrl('/health?eo_token=stale-token')).toBe(
      '/api/health?eo_token=test-token',
    )
  })

  it('does not attach the token to external or non-API URLs', async () => {
    const { withEdgeOnePreviewToken } = await (async () => {
      window.history.replaceState({}, '', '/?eo_token=test-token')
      vi.resetModules()
      return import('./edgeone-preview-auth')
    })()
    expect(withEdgeOnePreviewToken('https://example.com/api/health')).toBe(
      'https://example.com/api/health',
    )
    expect(withEdgeOnePreviewToken('/assets/app.js')).toBe('/assets/app.js')
  })

  it('recognizes EdgeOne preview hostnames without treating other domains as previews', async () => {
    const { isEdgeOnePreviewHostname } = await import('./edgeone-preview-auth')
    expect(isEdgeOnePreviewHostname('preview.edgeone.app')).toBe(true)
    expect(isEdgeOnePreviewHostname('app.example.com')).toBe(false)
  })
})
