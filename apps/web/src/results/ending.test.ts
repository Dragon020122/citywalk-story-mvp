import {
  calculateEnding,
  createInitialRuntimeState,
  type EndingCalculationInput,
} from '@citywalk/shared'
import { describe, expect, it } from 'vitest'
import { testGenerationResult } from '../test/generation-fixture'

describe('deterministic ending calculation', () => {
  it('uses scores, clues, items, flags, side quests and completed nodes without mutation', () => {
    const baseGraph = testGenerationResult.story.storyGraph
    const graph = {
      ...baseGraph,
      endings: [
        {
          id: 'ending_complete_archive',
          title: '完整归档',
          summary: '所有关键条件均已满足。',
          requiredState: {
            minimumScores: { truth: 2 },
            clues: ['clue_key'],
            items: ['item_key'],
            flags: { archiveOpen: true },
          },
          conditions: {
            completedNodeIds: ['node_intro'],
            minimumCompletedNodes: 1,
            sideQuest: { side_archive: 'completed' as const },
          },
        },
        ...baseGraph.endings,
      ],
    }
    const input: EndingCalculationInput = {
      effectScores: {
        truth: 2,
        memory: 0,
        empathy: 0,
        courage: 0,
        connection: 0,
      },
      clues: ['clue_key'],
      items: ['item_key'],
      flags: { archiveOpen: true },
      sideQuest: { side_archive: 'completed' },
      completedNodeIds: ['node_intro'],
    }
    const before = JSON.stringify(input)

    expect(calculateEnding(graph, input).id).toBe('ending_complete_archive')
    expect(calculateEnding(graph, input)).toEqual(calculateEnding(graph, input))
    expect(JSON.stringify(input)).toBe(before)
  })

  it('keeps the existing runtime resolver compatible', () => {
    const graph = testGenerationResult.story.storyGraph
    expect(createInitialRuntimeState(graph).endingId).toBeNull()
  })
})
