import { afterEach, describe, expect, it, vi } from 'vitest'
import { testGenerationResult } from '../test/generation-fixture'

async function loadAdapter(mode: 'server' | 'client-mock') {
  vi.stubEnv('VITE_GENERATION_MODE', mode)
  vi.resetModules()
  return import('./generation-adapter')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('generation adapter', () => {
  it.each([120, 180, 240] as const)(
    'generates locally for %i minutes without fetch',
    async (durationMinutes) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const adapter = await loadAdapter('client-mock')
      const preferences = {
        ...testGenerationResult.preferences,
        durationMinutes,
      }
      const signal = new AbortController().signal

      const routePlan = await adapter.planJourneyRoute(preferences, signal)
      const story = await adapter.generateJourneyStory(
        preferences,
        routePlan,
        signal,
      )

      expect(
        routePlan.selectedPois.every((poi) => poi.id.startsWith('mock_')),
      ).toBe(true)
      expect(
        story.storyGraph.nodes.every((node) =>
          routePlan.selectedPois.some((poi) => poi.id === node.poiId),
        ),
      ).toBe(true)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each([0, 50, 100, 200, 300] as const)(
    'accepts budgetCny=%i without fetch',
    async (budgetCny) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const adapter = await loadAdapter('client-mock')
      const signal = new AbortController().signal
      const preferences = { ...testGenerationResult.preferences, budgetCny }

      await expect(
        adapter.planJourneyRoute(preferences, signal),
      ).resolves.toBeTruthy()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('keeps server mode on the existing API endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ routePlan: testGenerationResult.routePlan }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(testGenerationResult.story), {
          status: 200,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const adapter = await loadAdapter('server')
    const signal = new AbortController().signal
    const routePlan = await adapter.planJourneyRoute(
      testGenerationResult.preferences,
      signal,
    )
    await adapter.generateJourneyStory(
      testGenerationResult.preferences,
      routePlan,
      signal,
    )

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/routes/plan',
      '/api/v1/stories/generate',
    ])
  })
})
