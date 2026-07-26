import {
  RoutePlanSchema,
  estimateRouteCost,
  selectRoutePois,
  type ContentMode,
  type JourneyPreferences,
  type Poi,
  type RoutePlan,
  type RouteSegment,
} from '@citywalk/shared'
import type { MapRouteProvider } from './map-route-provider.js'

const FALLBACK_WALKING_METERS_PER_MINUTE = 75

const stableHash = (value: string): string => {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const createManualSegment = (from: Poi, to: Poi): RouteSegment => ({
  fromPoiId: from.id,
  toPoiId: to.id,
  walkMeters: to.walkMinutes * FALLBACK_WALKING_METERS_PER_MINUTE,
  walkMinutes: to.walkMinutes,
  polyline: [],
  source: 'manual',
})

const buildSegments = async (
  pois: readonly Poi[],
  mapProvider: MapRouteProvider,
): Promise<{ segments: RouteSegment[]; degraded: boolean }> => {
  const segments: RouteSegment[] = []
  let degraded = false

  for (let index = 1; index < pois.length; index += 1) {
    const from = pois[index - 1]
    const to = pois[index]
    if (!from || !to) {
      continue
    }

    try {
      segments.push(await mapProvider.getWalkingRoute(from, to))
    } catch {
      degraded = true
      segments.push(createManualSegment(from, to))
    }
  }

  return { segments, degraded }
}

const summarizeRoute = (
  selectedPois: readonly Poi[],
  segments: readonly RouteSegment[],
): {
  totalWalkMeters: number
  totalWalkMinutes: number
  totalStayMinutes: number
  totalEstimatedMinutes: number
  estimatedCostCny: number
} => {
  const totalWalkMeters = segments.reduce(
    (total, segment) => total + segment.walkMeters,
    0,
  )
  const totalWalkMinutes = segments.reduce(
    (total, segment) => total + segment.walkMinutes,
    0,
  )
  const totalStayMinutes = selectedPois.reduce(
    (total, poi) => total + poi.stayMinutes,
    0,
  )

  return {
    totalWalkMeters,
    totalWalkMinutes,
    totalStayMinutes,
    totalEstimatedMinutes: totalWalkMinutes + totalStayMinutes,
    estimatedCostCny: estimateRouteCost(selectedPois),
  }
}

export interface PlanRouteEngineInput {
  preferences: JourneyPreferences
  pois: readonly Poi[]
  contentMode: ContentMode
  dataVersion: string
  mapProvider: MapRouteProvider
}

export const planRoute = async (
  input: PlanRouteEngineInput,
): Promise<RoutePlan> => {
  const selection = selectRoutePois(input)
  const selectedPois = [...selection.selectedPois]
  const removedForTime: Poi[] = []
  const maximumMinutes = Math.floor(
    input.preferences.durationMinutes * 1.08,
  )
  let routeResult = await buildSegments(selectedPois, input.mapProvider)
  let summary = summarizeRoute(selectedPois, routeResult.segments)

  while (
    summary.totalEstimatedMinutes > maximumMinutes &&
    selectedPois.length > 1
  ) {
    const removed = selectedPois.pop()
    if (removed) {
      removedForTime.push(removed)
    }
    routeResult = await buildSegments(selectedPois, input.mapProvider)
    summary = summarizeRoute(selectedPois, routeResult.segments)
  }

  const allAlternativePois = [
    ...selection.alternativePois,
    ...removedForTime,
  ].filter(
    (poi, index, pois) =>
      pois.findIndex((candidate) => candidate.id === poi.id) === index,
  )

  const routeIdSeed = JSON.stringify({
    dataVersion: input.dataVersion,
    preferences: input.preferences,
    selectedPoiIds: selectedPois.map((poi) => poi.id),
    alternativePoiIds: allAlternativePois.map((poi) => poi.id),
  })

  return RoutePlanSchema.parse({
    routeId: `route_${stableHash(routeIdSeed)}`,
    routePackId: input.preferences.routePackId,
    selectedPois,
    alternativePois: allAlternativePois,
    routeSegments: routeResult.segments,
    ...summary,
    degraded: routeResult.degraded,
  })
}
