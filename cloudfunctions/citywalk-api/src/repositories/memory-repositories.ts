import type {
  ApiLogger,
  FeedbackRecord,
  FeedbackRepository,
  GenerationCacheRecord,
  GenerationCacheRepository,
  RateLimitDecision,
  RateLimitRecord,
  RateLimitRepository,
  StorySessionRecord,
  StorySessionRepository,
  TelemetryEventRecord,
  TelemetryRepository,
} from './types.js'

export class InMemoryStorySessionRepository
  implements StorySessionRepository
{
  private readonly sessions = new Map<string, StorySessionRecord>()

  async get(id: string): Promise<StorySessionRecord | null> {
    return this.sessions.get(id) ?? null
  }

  async save(record: StorySessionRecord): Promise<void> {
    this.sessions.set(record.id, structuredClone(record))
  }
}

export class InMemoryGenerationCacheRepository
  implements GenerationCacheRepository
{
  private readonly cache = new Map<string, GenerationCacheRecord>()

  async get(
    key: string,
    now: Date,
  ): Promise<GenerationCacheRecord | null> {
    const record = this.cache.get(key)
    if (!record) {
      return null
    }
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      this.cache.delete(key)
      return null
    }
    return structuredClone(record)
  }

  async set(record: GenerationCacheRecord): Promise<void> {
    this.cache.set(record.key, structuredClone(record))
  }
}

export class LoggingFeedbackRepository implements FeedbackRepository {
  constructor(private readonly logger: ApiLogger) {}

  async create(record: FeedbackRecord): Promise<void> {
    this.logger.info('feedback_fallback', {
      feedbackId: record.id,
      storyId: record.feedback.storyId,
      overallRating: record.feedback.overallRating,
      clientIdHash: record.clientIdHash,
    })
  }
}

export class InMemoryRateLimitRepository
  implements RateLimitRepository
{
  private readonly records = new Map<string, RateLimitRecord>()

  async consume(options: {
    key: string
    limit: number
    windowMs: number
    now: Date
  }): Promise<RateLimitDecision> {
    const existing = this.records.get(options.key)
    const nowMs = options.now.getTime()
    const existingExpiry = existing
      ? new Date(existing.expiresAt).getTime()
      : 0
    const windowStartedAt =
      !existing || existingExpiry <= nowMs
        ? options.now
        : new Date(existing.windowStartedAt)
    const nextCount =
      !existing || existingExpiry <= nowMs ? 1 : existing.count + 1
    const resetAt = new Date(
      windowStartedAt.getTime() + options.windowMs,
    )

    this.records.set(options.key, {
      key: options.key,
      count: nextCount,
      windowStartedAt: windowStartedAt.toISOString(),
      expiresAt: resetAt.toISOString(),
    })

    return {
      allowed: nextCount <= options.limit,
      remaining: Math.max(0, options.limit - nextCount),
      resetAt: resetAt.toISOString(),
    }
  }
}

export class LoggingTelemetryRepository
  implements TelemetryRepository
{
  constructor(private readonly logger: ApiLogger) {}

  async record(event: TelemetryEventRecord): Promise<void> {
    this.logger.info('telemetry_fallback', {
      eventId: event.id,
      eventName: event.eventName,
      requestId: event.requestId,
      clientIdHash: event.clientIdHash,
      ...event.properties,
    })
  }
}
