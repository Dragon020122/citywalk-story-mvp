import { describe, expect, it } from 'vitest'
import {
  ApiErrorSchema,
  FeedbackRequestSchema,
  JourneyPreferencesSchema,
  PoiSchema,
  StoryGraphSchema,
  StoryRunSchema,
  TaskSchema,
  type Poi,
  type RoutePlan,
  type StoryGraph,
  type StoryNode,
} from './index.js'

const validPreferences = {
  routePackId: 'shanghai-hidden-lanes',
  startPoiId: 'auto',
  durationMinutes: 180,
  companion: 'friends',
  interests: ['architecture', 'local-history'],
  genre: 'mystery',
  taskIntensity: 'standard',
  budgetCny: 100,
  indoorPreference: 'balanced',
  photoTasksEnabled: true,
  puzzleTasksEnabled: true,
} as const

const validPoi: Poi = {
  id: 'mock_test_poi_1',
  routePackId: 'shanghai-hidden-lanes',
  name: '经核验的公共地点',
  shortName: '公共地点',
  address: '示例路 1 号',
  longitude: 121.4737,
  latitude: 31.2304,
  category: 'landmark',
  indoor: false,
  publicAccess: true,
  estimatedCostCny: 0,
  stayMinutes: 20,
  walkMinutes: 5,
  tags: ['architecture'],
  moodTags: ['quiet'],
  storyHooks: ['historic-detail'],
  taskHooks: ['observe-facade'],
  observationAnchors: ['main-entrance'],
  safetyNotes: ['stay-on-public-path'],
  verificationStatus: 'mock',
  verifiedAt: null,
  sourceUrls: [],
  fallbackPoiIds: [],
}

const emptyRequirement = {
  minimumScores: {},
  clues: [],
  items: [],
  flags: {},
}

const emptyRewards = {
  scores: {},
  clues: [],
  items: [],
  flags: {},
}

const createNode = (
  id: string,
  overrides: Partial<StoryNode> = {},
): StoryNode => ({
  id,
  poiId: validPoi.id,
  type: 'discovery',
  title: '节点标题',
  storyText: '节点剧情文本',
  arrivalText: '抵达文本',
  task: null,
  choices: [],
  rewards: emptyRewards,
  requiredState: emptyRequirement,
  next: null,
  fallbackNext: null,
  estimatedMinutes: 10,
  safetyNotice: null,
  ...overrides,
})

const validGraph: StoryGraph = {
  entryNodeId: 'intro',
  nodes: [
    createNode('intro', { type: 'intro', next: 'ending-gate' }),
    createNode('ending-gate', {
      type: 'ending_gate',
      poiId: null,
      arrivalText: null,
    }),
  ],
  endings: [
    {
      id: 'ending-1',
      title: '结局',
      summary: '旅程完成。',
      requiredState: emptyRequirement,
    },
  ],
  hiddenEnding: null,
  stateDefinition: {
    initialEffectScores: {
      truth: 0,
      memory: 0,
      empathy: 0,
      courage: 0,
      connection: 0,
    },
    initialClues: [],
    initialItems: [],
    initialFlags: {},
  },
}

const validRoutePlan: RoutePlan = {
  routeId: 'route-1',
  routePackId: validPoi.routePackId,
  selectedPois: [validPoi],
  alternativePois: [],
  routeSegments: [],
  totalWalkMeters: 0,
  totalWalkMinutes: 0,
  totalStayMinutes: 20,
  totalEstimatedMinutes: 20,
  estimatedCostCny: 0,
  degraded: false,
}

describe('JourneyPreferencesSchema', () => {
  it('accepts valid preferences and applies the default ratio', () => {
    const result = JourneyPreferencesSchema.parse(validPreferences)

    expect(result.storyExplorationRatio).toBe(60)
  })

  it('rejects more than four interests', () => {
    const result = JourneyPreferencesSchema.safeParse({
      ...validPreferences,
      interests: ['a', 'b', 'c', 'd', 'e'],
    })

    expect(result.success).toBe(false)
  })

  it.each([120, 180, 240] as const)(
    'accepts the supported duration %i as a number',
    (durationMinutes) => {
      expect(
        JourneyPreferencesSchema.safeParse({
          ...validPreferences,
          durationMinutes,
        }).success,
      ).toBe(true)
    },
  )

  it.each([150, '180'] as const)(
    'rejects an unsupported or non-numeric duration %s',
    (durationMinutes) => {
      expect(
        JourneyPreferencesSchema.safeParse({
          ...validPreferences,
          durationMinutes,
        }).success,
      ).toBe(false)
    },
  )

  it.each([0, 50, 100, 200, 300] as const)(
    'accepts the supported budget %i as a number',
    (budgetCny) => {
      expect(
        JourneyPreferencesSchema.safeParse({
          ...validPreferences,
          budgetCny,
        }).success,
      ).toBe(true)
    },
  )

  it.each([-1, 25, 301, '300'] as const)(
    'rejects an unsupported or non-numeric budget %s',
    (budgetCny) => {
      expect(
        JourneyPreferencesSchema.safeParse({
          ...validPreferences,
          budgetCny,
        }).success,
      ).toBe(false)
    },
  )
})

