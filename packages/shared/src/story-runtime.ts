import { z } from 'zod'
import { EffectScoresSchema, NonEmptyStringSchema } from './common.js'
import {
  FlagValueSchema,
  type ChoiceEffect,
  type StateRequirement,
  type StoryChoice,
  type StoryEnding,
  type StoryGraph,
  type StoryNode,
} from './story.js'

export const GameplayStateSchema = z.enum([
  'idle',
  'navigating',
  'arrived',
  'reading',
  'tasking',
  'choosing',
  'node_completed',
  'rerouting',
  'paused',
  'ending',
  'completed',
  'abandoned',
  'error',
])
export type GameplayState = z.infer<typeof GameplayStateSchema>

export const ResumableGameplayStateSchema = z.enum([
  'navigating',
  'arrived',
  'reading',
  'tasking',
  'choosing',
  'node_completed',
  'rerouting',
  'ending',
])
export type ResumableGameplayState = z.infer<
  typeof ResumableGameplayStateSchema
>

export const RuntimeJournalEntrySchema = z.object({
  nodeId: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
})

export const StoryRuntimeStateSchema = z.object({
  currentNodeId: NonEmptyStringSchema,
  completedNodeIds: z.array(NonEmptyStringSchema),
  completedTaskIds: z.array(NonEmptyStringSchema),
  submittedChoiceNodeIds: z.array(NonEmptyStringSchema),
  selectedChoices: z.record(NonEmptyStringSchema, NonEmptyStringSchema),
  rewardedNodeIds: z.array(NonEmptyStringSchema),
  clues: z.array(NonEmptyStringSchema),
  clueSources: z.record(NonEmptyStringSchema, NonEmptyStringSchema),
  items: z.array(NonEmptyStringSchema),
  flags: z.record(NonEmptyStringSchema, FlagValueSchema),
  effectScores: EffectScoresSchema,
  sideQuestReturnNodeIds: z.array(NonEmptyStringSchema),
  declinedSideQuestNodeIds: z.array(NonEmptyStringSchema),
  journalEntries: z.array(RuntimeJournalEntrySchema),
  localPhotoIds: z.array(NonEmptyStringSchema),
  endingId: NonEmptyStringSchema.nullable(),
  endingTitle: NonEmptyStringSchema.nullable(),
  endingSummary: NonEmptyStringSchema.nullable(),
  error: NonEmptyStringSchema.nullable(),
})
export type StoryRuntimeState = z.infer<typeof StoryRuntimeStateSchema>

export const PersistedGameplaySnapshotSchema = z.object({
  version: z.literal(1),
  storyId: NonEmptyStringSchema,
  state: GameplayStateSchema,
  resumeState: ResumableGameplayStateSchema,
  runtime: StoryRuntimeStateSchema,
})
export type PersistedGameplaySnapshot = z.infer<
  typeof PersistedGameplaySnapshotSchema
>

const SCORE_KEYS = [
  'truth',
  'memory',
  'empathy',
  'courage',
  'connection',
] as const

const unique = (values: string[]): string[] => [...new Set(values)]

export function createInitialRuntimeState(
  graph: StoryGraph,
): StoryRuntimeState {
  return {
    currentNodeId: graph.entryNodeId,
    completedNodeIds: [],
    completedTaskIds: [],
    submittedChoiceNodeIds: [],
    selectedChoices: {},
    rewardedNodeIds: [],
    clues: unique(graph.stateDefinition.initialClues),
    clueSources: {},
    items: unique(graph.stateDefinition.initialItems),
    flags: { ...graph.stateDefinition.initialFlags },
    effectScores: { ...graph.stateDefinition.initialEffectScores },
    sideQuestReturnNodeIds: [],
    declinedSideQuestNodeIds: [],
    journalEntries: [],
    localPhotoIds: [],
    endingId: null,
    endingTitle: null,
    endingSummary: null,
    error: null,
  }
}

