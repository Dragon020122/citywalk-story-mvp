import {
  GenerateStoryResponseSchema,
  JourneyPreferencesSchema,
  RoutePlanSchema,
  type GenerateStoryResponse,
  type JourneyPreferences,
  type JourneyPreferencesInput,
  type RoutePlan,
} from '@citywalk/shared'
import { z } from 'zod'

export const JOURNEY_DRAFT_KEY = 'citywalk.journey-draft.v1'
export const PENDING_GENERATION_KEY = 'citywalk.pending-generation.v1'
export const GENERATION_RESULT_KEY = 'citywalk.generation-result.v1'

const DraftValuesSchema = JourneyPreferencesSchema.partial().extend({
  routePackId: z.string().optional(),
  interests: z.array(z.string()).max(4).optional(),
})

const JourneyDraftSchema = z.object({
  version: z.literal(1),
  step: z.number().int().min(0).max(7),
  values: DraftValuesSchema,
})

const GenerationResultSchema = z.object({
  preferences: JourneyPreferencesSchema,
  routePlan: RoutePlanSchema,
  story: GenerateStoryResponseSchema,
  savedAt: z.string().datetime(),
})

export interface JourneyDraft {
  step: number
  values: Partial<JourneyPreferencesInput>
}

export interface GenerationResult {
  preferences: JourneyPreferences
  routePlan: RoutePlan
  story: GenerateStoryResponse
  savedAt: string
}

function readJson(storage: Storage, key: string): unknown {
  const value = storage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    storage.removeItem(key)
    return null
  }
}

export function loadJourneyDraft(): JourneyDraft | null {
  const parsed = JourneyDraftSchema.safeParse(
    readJson(window.localStorage, JOURNEY_DRAFT_KEY),
  )
  if (!parsed.success) return null
  const values = Object.fromEntries(
    Object.entries(parsed.data.values).filter(
      ([, value]) => value !== undefined,
    ),
  ) as Partial<JourneyPreferencesInput>
  return { step: parsed.data.step, values }
}

export function saveJourneyDraft(
  step: number,
  values: Partial<JourneyPreferencesInput>,
) {
  window.localStorage.setItem(
    JOURNEY_DRAFT_KEY,
    JSON.stringify({ version: 1, step, values }),
  )
}

export function clearJourneyDraft() {
  window.localStorage.removeItem(JOURNEY_DRAFT_KEY)
}

export function savePendingGeneration(preferences: JourneyPreferences) {
  window.sessionStorage.setItem(
    PENDING_GENERATION_KEY,
    JSON.stringify(preferences),
  )
}

export function loadPendingGeneration(): JourneyPreferences | null {
  const parsed = JourneyPreferencesSchema.safeParse(
    readJson(window.sessionStorage, PENDING_GENERATION_KEY),
  )
  return parsed.success ? parsed.data : null
}

export function saveGenerationResult(result: GenerationResult) {
  window.sessionStorage.setItem(GENERATION_RESULT_KEY, JSON.stringify(result))
}

export function loadGenerationResult(): GenerationResult | null {
  const parsed = GenerationResultSchema.safeParse(
    readJson(window.sessionStorage, GENERATION_RESULT_KEY),
  )
  return parsed.success ? parsed.data : null
}

export function clearGenerationResult() {
  window.sessionStorage.removeItem(GENERATION_RESULT_KEY)
}
