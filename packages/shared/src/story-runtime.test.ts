import { describe, expect, it } from 'vitest'
import {
  applyChoiceEffects,
  applyNodeRewards,
  calculateEnding,
  createEndingCalculationInput,
  createInitialRuntimeState,
  getAvailableChoices,
  isEndingReachable,
  meetsStateRequirement,
  resolveEnding,
  resolveNextNode,
  validateRuntimeState,
  type StoryGraph,
  type StoryNode,
} from './index.js'

const requirement = {
  minimumScores: {},
  clues: [],
  items: [],
  flags: {},
}

function node(
  id: string,
  overrides: Partial<StoryNode> = {},
): StoryNode {
  return {
    id,
    poiId: `mock_${id}`,
    type: 'discovery',
    title: id,
    storyText: `${id} story`,
    arrivalText: null,
    task: null,
    choices: [],
    rewards: { scores: {}, clues: [], items: [], flags: {} },
    requiredState: requirement,
    next: null,
    fallbackNext: null,
    estimatedMinutes: 1,
    safetyNotice: null,
    ...overrides,
  }
}

function graph(): StoryGraph {
  return {
    entryNodeId: 'start',
    nodes: [
      node('start', {
        choices: [
          {
            id: 'eligible',
            text: 'Eligible',
            effects: {
              truth: 2,
              memory: 1,
              empathy: 1,
              courage: 1,
              connection: 1,
              addClue: 'clue_choice',
              addItem: 'item_choice',
              unlockSideQuest: 'side',
              setFlag: { key: 'choiceMade', value: true },
              nextNodeId: 'side',
            },
          },
          {
            id: 'locked',
            text: 'Locked',
            effects: { nextNodeId: 'locked' },
          },
        ],
        next: 'normal',
        fallbackNext: 'fallback',
      }),
      node('side', {
        type: 'side_quest',
        requiredState: {
          ...requirement,
          flags: { 'sideQuest:side:unlocked': true },
        },
        next: 'normal',
      }),
      node('locked', {
        requiredState: {
          ...requirement,
          clues: ['missing'],
        },
      }),
      node('normal', {
        task: {
          id: 'task_normal',
          type: 'observe',
          title: 'Observe',
          instructions: 'Observe safely',
          required: true,
          estimatedMinutes: 1,
          observationAnchors: ['shape'],
        },
        rewards: {
          scores: { truth: 1 },
          clues: ['clue_reward'],
          items: ['item_reward'],
          flags: { endingId: 'ending_requested' },
        },
      }),
      node('fallback'),
    ],
    endings: [
      {
        id: 'ending_requested',
        title: 'Requested',
        summary: 'Requested ending',
        requiredState: {
          minimumScores: { truth: 1 },
          clues: [],
          items: [],
          flags: {},
        },
      },
      {
        id: 'ending_regular',
        title: 'Regular',
        summary: 'Regular ending',
        requiredState: requirement,
      },
    ],
    hiddenEnding: {
      id: 'ending_hidden',
      title: 'Hidden',
      summary: 'Hidden ending',
      requiredState: {
        minimumScores: {},
        clues: ['clue_reward'],
        items: ['item_reward'],
        flags: {},
      },
      conditions: {
        completedNodeIds: ['side'],
        minimumCompletedNodes: 1,
        sideQuest: { side: 'completed' },
      },
    },
    stateDefinition: {
      initialEffectScores: {
        truth: 0,
        memory: 0,
        empathy: 0,
        courage: 0,
        connection: 0,
      },
      initialClues: ['initial_clue', 'initial_clue'],
      initialItems: ['initial_item', 'initial_item'],
      initialFlags: {},
    },
  }
}

