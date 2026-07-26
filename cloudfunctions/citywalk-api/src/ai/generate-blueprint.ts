import {
  StoryBlueprintSchema,
  type JourneyPreferences,
  type RoutePlan,
  type StoryBlueprint,
} from '@citywalk/shared'
import type { AiTextClient } from './ai-client.js'
import { parseAiJson } from './json-parser.js'
import {
  blueprintPrompt,
  systemPrompt,
} from './prompts/index.js'
import { toStoryPoiContext } from './story-poi-context.js'

export interface BlueprintValidationIssue {
  code: string
  path: string
  message: string
}

export class BlueprintValidationError extends Error {
  readonly code = 'STORY_GRAPH_INVALID'

  constructor(readonly issues: BlueprintValidationIssue[]) {
    super('Generated StoryBlueprint failed semantic validation')
    this.name = 'BlueprintValidationError'
  }
}

export const validateBlueprint = (
  blueprint: StoryBlueprint,
  routePlan: RoutePlan,
): BlueprintValidationIssue[] => {
  const issues: BlueprintValidationIssue[] = []
  const allowedPoiIds = new Set(
    routePlan.selectedPois.map((poi) => poi.id),
  )

  if (blueprint.actStructure.length !== 3) {
    issues.push({
      code: 'ACT_COUNT_INVALID',
      path: 'actStructure',
      message: 'Blueprint must contain exactly three acts',
    })
  }
  if (blueprint.clueChain.length < 4) {
    issues.push({
      code: 'CLUE_COUNT_INVALID',
      path: 'clueChain',
      message: 'Blueprint must contain at least four clues',
    })
  }
  if (blueprint.items.length < 1 || blueprint.items.length > 3) {
    issues.push({
      code: 'ITEM_COUNT_INVALID',
      path: 'items',
      message: 'Blueprint must contain one to three items',
    })
  }
  if (blueprint.branchPlan.length < 2) {
    issues.push({
      code: 'BRANCH_COUNT_INVALID',
      path: 'branchPlan',
      message: 'Blueprint must contain at least two key branches',
    })
  }
  if (blueprint.sideQuestPlan.length < 1) {
    issues.push({
      code: 'SIDE_QUEST_MISSING',
      path: 'sideQuestPlan',
      message: 'Blueprint must contain at least one side quest',
    })
  }

  const normalEndingCount = blueprint.endingPlan.filter(
    (ending) => !ending.hidden,
  ).length
  const hiddenEndingCount = blueprint.endingPlan.filter(
    (ending) => ending.hidden,
  ).length
  if (normalEndingCount !== 3 || hiddenEndingCount > 1) {
    issues.push({
      code: 'ENDING_PLAN_INVALID',
      path: 'endingPlan',
      message:
        'Blueprint must contain three normal endings and at most one hidden ending',
    })
  }

  blueprint.actStructure.forEach((act, actIndex) => {
    act.poiIds.forEach((poiId, poiIndex) => {
      if (!allowedPoiIds.has(poiId)) {
        issues.push({
          code: 'UNKNOWN_POI_ID',
          path: `actStructure.${actIndex}.poiIds.${poiIndex}`,
          message: `Unknown POI id: ${poiId}`,
        })
      }
    })
  })
  blueprint.clueChain.forEach((clue, clueIndex) => {
    if (!clue.sourcePoiId || !allowedPoiIds.has(clue.sourcePoiId)) {
      issues.push({
        code: 'CLUE_SOURCE_INVALID',
        path: `clueChain.${clueIndex}.sourcePoiId`,
        message: `Clue ${clue.id} must reference an allowed POI`,
      })
    }
  })

  return issues
}

export const generateBlueprint = async (input: {
  aiClient: AiTextClient
  preferences: JourneyPreferences
  routePlan: RoutePlan
  signal?: AbortSignal | undefined
}): Promise<StoryBlueprint> => {
  const pois = input.routePlan.selectedPois.map(toStoryPoiContext)
  const output = await input.aiClient.generateText({
    system: systemPrompt,
    prompt: blueprintPrompt({
      preferences: input.preferences,
      routePlan: input.routePlan,
      pois,
    }),
    signal: input.signal,
  })
  const blueprint = parseAiJson(output, StoryBlueprintSchema)
  const issues = validateBlueprint(blueprint, input.routePlan)
  if (issues.length > 0) {
    throw new BlueprintValidationError(issues)
  }
  return blueprint
}
