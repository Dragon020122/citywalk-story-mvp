import { z } from 'zod'
import { NonEmptyStringSchema } from './common.js'
import { JourneyPreferencesSchema } from './journey.js'
import { RoutePlanSchema } from './route.js'
import { StoryRunSchema } from './run.js'
import {
  FlagValueSchema,
  StoryBlueprintSchema,
  StoryGraphSchema,
  StoryNodeSchema,
} from './story.js'

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'ROUTE_NOT_FOUND',
  'POI_NOT_VERIFIED',
  'MAP_SERVICE_ERROR',
  'AI_GENERATION_ERROR',
  'STORY_GRAPH_INVALID',
  'RATE_LIMITED',
  'STORY_NOT_FOUND',
  'INTERNAL_ERROR',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const API_ERROR_CODES = ApiErrorCodeSchema.enum

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: NonEmptyStringSchema,
  details: z.unknown().optional(),
  requestId: NonEmptyStringSchema.optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export const PlanRouteRequestSchema = z.object({
  preferences: JourneyPreferencesSchema,
})
export type PlanRouteRequest = z.infer<typeof PlanRouteRequestSchema>

export const PlanRouteResponseSchema = z.object({
  routePlan: RoutePlanSchema,
})
export type PlanRouteResponse = z.infer<typeof PlanRouteResponseSchema>

export const GenerateStoryRequestSchema = z.object({
  preferences: JourneyPreferencesSchema,
  routePlan: RoutePlanSchema,
})
export type GenerateStoryRequest = z.infer<
  typeof GenerateStoryRequestSchema
>

export const GenerateStoryResponseSchema = z.object({
  blueprint: StoryBlueprintSchema,
  storyGraph: StoryGraphSchema,
  fallbackUsed: z.boolean(),
  fallbackReason: z.literal('STORY_GRAPH_INVALID').nullable(),
})
export type GenerateStoryResponse = z.infer<
  typeof GenerateStoryResponseSchema
>

export const RegenerateNodeRequestSchema = z.object({
  reason: NonEmptyStringSchema.optional(),
})
export type RegenerateNodeRequest = z.infer<
  typeof RegenerateNodeRequestSchema
>

export const RegenerateNodeResponseSchema = z.object({
  node: StoryNodeSchema,
})
export type RegenerateNodeResponse = z.infer<
  typeof RegenerateNodeResponseSchema
>

export const RerouteRequestSchema = z.object({
  storyId: NonEmptyStringSchema,
  currentPoiId: NonEmptyStringSchema,
  unavailablePoiIds: z.array(NonEmptyStringSchema),
  preferences: JourneyPreferencesSchema,
  routePlan: RoutePlanSchema,
})
export type RerouteRequest = z.infer<typeof RerouteRequestSchema>

export const RerouteResponseSchema = z.object({
  routePlan: RoutePlanSchema,
  storyGraph: StoryGraphSchema,
})
export type RerouteResponse = z.infer<typeof RerouteResponseSchema>

export const ResolveStoryRequestSchema = z.object({
  storyRun: StoryRunSchema,
})
export type ResolveStoryRequest = z.infer<
  typeof ResolveStoryRequestSchema
>

export const ResolveStoryResponseSchema = z.object({
  endingId: NonEmptyStringSchema,
  storyRun: StoryRunSchema,
})
export type ResolveStoryResponse = z.infer<
  typeof ResolveStoryResponseSchema
>

export const FeedbackRequestSchema = z.object({
  storyId: NonEmptyStringSchema,
  rating: z.number().int().min(1).max(5),
  tags: z.array(NonEmptyStringSchema),
  comment: z.string().trim().max(2000).optional(),
  context: z
    .record(NonEmptyStringSchema, FlagValueSchema)
    .optional(),
})
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>