export function meetsStateRequirement(
  requirement: StateRequirement,
  runtime: StoryRuntimeState,
): boolean {
  return (
    Object.entries(requirement.minimumScores).every(
      ([key, value]) =>
        value === undefined ||
        runtime.effectScores[key as keyof typeof runtime.effectScores] >= value,
    ) &&
    requirement.clues.every((clue) => runtime.clues.includes(clue)) &&
    requirement.items.every((item) => runtime.items.includes(item)) &&
    Object.entries(requirement.flags).every(
      ([key, value]) => runtime.flags[key] === value,
    )
  )
}

export function getAvailableChoices(
  graph: StoryGraph,
  node: StoryNode,
  runtime: StoryRuntimeState,
): StoryChoice[] {
  if (runtime.submittedChoiceNodeIds.includes(node.id)) return []

  return node.choices.filter((choice) => {
    const nextNode = choice.effects.nextNodeId
      ? graph.nodes.find(
          (candidate) => candidate.id === choice.effects.nextNodeId,
        )
      : undefined
    return (
      !nextNode ||
      choice.effects.unlockSideQuest === nextNode.id ||
      meetsStateRequirement(nextNode.requiredState, runtime)
    )
  })
}

function applyEffect(
  runtime: StoryRuntimeState,
  effect: ChoiceEffect,
  sourceNodeId: string,
): StoryRuntimeState {
  const effectScores = { ...runtime.effectScores }
  SCORE_KEYS.forEach((key) => {
    effectScores[key] += effect[key] ?? 0
  })

  const flags = { ...runtime.flags }
  if (effect.setFlag) flags[effect.setFlag.key] = effect.setFlag.value
  if (effect.unlockSideQuest) {
    flags[`sideQuest:${effect.unlockSideQuest}:unlocked`] = true
  }

  return {
    ...runtime,
    effectScores,
    clues: unique([
      ...runtime.clues,
      ...(effect.addClue ? [effect.addClue] : []),
    ]),
    clueSources: effect.addClue
      ? { ...runtime.clueSources, [effect.addClue]: sourceNodeId }
      : runtime.clueSources,
    items: unique([
      ...runtime.items,
      ...(effect.addItem ? [effect.addItem] : []),
    ]),
    flags,
  }
}

export function applyChoiceEffects(
  runtime: StoryRuntimeState,
  node: StoryNode,
  choice: StoryChoice,
): StoryRuntimeState {
  if (runtime.submittedChoiceNodeIds.includes(node.id)) return runtime

  return {
    ...applyEffect(runtime, choice.effects, node.id),
    submittedChoiceNodeIds: [...runtime.submittedChoiceNodeIds, node.id],
    selectedChoices: { ...runtime.selectedChoices, [node.id]: choice.id },
  }
}

export function applyNodeRewards(
  runtime: StoryRuntimeState,
  node: StoryNode,
): StoryRuntimeState {
  if (runtime.rewardedNodeIds.includes(node.id)) return runtime

  const effectScores = { ...runtime.effectScores }
  SCORE_KEYS.forEach((key) => {
    effectScores[key] += node.rewards.scores[key] ?? 0
  })

  return {
    ...runtime,
    completedNodeIds: unique([...runtime.completedNodeIds, node.id]),
    rewardedNodeIds: [...runtime.rewardedNodeIds, node.id],
    effectScores,
    clues: unique([...runtime.clues, ...node.rewards.clues]),
    clueSources: Object.fromEntries([
      ...Object.entries(runtime.clueSources),
      ...node.rewards.clues.map((clue) => [clue, node.id]),
    ]),
    items: unique([...runtime.items, ...node.rewards.items]),
    flags: { ...runtime.flags, ...node.rewards.flags },
  }
}

export function resolveNextNode(
  graph: StoryGraph,
  node: StoryNode,
  runtime: StoryRuntimeState,
): StoryNode | null {
  const choiceId = runtime.selectedChoices[node.id]
  const choiceTarget = node.choices.find((choice) => choice.id === choiceId)
    ?.effects.nextNodeId
  const candidates = [choiceTarget, node.next, node.fallbackNext].filter(
    (value): value is string => Boolean(value),
  )

  for (const nodeId of candidates) {
    const candidate = graph.nodes.find((item) => item.id === nodeId)
    if (candidate && meetsStateRequirement(candidate.requiredState, runtime)) {
      return candidate
    }
  }

  return null
}

