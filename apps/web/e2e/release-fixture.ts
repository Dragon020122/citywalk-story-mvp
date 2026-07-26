import type { StoryNode } from '@citywalk/shared'
import type { GenerationResult } from '../src/journey-storage'
import { testGenerationResult } from '../src/test/generation-fixture'

const requirement = {
  minimumScores: {},
  clues: [],
  items: [],
  flags: {},
}

const reward = {
  scores: {},
  clues: [],
  items: [],
  flags: {},
}

const createNode = (
  id: string,
  poiId: string,
  overrides: Partial<StoryNode>,
): StoryNode => ({
  id,
  poiId,
  type: 'discovery',
  title: id,
  arrivalText: `抵达 ${id}`,
  storyText: `${id} 的发布验收剧情。`,
  task: null,
  choices: [],
  rewards: reward,
  requiredState: requirement,
  next: null,
  fallbackNext: null,
  estimatedMinutes: 2,
  safetyNotice: '请停留在公共空间。',
  ...overrides,
})

export const createReleaseGenerationResult = (): GenerationResult => {
  const result = structuredClone(testGenerationResult)
  const basePoi = result.routePlan.selectedPois[0]!
  const pois = ['observe', 'photo', 'choice', 'ending'].map(
    (suffix, index) => ({
      ...basePoi,
      id: `mock_release_${suffix}`,
      name: `发布验收节点 ${index + 1}`,
      shortName: `验收 ${index + 1}`,
      address: `固定 Mock 测试地址 ${index + 1}`,
      longitude: basePoi.longitude + index * 0.0001,
      latitude: basePoi.latitude + index * 0.0001,
      fallbackPoiIds: [],
    }),
  )

  result.routePlan = {
    ...result.routePlan,
    routeId: 'route_release_e2e',
    selectedPois: pois,
    alternativePois: [],
    routeSegments: [],
    totalWalkMeters: 1600,
    totalWalkMinutes: 25,
    totalStayMinutes: 40,
    totalEstimatedMinutes: 65,
  }
  result.story.blueprint = {
    ...result.story.blueprint,
    storyId: 'story_release_e2e',
    title: '发布前的最后一条暗线',
    subtitle: '在四个节点完成一次完整验收',
    role: '城市质量守门人',
    mission: '完成观察、拍照、选择与结局归档。',
    actStructure: [
      {
        id: 'act_release',
        title: '发布验收',
        summary: '依次完成关键任务。',
        objective: '验证完整移动端流程。',
        poiIds: pois.map((poi) => poi.id),
      },
    ],
    clueChain: [
      {
        id: 'clue_observe',
        name: '观察记录',
        description: '来自第一站的可核验细节。',
        sourcePoiId: pois[0]!.id,
        required: true,
      },
      {
        id: 'clue_photo',
        name: '本地影像',
        description: '只保存在设备里的现场照片。',
        sourcePoiId: pois[1]!.id,
        required: true,
      },
      {
        id: 'clue_choice',
        name: '分支决定',
        description: '选择继续追踪安全路线。',
        sourcePoiId: pois[2]!.id,
        required: true,
      },
    ],
    branchPlan: [
      {
        id: 'branch_release',
        fromActId: 'act_release',
        condition: '完成前两项任务',
        summary: '决定是否继续追踪。',
      },
    ],
    endingPlan: [
      {
        id: 'ending_release',
        title: '质量守门人',
        condition: '完成全部节点',
        summary: '所有发布检查均已完成。',
        hidden: false,
      },
    ],
  }
  result.story.storyGraph = {
    entryNodeId: 'node_observe',
    nodes: [
      createNode('node_observe', pois[0]!.id, {
        type: 'intro',
        title: '观察第一处标记',
        task: {
          id: 'task_observe',
          type: 'observe',
          title: '完成观察任务',
          instructions: '确认公共空间中的固定标记。',
          required: true,
          estimatedMinutes: 2,
          observationAnchors: ['门牌形状'],
        },
        rewards: { ...reward, clues: ['clue_observe'] },
        next: 'node_photo',
      }),
      createNode('node_photo', pois[1]!.id, {
        type: 'task',
        title: '保存本地照片',
        task: {
          id: 'task_photo',
          type: 'photo',
          title: '完成拍照任务',
          instructions: '拍摄允许记录的公共空间细节。',
          required: true,
          estimatedMinutes: 2,
          photoPrompt: '选择一张测试图片，仅保存在本地。',
        },
        rewards: { ...reward, clues: ['clue_photo'] },
        next: 'node_choice',
      }),
      createNode('node_choice', pois[2]!.id, {
        type: 'choice',
        title: '决定最后的追踪方向',
        choices: [
          {
            id: 'choice_continue',
            text: '继续沿安全路线追踪',
            effects: {
              courage: 1,
              addClue: 'clue_choice',
              nextNodeId: 'node_ending',
            },
          },
          {
            id: 'choice_archive',
            text: '直接归档现有证据',
            effects: { nextNodeId: 'node_ending' },
          },
        ],
        next: 'node_ending',
      }),
      createNode('node_ending', pois[3]!.id, {
        type: 'ending_gate',
        title: '完成发布归档',
        rewards: { ...reward, flags: { endingId: 'ending_release' } },
      }),
    ],
    endings: [
      {
        id: 'ending_release',
        title: '质量守门人',
        summary: '你完成了发布前的全部关键检查。',
        requiredState: requirement,
        conditions: {
          completedNodeIds: [
            'node_observe',
            'node_photo',
            'node_choice',
            'node_ending',
          ],
          minimumCompletedNodes: 4,
          sideQuest: {},
        },
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
  result.story.fallbackUsed = false
  result.story.fallbackReason = null
  result.savedAt = '2026-07-26T12:00:00.000Z'
  return result
}
