import {
  PersistedGameplaySnapshotSchema,
  validateRuntimeState,
  type GameplayState,
  type ResumableGameplayState,
  type StoryGraph,
  type StoryRuntimeState,
} from '@citywalk/shared'
import {
  db,
  quarantineRecord,
  type LocalStoryStatus,
  type StoryRunRecord,
} from '../persistence/database'

export interface RestoredGameplay {
  state: GameplayState
  resumeState: ResumableGameplayState
  runtime: StoryRuntimeState
}

let writeChain: Promise<void> = Promise.resolve()

function runStatus(state: GameplayState): LocalStoryStatus {
  if (state === 'completed') return 'completed'
  if (state === 'abandoned') return 'abandoned'
  return 'in_progress'
}

export async function loadGameplay(
  storyId: string,
  graph: StoryGraph,
): Promise<RestoredGameplay | null> {
  const record = await db.storyRuns.get(storyId)
  if (!record) return null
  const parsed = PersistedGameplaySnapshotSchema.safeParse({
    version: 1,
    storyId,
    state: record.state,
    resumeState: record.resumeState,
    runtime: record.runtime,
  })
  if (!parsed.success) {
    await quarantineRecord({
      table: 'storyRuns',
      key: storyId,
      raw: record,
      error: parsed.error.message,
    })
    return null
  }
  const validated = validateRuntimeState(graph, parsed.data.runtime)
  if (!validated.success) {
    await quarantineRecord({
      table: 'storyRuns',
      key: storyId,
      raw: record,
      error: validated.errors.join('; '),
    })
    return null
  }
  return {
    state: parsed.data.state,
    resumeState: parsed.data.resumeState,
    runtime: validated.data,
  }
}

export async function saveGameplay(
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
  const now = new Date().toISOString()

  await db.transaction(
    'rw',
    db.storyRuns,
    db.stories,
    db.journalEntries,
    db.syncQueue,
    async () => {
      const previousStory = await db.stories.get(storyId)
      const record: StoryRunRecord = {
        storyId,
        state,
        resumeState,
        runtime: snapshot.runtime,
        updatedAt: now,
      }
      await db.storyRuns.put(record)

      if (previousStory) {
        const status = runStatus(state)
        await db.stories.update(storyId, {
          status,
          updatedAt: now,
          completedAt: status === 'completed' ? now : previousStory.completedAt,
        })
        if (status === 'completed' && previousStory.status !== 'completed') {
          await db.syncQueue.add({
            kind: 'story_completion',
            payload: {
              storyId,
              endingId: runtime.endingId,
              completedAt: now,
            },
            attempts: 0,
            nextAttemptAt: 0,
            createdAt: now,
            lastError: null,
          })
        }
      }

      await db.journalEntries.where('storyId').equals(storyId).delete()
      if (runtime.journalEntries.length) {
        await db.journalEntries.bulkPut(
          runtime.journalEntries.map((entry, index) => ({
            id: `${storyId}:${entry.nodeId}:${index}`,
            storyId,
            nodeId: entry.nodeId,
            text: entry.text,
            createdAt: now,
          })),
        )
      }
    },
  )
}

export function scheduleGameplaySave(
  storyId: string,
  state: GameplayState,
  runtime: StoryRuntimeState,
  resumeState: ResumableGameplayState,
) {
  writeChain = writeChain
    .catch(() => undefined)
    .then(() => saveGameplay(storyId, state, runtime, resumeState))
  return writeChain
}

export async function flushGameplaySaves() {
  await writeChain
}

export async function clearGameplay(storyId: string) {
  await db.storyRuns.delete(storyId)
}
