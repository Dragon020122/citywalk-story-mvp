import {
  PersistedGameplaySnapshotSchema,
  validateRuntimeState,
  type GameplayState,
  type ResumableGameplayState,
  type StoryGraph,
  type StoryRuntimeState,
} from '@citywalk/shared'

export const GAMEPLAY_SNAPSHOT_KEY_PREFIX = 'citywalk.gameplay.v1.'

export interface RestoredGameplay {
  state: GameplayState
  resumeState: ResumableGameplayState
  runtime: StoryRuntimeState
}

const keyFor = (storyId: string) => `${GAMEPLAY_SNAPSHOT_KEY_PREFIX}${storyId}`

export function loadGameplay(
  storyId: string,
  graph: StoryGraph,
): RestoredGameplay | null {
  const raw = window.localStorage.getItem(keyFor(storyId))
  if (!raw) return null

  try {
    const parsed = PersistedGameplaySnapshotSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.storyId !== storyId) {
      window.localStorage.removeItem(keyFor(storyId))
      return null
    }
    const validated = validateRuntimeState(graph, parsed.data.runtime)
    if (!validated.success) {
      window.localStorage.removeItem(keyFor(storyId))
      return null
    }
    return {
      state: parsed.data.state,
      resumeState: parsed.data.resumeState,
      runtime: validated.data,
    }
  } catch {
    window.localStorage.removeItem(keyFor(storyId))
    return null
  }
}

export function saveGameplay(
  storyId: string,
  state: GameplayState,
  runtime: StoryRuntimeState,
  resumeState: ResumableGameplayState = 'navigating',
) {
  const snapshot = PersistedGameplaySnapshotSchema.parse({
    version: 1,
    storyId,
    state,
    resumeState,
    runtime,
  })
  window.localStorage.setItem(keyFor(storyId), JSON.stringify(snapshot))
}

export function clearGameplay(storyId: string) {
  window.localStorage.removeItem(keyFor(storyId))
}
