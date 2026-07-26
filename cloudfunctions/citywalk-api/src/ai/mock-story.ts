import {
  GenerateStoryResponseSchema,
  type GenerateStoryResponse,
  type JourneyPreferences,
  type RoutePlan,
  type StateRequirement,
  type StateReward,
  type StoryNode,
} from '@citywalk/shared'

const emptyRequirement = (): StateRequirement => ({
  minimumScores: {},
  clues: [],
  items: [],
  flags: {},
})

const emptyReward = (): StateReward => ({
  scores: {},
  clues: [],
  items: [],
  flags: {},
})

export const createMockStory = (input: {
  preferences: JourneyPreferences
  routePlan: RoutePlan
}): GenerateStoryResponse => {
  const { preferences, routePlan } = input
  const pois = routePlan.selectedPois
  if (pois.length === 0) {
    throw new Error('Cannot build a fallback story without selected POIs')
  }
  const poiId = (index: number): string =>
    pois[index % pois.length]?.id ?? pois[0]!.id
  const node = (
    value: Pick<StoryNode, 'id' | 'poiId' | 'type' | 'title'> &
      Partial<StoryNode>,
  ): StoryNode => ({
    storyText: '你在公开步行区域发现了一段仅用于开发演示的虚构线索。观察周围可见细节，并按自己的节奏继续。',
    arrivalText: '请在安全的公共区域停留。',
    task: null,
    choices: [],
    rewards: emptyReward(),
    requiredState: emptyRequirement(),
    next: null,
    fallbackNext: null,
    estimatedMinutes: 5,
    safetyNotice: '遵守现场规则，留意交通和行人。',
    ...value,
  })

  const nodes: StoryNode[] = [
    node({
      id: 'node_intro',
      poiId: poiId(0),
      type: 'intro',
      title: '未寄出的城市便笺',
      task: {
        id: 'task_observe_intro',
        type: 'observe',
        title: '寻找两种形状',
        instructions: '只观察公共区域内可见的形状，记录两种不同轮廓。',
        required: true,
        estimatedMinutes: 3,
        observationAnchors:
          pois[0]?.observationAnchors.slice(0, 2) ?? ['轮廓'],
      },
      choices: [
        {
          id: 'choice_follow_mark',
          text: '沿着显眼的标记继续',
          effects: { courage: 1, nextNodeId: 'node_discovery' },
        },
        {
          id: 'choice_side_note',
          text: '先查看便笺背面的提示',
          effects: {
            empathy: 1,
            unlockSideQuest: 'side_note',
            nextNodeId: 'node_side_quest',
          },
        },
      ],
    }),
    node({
      id: 'node_discovery',
      poiId: poiId(1),
      type: 'discovery',
      title: '重复出现的符号',
      rewards: {
        ...emptyReward(),
        clues: ['clue_1', 'clue_2'],
      },
      next: 'node_checkpoint',
    }),
    node({
      id: 'node_side_quest',
      poiId: poiId(2),
      type: 'side_quest',
      title: '支线：被忽略的颜色',
      storyText: '便笺提示你寻找一种重复出现的颜色。它不指向真实历史，只是这次虚构任务的暗号。',
      rewards: {
        ...emptyReward(),
        clues: ['clue_3'],
        items: ['item_note'],
      },
      next: 'node_discovery',
    }),
    node({
      id: 'node_checkpoint',
      poiId: poiId(3),
      type: 'choice',
      title: '把线索拼成答案',
      rewards: {
        ...emptyReward(),
        clues: ['clue_4'],
      },
      choices: [
        {
          id: 'choice_truth',
          text: '相信最直接的解释',
          effects: { truth: 2, nextNodeId: 'node_ending_truth' },
        },
        {
          id: 'choice_memory',
          text: '保留那些不确定的细节',
          effects: { memory: 2, nextNodeId: 'node_ending_memory' },
        },
        {
          id: 'choice_connection',
          text: '把答案留给同行者共同完成',
          effects: {
            connection: 2,
            nextNodeId: 'node_ending_connection',
          },
        },
      ],
    }),
    node({
      id: 'node_ending_truth',
      poiId: poiId(4),
      type: 'ending_gate',
      title: '结局：清晰的坐标',
      rewards: {
        ...emptyReward(),
        flags: { endingId: 'ending_truth' },
      },
    }),
    node({
      id: 'node_ending_memory',
      poiId: poiId(0),
      type: 'ending_gate',
      title: '结局：留白的回声',
      rewards: {
        ...emptyReward(),
        flags: { endingId: 'ending_memory' },
      },
    }),
    node({
      id: 'node_ending_connection',
      poiId: poiId(1),
      type: 'ending_gate',
      title: '结局：共同的注脚',
      rewards: {
        ...emptyReward(),
        flags: { endingId: 'ending_connection' },
      },
    }),
  ]

  const storyId = `story_${routePlan.routeId}`
  return GenerateStoryResponseSchema.parse({
    blueprint: {
      storyId,
      title: '城市便笺：开发演示',
      subtitle: '基于 Mock POI 的虚构互动故事',
      genre: preferences.genre,
      role: '便笺整理员',
      mission: '在公开区域内完成观察并整理四条虚构线索。',
      premise: '一组没有现实历史指向的便笺，将沿途观察连成一次安全的城市漫步。',
      actStructure: [
        {
          id: 'act_1',
          title: '收到便笺',
          summary: '发现任务与第一条线索。',
          objective: '确认符号。',
          poiIds: [poiId(0), poiId(1)],
        },
        {
          id: 'act_2',
          title: '补全线索',
          summary: '通过支线观察补全便笺。',
          objective: '收集四条线索。',
          poiIds: [poiId(2), poiId(3)],
        },
        {
          id: 'act_3',
          title: '选择答案',
          summary: '依据选择进入不同结局。',
          objective: '完成最后判断。',
          poiIds: [poiId(4)],
        },
      ],
      characters: [
        {
          id: 'character_writer',
          name: '匿名写信人',
          role: '虚构线索提供者',
          description: '只存在于故事中的便笺作者。',
        },
      ],
      clueChain: [0, 1, 2, 3].map((index) => ({
        id: `clue_${index + 1}`,
        name: `便笺线索${index + 1}`,
        description: '来自公共空间可见细节的虚构线索。',
        sourcePoiId: poiId(index),
        required: index < 2,
      })),
      items: [
        {
          id: 'item_note',
          name: '虚构便笺',
          description: '仅存在于故事状态中的虚构道具。',
        },
      ],
      branchPlan: [
        {
          id: 'branch_side',
          fromActId: 'act_1',
          condition: '选择查看背面提示',
          summary: '进入可返回主线的观察支线。',
        },
        {
          id: 'branch_ending',
          fromActId: 'act_3',
          condition: '选择不同的线索解释',
          summary: '进入三个不同普通结局。',
        },
      ],
      sideQuestPlan: [
        {
          id: 'side_note',
          title: '被忽略的颜色',
          trigger: '选择查看便笺背面',
          summary: '完成一次安全观察后回到主线。',
        },
      ],
      endingPlan: [
        {
          id: 'ending_truth',
          title: '清晰的坐标',
          condition: '选择直接解释',
          summary: '你得到一个明确答案。',
          hidden: false,
        },
        {
          id: 'ending_memory',
          title: '留白的回声',
          condition: '选择保留细节',
          summary: '你选择让故事保持开放。',
          hidden: false,
        },
        {
          id: 'ending_connection',
          title: '共同的注脚',
          condition: '选择共同完成',
          summary: '你与同行者共享答案。',
          hidden: false,
        },
      ],
      fictionNotice: '本故事及任务均为虚构，Mock POI 不可用于真实线下导航。',
      contentWarnings: ['请遵守现场规则并始终注意交通安全。'],
    },
    storyGraph: {
      entryNodeId: 'node_intro',
      nodes,
      endings: [
        {
          id: 'ending_truth',
          title: '清晰的坐标',
          summary: '你完成了直接而坚定的解释。',
          requiredState: emptyRequirement(),
        },
        {
          id: 'ending_memory',
          title: '留白的回声',
          summary: '你保存了故事中的不确定性。',
          requiredState: emptyRequirement(),
        },
        {
          id: 'ending_connection',
          title: '共同的注脚',
          summary: '你让同行成为答案的一部分。',
          requiredState: emptyRequirement(),
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
    },
    fallbackUsed: true,
    fallbackReason: 'STORY_GRAPH_INVALID',
  })
}
