import { describe, expect, it, vi } from 'vitest'
import { db } from './database'
import {
  BASE_RETRY_DELAY_MS,
  enqueueSync,
  processSyncQueue,
  queueFeedback,
} from './sync-queue'

describe('离线同步队列', () => {
  it('成功后删除队列记录', async () => {
    await queueFeedback({
      storyId: 'story_test',
      routePackId: 'mock_route',
      overallRating: 5,
      storyCoherence: 4,
      routeQuality: 5,
      taskQuality: 4,
      safetyFeeling: 5,
      likedTags: ['剧情'],
      issueTags: [],
      comment: '',
      fallbackUsed: false,
    })
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
  it('离线时保留经过共享 Schema 校验的匿名反馈', async () => {
    await queueFeedback({
      storyId: 'story_offline_feedback',
      routePackId: 'mock_route',
      overallRating: 4,
      storyCoherence: 4,
      routeQuality: 3,
      taskQuality: 5,
      safetyFeeling: 4,
      likedTags: ['现场任务'],
      issueTags: ['路线绕行'],
      comment: '离线完成后提交',
      fallbackUsed: true,
    })

    const queued = await db.syncQueue.where('kind').equals('feedback').first()
    expect(queued?.payload).toMatchObject({
      storyId: 'story_offline_feedback',
      overallRating: 4,
    })
  })
})
