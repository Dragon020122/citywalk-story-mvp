import { z } from 'zod'
import {
  EffectScoresSchema,
  GenreSchema,
  NonEmptyStringSchema,
} from './common.js'

const TaskBaseSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  instructions: NonEmptyStringSchema,
  required: z.boolean(),
  estimatedMinutes: z.number().int().nonnegative(),
})

export const ObserveTaskSchema = TaskBaseSchema.extend({
  type: z.literal('observe'),
  observationAnchors: z.array(NonEmptyStringSchema).min(1),
})

export const PhotoTaskSchema = TaskBaseSchema.extend({
  type: z.literal('photo'),
  photoPrompt: NonEmptyStringSchema,
})

export const PuzzleTaskSchema = TaskBaseSchema.extend({
  type: z.literal('puzzle'),
  question: NonEmptyStringSchema,
  hint: NonEmptyStringSchema,
  answerValidation: NonEmptyStringSchema,
})

export const SoundscapeTaskSchema = TaskBaseSchema.extend({
  type: z.literal('soundscape'),
  listeningPrompt: NonEmptyStringSchema,
})

export const JournalTaskSchema = TaskBaseSchema.extend({
  type: z.literal('journal'),
  journalPrompt: NonEmptyStringSchema,
})

export const CompanionTaskSchema = TaskBaseSchema.extend({
  type: z.literal('companion'),
  interactionPrompt: NonEmptyStringSchema,
})

export const TaskSchema = z.discriminatedUnion('type', [
  ObserveTaskSchema,
  PhotoTaskSchema,
  PuzzleTaskSchema,
  SoundscapeTaskSchema,
  JournalTaskSchema,
  CompanionTaskSchema,
])
export type Task = z.infer<typeof TaskSchema>

export const FlagValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
])

export const ChoiceEffectSchema = z
  .object({
    truth: z.number().int().optional(),
    memory: z.number().int().optional(),
    empathy: z.number().int().optional(),
    courage: z.number().int().optional(),
    connection: z.number().int().optional(),
    addClue: NonEmptyStringSchema.optional(),
    addItem: NonEmptyStringSchema.optional(),
    unlockSideQuest: NonEmptyStringSchema.optional(),
    setFlag: z
      .object({
        key: NonEmptyStringSchema,
        value: FlagValueSchema,
      })
      .optional(),
    nextNodeId: NonEmptyStringSchema.optional(),
  })
  .refine((effect) => Object.values(effect).some((value) => value !== undefined), {
    message: 'ChoiceEffect must contain at least one effect',
  })
export type ChoiceEffect = z.infer<typeof ChoiceEffectSchema>

export const StoryChoiceSchema = z.object({
  id: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
  effects: ChoiceEffectSchema,
})
export type StoryChoice = z.infer<typeof StoryChoiceSchema>

export const StateRequirementSchema = z.object({
  minimumScores: EffectScoresSchema.partial(),
  clues: z.array(NonEmptyStringSchema),
  items: z.array(NonEmptyStringSchema),
  flags: z.record(NonEmptyStringSchema, FlagValueSchema),
})
export type StateRequirement = z.infer<typeof StateRequirementSchema>

export const StateRewardSchema = z.object({
  scores: EffectScoresSchema.partial(),
  clues: z.array(NonEmptyStringSchema),
  items: z.array(NonEmptyStringSchema),
  flags: z.record(NonEmptyStringSchema, FlagValueSchema),
})
export type StateReward = z.infer<typeof StateRewardSchema>

export const StoryNodeTypeSchema = z.enum([
  'intro',
  'travel',
  'discovery',
  'task',
  'puzzle',
  'choice',
  'side_quest',
  'checkpoint',
  'climax',
  'ending_gate',
])
export type StoryNodeType = z.infer<typeof StoryNodeTypeSchema>

