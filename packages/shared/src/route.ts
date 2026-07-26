import { z } from 'zod'
import {
  GeoPointSchema,
  NonEmptyStringSchema,
} from './common.js'
import { PoiSchema } from './poi.js'

export const RouteSegmentSchema = z.object({
  fromPoiId: NonEmptyStringSchema,
  toPoiId: NonEmptyStringSchema,
  walkMeters: z.number().int().nonnegative(),
  walkMinutes: z.number().int().nonnegative(),
  polyline: z.array(GeoPointSchema),
  source: z.enum(['manual', 'tencent_map']),
})
export type RouteSegment = z.infer<typeof RouteSegmentSchema>

export const RoutePlanSchema = z.object({
  routeId: NonEmptyStringSchema,
  routePackId: NonEmptyStringSchema,
  selectedPois: z.array(PoiSchema).min(1),
  alternativePois: z.array(PoiSchema),
  routeSegments: z.array(RouteSegmentSchema),
  totalWalkMeters: z.number().int().nonnegative(),
  totalWalkMinutes: z.number().int().nonnegative(),
  totalStayMinutes: z.number().int().nonnegative(),
  totalEstimatedMinutes: z.number().int().nonnegative(),
  estimatedCostCny: z.number().nonnegative(),
  degraded: z.boolean(),
})

export type RoutePlan = z.infer<typeof RoutePlanSchema>
