import {
  GenerateStoryRequestSchema,
  GenerateStoryResponseSchema,
  JourneyPreferencesSchema,
  PlanRouteResponseSchema,
  generateMockStory,
  planMockRoute,
  type GenerateStoryResponse,
  type JourneyPreferences,
  type RoutePlan,
} from '@citywalk/shared'
import {
  generateJourneyStory as generateServerStory,
  planJourneyRoute as planServerRoute,
} from '../api-client'
import { getGenerationMode } from '../generation-mode'

export async function planJourneyRoute(
  preferences: JourneyPreferences,
  signal: AbortSignal,
): Promise<RoutePlan> {
  if (getGenerationMode() === 'server')
    return planServerRoute(preferences, signal)
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return PlanRouteResponseSchema.parse({
    routePlan: planMockRoute(JourneyPreferencesSchema.parse(preferences)),
  }).routePlan
}

export async function generateJourneyStory(
  preferences: JourneyPreferences,
  routePlan: RoutePlan,
  signal: AbortSignal,
): Promise<GenerateStoryResponse> {
  if (getGenerationMode() === 'server')
    return generateServerStory(preferences, routePlan, signal)
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return GenerateStoryResponseSchema.parse(
    generateMockStory(
      GenerateStoryRequestSchema.parse({ preferences, routePlan }),
    ),
  )
}
