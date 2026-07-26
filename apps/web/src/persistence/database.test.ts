import Dexie from 'dexie'
import { createInitialRuntimeState } from '@citywalk/shared'
import { describe, expect, it } from 'vitest'
import {
  listGenerationResults,
  loadGenerationResult,
  saveGenerationResult,
  type GenerationResult,
} from '../journey-storage'
import { loadGameplay, saveGameplay } from '../gameplay/gameplay-storage'
import { testGenerationResult } from '../test/generation-fixture'
import { CitywalkDatabase, db, resetStoryProgress } from './database'

function result(id: string, savedAt: string): GenerationResult {
  return {
    ...testGenerationResult,
    story: {
      ...testGenerationResult.story,
      blueprint: {
        ...testGenerationResult.story.blueprint,
        storyId: id,
        title: `故事 ${id}`,
      },
    },
    savedAt,
  }
}

describe('Dexie 离线数据库', () => {
  it('从 v1 迁移并补齐故事与同步队列字段', async () => {
    const name = `citywalk-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      stories: '&id, savedAt',
      storyRuns: '&storyId, updatedAt',
      journalEntries: '&id, storyId, nodeId, createdAt',
      localPhotos: '&id, storyId, nodeId, createdAt',
      draftPreferences: '&id, updatedAt',
      syncQueue: '++id, kind, createdAt',
      settings: '&key',
    })
    await legacy.table('stories').put({
      id: 'story_legacy',
      title: '旧故事',
      savedAt: '2026-07-20T08:00:00.000Z',
      generation: result('story_legacy', '2026-07-20T08:00:00.000Z'),
    })
    await legacy.table('syncQueue').add({
      kind: 'feedback',
      payload: {},
      createdAt: '2026-07-20T08:00:00.000Z',
    })
    legacy.close()

    const migrated = new CitywalkDatabase(name)
    await migrated.open()
    expect(await migrated.stories.get('story_legacy')).toMatchObject({
      status: 'ready',
      updatedAt: '2026-07-20T08:00:00.000Z',
      completedAt: null,
    })
    expect((await migrated.syncQueue.toArray())[0]).toMatchObject({
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
    })
    await migrated.delete()
  })

  it('离线关闭并重新打开后恢复故事和运行状态', async () => {
    const story = result('story_offline', '2026-07-26T08:00:00.000Z')
    await saveGenerationResult(story)
    const runtime = createInitialRuntimeState(story.story.storyGraph)
    await saveGameplay('story_offline', 'reading', runtime, 'reading')
    db.close()
    await db.open()

    expect(await loadGenerationResult('story_offline')).toEqual(story)
    expect(
      await loadGameplay('story_offline', story.story.storyGraph),
    ).toMatchObject({
      state: 'reading',
      resumeState: 'reading',
      runtime,
    })
  })

  it('隔离损坏记录且不阻止其余故事加载', async () => {
    await db.stories.put({
      id: 'story_corrupt',
      title: '损坏故事',
      status: 'ready',
      createdAt: '2026-07-26T08:00:00.000Z',
      updatedAt: '2026-07-26T08:00:00.000Z',
      completedAt: null,
      generation: { broken: true },
    })

    await expect(loadGenerationResult('story_corrupt')).resolves.toBeNull()
    expect(await db.stories.get('story_corrupt')).toBeUndefined()
    expect(await db.corruptRecords.count()).toBe(1)
  })

  it('只保留最近五条并级联删除旧运行数据', async () => {
    for (let index = 0; index < 6; index += 1) {
      const id = `story_${index}`
      const savedAt = `2026-08-${String(10 + index).padStart(2, '0')}T08:00:00.000Z`
      await saveGenerationResult(result(id, savedAt))
      await saveGameplay(
        id,
        'reading',
        createInitialRuntimeState(testGenerationResult.story.storyGraph),
        'reading',
      )
    }

    const history = await listGenerationResults()
    expect(history.map(({ record }) => record.id)).toEqual([
      'story_5',
      'story_4',
      'story_3',
      'story_2',
      'story_1',
    ])
    expect(await db.storyRuns.get('story_0')).toBeUndefined()
  })

  it('故事完成状态只入同步队列一次', async () => {
    const story = result('story_complete', '2026-07-26T08:00:00.000Z')
    await saveGenerationResult(story)
    const runtime = createInitialRuntimeState(story.story.storyGraph)
    await saveGameplay('story_complete', 'completed', runtime, 'ending')
    await saveGameplay('story_complete', 'completed', runtime, 'ending')

    expect(
      await db.syncQueue.where('kind').equals('story_completion').count(),
    ).toBe(1)
  })
  it('重新开始时清理运行状态、私人内容和待同步完成事件', async () => {
    const story = result('story_replay', '2026-07-26T08:00:00.000Z')
    await saveGenerationResult(story)
    const runtime = {
      ...createInitialRuntimeState(story.story.storyGraph),
      journalEntries: [{ nodeId: 'node_intro', text: '私人笔记' }],
    }
    await saveGameplay('story_replay', 'completed', runtime, 'ending')
    await db.localPhotos.put({
      id: 'local_photo_replay',
      storyId: 'story_replay',
      nodeId: 'node_intro',
      taskId: 'task_1',
      blob: new Blob(['photo'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      width: 1,
      height: 1,
      size: 5,
      createdAt: '2026-07-26T08:10:00.000Z',
    })

    await resetStoryProgress('story_replay')

    expect(await db.storyRuns.get('story_replay')).toBeUndefined()
    expect(
      await db.journalEntries.where('storyId').equals('story_replay').count(),
    ).toBe(0)
    expect(
      await db.localPhotos.where('storyId').equals('story_replay').count(),
    ).toBe(0)
    expect(
      await db.syncQueue.where('kind').equals('story_completion').count(),
    ).toBe(0)
    expect(await db.stories.get('story_replay')).toMatchObject({
      status: 'ready',
      completedAt: null,
    })
  })
})
