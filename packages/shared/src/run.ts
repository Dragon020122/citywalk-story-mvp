import { z } from 'zod'
import {
  EffectScoresSchema,
  IsoDateTimeSchema,
  NonEmptyStringSchema,
} from './common.js'
import { RoutePlanSchema } from './route.js'
import { FlagValueSchema } from './story.js'

export const StoryRunChoiceSchema = z.object({
  nodeId: NonEmptyStringSchema,
  choiceId: NonEmptyStringSchema,
  chosenAt: IsoDateTimeSchema,
})

export const JournalEntrySchema = z.object({
  id: NonEmptyStringSchema,
  nodeId: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
  createdAt: IsoDateTimeSchema,
})

export const StoryRunStatusSchema = z.enum([
  'in_progress',
  'completed',
  'abandoned',
])
export type StoryRunStatus = z.infer<typeof StoryRunStatusSchema>

export const StoryRunSchema = z
  .object({
    storyId: NonEmptyStringSchema,
    routePlan: RoutePlanSchema,
    currentNodeId: NonEmptyStringSchema,
    visitedNodeIds: z.array(NonEmptyStringSchema),
    completedTaskIds: z.array(NonEmptyStringSchema),
    choices: z.array(StoryRunChoiceSchema),
    clues: z.array(NonEmptyStringSchema),
    items: z.array(NonEmptyStringSchema),
    flags: z.record(NonEmptyStringSchema, FlagValueSchema),
    effectScores: EffectScoresSchema,
    journalEntries: z.array(JournalEntrySchema),
    localPhotoIds: z.array(NonEmptyStringSchema),
    startedAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.nullable(),
    endingId: NonEmptyStringSchema.nullable(),
    status: StoryRunStatusSchema,
  })
  .superRefine((run, context) => {
    if (
      run.status === 'completed' &&
      (run.completedAt === null || run.endingId === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Completed story runs require completedAt and endingId',
        path: ['status'],
      })
    }
  })

export type StoryRun = z.infer<typeof StoryRunSchema>
