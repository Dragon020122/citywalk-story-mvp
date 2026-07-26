import type { Poi } from '@citywalk/shared'

export interface StoryPoiContext {
  id: string
  name: string
  shortName: string
  address: string
  category: string
  indoor: boolean
  publicAccess: boolean
  estimatedCostCny: number
  stayMinutes: number
  tags: string[]
  moodTags: string[]
  storyHooks: string[]
  taskHooks: string[]
  observationAnchors: string[]
  safetyNotes: string[]
  fallbackPoiIds: string[]
}

export const toStoryPoiContext = (poi: Poi): StoryPoiContext => ({
  id: poi.id,
  name: poi.name,
  shortName: poi.shortName,
  address: poi.address,
  category: poi.category,
  indoor: poi.indoor,
  publicAccess: poi.publicAccess,
  estimatedCostCny: poi.estimatedCostCny,
  stayMinutes: poi.stayMinutes,
  tags: [...poi.tags],
  moodTags: [...poi.moodTags],
  storyHooks: [...poi.storyHooks],
  taskHooks: [...poi.taskHooks],
  observationAnchors: [...poi.observationAnchors],
  safetyNotes: [...poi.safetyNotes],
  fallbackPoiIds: [...poi.fallbackPoiIds],
})