export function isEndingReachable(
  ending: StoryEnding,
  runtime: StoryRuntimeState,
): boolean {
  return meetsStateRequirement(ending.requiredState, runtime)
}

export function resolveEnding(
  graph: StoryGraph,
  runtime: StoryRuntimeState,
  incomplete = false,
): StoryEnding {
  if (
    !incomplete &&
    graph.hiddenEnding &&
    isEndingReachable(graph.hiddenEnding, runtime)
  ) {
    return graph.hiddenEnding
  }

  const requestedEnding =
    typeof runtime.flags.endingId === 'string'
      ? graph.endings.find((ending) => ending.id === runtime.flags.endingId)
      : undefined
  const regularEnding =
    requestedEnding && isEndingReachable(requestedEnding, runtime)
      ? requestedEnding
      : graph.endings.find((ending) => isEndingReachable(ending, runtime))

  if (!incomplete && regularEnding) return regularEnding

  const strongestScore = SCORE_KEYS.reduce((best, key) =>
    runtime.effectScores[key] > runtime.effectScores[best] ? key : best,
  )
  return {
    id: 'ending_incomplete',
    title: '未完的城市回声',
    summary: `你带着 ${runtime.clues.length} 条线索、${runtime.items.length} 件道具和 ${runtime.completedNodeIds.length} 个已完成节点提前离开。${strongestScore} 是此刻最鲜明的倾向，未走完的暗线仍会留在档案里。`,
    requiredState: {
      minimumScores: {},
      clues: [],
      items: [],
      flags: {},
    },
  }
}

export function validateRuntimeState(
  graph: StoryGraph,
  input: unknown,
):
  | { success: true; data: StoryRuntimeState }
  | { success: false; errors: string[] } {
  const parsed = StoryRuntimeStateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    }
  }

  const runtime = parsed.data
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const taskIds = new Set(
    graph.nodes.flatMap((node) => (node.task ? [node.task.id] : [])),
  )
  const errors: string[] = []
  const idGroups: Array<[string, string[]]> = [
    ['completedNodeIds', runtime.completedNodeIds],
    ['completedTaskIds', runtime.completedTaskIds],
    ['submittedChoiceNodeIds', runtime.submittedChoiceNodeIds],
    ['rewardedNodeIds', runtime.rewardedNodeIds],
  ]

  if (!nodeIds.has(runtime.currentNodeId))
    errors.push('Current node is missing')
  idGroups.forEach(([name, ids]) => {
    if (new Set(ids).size !== ids.length)
      errors.push(`${name} contains duplicates`)
  })
  runtime.completedNodeIds
    .filter((id) => !nodeIds.has(id))
    .forEach((id) => errors.push(`Completed node is missing: ${id}`))
  runtime.rewardedNodeIds
    .filter((id) => !nodeIds.has(id))
    .forEach((id) => errors.push(`Rewarded node is missing: ${id}`))
  runtime.completedTaskIds
    .filter((id) => !taskIds.has(id))
    .forEach((id) => errors.push(`Completed task is missing: ${id}`))
  runtime.submittedChoiceNodeIds.forEach((nodeId) => {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId)
    const choiceId = runtime.selectedChoices[nodeId]
    if (!node?.choices.some((choice) => choice.id === choiceId)) {
      errors.push(`Selected choice is invalid for node: ${nodeId}`)
    }
  })
  Object.keys(runtime.selectedChoices)
    .filter((nodeId) => !runtime.submittedChoiceNodeIds.includes(nodeId))
    .forEach((nodeId) =>
      errors.push(`Choice exists without a submitted node: ${nodeId}`),
    )

  return errors.length
    ? { success: false, errors }
    : { success: true, data: runtime }
}
