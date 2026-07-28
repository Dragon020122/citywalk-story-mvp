import { afterEach, describe, expect, it, vi } from 'vitest'

const originalUrl = window.location.href

async function loadAuth(path: string) {
  window.history.replaceState({}, '', path)
  vi.resetModules()
  return import('./edgeone-preview-auth')
}

afterEach(() => {
  window.history.replaceState({}, '', originalUrl)
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('EdgeOne preview runtime authentication', () => {
  it('captures the initial token before React rendering and keeps it in memory', async () => {
    const auth = await loadAuth('/?eo_token=test-token&eo_time=9999999999')
    auth.initEdgeOnePreviewAuth()
    window.history.replaceState({}, '', '/create')
    expect(auth.getEdgeOnePreviewToken()).toBe('test-token')
  })

  it('preserves preview parameters for same-origin navigation only', async () => {
    const auth = await loadAuth('/?eo_token=test-token&eo_time=9999999999')
    auth.initEdgeOnePreviewAuth()
    expect(auth.withEdgeOnePreviewNavigation('/story/story_test/preview')).toBe(
      '/story/story_test/preview?eo_token=test-token&eo_time=9999999999',
    )
  })

  it('does not put preview parameters on API or external URLs', async () => {
    const auth = await loadAuth('/?eo_token=test-token')
    auth.initEdgeOnePreviewAuth()
    expect(auth.withEdgeOnePreviewNavigation('/api/health')).toBe('/api/health')
    expect(
      auth.withEdgeOnePreviewNavigation('https://example.com/create'),
    ).toBe('https://example.com/create')
  })

  it('recognizes EdgeOne preview hostnames without treating other domains as previews', async () => {
    const { isEdgeOnePreviewHostname } = await loadAuth('/')
    expect(isEdgeOnePreviewHostname('preview.edgeone.app')).toBe(true)
    expect(isEdgeOnePreviewHostname('preview.edgeone.cool')).toBe(true)
    expect(isEdgeOnePreviewHostname('app.example.com')).toBe(false)
  })
})
