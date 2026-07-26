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
import {
  db,
  deleteStoryCascade,
  quarantineRecord,
  trimStoryHistory,
  type StoryRecord,
} from './persistence/database'

export const JOURNEY_DRAFT_ID = 'draft'
export const PENDING_GENERATION_ID = 'pending'

const DraftValuesSchema = JourneyPreferencesSchema.partial().extend({
  routePackId: z.string().optional(),
  interests: z.array(z.string()).max(4).optional(),
})

const JourneyDraftSchema = z.object({
  step: z.number().int().min(0).max(7),
  values: DraftValuesSchema,
})

export const GenerationResultSchema = z.object({
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

export async function loadJourneyDraft(): Promise<JourneyDraft | null> {
  const record = await db.draftPreferences.get(JOURNEY_DRAFT_ID)
  if (!record) return null
  const parsed = JourneyDraftSchema.safeParse({
    step: record.step,
    values: record.values,
  })
  if (!parsed.success) {
    await quarantineRecord({
      table: 'draftPreferences',
      key: record.id,
      raw: record,
      error: parsed.error.message,
    })
    return null
  }
  const values = Object.fromEntries(
    Object.entries(parsed.data.values).filter(
      ([, value]) => value !== undefined,
    ),
  ) as Partial<JourneyPreferencesInput>
  return { step: parsed.data.step, values }
}

export async function saveJourneyDraft(
  step: number,
  values: Partial<JourneyPreferencesInput>,
) {
  const parsed = JourneyDraftSchema.parse({ step, values })
  await db.draftPreferences.put({
    id: JOURNEY_DRAFT_ID,
    step: parsed.step,
    values: parsed.values,
    updatedAt: new Date().toISOString(),
  })
}

export async function clearJourneyDraft() {
  await db.draftPreferences.delete(JOURNEY_DRAFT_ID)
}

export async function savePendingGeneration(preferences: JourneyPreferences) {
  const parsed = JourneyPreferencesSchema.parse(preferences)
  await db.draftPreferences.put({
    id: PENDING_GENERATION_ID,
    step: null,
    values: parsed,
    updatedAt: new Date().toISOString(),
  })
}

export async function loadPendingGeneration(): Promise<JourneyPreferences | null> {
  const record = await db.draftPreferences.get(PENDING_GENERATION_ID)
  if (!record) return null
  const parsed = JourneyPreferencesSchema.safeParse(record.values)
  if (!parsed.success) {
    await quarantineRecord({
      table: 'draftPreferences',
      key: record.id,
      raw: record,
      error: parsed.error.message,
    })
    return null
  }
  return parsed.data
}

function toStoryRecord(result: GenerationResult): StoryRecord {
  const storyId = result.story.blueprint.storyId
  return {
    id: storyId,
    title: result.story.blueprint.title,
    status: 'ready',
    createdAt: result.savedAt,
    updatedAt: result.savedAt,
    completedAt: null,
    generation: GenerationResultSchema.parse(result),
  }
}

export async function saveGenerationResult(result: GenerationResult) {
  await db.stories.put(toStoryRecord(result))
  await trimStoryHistory(5)
}

export async function loadGenerationResult(
  storyId?: string,
): Promise<GenerationResult | null> {
  const record = storyId
    ? await db.stories.get(storyId)
    : await db.stories.orderBy('updatedAt').last()
  if (!record) return null
  const parsed = GenerationResultSchema.safeParse(record.generation)
  if (!parsed.success || parsed.data.story.blueprint.storyId !== record.id) {
    await quarantineRecord({
      table: 'stories',
      key: record.id,
      raw: record,
      error: parsed.success
        ? 'Story id does not match the generation payload'
        : parsed.error.message,
    })
    return null
  }
  return parsed.data
}

export async function listGenerationResults(): Promise<
  Array<{ record: StoryRecord; result: GenerationResult }>
> {
  const records = await db.stories.orderBy('updatedAt').reverse().toArray()
  const results: Array<{ record: StoryRecord; result: GenerationResult }> = []
  for (const record of records) {
    const parsed = GenerationResultSchema.safeParse(record.generation)
    if (parsed.success && parsed.data.story.blueprint.storyId === record.id) {
      results.push({ record, result: parsed.data })
    } else {
      await quarantineRecord({
        table: 'stories',
        key: record.id,
        raw: record,
        error: parsed.success ? 'Story id mismatch' : parsed.error.message,
      })
    }
  }
  return results
}

export async function clearGenerationResult(storyId?: string) {
  if (storyId) await deleteStoryCascade(storyId)
}
