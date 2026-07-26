import Dexie, { type EntityTable, type Transaction } from 'dexie'

export type LocalStoryStatus =
  'ready' | 'in_progress' | 'completed' | 'abandoned'

export interface StoryRecord {
  id: string
  title: string
  status: LocalStoryStatus
  createdAt: string
  updatedAt: string
  completedAt: string | null
  generation: unknown
}

export interface StoryRunRecord {
  storyId: string
  state: string
  resumeState: string
  runtime: unknown
  updatedAt: string
}

export interface JournalEntryRecord {
  id: string
  storyId: string
  nodeId: string
  text: string
  createdAt: string
}

export interface LocalPhotoRecord {
  id: string
  storyId: string
  nodeId: string
  taskId: string
  blob: Blob
  mimeType: 'image/jpeg' | 'image/webp'
  width: number
  height: number
  size: number
  createdAt: string
}

export interface DraftPreferencesRecord {
  id: 'draft' | 'pending'
  step: number | null
  values: unknown
  schemaVersion?: number
  updatedAt: string
}

export type SyncQueueKind = 'feedback' | 'anonymous_event' | 'story_completion'

export interface SyncQueueRecord {
  id?: number
  kind: SyncQueueKind
  payload: unknown
  attempts: number
  nextAttemptAt: number
  createdAt: string
  lastError: string | null
}

export interface SettingRecord {
  key: string
  value: unknown
  updatedAt: string
}

export interface CorruptRecord {
  id?: number
  sourceTable: string
  sourceKey: string
  raw: unknown
  error: string
  quarantinedAt: string
}

const VERSION_ONE_STORES = {
  stories: '&id, savedAt',
  storyRuns: '&storyId, updatedAt',
  journalEntries: '&id, storyId, nodeId, createdAt',
  localPhotos: '&id, storyId, nodeId, createdAt',
  draftPreferences: '&id, updatedAt',
  syncQueue: '++id, kind, createdAt',
  settings: '&key',
}

const VERSION_TWO_STORES = {
  stories: '&id, updatedAt, status, completedAt',
  storyRuns: '&storyId, updatedAt, state',
  journalEntries: '&id, storyId, nodeId, createdAt',
  localPhotos: '&id, storyId, nodeId, taskId, createdAt',
  draftPreferences: '&id, updatedAt',
  syncQueue: '++id, kind, nextAttemptAt, attempts, createdAt',
  settings: '&key',
  corruptRecords: '++id, sourceTable, sourceKey, quarantinedAt',
}

async function migrateVersionOne(transaction: Transaction) {
  const now = new Date().toISOString()
  await transaction
    .table<Partial<StoryRecord> & { savedAt?: string }, string>('stories')
    .toCollection()
    .modify((story) => {
      story.createdAt ??= story.savedAt ?? now
      story.updatedAt ??= story.savedAt ?? now
      story.status ??= 'ready'
      story.completedAt ??= null
      delete story.savedAt
    })
  await transaction
    .table<Partial<SyncQueueRecord>, number>('syncQueue')
    .toCollection()
    .modify((entry) => {
      entry.attempts ??= 0
      entry.nextAttemptAt ??= 0
      entry.lastError ??= null
    })
}

export class CitywalkDatabase extends Dexie {
  stories!: EntityTable<StoryRecord, 'id'>
  storyRuns!: EntityTable<StoryRunRecord, 'storyId'>
  journalEntries!: EntityTable<JournalEntryRecord, 'id'>
  localPhotos!: EntityTable<LocalPhotoRecord, 'id'>
  draftPreferences!: EntityTable<DraftPreferencesRecord, 'id'>
  syncQueue!: EntityTable<SyncQueueRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  corruptRecords!: EntityTable<CorruptRecord, 'id'>

  constructor(name = 'citywalk-story') {
    super(name)
    this.version(1).stores(VERSION_ONE_STORES)
    this.version(2).stores(VERSION_TWO_STORES).upgrade(migrateVersionOne)
  }
}

export const db = new CitywalkDatabase()

export async function quarantineRecord(options: {
  table:
    | 'stories'
    | 'storyRuns'
    | 'journalEntries'
    | 'localPhotos'
    | 'draftPreferences'
    | 'syncQueue'
    | 'settings'
  key: string | number
  raw: unknown
  error: string
  database?: CitywalkDatabase
}) {
  const database = options.database ?? db
  await database.transaction(
    'rw',
    database.table(options.table),
    database.corruptRecords,
    async () => {
      await database.corruptRecords.add({
        sourceTable: options.table,
        sourceKey: String(options.key),
        raw: options.raw,
        error: options.error,
        quarantinedAt: new Date().toISOString(),
      })
      await database.table(options.table).delete(options.key)
    },
  )
}

export async function deleteStoryCascade(
  storyId: string,
  database = db,
): Promise<void> {
  await database.transaction(
    'rw',
    database.stories,
    database.storyRuns,
    database.journalEntries,
    database.localPhotos,
    async () => {
      await Promise.all([
        database.stories.delete(storyId),
        database.storyRuns.delete(storyId),
        database.journalEntries.where('storyId').equals(storyId).delete(),
        database.localPhotos.where('storyId').equals(storyId).delete(),
      ])
    },
  )
}

export async function resetStoryProgress(
  storyId: string,
  database = db,
): Promise<void> {
  await database.transaction(
    'rw',
    database.stories,
    database.storyRuns,
    database.journalEntries,
    database.localPhotos,
    database.syncQueue,
    async () => {
      await Promise.all([
        database.storyRuns.delete(storyId),
        database.journalEntries.where('storyId').equals(storyId).delete(),
        database.localPhotos.where('storyId').equals(storyId).delete(),
      ])
      const pendingCompletions = await database.syncQueue
        .where('kind')
        .equals('story_completion')
        .filter(
          (entry) =>
            typeof entry.payload === 'object' &&
            entry.payload !== null &&
            'storyId' in entry.payload &&
            entry.payload.storyId === storyId,
        )
        .primaryKeys()
      await database.syncQueue.bulkDelete(pendingCompletions)
      await database.stories.update(storyId, {
        status: 'ready',
        completedAt: null,
        updatedAt: new Date().toISOString(),
      })
    },
  )
}

export async function trimStoryHistory(
  limit = 5,
  database = db,
): Promise<string[]> {
  const staleIds = await database.stories
    .orderBy('updatedAt')
    .reverse()
    .offset(limit)
    .primaryKeys()
  for (const storyId of staleIds) {
    await deleteStoryCascade(storyId, database)
  }
  return staleIds
}
