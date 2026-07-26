import { z } from 'zod'
import { GenreSchema, NonEmptyStringSchema } from './common.js'

export const JourneyPreferencesSchema = z.object({
  routePackId: NonEmptyStringSchema,
  startPoiId: z.union([z.literal('auto'), NonEmptyStringSchema]),
  durationMinutes: z.union([
    z.literal(120),
    z.literal(180),
    z.literal(240),
  ]),
  companion: z.enum(['solo', 'couple', 'friends']),
  interests: z.array(NonEmptyStringSchema).min(1).max(4),
  genre: GenreSchema,
  taskIntensity: z.enum(['light', 'standard', 'immersive']),
  budgetCny: z.union([
    z.literal(0),
    z.literal(50),
    z.literal(100),
    z.literal(200),
    z.literal(300),
  ]),
  indoorPreference: z.enum(['avoid', 'balanced', 'prefer']),
  photoTasksEnabled: z.boolean(),
  puzzleTasksEnabled: z.boolean(),
  storyExplorationRatio: z.number().min(0).max(100).default(60),
})

export type JourneyPreferences = z.infer<typeof JourneyPreferencesSchema>
export type JourneyPreferencesInput = z.input<typeof JourneyPreferencesSchema>
