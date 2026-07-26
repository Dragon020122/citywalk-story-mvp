import type { StoryGraph } from '@citywalk/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { loadGameplay } from '../gameplay/gameplay-storage'
import { listGenerationResults, loadGenerationResult } from '../journey-storage'

export function useStoredStory(storyId?: string) {
  return useLiveQuery(() => loadGenerationResult(storyId), [storyId])
}

export function useStoredGameplay(
  storyId: string | undefined,
  graph: StoryGraph | undefined,
) {
  const graphSignature = graph
    ? graph.nodes
        .map(
          (node) =>
            `${node.id}:${node.poiId ?? ''}:${node.next ?? ''}:${node.fallbackNext ?? ''}`,
        )
        .join('|')
    : ''
  return useLiveQuery(
    () => (storyId && graph ? loadGameplay(storyId, graph) : undefined),
    [storyId, graphSignature],
  )
}

export function useStoryHistory() {
  return useLiveQuery(() => listGenerationResults(), [])
}
