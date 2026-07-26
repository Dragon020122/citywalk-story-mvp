import { z } from 'zod'

export const NonEmptyStringSchema = z.string().trim().min(1)
export const IsoDateTimeSchema = z.string().datetime({ offset: true })

export const GenreSchema = z.enum([
  'mystery',
  'healing',
  'relationship',
  'urban_fantasy',
])
export type Genre = z.infer<typeof GenreSchema>

export const EffectScoreKeySchema = z.enum([
  'truth',
  'memory',
  'empathy',
  'courage',
  'connection',
])
export type EffectScoreKey = z.infer<typeof EffectScoreKeySchema>

export const EffectScoresSchema = z.object({
  truth: z.number().int(),
  memory: z.number().int(),
  empathy: z.number().int(),
  courage: z.number().int(),
  connection: z.number().int(),
})
export type EffectScores = z.infer<typeof EffectScoresSchema>

export const GeoPointSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
})
export type GeoPoint = z.infer<typeof GeoPointSchema>
