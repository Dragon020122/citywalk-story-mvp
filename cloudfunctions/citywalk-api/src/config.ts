import {
  ContentModeSchema,
  type ContentMode,
} from '@citywalk/shared'
import { z } from 'zod'

const PositiveIntegerStringSchema = z
  .string()
  .regex(/^\d+$/u)
  .transform(Number)
  .pipe(z.number().int().positive())

const EnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_CONTENT_MODE: ContentModeSchema.default('mock'),
  CLOUDBASE_ENV_ID: z.string().trim().optional(),
  AI_MODEL: z.string().trim().min(1).default('deepseek-v4-flash'),
  TENCENT_MAP_SERVER_KEY: z.string().trim().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_GENERATE_PER_HOUR:
    PositiveIntegerStringSchema.default(8),
  RATE_LIMIT_REGENERATE_PER_HOUR:
    PositiveIntegerStringSchema.default(12),
  RATE_LIMIT_COMMON_PER_MINUTE:
    PositiveIntegerStringSchema.default(30),
  STORY_CACHE_TTL_HOURS: PositiveIntegerStringSchema.default(24),
  REQUEST_TIMEOUT_MS: PositiveIntegerStringSchema.default(10_000),
  JSON_BODY_LIMIT: z.string().trim().min(1).default('64kb'),
  PORT: PositiveIntegerStringSchema.default(3000),
  POI_DATA_VERSION: z.string().trim().min(1).default('mock-v1'),
})

export interface AppConfig {
  nodeEnvironment: 'development' | 'test' | 'production'
  contentMode: ContentMode
  cloudbaseEnvironmentId: string | undefined
  aiModel: string
  tencentMapServerKey: string | undefined
  allowedOrigins: string[]
  generateLimitPerHour: number
  regenerateLimitPerHour: number
  commonLimitPerMinute: number
  storyCacheTtlHours: number
  requestTimeoutMs: number
  jsonBodyLimit: string
  port: number
  poiDataVersion: string
  version: string
}

export const loadConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig => {
  const parsed = EnvironmentSchema.parse(environment)
  return {
    nodeEnvironment: parsed.NODE_ENV,
    contentMode: parsed.APP_CONTENT_MODE,
    cloudbaseEnvironmentId: parsed.CLOUDBASE_ENV_ID,
    aiModel: parsed.AI_MODEL,
    tencentMapServerKey: parsed.TENCENT_MAP_SERVER_KEY,
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    generateLimitPerHour: parsed.RATE_LIMIT_GENERATE_PER_HOUR,
    regenerateLimitPerHour: parsed.RATE_LIMIT_REGENERATE_PER_HOUR,
    commonLimitPerMinute: parsed.RATE_LIMIT_COMMON_PER_MINUTE,
    storyCacheTtlHours: parsed.STORY_CACHE_TTL_HOURS,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    jsonBodyLimit: parsed.JSON_BODY_LIMIT,
    port: parsed.PORT,
    poiDataVersion: parsed.POI_DATA_VERSION,
    version: '1.0.0',
  }
}
