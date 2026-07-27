import {
  ApiErrorSchema,
  type JourneyPreferences,
  type Poi,
} from '@citywalk/shared'
import express from 'express'
import supertest from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  createApp,
  createDefaultDependencies,
  type AppDependencies,
} from './app.js'
import { MockStoryWorkflow } from './ai/index.js'
import { loadConfig } from './config.js'
import { StaticPoiSource } from './poi-source.js'
import {
  createFallbackRepositories,
  type ApiLogger,
} from './repositories/index.js'
import { MockMapRouteProvider } from './route/mock-map-route-provider.js'

const silentLogger: ApiLogger = {
  info() {},
  warn() {},
  error() {},
}

const fixedNow = new Date('2026-07-26T08:00:00+08:00')

const createFixedMockPois = (count = 12): Poi[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `mock_api_${String(index + 1).padStart(2, '0')}`,
    routePackId: 'mock_api_route',
    name: `固定 API 模拟节点 ${index + 1}`,
    shortName: `API 模拟 ${index + 1}`,
    address: `固定开发测试地址 ${index + 1}，不对应真实地点`,
    longitude: 121.47 + index * 0.0001,
    latitude: 31.23 + index * 0.0001,
    category: ['public_space', 'gallery', 'cafe'][index % 3] ?? 'public_space',
    indoor: index % 2 === 1,
    publicAccess: true,
    estimatedCostCny: 0,
    stayMinutes: 10,
    walkMinutes: 3,
    tags: ['architecture'],
    moodTags: ['urban'],
    storyHooks: ['mystery'],
    taskHooks: ['observe', `task-${index % 3}`],
    observationAnchors: [`anchor-${index + 1}`],
    safetyNotes: ['stay-public'],
    verificationStatus: 'mock',
    verifiedAt: null,
    sourceUrls: [],
    fallbackPoiIds: [
      `mock_api_${String(((index + 1) % count) + 1).padStart(2, '0')}`,
    ],
  }))

const preferences: JourneyPreferences = {
  routePackId: 'mock_api_route',
  startPoiId: 'auto',
  durationMinutes: 120,
  companion: 'friends',
  interests: ['architecture'],
  genre: 'mystery',
  taskIntensity: 'standard',
  budgetCny: 100,
  indoorPreference: 'balanced',
  photoTasksEnabled: true,
  puzzleTasksEnabled: true,
  storyExplorationRatio: 60,
}

const createTestDependencies = (
  overrides: Partial<AppDependencies['config']> = {},
): AppDependencies => {
  const config = {
    ...loadConfig({
      NODE_ENV: 'test',
      APP_CONTENT_MODE: 'mock',
      ALLOWED_ORIGINS: 'http://localhost:5173',
    }),
    ...overrides,
  }

  return {
    config,
    repositories: createFallbackRepositories(silentLogger),
    poiSource: new StaticPoiSource(createFixedMockPois()),
    mapProvider: new MockMapRouteProvider(),
    logger: silentLogger,
    now: () => new Date(fixedNow),
  }
}

