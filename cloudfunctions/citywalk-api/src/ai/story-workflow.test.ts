import {
  type GenerateStoryRequest,
  type JourneyPreferences,
  type Poi,
  type RoutePlan,
  type StoryGraph,
} from '@citywalk/shared'
import { describe, expect, it } from 'vitest'
import { InMemoryGenerationCacheRepository } from '../repositories/index.js'
import type {
  AiTextClient,
  GenerateTextInput,
} from './ai-client.js'
import { generateStoryGraph } from './generate-story-graph.js'
import {
  AiOutputParseError,
  parseAiJson,
} from './json-parser.js'
import { createMockStory } from './mock-story.js'
import { regenerateNodeCopy } from './regenerate-node.js'
import {
  DefaultStoryWorkflow,
  MockStoryWorkflow,
} from './story-workflow.js'
import { validateStoryGraph } from './validate-story-graph.js'
import { z } from 'zod'

class QueueAiClient implements AiTextClient {
  readonly inputs: GenerateTextInput[] = []

  constructor(private readonly outputs: string[]) {}

  async generateText(input: GenerateTextInput): Promise<string> {
    this.inputs.push(input)
    const output = this.outputs.shift()
    if (output === undefined) {
      throw new Error('No queued AI output')
    }
    return output
  }
}

const preferences: JourneyPreferences = {
  routePackId: 'mock_story_route',
  startPoiId: 'auto',
  durationMinutes: 120,
  companion: 'friends',
  interests: ['architecture'],
  genre: 'mystery',
  taskIntensity: 'standard',
  budgetCny: 100,
  indoorPreference: 'balanced',
  photoTasksEnabled: true,
  puzzleTasksEnabled: true,
  storyExplorationRatio: 60,
}

const pois: Poi[] = Array.from({ length: 7 }, (_, index) => ({
  id: `mock_story_${index + 1}`,
  routePackId: preferences.routePackId,
  name: `开发模拟节点 ${index + 1}`,
  shortName: `模拟 ${index + 1}`,
  address: `开发测试地址 ${index + 1}，不对应真实地点`,
  longitude: 121.45 + index * 0.001,
  latitude: 31.22 + index * 0.001,
  category: index % 2 === 0 ? 'public_space' : 'gallery',
  indoor: index % 2 === 1,
  publicAccess: true,
  estimatedCostCny: 0,
  stayMinutes: 10,
  walkMinutes: 3,
  tags: ['architecture'],
  moodTags: ['urban'],
  storyHooks: ['fiction-only'],
  taskHooks: ['observe-detail', 'journal-note'],
  observationAnchors: ['shape', 'light'],
  safetyNotes: ['remain-in-public-space'],
  verificationStatus: 'mock',
  verifiedAt: null,
  sourceUrls: [],
  fallbackPoiIds: [`mock_story_${((index + 1) % 7) + 1}`],
}))

const routePlan: RoutePlan = {
  routeId: 'route_story_test',
  routePackId: preferences.routePackId,
  selectedPois: pois,
  alternativePois: [],
  routeSegments: [],
  totalWalkMeters: 1_500,
  totalWalkMinutes: 20,
  totalStayMinutes: 70,
  totalEstimatedMinutes: 90,
  estimatedCostCny: 0,
  degraded: true,
}

const request: GenerateStoryRequest = { preferences, routePlan }
const fixture = createMockStory(request)
const validBlueprintOutput = JSON.stringify(fixture.blueprint)
const validGraphOutput = JSON.stringify(fixture.storyGraph)

const createWorkflow = (
  client: AiTextClient,
  cache = new InMemoryGenerationCacheRepository(),
): DefaultStoryWorkflow =>
  new DefaultStoryWorkflow({
    aiClient: client,
    cache,
    cacheTtlHours: 24,
    poiDataVersion: 'fixed-mock-v1',
    now: () => new Date('2026-07-26T00:00:00.000Z'),
  })

const graphIssues = (graph: StoryGraph): string[] =>
  validateStoryGraph({
    graph,
    blueprint: fixture.blueprint,
    routePlan,
  }).map((issue) => issue.code)

describe('AI JSON parser', () => {
  const schema = z.object({ ok: z.boolean() })

  it('parses direct and fenced JSON', () => {
    expect(parseAiJson('{"ok":true}', schema)).toEqual({ ok: true })
    expect(parseAiJson('```json\n{"ok":true}\n```', schema)).toEqual({
      ok: true,
    })
    expect(
      parseAiJson('preface {"ok":true} epilogue', schema),
    ).toEqual({ ok: true })
  })

  it('rejects invalid JSON', () => {
    expect(() => parseAiJson('not-json', schema)).toThrow(
      AiOutputParseError,
    )
  })
})

