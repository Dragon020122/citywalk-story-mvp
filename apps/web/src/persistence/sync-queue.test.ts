import { describe, expect, it, vi } from 'vitest'
import { db } from './database'
import {
  BASE_RETRY_DELAY_MS,
  enqueueSync,
  processSyncQueue,
} from './sync-queue'

describe('离线同步队列', () => {
  it('成功后删除队列记录', async () => {
    await enqueueSync('feedback', { storyId: 'story_test', rating: 5 })
    const handler = vi.fn().mockResolvedValue(undefined)
    await processSyncQueue({ handler, now: 1_000 })
    expect(handler).toHaveBeenCalledOnce()
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('失败按指数退避且最多重试三次', async () => {
    const id = await enqueueSync('anonymous_event', { name: 'offline_open' })
    const handler = vi.fn().mockRejectedValue(new Error('offline'))
    let now = 1_000

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await processSyncQueue({ handler, now })
      const entry = await db.syncQueue.get(id)
      expect(entry?.attempts).toBe(attempt)
      now =
        attempt < 3
          ? 1_000 + BASE_RETRY_DELAY_MS * (attempt === 1 ? 1 : 1 + 2)
          : Number.MAX_SAFE_INTEGER
    }

    await processSyncQueue({ handler, now: Number.MAX_SAFE_INTEGER })
    expect(handler).toHaveBeenCalledTimes(3)
    expect((await db.syncQueue.get(id))?.nextAttemptAt).toBe(
      Number.MAX_SAFE_INTEGER,
    )
  })
})
