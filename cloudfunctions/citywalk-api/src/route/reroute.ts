import {
  RerouteResponseSchema,
  estimateRouteCost,
  type Poi,
  type RerouteResponse,
  type RoutePlan,
  type RouteSegment,
  type StoryGraph,
} from '@citywalk/shared'
import type { MapRouteProvider } from './map-route-provider.js'

const FALLBACK_WALKING_METERS_PER_MINUTE = 75

export class RerouteError extends Error {
  readonly code: 'CURRENT_POI_NOT_FOUND' | 'NO_FALLBACK_POI'

  constructor(
    code: 'CURRENT_POI_NOT_FOUND' | 'NO_FALLBACK_POI',
    message: string,
  ) {
    super(message)
    this.name = 'RerouteError'
    this.code = code
  }
}

const manualSegment = (from: Poi, to: Poi): RouteSegment => ({
  fromPoiId: from.id,
  toPoiId: to.id,
  walkMeters: to.walkMinutes * FALLBACK_WALKING_METERS_PER_MINUTE,
  walkMinutes: to.walkMinutes,
  polyline: [],
  source: 'manual',
})

export async function rerouteUnavailablePoi(input: {
  routePlan: RoutePlan
  storyGraph: StoryGraph
  allPois: readonly Poi[]
  currentPoiId: string
  unavailablePoiIds: readonly string[]
  mapProvider: MapRouteProvider
}): Promise<RerouteResponse> {
  const currentIndex = input.routePlan.selectedPois.findIndex(
    (poi) => poi.id === input.currentPoiId,
  )
  const currentPoi = input.routePlan.selectedPois[currentIndex]
  if (!currentPoi || currentIndex < 0) {
    throw new RerouteError(
      'CURRENT_POI_NOT_FOUND',
      'Current POI is not part of this route',
    )
  }

  const unavailable = new Set([...input.unavailablePoiIds, input.currentPoiId])
  const selected = new Set(
    input.routePlan.selectedPois
      .filter((poi) => poi.id !== input.currentPoiId)
      .map((poi) => poi.id),
  )
  const candidateIds = [
    ...currentPoi.fallbackPoiIds,
    ...input.routePlan.alternativePois.map((poi) => poi.id),
  ]
  const replacement = candidateIds
    .map((id) => input.allPois.find((poi) => poi.id === id))
    .find((poi): poi is Poi =>
      Boolean(
        poi &&
        poi.routePackId === input.routePlan.routePackId &&
        !unavailable.has(poi.id) &&
        !selected.has(poi.id),
      ),
    )
  if (!replacement) {
    throw new RerouteError(
      'NO_FALLBACK_POI',
      'No available fallback POI could replace the current stop',
    )
  }

  const selectedPois = [...input.routePlan.selectedPois]
  selectedPois[currentIndex] = replacement
  const routeSegments: RouteSegment[] = []
  let degraded = input.routePlan.degraded
  for (let index = 1; index < selectedPois.length; index += 1) {
    const from = selectedPois[index - 1]
    const to = selectedPois[index]
    if (!from || !to) continue
    try {
      routeSegments.push(await input.mapProvider.getWalkingRoute(from, to))
    } catch {
      degraded = true
      routeSegments.push(manualSegment(from, to))
    }
  }

  const totalWalkMeters = routeSegments.reduce(
    (total, segment) => total + segment.walkMeters,
    0,
  )
  const totalWalkMinutes = routeSegments.reduce(
    (total, segment) => total + segment.walkMinutes,
    0,
  )
  const totalStayMinutes = selectedPois.reduce(
    (total, poi) => total + poi.stayMinutes,
    0,
  )
  const routePlan: RoutePlan = {
    ...input.routePlan,
    routeId: `${input.routePlan.routeId}_r_${replacement.id}`,
    selectedPois,
    alternativePois: input.routePlan.alternativePois.filter(
      (poi) => poi.id !== replacement.id && !unavailable.has(poi.id),
    ),
    routeSegments,
    totalWalkMeters,
    totalWalkMinutes,
    totalStayMinutes,
    totalEstimatedMinutes: totalWalkMinutes + totalStayMinutes,
    estimatedCostCny: estimateRouteCost(selectedPois),
    degraded,
  }
  const storyGraph: StoryGraph = {
    ...input.storyGraph,
    nodes: input.storyGraph.nodes.map((node) =>
      node.poiId === input.currentPoiId
        ? { ...node, poiId: replacement.id }
        : node,
    ),
  }

  return RerouteResponseSchema.parse({ routePlan, storyGraph })
}