describe('StoryGraph semantic validation', () => {
  it('accepts a legal AI graph', async () => {
    const client = new QueueAiClient([validGraphOutput])
    await expect(
      generateStoryGraph({
        aiClient: client,
        blueprint: fixture.blueprint,
        routePlan,
      }),
    ).resolves.toEqual(fixture.storyGraph)
  })

  it('rejects a POI outside the route', () => {
    const graph = structuredClone(fixture.storyGraph)
    graph.nodes[0]!.poiId = 'mock_unknown'
    expect(graphIssues(graph)).toContain('POI_ID_INVALID')
  })

  it('detects an infinite loop', () => {
    const graph = structuredClone(fixture.storyGraph)
    graph.nodes[4]!.next = graph.entryNodeId
    expect(graphIssues(graph)).toContain('INFINITE_LOOP')
  })

  it('detects an unreachable ending', () => {
    const graph = structuredClone(fixture.storyGraph)
    graph.nodes[3]!.choices = graph.nodes[3]!.choices.slice(0, 2)
    expect(graphIssues(graph)).toContain(
      'REACHABLE_ENDINGS_INSUFFICIENT',
    )
    expect(graphIssues(graph)).toContain('CRITICAL_NODE_UNREACHABLE')
  })

  it('detects fake branches with identical consequences', () => {
    const graph = structuredClone(fixture.storyGraph)
    graph.nodes[0]!.choices[1]!.effects =
      graph.nodes[0]!.choices[0]!.effects
    expect(graphIssues(graph)).toContain(
      'MEANINGFUL_CHOICES_INSUFFICIENT',
    )
  })

  it('detects dangerous tasks', () => {
    const graph = structuredClone(fixture.storyGraph)
    graph.nodes[0]!.task!.instructions = '奔跑横穿机动车道'
    expect(graphIssues(graph)).toContain('UNSAFE_TASK')
  })
})

describe('structured story workflow', () => {
  it('generates a schema-valid story without AI in mock mode', async () => {
    const result = await new MockStoryWorkflow().generate(request)

    expect(result).toEqual(fixture)
    expect(result.fallbackUsed).toBe(true)
  })

  it('repairs one invalid graph successfully', async () => {
    const client = new QueueAiClient([
      validBlueprintOutput,
      'not-json',
      validGraphOutput,
    ])
    const result = await createWorkflow(client).generate(request)

    expect(result.fallbackUsed).toBe(false)
    expect(result.storyGraph).toEqual(fixture.storyGraph)
    expect(client.inputs).toHaveLength(3)
    expect(client.inputs[0]?.prompt).not.toContain('sourceUrls')
    expect(client.inputs[0]?.prompt).not.toContain('verificationStatus')
  })

  it('falls back after the only repair also fails', async () => {
    const client = new QueueAiClient([
      validBlueprintOutput,
      'not-json',
      'still-not-json',
    ])
    const result = await createWorkflow(client).generate(request)

    expect(result.fallbackUsed).toBe(true)
    expect(result.fallbackReason).toBe('STORY_GRAPH_INVALID')
    expect(result.storyGraph.nodes).toHaveLength(7)
    expect(client.inputs).toHaveLength(3)
  })

  it('returns a cached response without calling AI again', async () => {
    const cache = new InMemoryGenerationCacheRepository()
    const firstClient = new QueueAiClient([
      validBlueprintOutput,
      validGraphOutput,
    ])
    await createWorkflow(firstClient, cache).generate(request)

    const secondClient = new QueueAiClient([])
    const cached = await createWorkflow(secondClient, cache).generate(
      request,
    )

    expect(cached.fallbackUsed).toBe(false)
    expect(secondClient.inputs).toHaveLength(0)
  })
})

describe('node regeneration', () => {
  it('changes copy without changing graph structure', async () => {
    const original = fixture.storyGraph.nodes[0]!
    const client = new QueueAiClient([
      JSON.stringify({
        storyText: '重写后的安全故事文案。',
        arrivalText: '重写后的抵达文案。',
        taskCopy: {
          title: '重写任务标题',
          instructions: '观察公共区域中可见的形状。',
        },
        choiceTexts: original.choices.map((choice) => ({
          choiceId: choice.id,
          text: `重写：${choice.text}`,
        })),
      }),
    ])

    const regenerated = await regenerateNodeCopy({
      aiClient: client,
      node: original,
    })

    expect(regenerated.storyText).not.toBe(original.storyText)
    expect(regenerated.id).toBe(original.id)
    expect(regenerated.poiId).toBe(original.poiId)
    expect(regenerated.type).toBe(original.type)
    expect(regenerated.next).toBe(original.next)
    expect(regenerated.fallbackNext).toBe(original.fallbackNext)
    expect(regenerated.rewards).toEqual(original.rewards)
    expect(regenerated.requiredState).toEqual(original.requiredState)
    expect(regenerated.task?.id).toBe(original.task?.id)
    expect(regenerated.task?.type).toBe(original.task?.type)
    expect(
      regenerated.choices.map((choice) => ({
        id: choice.id,
        effects: choice.effects,
      })),
    ).toEqual(
      original.choices.map((choice) => ({
        id: choice.id,
        effects: choice.effects,
      })),
    )
  })
})
