import {
  createInitialRuntimeState,
  type GameplayState,
  type StoryGraph,
} from '@citywalk/shared'
import { useActorRef, useSelector } from '@xstate/react'
import { useEffect, useRef } from 'react'
import { createGameplayMachine } from './gameplay-machine'
import { scheduleGameplaySave, type RestoredGameplay } from './gameplay-storage'

export function useGameplay(
  storyId: string,
  graph: StoryGraph,
  restored: RestoredGameplay | null,
) {
  const machineRef = useRef<ReturnType<typeof createGameplayMachine> | null>(
    null,
  )
  machineRef.current ??= createGameplayMachine(
    graph,
    restored?.runtime ?? createInitialRuntimeState(graph),
    restored?.state ?? 'idle',
    restored?.resumeState ?? 'navigating',
  )
  const actorRef = useActorRef(machineRef.current)
  const snapshot = useSelector(actorRef, (value) => value)
  const state = snapshot.value as GameplayState

  useEffect(() => {
    const persist = (value: ReturnType<typeof actorRef.getSnapshot>) => {
      void scheduleGameplaySave(
        storyId,
        value.value as GameplayState,
        value.context.runtime,
        value.context.resumeState,
      )
    }
    persist(actorRef.getSnapshot())
    const subscription = actorRef.subscribe(persist)
    return () => subscription.unsubscribe()
  }, [actorRef, storyId])

  useEffect(() => {
    const saveNow = () => {
      void scheduleGameplaySave(
        storyId,
        state,
        snapshot.context.runtime,
        snapshot.context.resumeState,
      )
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', saveNow)
    window.addEventListener('beforeunload', saveNow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', saveNow)
      window.removeEventListener('beforeunload', saveNow)
    }
  }, [snapshot.context.resumeState, snapshot.context.runtime, state, storyId])

  return {
    state,
    graph: snapshot.context.graph,
    runtime: snapshot.context.runtime,
    send: actorRef.send,
  }
}
