import {
  applyChoiceEffects,
  applyNodeRewards,
  createInitialRuntimeState,
  getAvailableChoices,
  resolveEnding,
  resolveNextNode,
  type GameplayState,
  type StoryGraph,
  type StoryRuntimeState,
} from '@citywalk/shared'
import { assign, setup } from 'xstate'

export type ResumeState = Exclude<
  GameplayState,
  'idle' | 'paused' | 'completed' | 'abandoned' | 'error'
>

export interface GameplayContext {
  graph: StoryGraph
  runtime: StoryRuntimeState
  resumeState: ResumeState
}

export type GameplayEvent =
  | { type: 'START' }
  | { type: 'ARRIVE' }
  | { type: 'READ_ARRIVAL' }
  | { type: 'FINISH_READING' }
  | {
      type: 'COMPLETE_TASK'
      journalText?: string
      localPhotoId?: string
    }
  | { type: 'SUBMIT_CHOICE'; choiceId: string }
  | { type: 'ADVANCE' }
  | { type: 'START_REROUTE' }
  | { type: 'REROUTE_SUCCESS'; graph: StoryGraph }
  | { type: 'REROUTE_FAILURE'; message: string }
  | { type: 'PAUSE'; from: ResumeState }
  | { type: 'RESUME' }
  | { type: 'END_EARLY' }
  | { type: 'FINISH_ENDING' }
  | { type: 'ABANDON' }
  | { type: 'FAIL'; message: string }
  | { type: 'RETRY_NODE' }

const currentNode = (context: GameplayContext) =>
  context.graph.nodes.find((node) => node.id === context.runtime.currentNodeId)

const gameplaySetup = setup({
  types: {
    context: {} as GameplayContext,
    events: {} as GameplayEvent,
  },
  guards: {
    hasTask: ({ context }) => Boolean(currentNode(context)?.task),
    hasChoices: ({ context }) =>
      Boolean(
        currentNode(context) &&
        getAvailableChoices(
          context.graph,
          currentNode(context)!,
          context.runtime,
        ).length,
      ),
    taskCanComplete: ({ context }) => {
      const task = currentNode(context)?.task
      return Boolean(
        task && !context.runtime.completedTaskIds.includes(task.id),
      )
    },
    taskCanCompleteWithChoices: ({ context }) => {
      const node = currentNode(context)
      return Boolean(
        node?.task &&
        !context.runtime.completedTaskIds.includes(node.task.id) &&
        getAvailableChoices(context.graph, node, context.runtime).length > 0,
      )
    },
    choiceCanSubmit: ({ context, event }) => {
      if (event.type !== 'SUBMIT_CHOICE') return false
      const node = currentNode(context)
      return Boolean(
        node &&
        getAvailableChoices(context.graph, node, context.runtime).some(
          (choice) => choice.id === event.choiceId,
        ),
      )
    },
    hasNextNode: ({ context }) => {
      const node = currentNode(context)
      return Boolean(
        node && resolveNextNode(context.graph, node, context.runtime),
      )
    },
    resumeNavigating: ({ context }) => context.resumeState === 'navigating',
    resumeArrived: ({ context }) => context.resumeState === 'arrived',
    resumeReading: ({ context }) => context.resumeState === 'reading',
    resumeTasking: ({ context }) => context.resumeState === 'tasking',
    resumeChoosing: ({ context }) => context.resumeState === 'choosing',
    resumeNodeCompleted: ({ context }) =>
      context.resumeState === 'node_completed',
    resumeRerouting: ({ context }) => context.resumeState === 'rerouting',
    resumeEnding: ({ context }) => context.resumeState === 'ending',
  },
  actions: {
    completeTask: assign({
      runtime: ({ context, event }) => {
        if (event.type !== 'COMPLETE_TASK') return context.runtime
        const task = currentNode(context)?.task
        if (!task || context.runtime.completedTaskIds.includes(task.id)) {
          return context.runtime
        }
        return {
          ...context.runtime,
          completedTaskIds: [...context.runtime.completedTaskIds, task.id],
          journalEntries: event.journalText
            ? [
                ...context.runtime.journalEntries,
                {
                  nodeId: context.runtime.currentNodeId,
                  text: event.journalText,
                },
              ]
            : context.runtime.journalEntries,
          localPhotoIds: event.localPhotoId
            ? [...context.runtime.localPhotoIds, event.localPhotoId]
            : context.runtime.localPhotoIds,
        }
      },
    }),
    submitChoice: assign({
      runtime: ({ context, event }) => {
        if (event.type !== 'SUBMIT_CHOICE') return context.runtime
        const node = currentNode(context)
        const choice = node?.choices.find(
          (candidate) => candidate.id === event.choiceId,
        )
        return node && choice
          ? applyChoiceEffects(context.runtime, node, choice)
          : context.runtime
      },
    }),
    rewardNode: assign({
      runtime: ({ context }) => {
        const node = currentNode(context)
        return node ? applyNodeRewards(context.runtime, node) : context.runtime
      },
    }),
    advanceNode: assign({
      runtime: ({ context }) => {
        const node = currentNode(context)
        const next = node
          ? resolveNextNode(context.graph, node, context.runtime)
          : null
        return next
          ? { ...context.runtime, currentNodeId: next.id, error: null }
          : context.runtime
      },
    }),
    resolveCompleteEnding: assign({
      runtime: ({ context }) => {
        const ending = resolveEnding(context.graph, context.runtime)
        return {
          ...context.runtime,
          endingId: ending.id,
          endingTitle: ending.title,
          endingSummary: ending.summary,
        }
      },
    }),
    resolveIncompleteEnding: assign({
      runtime: ({ context }) => {
        const ending = resolveEnding(context.graph, context.runtime, true)
        return {
          ...context.runtime,
          endingId: ending.id,
          endingTitle: ending.title,
          endingSummary: ending.summary,
        }
      },
    }),
    rememberResumeState: assign({
      resumeState: ({ context, event }) =>
        event.type === 'PAUSE' ? event.from : context.resumeState,
    }),
    replaceGraph: assign({
      graph: ({ context, event }) =>
        event.type === 'REROUTE_SUCCESS' ? event.graph : context.graph,
    }),
    setError: assign({
      runtime: ({ context, event }) => ({
        ...context.runtime,
        error:
          event.type === 'FAIL' || event.type === 'REROUTE_FAILURE'
            ? event.message
            : '未知运行时错误',
      }),
    }),
    recoverNode: assign({
      runtime: ({ context }) => {
        const node = currentNode(context)
        const fallback = node?.fallbackNext
          ? context.graph.nodes.find(
              (candidate) => candidate.id === node.fallbackNext,
            )
          : undefined
        return {
          ...context.runtime,
          currentNodeId: fallback?.id ?? context.runtime.currentNodeId,
          error: null,
        }
      },
    }),
  },
})