export const StoryNodeSchema = z.object({
  id: NonEmptyStringSchema,
  poiId: NonEmptyStringSchema.nullable(),
  type: StoryNodeTypeSchema,
  title: NonEmptyStringSchema,
  storyText: NonEmptyStringSchema,
  arrivalText: NonEmptyStringSchema.nullable(),
  task: TaskSchema.nullable(),
  choices: z.array(StoryChoiceSchema),
  rewards: StateRewardSchema,
  requiredState: StateRequirementSchema,
  next: NonEmptyStringSchema.nullable(),
  fallbackNext: NonEmptyStringSchema.nullable(),
  estimatedMinutes: z.number().int().nonnegative(),
  safetyNotice: NonEmptyStringSchema.nullable(),
})
export type StoryNode = z.infer<typeof StoryNodeSchema>

export const StoryEndingSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  requiredState: StateRequirementSchema,
})
export type StoryEnding = z.infer<typeof StoryEndingSchema>

export const StoryStateDefinitionSchema = z.object({
  initialEffectScores: EffectScoresSchema,
  initialClues: z.array(NonEmptyStringSchema),
  initialItems: z.array(NonEmptyStringSchema),
  initialFlags: z.record(NonEmptyStringSchema, FlagValueSchema),
})
export type StoryStateDefinition = z.infer<
  typeof StoryStateDefinitionSchema
>

export const StoryGraphSchema = z
  .object({
    entryNodeId: NonEmptyStringSchema,
    nodes: z.array(StoryNodeSchema).min(1),
    endings: z.array(StoryEndingSchema).min(1),
    hiddenEnding: StoryEndingSchema.nullable(),
    stateDefinition: StoryStateDefinitionSchema,
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set<string>()

    graph.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate node id: ${node.id}`,
          path: ['nodes', index, 'id'],
        })
      }
      nodeIds.add(node.id)
    })

    if (!nodeIds.has(graph.entryNodeId)) {
      context.addIssue({
        code: 'custom',
        message: `Entry node does not exist: ${graph.entryNodeId}`,
        path: ['entryNodeId'],
      })
    }

    graph.nodes.forEach((node, nodeIndex) => {
      const references: Array<{
        nodeId: string | null | undefined
        path: Array<string | number>
      }> = [
        { nodeId: node.next, path: ['nodes', nodeIndex, 'next'] },
        {
          nodeId: node.fallbackNext,
          path: ['nodes', nodeIndex, 'fallbackNext'],
        },
        ...node.choices.map((choice, choiceIndex) => ({
          nodeId: choice.effects.nextNodeId,
          path: [
            'nodes',
            nodeIndex,
            'choices',
            choiceIndex,
            'effects',
            'nextNodeId',
          ],
        })),
      ]

      references.forEach((reference) => {
        if (reference.nodeId && !nodeIds.has(reference.nodeId)) {
          context.addIssue({
            code: 'custom',
            message: `Referenced node does not exist: ${reference.nodeId}`,
            path: reference.path,
          })
        }
      })
    })
  })
export type StoryGraph = z.infer<typeof StoryGraphSchema>

export const StoryActSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  objective: NonEmptyStringSchema,
  poiIds: z.array(NonEmptyStringSchema),
})

export const StoryCharacterSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  role: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
})

export const StoryClueSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  sourcePoiId: NonEmptyStringSchema.nullable(),
  required: z.boolean(),
})

export const StoryItemSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
})

export const StoryBranchSchema = z.object({
  id: NonEmptyStringSchema,
  fromActId: NonEmptyStringSchema,
  condition: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
})

export const SideQuestPlanSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  trigger: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
})

export const EndingPlanSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  condition: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  hidden: z.boolean(),
})

export const StoryBlueprintSchema = z.object({
  storyId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  subtitle: NonEmptyStringSchema,
  genre: GenreSchema,
  role: NonEmptyStringSchema,
  mission: NonEmptyStringSchema,
  premise: NonEmptyStringSchema,
  actStructure: z.array(StoryActSchema).min(1),
  characters: z.array(StoryCharacterSchema),
  clueChain: z.array(StoryClueSchema),
  items: z.array(StoryItemSchema),
  branchPlan: z.array(StoryBranchSchema),
  sideQuestPlan: z.array(SideQuestPlanSchema),
  endingPlan: z.array(EndingPlanSchema).min(1),
  fictionNotice: NonEmptyStringSchema,
  contentWarnings: z.array(NonEmptyStringSchema),
})
export type StoryBlueprint = z.infer<typeof StoryBlueprintSchema>