describe('CloudBase HTTP API foundation', () => {
  it('uses server-side Mock story generation only in mock content mode', () => {
    const mockDependencies = createDefaultDependencies({
      NODE_ENV: 'production',
      APP_CONTENT_MODE: 'mock',
      CLOUDBASE_ENV_ID: 'mock-environment',
      TENCENT_MAP_SERVER_KEY: 'server-key-must-not-be-used',
    })
    const verifiedDependencies = createDefaultDependencies({
      NODE_ENV: 'development',
      APP_CONTENT_MODE: 'verified',
    })

    expect(mockDependencies.aiClient).toBeNull()
    expect(mockDependencies.storyWorkflow).toBeDefined()
    expect(mockDependencies.mapProvider).toBeInstanceOf(MockMapRouteProvider)
    expect(mockDependencies.repositories.databaseStatus.enabled).toBe(false)
    expect(verifiedDependencies.aiClient).toBeNull()
    expect(verifiedDependencies.storyWorkflow).toBeNull()
  })

  it('returns health status without secrets', async () => {
    const response = await supertest(
      createApp(createTestDependencies()),
    ).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      version: '1.0.0',
      environment: 'test',
      aiEnabled: false,
      mapEnabled: false,
      databaseEnabled: false,
    })
    expect(JSON.stringify(response.body)).not.toContain('TENCENT_MAP')
    expect(JSON.stringify(response.body)).not.toContain('CLOUDBASE')
  })

  it('plans a route with the real route engine', async () => {
    const response = await supertest(
      createApp(createTestDependencies()),
    )
      .post('/v1/routes/plan')
      .set('x-device-id', 'fixed-device')
      .send({ preferences })

    expect(response.status).toBe(200)
    expect(response.body.routePlan.selectedPois).toHaveLength(7)
    expect(response.body.routePlan.routeId).toMatch(/^route_/u)
  })

  it('completes route and story generation in mock mode without AI', async () => {
    const dependencies = createTestDependencies()
    dependencies.storyWorkflow = new MockStoryWorkflow()
    const client = supertest(createApp(dependencies))
    const routeResponse = await client
      .post('/v1/routes/plan')
      .set('x-device-id', 'mock-generation-device')
      .send({ preferences })
    const storyResponse = await client
      .post('/v1/stories/generate')
      .set('x-device-id', 'mock-generation-device')
      .send({
        preferences,
        routePlan: routeResponse.body.routePlan,
      })

    expect(routeResponse.status).toBe(200)
    expect(storyResponse.status).toBe(200)
    expect(storyResponse.body.fallbackUsed).toBe(true)
    expect(storyResponse.body.blueprint.storyId).toMatch(/^story_route_/u)
  })

  it('serves the EdgeOne /api catch-all without changing Express routes', async () => {
    const dependencies = createTestDependencies()
    dependencies.storyWorkflow = new MockStoryWorkflow()
    const edgeOneMountedApp = express()
    edgeOneMountedApp.use('/api', createApp(dependencies))
    const client = supertest(edgeOneMountedApp)

    const healthResponse = await client.get('/api/health')
    const routeResponse = await client
      .post('/api/v1/routes/plan')
      .set('x-device-id', 'edgeone-mounted-device')
      .send({ preferences })
    const storyResponse = await client
      .post('/api/v1/stories/generate')
      .set('x-device-id', 'edgeone-mounted-device')
      .send({ preferences, routePlan: routeResponse.body.routePlan })

    expect(healthResponse.status).toBe(200)
    expect(routeResponse.status).toBe(200)
    expect(storyResponse.status).toBe(200)
  })

  it('rejects an invalid route request with a normalized error', async () => {
    const response = await supertest(
      createApp(createTestDependencies()),
    )
      .post('/v1/routes/plan')
      .send({ preferences: { ...preferences, interests: [] } })

    expect(response.status).toBe(400)
    expect(ApiErrorSchema.safeParse(response.body).success).toBe(true)
    expect(response.body.code).toBe('VALIDATION_ERROR')
  })

  it('returns a normalized 404 error', async () => {
    const response = await supertest(
      createApp(createTestDependencies()),
    ).get('/missing')

    expect(response.status).toBe(404)
    expect(ApiErrorSchema.safeParse(response.body).success).toBe(true)
    expect(response.body.code).toBe('ROUTE_NOT_FOUND')
  })

  it('returns a normalized 501 response for AI endpoints', async () => {
    const response = await supertest(
      createApp(createTestDependencies()),
    ).post('/v1/stories/generate')

    expect(response.status).toBe(501)
    expect(ApiErrorSchema.safeParse(response.body).success).toBe(true)
    expect(response.body.code).toBe('AI_GENERATION_ERROR')
  })

  it('enforces anonymous client rate limits', async () => {
    const app = createApp(
      createTestDependencies({ commonLimitPerMinute: 2 }),
    )
    const client = supertest(app)
    const send = () =>
      client
        .post('/v1/stories/generate')
        .set('user-agent', 'fixed-test-agent')
        .set('x-device-id', 'fixed-device')

    expect((await send()).status).toBe(501)
    expect((await send()).status).toBe(501)
    const limited = await send()
    expect(limited.status).toBe(429)
    expect(limited.body.code).toBe('RATE_LIMITED')
  })

  it('returns CORS headers for an allowed origin', async () => {
    const response = await supertest(
      createApp(createTestDependencies()),
    )
      .get('/health')
      .set('origin', 'http://localhost:5173')

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    )
  })

  it('rejects JSON bodies above the configured size limit', async () => {
    const response = await supertest(
      createApp(createTestDependencies({ jsonBodyLimit: '1kb' })),
    )
      .post('/v1/routes/plan')
      .send({ payload: 'x'.repeat(2_000) })

    expect(response.status).toBe(413)
    expect(response.body.code).toBe('VALIDATION_ERROR')
  })

  it('keeps feedback available with database fallback enabled', async () => {
    const dependencies = createTestDependencies()
    const response = await supertest(createApp(dependencies))
      .post('/v1/feedback')
      .set('x-device-id', 'fallback-device')
      .send({
        storyId: 'story-test',
        routePackId: 'mock_api_route',
        overallRating: 5,
        storyCoherence: 4,
        routeQuality: 5,
        taskQuality: 4,
        safetyFeeling: 5,
        likedTags: ['useful'],
        issueTags: [],
        comment: '',
        fallbackUsed: false,
      })

    expect(dependencies.repositories.databaseStatus.enabled).toBe(false)
    expect(response.status).toBe(201)
    expect(response.body.accepted).toBe(true)
  })

  it('accepts queued anonymous events and story completion status', async () => {
    const app = createApp(createTestDependencies())
    const eventResponse = await supertest(app)
      .post('/v1/events')
      .send({
        eventName: 'offline_open',
        occurredAt: fixedNow.toISOString(),
        properties: { cachedStories: 2 },
      })
    const completionResponse = await supertest(app)
      .post('/v1/stories/story-test/completion')
      .send({
        storyId: 'story-test',
        endingId: 'ending-test',
        completedAt: fixedNow.toISOString(),
      })

    expect(eventResponse.status).toBe(202)
    expect(completionResponse.status).toBe(202)
  })
})
