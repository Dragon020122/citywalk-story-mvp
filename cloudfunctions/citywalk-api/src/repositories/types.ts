import type { FeedbackRequest, StoryRun } from '@citywalk/shared'

export interface StorySessionRecord {
  id: string
  storyId: string
  clientIdHash: string
  storyRun: StoryRun
  createdAt: string
  updatedAt: string
}

export interface GenerationCacheRecord {
  key: string
  value: unknown
  expiresAt: string
  createdAt: string
}

export interface FeedbackRecord {
  id: string
  clientIdHash: string
  feedback: FeedbackRequest
  createdAt: string
}

export interface RateLimitRecord {
  key: string
  count: number
  windowStartedAt: string
  expiresAt: string
}

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  resetAt: string
}

export interface TelemetryEventRecord {
  id: string
  eventName: string
  requestId: string
  clientIdHash: string
  properties: Record<string, boolean | number | string>
  createdAt: string
}

export interface StorySessionRepository {
  get(id: string): Promise<StorySessionRecord | null>
  save(record: StorySessionRecord): Promise<void>
}

export interface GenerationCacheRepository {
  get(key: string, now: Date): Promise<GenerationCacheRecord | null>
  set(record: GenerationCacheRecord): Promise<void>
}

export interface FeedbackRepository {
  create(record: FeedbackRecord): Promise<void>
}

export interface RateLimitRepository {
  consume(options: {
    key: string
    limit: number
    windowMs: number
    now: Date
  }): Promise<RateLimitDecision>
}

export interface TelemetryRepository {
  record(event: TelemetryEventRecord): Promise<void>
}

export interface DatabaseStatus {
  enabled: boolean
}

export interface RepositoryBundle {
  storySessions: StorySessionRepository
  generationCache: GenerationCacheRepository
  feedback: FeedbackRepository
  rateLimits: RateLimitRepository
  telemetry: TelemetryRepository
  databaseStatus: DatabaseStatus
}

export interface ApiLogger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}
