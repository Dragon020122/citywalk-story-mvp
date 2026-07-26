import type {
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

interface CloudBaseGetResult {
  data: unknown[]
}

interface CloudBaseDocument {
  get(): Promise<CloudBaseGetResult>
  set(data: object): Promise<unknown>
  delete(): Promise<unknown>
}

interface CloudBaseCollection {
  doc(id: string): CloudBaseDocument
  add(data: object): Promise<unknown>
}

export interface CloudBaseDatabase {
  collection(name: string): CloudBaseCollection
}

const getFirstRecord = <T>(result: CloudBaseGetResult): T | null =>
  (result.data[0] as T | undefined) ?? null

export class CloudBaseStorySessionRepository
  implements StorySessionRepository
{
  constructor(private readonly database: CloudBaseDatabase) {}

  async get(id: string): Promise<StorySessionRecord | null> {
    return getFirstRecord<StorySessionRecord>(
      await this.database.collection('story_sessions').doc(id).get(),
    )
  }

  async save(record: StorySessionRecord): Promise<void> {
    await this.database
      .collection('story_sessions')
      .doc(record.id)
      .set(record)
  }
}

export class CloudBaseGenerationCacheRepository
  implements GenerationCacheRepository
{
  constructor(private readonly database: CloudBaseDatabase) {}

  async get(
    key: string,
    now: Date,
  ): Promise<GenerationCacheRecord | null> {
    const document = this.database
      .collection('generation_cache')
      .doc(key)
    const record = getFirstRecord<GenerationCacheRecord>(
      await document.get(),
    )
    if (record && new Date(record.expiresAt).getTime() <= now.getTime()) {
      await document.delete()
      return null
    }
    return record
  }

  async set(record: GenerationCacheRecord): Promise<void> {
    await this.database
      .collection('generation_cache')
      .doc(record.key)
      .set(record)
  }
}

export class CloudBaseFeedbackRepository implements FeedbackRepository {
  constructor(private readonly database: CloudBaseDatabase) {}

  async create(record: FeedbackRecord): Promise<void> {
    await this.database.collection('feedback').doc(record.id).set(record)
  }
}

export class CloudBaseRateLimitRepository
  implements RateLimitRepository
{
  constructor(private readonly database: CloudBaseDatabase) {}

  async consume(options: {
    key: string
    limit: number
    windowMs: number
    now: Date
  }): Promise<RateLimitDecision> {
    const document = this.database
      .collection('rate_limits')
      .doc(options.key)
    const existing = getFirstRecord<RateLimitRecord>(
      await document.get(),
    )
    const nowMs = options.now.getTime()
    const expired =
      !existing || new Date(existing.expiresAt).getTime() <= nowMs
    const windowStartedAt = expired
      ? options.now
      : new Date(existing.windowStartedAt)
    const count = expired ? 1 : existing.count + 1
    const resetAt = new Date(
      windowStartedAt.getTime() + options.windowMs,
    )

    await document.set({
      key: options.key,
      count,
      windowStartedAt: windowStartedAt.toISOString(),
      expiresAt: resetAt.toISOString(),
    })

    return {
      allowed: count <= options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt: resetAt.toISOString(),
    }
  }
}

export class CloudBaseTelemetryRepository
  implements TelemetryRepository
{
  constructor(private readonly database: CloudBaseDatabase) {}

  async record(event: TelemetryEventRecord): Promise<void> {
    await this.database
      .collection('telemetry_events')
      .doc(event.id)
      .set(event)
  }
}
