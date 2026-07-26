import {
  createInitialRuntimeState,
  type GameplayState,
  type StoryGraph,
} from '@citywalk/shared'
import { useActorRef, useSelector } from '@xstate/react'
import { useEffect, useMemo } from 'react'
import { createGameplayMachine } from './gameplay-machine'
import { loadGameplay, saveGameplay } from './gameplay-storage'

export function useGameplay(storyId: string, graph: StoryGraph) {
  const restored = useMemo(() => loadGameplay(storyId, graph), [graph, storyId])
  const machine = useMemo(
    () =>
      createGameplayMachine(
        graph,
        restored?.runtime ?? createInitialRuntimeState(graph),
        restored?.state ?? 'idle',
        restored?.resumeState ?? 'navigating',
      ),
    [graph, restored],
  )
  const actorRef = useActorRef(machine)
  const snapshot = useSelector(actorRef, (value) => value)
  const state = snapshot.value as GameplayState

  useEffect(() => {
    saveGameplay(
      storyId,
      state,
      snapshot.context.runtime,
      snapshot.context.resumeState,
    )
  }, [snapshot.context.resumeState, snapshot.context.runtime, state, storyId])

  return {
    state,
    graph: snapshot.context.graph,
    runtime: snapshot.context.runtime,
    send: actorRef.send,
  }
}
