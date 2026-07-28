import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import supertest from 'supertest'

const require = createRequire(import.meta.url)

describe('EdgeOne Makers deployment configuration', () => {
  it('keeps the API function namespace ahead of the SPA fallback contract', async () => {
    const file = await readFile(resolve('edgeone.json'), 'utf8')
    const config: unknown = JSON.parse(file)

    expect(config).toMatchObject({
      outputDirectory: 'apps/web/dist',
      rewrites: [{ source: '/*', destination: '/index.html' }],
      cloudFunctions: { nodejs: { maxDuration: 60 } },
    })
    expect(file).not.toContain('//')
    expect(
      await readFile(resolve('cloud-functions/api/[[default]].ts'), 'utf8'),
    ).toContain('export default app')
    const viteConfig = await readFile(
      resolve('apps/web/vite.config.ts'),
      'utf8',
    )
    expect(viteConfig).toContain('/^\\/api(?:\\/|$)/')
    expect(viteConfig).toContain("handler: 'NetworkOnly'")
  })

  it('imports the production Mock function entry without live services', async () => {
    const originalEnvironment = {
      NODE_ENV: process.env.NODE_ENV,
      APP_CONTENT_MODE: process.env.APP_CONTENT_MODE,
      CLOUDBASE_ENV_ID: process.env.CLOUDBASE_ENV_ID,
      TENCENT_MAP_SERVER_KEY: process.env.TENCENT_MAP_SERVER_KEY,
    }
    const originalFetch = globalThis.fetch
    const fetchCalls: unknown[][] = []

    process.env.NODE_ENV = 'production'
    process.env.APP_CONTENT_MODE = 'mock'
    process.env.CLOUDBASE_ENV_ID = 'must-not-be-initialized'
    process.env.TENCENT_MAP_SERVER_KEY = 'must-not-be-used'
    globalThis.fetch = ((...args: unknown[]) => {
      fetchCalls.push(args)
      return Promise.reject(new Error('Mock function must not call fetch'))
    }) as typeof fetch

    try {
      expect(require.resolve('ws')).toBeTruthy()
      const { default: app } =
        await import('../cloud-functions/api/[[default]].js')
      const client = supertest(app)
      const preferences = {
        routePackId: 'wukang-hunan',
        startPoiId: 'auto',
        durationMinutes: 180,
        companion: 'friends',
        interests: ['development'],
        genre: 'mystery',
        taskIntensity: 'standard',
        budgetCny: 100,
        indoorPreference: 'balanced',
        photoTasksEnabled: true,
        puzzleTasksEnabled: true,
        storyExplorationRatio: 60,
      }
      const health = await client.get('/health')
      const route = await client
        .post('/v1/routes/plan')
        .set('x-device-id', 'edgeone-production-mock')
        .send({ preferences })
      const story = await client
        .post('/v1/stories/generate')
        .set('x-device-id', 'edgeone-production-mock')
        .send({ preferences, routePlan: route.body.routePlan })

      expect(health.status).toBe(200)
      expect(health.body).toMatchObject({
        aiEnabled: false,
        mapEnabled: false,
        databaseEnabled: false,
      })
      expect(route.status).toBe(200)
      expect(story.status).toBe(200)
      expect(fetchCalls).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
      for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })
})
