import {
  AnonymousEventRequestSchema,
  FeedbackRequestSchema,
  StoryCompletionSyncRequestSchema,
} from '@citywalk/shared'
import { apiUrl } from '../api-base'
import { db, type SyncQueueKind, type SyncQueueRecord } from './database'

export const MAX_SYNC_ATTEMPTS = 3
export const BASE_RETRY_DELAY_MS = 1_000

export type SyncHandler = (entry: SyncQueueRecord) => Promise<void>

export async function enqueueSync(
  kind: SyncQueueKind,
  payload: unknown,
): Promise<number> {
  const id = await db.syncQueue.add({
    kind,
    payload,
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: new Date().toISOString(),
    lastError: null,
  })
  if (id === undefined) throw new Error('无法创建同步队列记录')
  return id
}

export async function queueFeedback(payload: unknown) {
  return enqueueSync('feedback', FeedbackRequestSchema.parse(payload))
}

export async function queueAnonymousEvent(
  eventName: string,
  properties: Record<string, boolean | number | string> = {},
) {
  return enqueueSync(
    'anonymous_event',
    AnonymousEventRequestSchema.parse({
      eventName,
      occurredAt: new Date().toISOString(),
      properties,
    }),
  )
}

async function postSync(path: string, payload: unknown) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`同步失败（HTTP ${response.status}）`)
  }
}

export const defaultSyncHandler: SyncHandler = async (entry) => {
  switch (entry.kind) {
    case 'feedback':
      await postSync('/v1/feedback', FeedbackRequestSchema.parse(entry.payload))
      break
    case 'anonymous_event':
      await postSync(
        '/v1/events',
        AnonymousEventRequestSchema.parse(entry.payload),
      )
      break
    case 'story_completion': {
      const payload = StoryCompletionSyncRequestSchema.parse(entry.payload)
      await postSync(
        `/v1/stories/${encodeURIComponent(payload.storyId)}/completion`,
        payload,
      )
      break
    }
  }
}

export async function processSyncQueue(
  options: {
    handler?: SyncHandler
    now?: number
  } = {},
) {
  const handler = options.handler ?? defaultSyncHandler
  const now = options.now ?? Date.now()
  const due = await db.syncQueue
    .where('nextAttemptAt')
    .belowOrEqual(now)
    .and((entry) => entry.attempts < MAX_SYNC_ATTEMPTS)
    .sortBy('createdAt')

  let succeeded = 0
  let failed = 0
  for (const entry of due) {
    if (entry.id === undefined) continue
    try {
      await handler(entry)
      await db.syncQueue.delete(entry.id)
      succeeded += 1
    } catch (reason) {
      const attempts = entry.attempts + 1
      await db.syncQueue.update(entry.id, {
        attempts,
        nextAttemptAt:
          attempts >= MAX_SYNC_ATTEMPTS
            ? Number.MAX_SAFE_INTEGER
            : now + BASE_RETRY_DELAY_MS * 2 ** (attempts - 1),
        lastError: reason instanceof Error ? reason.message : '未知同步错误',
      })
      failed += 1
    }
  }
  return { processed: due.length, succeeded, failed }
}

export function installOnlineSync() {
  const process = () => {
    if (navigator.onLine) void processSyncQueue()
  }
  window.addEventListener('online', process)
  process()
  return () => window.removeEventListener('online', process)
}
