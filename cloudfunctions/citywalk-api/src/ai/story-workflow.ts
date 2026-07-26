import {
  GenerateStoryResponseSchema,
  type GenerateStoryRequest,
  type GenerateStoryResponse,
} from '@citywalk/shared'
import type { GenerationCacheRepository } from '../repositories/index.js'
import type { AiTextClient } from './ai-client.js'
import { createStoryCacheKey } from './cache-key.js'
import { generateBlueprint } from './generate-blueprint.js'
import {
  generateStoryGraph,
  repairStoryGraph,
  StoryGraphValidationError,
} from './generate-story-graph.js'
import { createMockStory } from './mock-story.js'

export interface StoryWorkflow {
  generate(
    request: GenerateStoryRequest,
    signal?: AbortSignal | undefined,
  ): Promise<GenerateStoryResponse>
}

export class DefaultStoryWorkflow implements StoryWorkflow {
  constructor(
    private readonly options: {
      aiClient: AiTextClient
      cache: GenerationCacheRepository
      cacheTtlHours: number
      poiDataVersion: string
      now: () => Date
    },
  ) {}

  async generate(
    request: GenerateStoryRequest,
    signal?: AbortSignal | undefined,
  ): Promise<GenerateStoryResponse> {
    const key = createStoryCacheKey({
      preferences: request.preferences,
      routePlan: request.routePlan,
      poiDataVersion: this.options.poiDataVersion,
    })
    const cached = await this.options.cache.get(key, this.options.now())
    if (cached) {
      const parsed = GenerateStoryResponseSchema.safeParse(cached.value)
      if (parsed.success) {
        return parsed.data
      }
    }

    const blueprint = await generateBlueprint({
      aiClient: this.options.aiClient,
      preferences: request.preferences,
      routePlan: request.routePlan,
      signal,
    })

    let response: GenerateStoryResponse
    try {
      const storyGraph = await generateStoryGraph({
        aiClient: this.options.aiClient,
        blueprint,
        routePlan: request.routePlan,
        signal,
      })
      response = GenerateStoryResponseSchema.parse({
        blueprint,
        storyGraph,
        fallbackUsed: false,
        fallbackReason: null,
      })
    } catch (error) {
      if (!(error instanceof StoryGraphValidationError)) {
        throw error
      }
      try {
        const storyGraph = await repairStoryGraph({
          aiClient: this.options.aiClient,
          blueprint,
          routePlan: request.routePlan,
          invalidOutput: error.rawOutput,
          errors: error.issues,
          signal,
        })
        response = GenerateStoryResponseSchema.parse({
          blueprint,
          storyGraph,
          fallbackUsed: false,
          fallbackReason: null,
        })
      } catch {
        response = createMockStory(request)
      }
    }

    const now = this.options.now()
    await this.options.cache.set({
      key,
      value: response,
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + this.options.cacheTtlHours * 60 * 60 * 1000,
      ).toISOString(),
    })
    return response
  }
}
