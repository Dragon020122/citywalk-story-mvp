import { createHash } from 'node:crypto'
import type {
  JourneyPreferences,
  RoutePlan,
} from '@citywalk/shared'

export const PROMPT_VERSION = 'story-v1'

export const createStoryCacheKey = (input: {
  preferences: JourneyPreferences
  routePlan: RoutePlan
  promptVersion?: string
  poiDataVersion: string
}): string => {
  const payload = {
    routePackId: input.routePlan.routePackId,
    selectedPoiIds: input.routePlan.selectedPois.map((poi) => poi.id),
    genre: input.preferences.genre,
    companion: input.preferences.companion,
    interests: [...input.preferences.interests].sort(),
    duration: input.preferences.durationMinutes,
    taskIntensity: input.preferences.taskIntensity,
    promptVersion: input.promptVersion ?? PROMPT_VERSION,
    poiDataVersion: input.poiDataVersion,
  }

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
}