describe('story graph interpreter release coverage', () => {
  it('creates unique initial state and evaluates every requirement type', () => {
    const runtime = createInitialRuntimeState(graph())
    expect(runtime.clues).toEqual(['initial_clue'])
    expect(runtime.items).toEqual(['initial_item'])
    expect(
      meetsStateRequirement(
        {
          minimumScores: { truth: 0 },
          clues: ['initial_clue'],
          items: ['initial_item'],
          flags: {},
        },
        runtime,
      ),
    ).toBe(true)
    expect(
      meetsStateRequirement(
        {
          minimumScores: { truth: 1 },
          clues: ['missing'],
          items: ['missing'],
          flags: { missing: true },
        },
        runtime,
      ),
    ).toBe(false)
  })

  it('filters locked and already submitted choices', () => {
    const currentGraph = graph()
    const runtime = createInitialRuntimeState(currentGraph)
    expect(
      getAvailableChoices(currentGraph, currentGraph.nodes[0]!, runtime).map(
        (choice) => choice.id,
      ),
    ).toEqual(['eligible'])
    expect(
      getAvailableChoices(currentGraph, currentGraph.nodes[0]!, {
        ...runtime,
        submittedChoiceNodeIds: ['start'],
      }),
    ).toEqual([])
  })

  it('applies choice effects once and resolves choice, next and fallback edges', () => {
    const currentGraph = graph()
    const start = currentGraph.nodes[0]!
    const initial = createInitialRuntimeState(currentGraph)
    const selected = applyChoiceEffects(
      initial,
      start,
      start.choices[0]!,
    )
    expect(selected.effectScores).toEqual({
      truth: 2,
      memory: 1,
      empathy: 1,
      courage: 1,
      connection: 1,
    })
    expect(selected.clues).toContain('clue_choice')
    expect(selected.items).toContain('item_choice')
    expect(selected.flags).toMatchObject({
      choiceMade: true,
      'sideQuest:side:unlocked': true,
    })
    expect(resolveNextNode(currentGraph, start, selected)?.id).toBe('side')
    expect(applyChoiceEffects(selected, start, start.choices[0]!)).toBe(
      selected,
    )

    expect(resolveNextNode(currentGraph, start, initial)?.id).toBe('normal')
    expect(
      resolveNextNode(currentGraph, {
        ...start,
        next: 'locked',
      }, initial)?.id,
    ).toBe('fallback')
    expect(
      resolveNextNode(
        currentGraph,
        { ...start, next: null, fallbackNext: null, choices: [] },
        initial,
      ),
    ).toBeNull()
  })

  it('applies rewards once and calculates hidden, requested and incomplete endings', () => {
    const currentGraph = graph()
    const initial = createInitialRuntimeState(currentGraph)
    const sideRewarded = applyNodeRewards(initial, currentGraph.nodes[1]!)
    const normalRewarded = applyNodeRewards(
      sideRewarded,
      currentGraph.nodes[3]!,
    )
    expect(normalRewarded.completedNodeIds).toEqual(['side', 'normal'])
    expect(normalRewarded.clueSources.clue_reward).toBe('normal')
    expect(
      applyNodeRewards(normalRewarded, currentGraph.nodes[3]!),
    ).toBe(normalRewarded)
    expect(resolveEnding(currentGraph, normalRewarded).id).toBe(
      'ending_hidden',
    )
    expect(isEndingReachable(currentGraph.hiddenEnding!, normalRewarded)).toBe(
      true,
    )

    const requested = {
      ...normalRewarded,
      completedNodeIds: ['normal'],
    }
    expect(resolveEnding(currentGraph, requested).id).toBe(
      'ending_requested',
    )
    expect(resolveEnding(currentGraph, initial, true).id).toBe(
      'ending_incomplete',
    )
  })

  it('derives every side quest status and honors explicit ending conditions', () => {
    const runtime = {
      ...createInitialRuntimeState(graph()),
      completedNodeIds: ['complete_side'],
      sideQuestReturnNodeIds: ['return_side'],
      declinedSideQuestNodeIds: ['declined_side'],
      flags: {
        'sideQuest:complete_side:unlocked': true,
        'sideQuest:flag_complete:completed': true,
        'sideQuest:unlocked_side:unlocked': true,
      },
    }
    const input = createEndingCalculationInput(runtime)
    expect(input.sideQuest).toEqual({
      complete_side: 'completed',
      declined_side: 'declined',
      flag_complete: 'completed',
      return_side: 'unlocked',
      unlocked_side: 'unlocked',
    })
    expect(
      calculateEnding(
        {
          ...graph(),
          hiddenEnding: null,
          endings: [
            {
              id: 'conditioned',
              title: 'Conditioned',
              summary: 'Conditioned',
              requiredState: requirement,
              conditions: {
                completedNodeIds: ['complete_side'],
                minimumCompletedNodes: 1,
                sideQuest: { declined_side: 'declined' },
              },
            },
          ],
        },
        input,
      ).id,
    ).toBe('conditioned')
  })

  it('validates malformed schemas and cross-reference corruption', () => {
    const currentGraph = graph()
    expect(validateRuntimeState(currentGraph, null).success).toBe(false)
    const initial = createInitialRuntimeState(currentGraph)
    const invalid = validateRuntimeState(currentGraph, {
      ...initial,
      currentNodeId: 'missing',
      completedNodeIds: ['missing', 'missing'],
      completedTaskIds: ['missing_task', 'missing_task'],
      rewardedNodeIds: ['missing', 'missing'],
      submittedChoiceNodeIds: ['start', 'start'],
      selectedChoices: {
        start: 'missing_choice',
        orphan: 'choice',
      },
    })
    expect(invalid.success).toBe(false)
    if (!invalid.success) {
      expect(invalid.errors).toEqual(
        expect.arrayContaining([
          'Current node is missing',
          'completedNodeIds contains duplicates',
          'completedTaskIds contains duplicates',
          'submittedChoiceNodeIds contains duplicates',
          'rewardedNodeIds contains duplicates',
          'Completed node is missing: missing',
          'Rewarded node is missing: missing',
          'Completed task is missing: missing_task',
          'Selected choice is invalid for node: start',
          'Choice exists without a submitted node: orphan',
        ]),
      )
    }
    expect(validateRuntimeState(currentGraph, initial).success).toBe(true)
  })
})
