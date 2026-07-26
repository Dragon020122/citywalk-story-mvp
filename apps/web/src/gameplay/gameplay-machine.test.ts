import {
  applyChoiceEffects,
  applyNodeRewards,
  createInitialRuntimeState,
  resolveEnding,
  type StoryGraph,
  type StoryNode,
} from '@citywalk/shared'
import { createActor } from 'xstate'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGameplayMachine } from './gameplay-machine'
import { loadGameplay, saveGameplay } from './gameplay-storage'

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

function node(id: string, overrides: Partial<StoryNode> = {}): StoryNode {
  return {
    id,
    poiId: `mock_${id}`,
    type: 'discovery',
    title: id,
    arrivalText: `抵达 ${id}`,
    storyText: `${id} 的剧情`,
    task: null,
    choices: [],
    rewards: reward,
    requiredState: requirement,
    next: null,
    fallbackNext: null,
    estimatedMinutes: 1,
    safetyNotice: null,
    ...overrides,
  }
}

function createGraph(): StoryGraph {
  return {
    entryNodeId: 'main',
    nodes: [
      node('main', {
        task: {
          id: 'task_main',
          type: 'observe',
          title: '观察',
          instructions: '观察公共空间标记',
          required: true,
          estimatedMinutes: 1,
          observationAnchors: ['标记'],
        },
        choices: [
          {
            id: 'accept_side',
            text: '接受支线',
            effects: {
              unlockSideQuest: 'side',
              nextNodeId: 'side',
              addClue: 'clue_choice',
            },
          },
          {
            id: 'refuse_side',
            text: '拒绝支线',
            effects: {
              setFlag: { key: 'sideDeclined', value: true },
              nextNodeId: 'after',
            },
          },
        ],
        rewards: {
          ...reward,
          clues: ['clue_main'],
        },
        fallbackNext: 'after',
      }),
      node('side', {
        type: 'side_quest',
        requiredState: {
          ...requirement,
          flags: { 'sideQuest:side:unlocked': true },
        },
        rewards: {
          ...reward,
          clues: ['clue_side'],
          items: ['item_side'],
        },
        next: 'after',
        fallbackNext: 'after',
      }),
      node('after', {
        type: 'ending_gate',
        rewards: {
          ...reward,
          flags: { endingId: 'ending_normal' },
        },
      }),
    ],
    endings: [
      {
        id: 'ending_normal',
        title: '普通结局',
        summary: '主线完成。',
        requiredState: requirement,
      },
    ],
    hiddenEnding: {
      id: 'ending_hidden',
      title: '隐藏结局',
      summary: '支线物品开启了隐藏结局。',
      requiredState: { ...requirement, items: ['item_side'] },
    },
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
}

function arriveAndRead(actor: ReturnType<typeof createActor>) {
  actor.send({ type: 'START' })
  actor.send({ type: 'ARRIVE' })
  actor.send({ type: 'READ_ARRIVAL' })
  actor.send({ type: 'FINISH_READING' })
}

describe('互动剧情 XState 引擎', () => {
  beforeEach(() => window.localStorage.clear())

  it('按事件依次通过顶层节点流程', () => {
    const actor = createActor(createGameplayMachine(createGraph())).start()
    expect(actor.getSnapshot().value).toBe('idle')
    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('navigating')
    actor.send({ type: 'ARRIVE' })
    expect(actor.getSnapshot().value).toBe('arrived')
    actor.send({ type: 'READ_ARRIVAL' })
    expect(actor.getSnapshot().value).toBe('reading')
    actor.send({ type: 'FINISH_READING' })
    expect(actor.getSnapshot().value).toBe('tasking')
  })

  it('重复任务事件不会重复完成或触发副作用', () => {
    const actor = createActor(createGameplayMachine(createGraph())).start()
    arriveAndRead(actor)
    actor.send({ type: 'COMPLETE_TASK' })
    actor.send({ type: 'COMPLETE_TASK' })
    expect(actor.getSnapshot().context.runtime.completedTaskIds).toEqual([
      'task_main',
    ])
  })

  it('重复 choice 提交只应用一次效果', () => {
    const actor = createActor(createGameplayMachine(createGraph())).start()
    arriveAndRead(actor)
    actor.send({ type: 'COMPLETE_TASK' })
    actor.send({ type: 'SUBMIT_CHOICE', choiceId: 'accept_side' })
    actor.send({ type: 'SUBMIT_CHOICE', choiceId: 'accept_side' })
    const runtime = actor.getSnapshot().context.runtime
    expect(runtime.submittedChoiceNodeIds).toEqual(['main'])
    expect(runtime.clues.filter((clue) => clue === 'clue_choice')).toHaveLength(
      1,
    )
  })

  it('支线可进入、可返回主线，也可以明确拒绝', () => {
    const graph = createGraph()
    const accepted = createActor(createGameplayMachine(graph)).start()
    arriveAndRead(accepted)
    accepted.send({ type: 'COMPLETE_TASK' })
    accepted.send({ type: 'SUBMIT_CHOICE', choiceId: 'accept_side' })
    accepted.send({ type: 'ADVANCE' })
    expect(accepted.getSnapshot().context.runtime.currentNodeId).toBe('side')
    arriveAndRead(accepted)
    accepted.send({ type: 'ADVANCE' })
    expect(accepted.getSnapshot().context.runtime.currentNodeId).toBe('after')

    const refused = createActor(createGameplayMachine(graph)).start()
    arriveAndRead(refused)
    refused.send({ type: 'COMPLETE_TASK' })
    refused.send({ type: 'SUBMIT_CHOICE', choiceId: 'refuse_side' })
    refused.send({ type: 'ADVANCE' })
    expect(refused.getSnapshot().context.runtime.currentNodeId).toBe('after')
    expect(refused.getSnapshot().context.runtime.flags.sideDeclined).toBe(true)
  })

  it('线索与道具奖励保持幂等并记录来源节点', () => {
    const graph = createGraph()
    const runtime = createInitialRuntimeState(graph)
    const rewardedOnce = applyNodeRewards(runtime, graph.nodes[1]!)
    const rewardedTwice = applyNodeRewards(rewardedOnce, graph.nodes[1]!)
    expect(rewardedTwice.clues).toEqual(['clue_side'])
    expect(rewardedTwice.items).toEqual(['item_side'])
    expect(rewardedTwice.clueSources.clue_side).toBe('side')
  })

  it('提前结束根据当前档案生成未完成结局', () => {
    const actor = createActor(createGameplayMachine(createGraph())).start()
    actor.send({ type: 'START' })
    actor.send({ type: 'END_EARLY' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('ending')
    expect(snapshot.context.runtime.endingId).toBe('ending_incomplete')
    expect(snapshot.context.runtime.endingSummary).toContain('提前离开')
  })

  it('满足条件时隐藏结局优先于普通结局', () => {
    const graph = createGraph()
    const runtime = applyNodeRewards(
      createInitialRuntimeState(graph),
      graph.nodes[1]!,
    )
    expect(resolveEnding(graph, runtime).id).toBe('ending_hidden')
  })

  it('刷新后通过共享 Schema 恢复准确状态', () => {
    const graph = createGraph()
    const runtime = applyChoiceEffects(
      createInitialRuntimeState(graph),
      graph.nodes[0]!,
      graph.nodes[0]!.choices[0]!,
    )
    saveGameplay('story_restore', 'choosing', runtime)
    expect(loadGameplay('story_restore', graph)).toEqual({
      state: 'choosing',
      resumeState: 'navigating',
      runtime,
    })
  })

  it('暂停状态刷新后仍恢复到暂停前的精确阶段', () => {
    const graph = createGraph()
    const actor = createActor(createGameplayMachine(graph)).start()
    arriveAndRead(actor)
    actor.send({ type: 'PAUSE', from: 'tasking' })
    const paused = actor.getSnapshot()
    saveGameplay(
      'story_paused',
      'paused',
      paused.context.runtime,
      paused.context.resumeState,
    )

    const restored = loadGameplay('story_paused', graph)!
    const resumedActor = createActor(
      createGameplayMachine(
        graph,
        restored.runtime,
        restored.state,
        restored.resumeState,
      ),
    ).start()
    resumedActor.send({ type: 'RESUME' })
    expect(resumedActor.getSnapshot().value).toBe('tasking')
  })

  it('错误节点优先回退到 fallbackNext，主线仍可继续', () => {
    const actor = createActor(createGameplayMachine(createGraph())).start()
    arriveAndRead(actor)
    actor.send({ type: 'COMPLETE_TASK' })
    actor.send({ type: 'SUBMIT_CHOICE', choiceId: 'accept_side' })
    actor.send({ type: 'ADVANCE' })
    expect(actor.getSnapshot().context.runtime.currentNodeId).toBe('side')
    actor.send({ type: 'FAIL', message: '节点损坏' })
    expect(actor.getSnapshot().value).toBe('error')
    actor.send({ type: 'RETRY_NODE' })
    expect(actor.getSnapshot().value).toBe('navigating')
    expect(actor.getSnapshot().context.runtime.currentNodeId).toBe('after')
  })
})
