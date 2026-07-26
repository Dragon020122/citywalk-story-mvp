import { createInitialRuntimeState } from '@citywalk/shared'
import { describe, expect, it } from 'vitest'
import { testGenerationResult } from '../test/generation-fixture'
import { buildResultSummary } from './result-summary'

function summaryWith(overrides: object) {
  const graph = testGenerationResult.story.storyGraph
  return buildResultSummary({
    blueprint: testGenerationResult.story.blueprint,
    graph,
    routePlan: testGenerationResult.routePlan,
    runtime: {
      ...createInitialRuntimeState(graph),
      ...overrides,
    },
  })
}

describe('result summary branches', () => {
  it('uses deterministic role, notes, places and ending fallbacks', () => {
    const summary = summaryWith({
      effectScores: {
        truth: 0,
        memory: 1,
        empathy: 2,
        courage: 3,
        connection: 4,
      },
      completedNodeIds: ['node_intro'],
      completedTaskIds: ['task_1'],
      selectedChoices: { node_intro: 'choice_1' },
      journalEntries: [
        { nodeId: 'node_intro', text: 'a'.repeat(130) },
      ],
    })
    expect(summary.roleTitle).toBe('街巷联结者')
    expect(summary.completedStops).toBe(1)
    expect(summary.completedTasks).toBe(1)
    expect(summary.places).toHaveLength(1)
    expect(summary.noteSummary).toHaveLength(121)
    expect(summary.endingTitle).toBe('未收录结局')
  })

  it.each([
    {
      completedNodeIds: [],
      declinedSideQuestNodeIds: [],
      expected: '未触发或未完成',
    },
    {
      completedNodeIds: [],
      declinedSideQuestNodeIds: ['side'],
      expected: '已婉拒',
    },
    {
      completedNodeIds: ['side'],
      declinedSideQuestNodeIds: [],
      expected: '全部完成',
    },
  ])('summarizes side quest state as $expected', (scenario) => {
    const graph = {
      ...testGenerationResult.story.storyGraph,
      nodes: [
        ...testGenerationResult.story.storyGraph.nodes,
        {
          ...testGenerationResult.story.storyGraph.nodes[0]!,
          id: 'side',
          type: 'side_quest' as const,
        },
      ],
    }
    const runtime = {
      ...createInitialRuntimeState(graph),
      completedNodeIds: scenario.completedNodeIds,
      declinedSideQuestNodeIds: scenario.declinedSideQuestNodeIds,
    }
    expect(
      buildResultSummary({
        blueprint: testGenerationResult.story.blueprint,
        graph,
        routePlan: testGenerationResult.routePlan,
        runtime,
      }).sideQuestStatus,
    ).toBe(scenario.expected)
  })
})
