import { afterEach, describe, expect, it, vi } from 'vitest'
import { testGenerationResult } from './test/generation-fixture'

const originalUrl = window.location.href

async function loadApiClient(path: string) {
  window.history.replaceState({}, '', path)
  vi.resetModules()
  return import('./api-client')
}

afterEach(() => {
  window.history.replaceState({}, '', originalUrl)
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('API client EdgeOne preview support', () => {
  it('uses cookie-backed same-origin API URLs without putting preview tokens in bodies', async () => {
    const client = await loadApiClient('/?eo_token=test-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ routePlan: testGenerationResult.routePlan }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(testGenerationResult.story), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal

    const routePlan = await client.planJourneyRoute(
      testGenerationResult.preferences,
      signal,
    )
    await client.generateJourneyStory(
      testGenerationResult.preferences,
      routePlan,
      signal,
    )

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/routes/plan',
      '/api/v1/stories/generate',
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.parse(String(init?.body))).not.toHaveProperty('eo_token')
      expect(init?.credentials).toBe('same-origin')
    }
  })

  it('classifies 401 responses for preview expiry, missing credentials, and ordinary authorization', async () => {
    const { classifyHttpError } = await loadApiClient('/')
    expect(classifyHttpError(401, true, true, true)).toBe(
      'EDGEONE_PREVIEW_TOKEN_EXPIRED',
    )
    expect(classifyHttpError(401, true, true)).toBe(
      'EDGEONE_PREVIEW_AUTH_FAILED',
    )
    expect(classifyHttpError(401, false, true)).toBe(
      'EDGEONE_PREVIEW_TOKEN_MISSING',
    )
    expect(classifyHttpError(401, false, false)).toBe('HTTP_UNAUTHORIZED')
    expect(classifyHttpError(500, false, false)).toBe('API_ERROR')
  })
})
