import {
  StoryGraphSchema,
  type RoutePlan,
  type StoryBlueprint,
  type StoryGraph,
} from '@citywalk/shared'
import type { AiTextClient } from './ai-client.js'
import {
  AiOutputParseError,
  parseAiJson,
} from './json-parser.js'
import {
  graphPrompt,
  repairPrompt,
  systemPrompt,
} from './prompts/index.js'
import { toStoryPoiContext } from './story-poi-context.js'
import {
  validateStoryGraph,
  type StoryGraphValidationIssue,
} from './validate-story-graph.js'

export class StoryGraphValidationError extends Error {
  readonly code = 'STORY_GRAPH_INVALID'

  constructor(
    readonly issues: StoryGraphValidationIssue[],
    readonly rawOutput: string,
  ) {
    super('Generated StoryGraph failed validation')
    this.name = 'StoryGraphValidationError'
  }
}

const parseAndValidateGraph = (input: {
  rawOutput: string
  blueprint: StoryBlueprint
  routePlan: RoutePlan
}): StoryGraph => {
  let graph: StoryGraph
  try {
    graph = parseAiJson(input.rawOutput, StoryGraphSchema)
  } catch (error) {
    if (error instanceof AiOutputParseError) {
      throw new StoryGraphValidationError(
        error.issues.length > 0
          ? error.issues.map((issue) => ({
              code: 'SCHEMA_VALIDATION_ERROR',
              path: issue.path,
              message: issue.message,
            }))
          : [
              {
                code: 'JSON_PARSE_ERROR',
                path: '',
                message: error.message,
              },
            ],
        input.rawOutput,
      )
    }
    throw error
  }

  const issues = validateStoryGraph({
    graph,
    blueprint: input.blueprint,
    routePlan: input.routePlan,
  })
  if (issues.length > 0) {
    throw new StoryGraphValidationError(issues, input.rawOutput)
  }
  return graph
}

export const generateStoryGraph = async (input: {
  aiClient: AiTextClient
  blueprint: StoryBlueprint
  routePlan: RoutePlan
  signal?: AbortSignal | undefined
}): Promise<StoryGraph> => {
  const rawOutput = await input.aiClient.generateText({
    system: systemPrompt,
    prompt: graphPrompt({
      blueprint: input.blueprint,
      routePlan: input.routePlan,
      pois: input.routePlan.selectedPois.map(toStoryPoiContext),
    }),
    signal: input.signal,
  })
  return parseAndValidateGraph({
    rawOutput,
    blueprint: input.blueprint,
    routePlan: input.routePlan,
  })
}

export const repairStoryGraph = async (input: {
  aiClient: AiTextClient
  blueprint: StoryBlueprint
  routePlan: RoutePlan
  invalidOutput: string
  errors: StoryGraphValidationIssue[]
  signal?: AbortSignal | undefined
}): Promise<StoryGraph> => {
  const rawOutput = await input.aiClient.generateText({
    system: systemPrompt,
    prompt: repairPrompt({
      blueprint: input.blueprint,
      routePlan: input.routePlan,
      invalidOutput: input.invalidOutput,
      errors: input.errors,
    }),
    signal: input.signal,
  })
  return parseAndValidateGraph({
    rawOutput,
    blueprint: input.blueprint,
    routePlan: input.routePlan,
  })
}
