import { initializeCloudBase } from '../cloudbase-sdk.js'
import {
  CloudBaseFeedbackRepository,
  CloudBaseGenerationCacheRepository,
  CloudBaseRateLimitRepository,
  CloudBaseStorySessionRepository,
  CloudBaseTelemetryRepository,
  type CloudBaseDatabase,
} from './cloudbase-repositories.js'
import {
  InMemoryGenerationCacheRepository,
  InMemoryRateLimitRepository,
  InMemoryStorySessionRepository,
  LoggingFeedbackRepository,
  LoggingTelemetryRepository,
} from './memory-repositories.js'
import type {
  ApiLogger,
  FeedbackRepository,
  GenerationCacheRepository,
  RateLimitRepository,
  RepositoryBundle,
  StorySessionRepository,
  TelemetryRepository,
} from './types.js'

const markDatabaseUnavailable = (
  databaseStatus: { enabled: boolean },
  logger: ApiLogger,
  error: unknown,
): void => {
  databaseStatus.enabled = false
  logger.warn('database_fallback_activated', {
    error: error instanceof Error ? error.message : 'unknown database error',
  })
}

const withFallback = <T extends object>(
  primary: T,
  fallback: T,
  databaseStatus: { enabled: boolean },
  logger: ApiLogger,
): T =>
  new Proxy(primary, {
    get(target, property, receiver) {
      const primaryValue = Reflect.get(target, property, receiver)
      const fallbackValue = Reflect.get(fallback, property, fallback)
      if (
        typeof primaryValue !== 'function' ||
        typeof fallbackValue !== 'function'
      ) {
        return primaryValue
      }

      return async (...args: unknown[]) => {
        if (!databaseStatus.enabled) {
          return Reflect.apply(fallbackValue, fallback, args)
        }
        try {
          return await Reflect.apply(primaryValue, target, args)
        } catch (error) {
          markDatabaseUnavailable(databaseStatus, logger, error)
          return Reflect.apply(fallbackValue, fallback, args)
        }
      }
    },
  })

export const createFallbackRepositories = (
  logger: ApiLogger,
): RepositoryBundle => ({
  storySessions: new InMemoryStorySessionRepository(),
  generationCache: new InMemoryGenerationCacheRepository(),
  feedback: new LoggingFeedbackRepository(logger),
  rateLimits: new InMemoryRateLimitRepository(),
  telemetry: new LoggingTelemetryRepository(logger),
  databaseStatus: { enabled: false },
})

export const createRepositories = (options: {
  environment: NodeJS.ProcessEnv
  logger: ApiLogger
}): RepositoryBundle => {
  const fallback = createFallbackRepositories(options.logger)
  const environmentId = options.environment.CLOUDBASE_ENV_ID?.trim()
  const isDevelopment =
    (options.environment.NODE_ENV ?? 'development') === 'development'

  if (!environmentId || isDevelopment) {
    return fallback
  }

  try {
    const cloudbase = initializeCloudBase({ env: environmentId })
    const database =
      cloudbase.database() as unknown as CloudBaseDatabase
    const databaseStatus = { enabled: true }
    const storySessions: StorySessionRepository = withFallback(
      new CloudBaseStorySessionRepository(database),
      fallback.storySessions,
      databaseStatus,
      options.logger,
    )
    const generationCache: GenerationCacheRepository = withFallback(
      new CloudBaseGenerationCacheRepository(database),
      fallback.generationCache,
      databaseStatus,
      options.logger,
    )
    const feedback: FeedbackRepository = withFallback(
      new CloudBaseFeedbackRepository(database),
      fallback.feedback,
      databaseStatus,
      options.logger,
    )
    const rateLimits: RateLimitRepository = withFallback(
      new CloudBaseRateLimitRepository(database),
      fallback.rateLimits,
      databaseStatus,
      options.logger,
    )
    const telemetry: TelemetryRepository = withFallback(
      new CloudBaseTelemetryRepository(database),
      fallback.telemetry,
      databaseStatus,
      options.logger,
    )

    return {
      storySessions,
      generationCache,
      feedback,
      rateLimits,
      telemetry,
      databaseStatus,
    }
  } catch (error) {
    markDatabaseUnavailable(
      fallback.databaseStatus,
      options.logger,
      error,
    )
    return fallback
  }
}
