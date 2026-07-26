import { describe, expect, it, vi } from 'vitest'
import { db } from './database'
import {
  BASE_RETRY_DELAY_MS,
  enqueueSync,
  processSyncQueue,
  queueAnonymousEvent,
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

  it('默认处理器向三个受校验的 API 路径同步 JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    await queueAnonymousEvent('offline_open', { cachedStories: 1 })
    await enqueueSync('story_completion', {
      storyId: 'story_sync',
      endingId: 'ending_sync',
      completedAt: '2026-07-26T08:00:00+08:00',
    })
    await queueFeedback({
      storyId: 'story_sync',
      routePackId: 'mock_route',
      overallRating: 5,
      storyCoherence: 5,
      routeQuality: 5,
      taskQuality: 5,
      safetyFeeling: 5,
      likedTags: [],
      issueTags: [],
      comment: '',
      fallbackUsed: false,
    })

    await expect(processSyncQueue()).resolves.toMatchObject({
      processed: 3,
      succeeded: 3,
      failed: 0,
    })
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/v1/events',
      '/v1/stories/story_sync/completion',
      '/v1/feedback',
    ])
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method === 'POST'),
    ).toBe(true)
  })

  it('默认处理器将非成功 HTTP 响应留在队列重试', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    )
    await queueAnonymousEvent('offline_open')
    const result = await processSyncQueue({ now: 2_000 })
    expect(result.failed).toBe(1)
    expect((await db.syncQueue.toArray())[0]?.lastError).toContain('503')
  })
})
