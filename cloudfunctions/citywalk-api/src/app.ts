import cors from 'cors'
import express, { type Express, type RequestHandler } from 'express'
import helmet from 'helmet'
import { nanoid } from 'nanoid'
import {
  FeedbackRequestSchema,
  PlanRouteRequestSchema,
  PlanRouteResponseSchema,
  RoutePlanningError,
} from '@citywalk/shared'
import { loadConfig, type AppConfig } from './config.js'
import { HttpError } from './http-error.js'
import { consoleLogger } from './logger.js'
import {
  errorHandler,
  rateLimit,
  requestContext,
  requestLogger,
  requestTimeout,
  validateBody,
} from './middleware.js'
import { FilePoiSource, type PoiSource } from './poi-source.js'
import {
  createRepositories,
  type ApiLogger,
  type RepositoryBundle,
} from './repositories/index.js'
import type { MapRouteProvider } from './route/map-route-provider.js'
import { MockMapRouteProvider } from './route/mock-map-route-provider.js'
import { planRoute } from './route/plan-route.js'
import { TencentMapRouteProvider } from './route/tencent-map-route-provider.js'

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export interface AppDependencies {
  config: AppConfig
  repositories: RepositoryBundle
  poiSource: PoiSource
  mapProvider: MapRouteProvider
  logger: ApiLogger
  now: () => Date
}

const asyncHandler = (
  handler: (
    ...arguments_: Parameters<RequestHandler>
  ) => Promise<void>,
): RequestHandler => (request, response, next) => {
  void handler(request, response, next).catch(next)
}

const createNotImplementedHandler = (
  feature: string,
): RequestHandler => (_request, _response, next) => {
  next(
    new HttpError({
      statusCode: 501,
      code: 'AI_GENERATION_ERROR',
      message: `${feature} is not available because AI is disabled in this stage`,
    }),
  )
}

export const createDefaultDependencies = (
  environment: NodeJS.ProcessEnv = process.env,
): AppDependencies => {
  const config = loadConfig(environment)
  const repositories = createRepositories({
    environment,
    logger: consoleLogger,
  })
  const mapProvider =
    config.nodeEnvironment === 'development' ||
    config.nodeEnvironment === 'test'
      ? new MockMapRouteProvider()
      : new TencentMapRouteProvider({
          apiKey: config.tencentMapServerKey,
        })

  return {
    config,
    repositories,
    poiSource: new FilePoiSource(),
    mapProvider,
    logger: consoleLogger,
    now: () => new Date(),
  }
}

export const createApp = (
  dependencies: AppDependencies = createDefaultDependencies(),
): Express => {
  const app = express()
  const { config, repositories } = dependencies
  const allowedOrigins = new Set(config.allowedOrigins)

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(requestContext)
  app.use(helmet())
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true)
          return
        }
        callback(
          new HttpError({
            statusCode: 403,
            code: 'VALIDATION_ERROR',
            message: 'Origin is not allowed',
          }),
        )
      },
    }),
  )
  app.use(
    requestLogger({
      logger: dependencies.logger,
      telemetry: repositories.telemetry,
      now: dependencies.now,
    }),
  )
  app.use(requestTimeout(config.requestTimeoutMs))
  app.use(express.json({ limit: config.jsonBodyLimit }))

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      version: config.version,
      environment: config.nodeEnvironment,
      aiEnabled: false,
      mapEnabled: Boolean(config.tencentMapServerKey),
      databaseEnabled: repositories.databaseStatus.enabled,
    })
  })

  app.use(
    '/v1',
    rateLimit({
      repository: repositories.rateLimits,
      scope: 'common',
      limit: config.commonLimitPerMinute,
      windowMs: MINUTE_MS,
      now: dependencies.now,
    }),
  )

  app.post(
    '/v1/routes/plan',
    validateBody(PlanRouteRequestSchema),
    asyncHandler(async (request, response) => {
      try {
        const pois = await dependencies.poiSource.load()
        const routePlan = await planRoute({
          preferences: request.body.preferences,
          pois,
          contentMode: config.contentMode,
          dataVersion: config.poiDataVersion,
          mapProvider: dependencies.mapProvider,
        })
        response.json(PlanRouteResponseSchema.parse({ routePlan }))
      } catch (error) {
        if (error instanceof RoutePlanningError) {
          throw new HttpError({
            statusCode: 422,
            code: 'ROUTE_NOT_FOUND',
            message: error.message,
            details: { routePlanningCode: error.code },
          })
        }
        throw error
      }
    }),
  )

  app.post(
    '/v1/stories/generate',
    rateLimit({
      repository: repositories.rateLimits,
      scope: 'generate',
      limit: config.generateLimitPerHour,
      windowMs: HOUR_MS,
      now: dependencies.now,
    }),
    createNotImplementedHandler('Story generation'),
  )
  app.post(
    '/v1/stories/:storyId/nodes/:nodeId/regenerate',
    rateLimit({
      repository: repositories.rateLimits,
      scope: 'regenerate',
      limit: config.regenerateLimitPerHour,
      windowMs: HOUR_MS,
      now: dependencies.now,
    }),
    createNotImplementedHandler('Node regeneration'),
  )
  app.post(
    '/v1/stories/:storyId/reroute',
    createNotImplementedHandler('Story rerouting'),
  )
  app.post(
    '/v1/stories/:storyId/resolve',
    createNotImplementedHandler('Story resolution'),
  )

  app.post(
    '/v1/feedback',
    validateBody(FeedbackRequestSchema),
    asyncHandler(async (request, response) => {
      const feedbackId = nanoid()
      await repositories.feedback.create({
        id: feedbackId,
        clientIdHash: String(response.locals.clientIdHash),
        feedback: request.body,
        createdAt: dependencies.now().toISOString(),
      })
      response.status(201).json({ feedbackId, accepted: true })
    }),
  )

  app.use((_request, _response, next) => {
    next(
      new HttpError({
        statusCode: 404,
        code: 'ROUTE_NOT_FOUND',
        message: 'HTTP route not found',
      }),
    )
  })
  app.use(errorHandler(dependencies.logger))

  return app
}