describe('PoiSchema', () => {
  it('rejects invalid coordinates', () => {
    const result = PoiSchema.safeParse({
      ...validPoi,
      longitude: 181,
      latitude: -91,
    })

    expect(result.success).toBe(false)
  })
})

describe('StoryGraphSchema', () => {
  it('rejects a graph whose entry node does not exist', () => {
    const result = StoryGraphSchema.safeParse({
      ...validGraph,
      entryNodeId: 'missing-entry',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a choice that references a missing node', () => {
    const result = StoryGraphSchema.safeParse({
      ...validGraph,
      nodes: [
        createNode('intro', {
          type: 'choice',
          choices: [
            {
              id: 'choice-1',
              text: '前往不存在的节点',
              effects: { nextNodeId: 'missing-node' },
            },
          ],
        }),
      ],
    })

    expect(result.success).toBe(false)
  })
})

describe('StoryRunSchema', () => {
  it('accepts a valid in-progress story run', () => {
    const result = StoryRunSchema.safeParse({
      storyId: 'story-1',
      routePlan: validRoutePlan,
      currentNodeId: 'intro',
      visitedNodeIds: ['intro'],
      completedTaskIds: [],
      choices: [],
      clues: [],
      items: [],
      flags: {},
      effectScores: {
        truth: 0,
        memory: 0,
        empathy: 0,
        courage: 0,
        connection: 0,
      },
      journalEntries: [],
      localPhotoIds: [],
      startedAt: '2026-07-26T08:00:00+08:00',
      updatedAt: '2026-07-26T08:10:00+08:00',
      completedAt: null,
      endingId: null,
      status: 'in_progress',
    })

    expect(result.success).toBe(true)
  })
})

describe('PuzzleTaskSchema', () => {
  const basePuzzle = {
    id: 'puzzle-1',
    type: 'puzzle',
    title: '现场谜题',
    instructions: '只观察公共空间。',
    required: true,
    estimatedMinutes: 2,
    question: '请选择或排列现场标记。',
    hint: '留意重复出现的符号。',
    answerValidation: 'structured-v1',
  } as const

  it.each([
    {
      kind: 'single',
      options: ['A', 'B'],
      answer: 'A',
    },
    {
      kind: 'multiple',
      options: ['A', 'B', 'C'],
      answers: ['A', 'C'],
    },
    {
      kind: 'order',
      options: ['A', 'B', 'C'],
      answerOrder: ['B', 'A', 'C'],
    },
    {
      kind: 'observation_code',
      code: '2718',
    },
  ])('supports $kind puzzles without open-ended AI judging', (puzzle) => {
    expect(TaskSchema.safeParse({ ...basePuzzle, puzzle }).success).toBe(true)
  })
})

describe('ApiErrorSchema', () => {
  it('accepts the unified API error shape', () => {
    const result = ApiErrorSchema.safeParse({
      code: 'POI_NOT_VERIFIED',
      message: 'POI 尚未通过人工核验',
      details: { poiId: 'poi-1' },
      requestId: 'request-1',
    })

    expect(result.success).toBe(true)
  })
})

describe('FeedbackRequestSchema', () => {
  it('validates the anonymous results feedback contract', () => {
    const feedback = {
      storyId: 'story-1',
      routePackId: 'mock_route',
      overallRating: 5,
      storyCoherence: 4,
      routeQuality: 5,
      taskQuality: 4,
      safetyFeeling: 5,
      likedTags: ['剧情氛围'],
      issueTags: [],
      comment: '',
      fallbackUsed: false,
    }
    expect(FeedbackRequestSchema.safeParse(feedback).success).toBe(true)
    expect(
      FeedbackRequestSchema.safeParse({
        ...feedback,
        overallRating: 6,
      }).success,
    ).toBe(false)
    expect(
      FeedbackRequestSchema.safeParse({
        ...feedback,
        phone: '13800000000',
      }).success,
    ).toBe(false)
  })
})
