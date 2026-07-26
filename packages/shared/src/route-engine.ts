import type { ContentMode } from './content-mode.js'
import { filterPoisForContentMode } from './content-mode.js'
import type { JourneyPreferences } from './journey.js'
import type { Poi } from './poi.js'

export type RoutePlanningErrorCode =
  | 'INSUFFICIENT_POIS'
  | 'START_POI_NOT_AVAILABLE'
  | 'ROUTE_CONSTRAINTS_UNSATISFIED'

export class RoutePlanningError extends Error {
  readonly code: RoutePlanningErrorCode

  constructor(code: RoutePlanningErrorCode, message: string) {
    super(`${code}: ${message}`)
    this.name = 'RoutePlanningError'
    this.code = code
  }
}

export interface RouteSelection {
  selectedPois: Poi[]
  alternativePois: Poi[]
}

const DURATION_STOP_TARGETS = {
  120: 7,
  180: 9,
  240: 10,
} as const

const INDOOR_TARGET_RATIOS = {
  avoid: 0.2,
  balanced: 0.5,
  prefer: 0.75,
} as const

export const getTargetStopCount = (
  durationMinutes: JourneyPreferences['durationMinutes'],
): number => DURATION_STOP_TARGETS[durationMinutes]

export const estimateManualDuration = (pois: readonly Poi[]): number =>
  pois.reduce(
    (total, poi, index) =>
      total + poi.stayMinutes + (index === 0 ? 0 : poi.walkMinutes),
    0,
  )

export const estimateRouteCost = (pois: readonly Poi[]): number =>
  pois.reduce((total, poi) => total + poi.estimatedCostCny, 0)

const normalize = (value: string): string => value.trim().toLowerCase()

const getSearchableTags = (poi: Poi): Set<string> =>
  new Set(
    [
      poi.category,
      ...poi.tags,
      ...poi.moodTags,
      ...poi.storyHooks,
      ...poi.taskHooks,
    ].map(normalize),
  )

const scoreIndoorPreference = (
  poi: Poi,
  preference: JourneyPreferences['indoorPreference'],
): number => {
  if (preference === 'avoid') {
    return poi.indoor ? -5 : 5
  }
  if (preference === 'prefer') {
    return poi.indoor ? 5 : -2
  }
  return 1
}

const scoreBasePoi = (
  poi: Poi,
  preferences: JourneyPreferences,
): number => {
  const searchableTags = getSearchableTags(poi)
  const interestScore =
    preferences.interests.filter((interest) =>
      searchableTags.has(normalize(interest)),
    ).length * 5
  const genreScore = searchableTags.has(normalize(preferences.genre)) ? 4 : 0
  const taskScore = Math.min(new Set(poi.taskHooks).size, 4)

  return (
    interestScore +
    genreScore +
    taskScore +
    scoreIndoorPreference(poi, preferences.indoorPreference)
  )
}

const getIndoorRatio = (pois: readonly Poi[]): number =>
  pois.length === 0
    ? 0
    : pois.filter((poi) => poi.indoor).length / pois.length

const scoreDynamicPoi = (
  poi: Poi,
  selectedPois: readonly Poi[],
  preferences: JourneyPreferences,
): number => {
  const selectedTaskHooks = new Set(
    selectedPois.flatMap((selectedPoi) => selectedPoi.taskHooks),
  )
  const newTaskHookCount = poi.taskHooks.filter(
    (taskHook) => !selectedTaskHooks.has(taskHook),
  ).length
  const selectedCategories = new Set(
    selectedPois.map((selectedPoi) => selectedPoi.category),
  )
  const categoryDiversityScore = selectedCategories.has(poi.category) ? 0 : 4
  const targetIndoorRatio =
    INDOOR_TARGET_RATIOS[preferences.indoorPreference]
  const currentDistance = Math.abs(
    getIndoorRatio(selectedPois) - targetIndoorRatio,
  )
  const nextDistance = Math.abs(
    getIndoorRatio([...selectedPois, poi]) - targetIndoorRatio,
  )
  const indoorBalanceScore = (currentDistance - nextDistance) * 8

  return (
    scoreBasePoi(poi, preferences) +
    newTaskHookCount * 2 +
    categoryDiversityScore +
    indoorBalanceScore
  )
}

const sortCandidates = (
  candidates: readonly Poi[],
  selectedPois: readonly Poi[],
  preferences: JourneyPreferences,
): Poi[] =>
  [...candidates].sort((left, right) => {
    const scoreDifference =
      scoreDynamicPoi(right, selectedPois, preferences) -
      scoreDynamicPoi(left, selectedPois, preferences)
    return scoreDifference || left.id.localeCompare(right.id)
  })

