import { z } from 'zod'
import {
  IsoDateTimeSchema,
  NonEmptyStringSchema,
} from './common.js'

export const PoiVerificationStatusSchema = z.enum([
  'unverified',
  'pending',
  'verified',
  'rejected',
  'mock',
])
export type PoiVerificationStatus = z.infer<
  typeof PoiVerificationStatusSchema
>

export const PoiSchema = z.object({
  id: NonEmptyStringSchema,
  routePackId: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  shortName: NonEmptyStringSchema,
  address: NonEmptyStringSchema,
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  category: NonEmptyStringSchema,
  indoor: z.boolean(),
  publicAccess: z.boolean(),
  estimatedCostCny: z.number().min(0),
  stayMinutes: z.number().int().positive(),
  walkMinutes: z.number().int().nonnegative(),
  tags: z.array(NonEmptyStringSchema),
  moodTags: z.array(NonEmptyStringSchema),
  storyHooks: z.array(NonEmptyStringSchema),
  taskHooks: z.array(NonEmptyStringSchema),
  observationAnchors: z.array(NonEmptyStringSchema),
  safetyNotes: z.array(NonEmptyStringSchema),
  verificationStatus: PoiVerificationStatusSchema,
  verifiedAt: IsoDateTimeSchema.nullable(),
  sourceUrls: z.array(z.string().url()),
  fallbackPoiIds: z.array(NonEmptyStringSchema),
})

export type Poi = z.infer<typeof PoiSchema>

export const isProductionPoi = (poi: Poi): boolean =>
  poi.verificationStatus === 'verified'