const pausable = {
  PAUSE: {
    target: 'paused',
    actions: 'rememberResumeState',
  },
  END_EARLY: {
    target: 'ending',
    actions: 'resolveIncompleteEnding',
  },
  ABANDON: 'abandoned',
  FAIL: {
    target: 'error',
    actions: 'setError',
  },
} as const

export function createGameplayMachine(
  graph: StoryGraph,
  runtime = createInitialRuntimeState(graph),
  initialState: GameplayState = 'idle',
  resumeState: ResumeState = 'navigating',
) {
  return gameplaySetup.createMachine({
    id: 'citywalk-gameplay',
    initial: initialState,
    context: {
      graph,
      runtime,
      resumeState,
    },
    states: {
      idle: {
        on: {
          START: 'navigating',
          END_EARLY: {
            target: 'ending',
            actions: 'resolveIncompleteEnding',
          },
          ABANDON: 'abandoned',
          FAIL: { target: 'error', actions: 'setError' },
        },
      },
      navigating: {
        on: {
          ...pausable,
          ARRIVE: 'arrived',
          START_REROUTE: 'rerouting',
        },
      },
      arrived: {
        on: {
          ...pausable,
          READ_ARRIVAL: 'reading',
        },
      },
      reading: {
        on: {
          ...pausable,
          FINISH_READING: [
            { guard: 'hasTask', target: 'tasking' },
            { guard: 'hasChoices', target: 'choosing' },
            { target: 'node_completed' },
          ],
        },
      },
      tasking: {
        on: {
          ...pausable,
          COMPLETE_TASK: [
            {
              guard: 'taskCanCompleteWithChoices',
              actions: 'completeTask',
              target: 'choosing',
            },
            {
              guard: 'taskCanComplete',
              actions: 'completeTask',
              target: 'node_completed',
            },
          ],
        },
      },
      choosing: {
        on: {
          ...pausable,
          SUBMIT_CHOICE: {
            guard: 'choiceCanSubmit',
            actions: 'submitChoice',
            target: 'node_completed',
          },
        },
      },
      node_completed: {
        entry: 'rewardNode',
        on: {
          ...pausable,
          ADVANCE: [
            {
              guard: 'hasNextNode',
              actions: 'advanceNode',
              target: 'navigating',
            },
            {
              actions: 'resolveCompleteEnding',
              target: 'ending',
            },
          ],
        },
      },
      rerouting: {
        on: {
          ...pausable,
          REROUTE_SUCCESS: {
            actions: 'replaceGraph',
            target: 'navigating',
          },
          REROUTE_FAILURE: {
            actions: 'setError',
            target: 'error',
          },
        },
      },
      paused: {
        on: {
          RESUME: [
            { guard: 'resumeNavigating', target: 'navigating' },
            { guard: 'resumeArrived', target: 'arrived' },
            { guard: 'resumeReading', target: 'reading' },
            { guard: 'resumeTasking', target: 'tasking' },
            { guard: 'resumeChoosing', target: 'choosing' },
            { guard: 'resumeNodeCompleted', target: 'node_completed' },
            { guard: 'resumeRerouting', target: 'rerouting' },
            { guard: 'resumeEnding', target: 'ending' },
            { target: 'navigating' },
          ],
          ABANDON: 'abandoned',
        },
      },
      ending: {
        on: {
          FINISH_ENDING: 'completed',
          ABANDON: 'abandoned',
        },
      },
      completed: { type: 'final' },
      abandoned: { type: 'final' },
      error: {
        on: {
          RETRY_NODE: {
            actions: 'recoverNode',
            target: 'navigating',
          },
          END_EARLY: {
            actions: 'resolveIncompleteEnding',
            target: 'ending',
          },
          ABANDON: 'abandoned',
        },
      },
    },
  })
}