const hasThreeConsecutiveCategories = (
  selectedPois: readonly Poi[],
  candidate: Poi,
): boolean => {
  const previous = selectedPois.at(-1)
  const beforePrevious = selectedPois.at(-2)
  return (
    previous?.category === candidate.category &&
    beforePrevious?.category === candidate.category
  )
}

const canAddPoi = (
  selectedPois: readonly Poi[],
  candidate: Poi,
  maximumMinutes: number,
  maximumBudgetCny: number,
): boolean =>
  !selectedPois.some((poi) => poi.id === candidate.id) &&
  !hasThreeConsecutiveCategories(selectedPois, candidate) &&
  estimateManualDuration([...selectedPois, candidate]) <= maximumMinutes &&
  estimateRouteCost([...selectedPois, candidate]) <= maximumBudgetCny

const isPublicSpace = (poi: Poi): boolean =>
  poi.publicAccess && !poi.indoor

const hasVisualAnchor = (poi: Poi): boolean =>
  poi.observationAnchors.length > 0

export const selectRoutePois = (options: {
  preferences: JourneyPreferences
  pois: readonly Poi[]
  contentMode: ContentMode
}): RouteSelection => {
  const { preferences, contentMode } = options
  const maximumMinutes = Math.floor(preferences.durationMinutes * 1.08)
  const maximumBudgetCny = preferences.budgetCny * 1.1
  const routePackPois = filterPoisForContentMode(
    options.pois.filter(
      (poi) =>
        poi.routePackId === preferences.routePackId &&
        poi.publicAccess &&
        poi.estimatedCostCny <= maximumBudgetCny,
    ),
    contentMode,
  )

  if (routePackPois.length < 3) {
    throw new RoutePlanningError(
      'INSUFFICIENT_POIS',
      `route pack ${preferences.routePackId} needs at least one main POI and two alternatives`,
    )
  }

  const startPoi =
    preferences.startPoiId === 'auto'
      ? sortCandidates(routePackPois, [], preferences)[0]
      : routePackPois.find((poi) => poi.id === preferences.startPoiId)

  if (!startPoi) {
    throw new RoutePlanningError(
      'START_POI_NOT_AVAILABLE',
      `start POI ${preferences.startPoiId} is unavailable in ${contentMode} mode`,
    )
  }

  if (
    startPoi.stayMinutes > maximumMinutes ||
    startPoi.estimatedCostCny > maximumBudgetCny
  ) {
    throw new RoutePlanningError(
      'ROUTE_CONSTRAINTS_UNSATISFIED',
      'the selected start POI exceeds time or budget constraints',
    )
  }

  const targetStopCount = Math.min(
    getTargetStopCount(preferences.durationMinutes),
    routePackPois.length - 2,
  )
  const selectedPois: Poi[] = [startPoi]
  const remaining = new Map(
    routePackPois
      .filter((poi) => poi.id !== startPoi.id)
      .map((poi) => [poi.id, poi]),
  )

  const addBestMatching = (predicate: (poi: Poi) => boolean): void => {
    if (selectedPois.length >= targetStopCount) {
      return
    }
    const candidate = sortCandidates(
      [...remaining.values()].filter(predicate),
      selectedPois,
      preferences,
    ).find((poi) =>
      canAddPoi(
        selectedPois,
        poi,
        maximumMinutes,
        maximumBudgetCny,
      ),
    )
    if (candidate) {
      selectedPois.push(candidate)
      remaining.delete(candidate.id)
    }
  }

  if (!selectedPois.some(isPublicSpace)) {
    addBestMatching(isPublicSpace)
  }
  if (!selectedPois.some(hasVisualAnchor)) {
    addBestMatching(hasVisualAnchor)
  }

  for (
    let attempts = 0;
    attempts < routePackPois.length &&
    selectedPois.length < targetStopCount;
    attempts += 1
  ) {
    const candidate = sortCandidates(
      [...remaining.values()],
      selectedPois,
      preferences,
    ).find((poi) =>
      canAddPoi(
        selectedPois,
        poi,
        maximumMinutes,
        maximumBudgetCny,
      ),
    )

    if (!candidate) {
      break
    }

    selectedPois.push(candidate)
    remaining.delete(candidate.id)
  }

  if (
    !selectedPois.some(isPublicSpace) ||
    !selectedPois.some(hasVisualAnchor)
  ) {
    throw new RoutePlanningError(
      'ROUTE_CONSTRAINTS_UNSATISFIED',
      'route requires a public space and a visual observation point',
    )
  }

  const alternativePois = sortCandidates(
    [...remaining.values()],
    selectedPois,
    preferences,
  ).slice(0, 2)

  if (alternativePois.length < 2) {
    throw new RoutePlanningError(
      'INSUFFICIENT_POIS',
      'route requires at least two alternative POIs',
    )
  }

  return {
    selectedPois,
    alternativePois,
  }
}
