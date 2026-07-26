import cors from 'cors'
import express, { type Express, type RequestHandler } from 'express'
import helmet from 'helmet'
import { nanoid } from 'nanoid'
import {
  FeedbackRequestSchema,
  GenerateStoryRequestSchema,
  GenerateStoryResponseSchema,
  PlanRouteRequestSchema,
  PlanRouteResponseSchema,
  RegenerateNodeRequestSchema,
  RegenerateNodeResponseSchema,
  RerouteRequestSchema,
  RerouteResponseSchema,
  RoutePlanningError,
} from '@citywalk/shared'
import {
  AiClientError,
  AiOutputParseError,
  BlueprintValidationError,
  CloudBaseAiClient,
  DefaultStoryWorkflow,
  regenerateNodeCopy,
  type AiTextClient,
  type StoryWorkflow,
} from './ai/index.js'
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
import { rerouteUnavailablePoi, RerouteError } from './route/reroute.js'
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
  storyWorkflow?: StoryWorkflow | null
  aiClient?: AiTextClient | null
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
    (config.nodeEnvironment === 'development' ||
      config.nodeEnvironment === 'test') &&
    !config.tencentMapServerKey
      ? new MockMapRouteProvider()
      : new TencentMapRouteProvider({
          apiKey: config.tencentMapServerKey,
        })
  const aiClient = config.cloudbaseEnvironmentId
    ? new CloudBaseAiClient({
        environmentId: config.cloudbaseEnvironmentId,
        modelName: config.aiModel,
      })
    : null
  const storyWorkflow = aiClient
    ? new DefaultStoryWorkflow({
        aiClient,
        cache: repositories.generationCache,
        cacheTtlHours: config.storyCacheTtlHours,
        poiDataVersion: config.poiDataVersion,
        now: () => new Date(),
      })
    : null

  return {
    config,
    repositories,
    poiSource: new FilePoiSource(),
    mapProvider,
    logger: consoleLogger,
    now: () => new Date(),
    aiClient,
    storyWorkflow,
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
      aiEnabled: Boolean(dependencies.storyWorkflow),
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
    ...(dependencies.storyWorkflow
      ? [
          validateBody(GenerateStoryRequestSchema),
          asyncHandler(async (request, response) => {
          try {
            const result = await dependencies.storyWorkflow!.generate(
              request.body,
            )
            const now = dependencies.now().toISOString()
            await repositories.storySessions.save({
              id: result.blueprint.storyId,
              storyId: result.blueprint.storyId,
              clientIdHash: String(response.locals.clientIdHash),
              preferences: request.body.preferences,
              routePlan: request.body.routePlan,
              blueprint: result.blueprint,
              storyGraph: result.storyGraph,
              createdAt: now,
              updatedAt: now,
            })
            response.json(GenerateStoryResponseSchema.parse(result))
          } catch (error) {
            if (
              error instanceof AiClientError ||
              error instanceof AiOutputParseError ||
              error instanceof BlueprintValidationError
            ) {
              throw new HttpError({
                statusCode: 502,
                code: 'AI_GENERATION_ERROR',
                message: 'Story generation failed',
              })
            }
            throw error
          }
          }),
        ]
      : [createNotImplementedHandler('Story generation')]),
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
    ...(dependencies.aiClient
      ? [
          validateBody(RegenerateNodeRequestSchema),
          asyncHandler(async (request, response) => {
          const storyId = Array.isArray(request.params.storyId)
            ? request.params.storyId[0]
            : request.params.storyId
          const nodeId = Array.isArray(request.params.nodeId)
            ? request.params.nodeId[0]
            : request.params.nodeId
          const session = storyId
            ? await repositories.storySessions.get(storyId)
            : null
          if (!session || !nodeId) {
            throw new HttpError({
              statusCode: 404,
              code: 'STORY_NOT_FOUND',
              message: 'Story or node not found',
            })
          }
          const node = session.storyGraph.nodes.find(
            (candidate) => candidate.id === nodeId,
          )
          if (!node) {
            throw new HttpError({
              statusCode: 404,
              code: 'STORY_NOT_FOUND',
              message: 'Story or node not found',
            })
          }
          try {
            const regenerated = await regenerateNodeCopy({
              aiClient: dependencies.aiClient!,
              node,
              reason: request.body.reason,
            })
            const storyGraph = {
              ...session.storyGraph,
              nodes: session.storyGraph.nodes.map((candidate) =>
                candidate.id === nodeId ? regenerated : candidate,
              ),
            }
            await repositories.storySessions.save({
              ...session,
              storyGraph,
              updatedAt: dependencies.now().toISOString(),
            })
            response.json(
              RegenerateNodeResponseSchema.parse({
                node: regenerated,
              }),
            )
          } catch (error) {
            if (
              error instanceof AiClientError ||
              error instanceof AiOutputParseError
            ) {
              throw new HttpError({
                statusCode: 502,
                code: 'AI_GENERATION_ERROR',
                message: 'Node regeneration failed',
              })
            }
            throw error
          }
          }),
        ]
      : [createNotImplementedHandler('Node regeneration')]),
  )
  app.post(
    '/v1/stories/:storyId/reroute',
    validateBody(RerouteRequestSchema),
    asyncHandler(async (request, response) => {
      const storyId = Array.isArray(request.params.storyId)
        ? request.params.storyId[0]
        : request.params.storyId
      if (!storyId || storyId !== request.body.storyId) {
        throw new HttpError({
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          message: 'Story id does not match the request path',
        })
      }
      const session = await repositories.storySessions.get(storyId)
      if (!session) {
        throw new HttpError({
          statusCode: 404,
          code: 'STORY_NOT_FOUND',
          message: 'Story session not found',
        })
      }
      try {
        const result = await rerouteUnavailablePoi({
          routePlan: request.body.routePlan,
          storyGraph: session.storyGraph,
          allPois: await dependencies.poiSource.load(),
          currentPoiId: request.body.currentPoiId,
          unavailablePoiIds: request.body.unavailablePoiIds,
          mapProvider: dependencies.mapProvider,
        })
        await repositories.storySessions.save({
          ...session,
          preferences: request.body.preferences,
          routePlan: result.routePlan,
          storyGraph: result.storyGraph,
          updatedAt: dependencies.now().toISOString(),
        })
        response.json(RerouteResponseSchema.parse(result))
      } catch (error) {
        if (error instanceof RerouteError) {
          throw new HttpError({
            statusCode: 422,
            code: 'ROUTE_NOT_FOUND',
            message: error.message,
            details: { rerouteCode: error.code },
          })
        }
        throw error
      }
    }),
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
