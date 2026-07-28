import {
  GenerateStoryRequestSchema,
  GenerateStoryResponseSchema,
  PlanRouteRequestSchema,
  type GenerateStoryRequest,
  type GenerateStoryResponse,
} from './api.js'
import type { JourneyPreferences } from './journey.js'
import type { Poi } from './poi.js'
import { RoutePlanSchema, type RoutePlan } from './route.js'
import { estimateRouteCost, selectRoutePois } from './route-engine.js'

const emptyRequirement = () => ({
  minimumScores: {},
  clues: [],
  items: [],
  flags: {},
})
const emptyReward = () => ({ scores: {}, clues: [], items: [], flags: {} })

const stableHash = (value: string): string => {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619)
  }
  return (hash >>> 0).toString(16)
}

export const getMockPois = (routePackId: string): Poi[] =>
  Array.from({ length: 5 }, (_, index) => {
    const number = index + 1
    const indoor = number === 2 || number === 5
    return {
      id: `mock_${routePackId.replace(/[^a-z0-9]/giu, '_')}_${number}`,
      routePackId,
      name: `Mock stop ${number}`,
      shortName: `Mock ${number}`,
      address: `Development-only mock location ${number}`,
      longitude: 121.43 + number * 0.002,
      latitude: 31.21 + number * 0.002,
      category: indoor ? 'mock_indoor' : 'mock_outdoor',
      indoor,
      publicAccess: true,
      estimatedCostCny: indoor ? (number === 5 ? 100 : 50) : 0,
      stayMinutes: indoor ? 20 : 15,
      walkMinutes: 5,
      tags: ['development', 'mock'],
      moodTags: ['quiet', 'urban'],
      storyHooks: ['fiction-only'],
      taskHooks: ['observe-detail'],
      observationAnchors: ['shape', 'color'],
      safetyNotes: ['remain-in-public-space'],
      verificationStatus: 'mock',
      verifiedAt: null,
      sourceUrls: [],
      fallbackPoiIds: [],
    }
  })

export const planMockRoute = (
  preferencesInput: JourneyPreferences,
): RoutePlan => {
  const preferences = PlanRouteRequestSchema.parse({
    preferences: preferencesInput,
  }).preferences
  const selection = selectRoutePois({
    preferences,
    pois: getMockPois(preferences.routePackId),
    contentMode: 'mock',
  })
  const selectedPois = selection.selectedPois
  const routeSegments = selectedPois.slice(1).map((poi, index) => {
    const from = selectedPois[index]!
    const walkMeters = 375
    return {
      fromPoiId: from.id,
      toPoiId: poi.id,
      walkMeters,
      walkMinutes: 5,
      polyline: [
        { longitude: from.longitude, latitude: from.latitude },
        { longitude: poi.longitude, latitude: poi.latitude },
      ],
      source: 'manual' as const,
    }
  })
  const totalWalkMinutes = routeSegments.reduce(
    (total, segment) => total + segment.walkMinutes,
    0,
  )
  const totalStayMinutes = selectedPois.reduce(
    (total, poi) => total + poi.stayMinutes,
    0,
  )
  return RoutePlanSchema.parse({
    routeId: `route_mock_${stableHash(JSON.stringify(preferences))}`,
    routePackId: preferences.routePackId,
    selectedPois,
    alternativePois: selection.alternativePois,
    routeSegments,
    totalWalkMeters: routeSegments.reduce(
      (total, segment) => total + segment.walkMeters,
      0,
    ),
    totalWalkMinutes,
    totalStayMinutes,
    totalEstimatedMinutes: totalWalkMinutes + totalStayMinutes,
    estimatedCostCny: estimateRouteCost(selectedPois),
    degraded: false,
  })
}

export const generateMockStory = (
  requestInput: GenerateStoryRequest,
): GenerateStoryResponse => {
  const request = GenerateStoryRequestSchema.parse(requestInput)
  const firstPoi = request.routePlan.selectedPois[0]
  if (!firstPoi) throw new Error('INSUFFICIENT_POIS: no selected Mock POI')
  const storyId = `story_${request.routePlan.routeId}`
  const endingId = 'ending_mock'
  return GenerateStoryResponseSchema.parse({
    blueprint: {
      storyId,
      title: 'City Walk: Mock Archive',
      subtitle: 'A deterministic browser-only demonstration story',
      genre: request.preferences.genre,
      role: 'Archive walker',
      mission: 'Observe development-only mock details safely.',
      premise: 'This fictional story is generated locally from Mock POIs.',
      actStructure: [
        {
          id: 'act_mock',
          title: 'Mock route',
          summary: 'Follow the local demonstration route.',
          objective: 'Complete the observation.',
          poiIds: request.routePlan.selectedPois.map((poi) => poi.id),
        },
      ],
      characters: [],
      clueChain: [
        {
          id: 'clue_mock',
          name: 'Mock clue',
          description: 'A fictional clue for preview only.',
          sourcePoiId: firstPoi.id,
          required: true,
        },
      ],
      items: [],
      branchPlan: [],
      sideQuestPlan: [],
      endingPlan: [
        {
          id: endingId,
          title: 'Mock ending',
          condition: 'Complete the preview task.',
          summary: 'The local demonstration is complete.',
          hidden: false,
        },
      ],
      fictionNotice:
        'This is a fictional Mock demonstration and cannot be used for real-world navigation.',
      contentWarnings: [
        'Remain in public spaces and follow local safety rules.',
      ],
    },
    storyGraph: {
      entryNodeId: 'node_mock_intro',
      nodes: [
        {
          id: 'node_mock_intro',
          poiId: firstPoi.id,
          type: 'intro',
          title: 'Mock observation',
          storyText:
            'Observe two visible details in a public area. This is a local preview story.',
          arrivalText: 'Stay aware of your surroundings.',
          task: {
            id: 'task_mock_observe',
            type: 'observe',
            title: 'Observe details',
            instructions: 'Record two different visible shapes.',
            required: true,
            estimatedMinutes: 3,
            observationAnchors: firstPoi.observationAnchors,
          },
          choices: [
            {
              id: 'choice_mock_finish',
              text: 'Finish the preview',
              effects: { courage: 1, nextNodeId: 'node_mock_end' },
            },
          ],
          rewards: emptyReward(),
          requiredState: emptyRequirement(),
          next: null,
          fallbackNext: null,
          estimatedMinutes: 5,
          safetyNotice: 'Follow on-site rules.',
        },
        {
          id: 'node_mock_end',
          poiId: firstPoi.id,
          type: 'ending_gate',
          title: 'Mock ending',
          storyText: 'You completed the local demonstration route.',
          arrivalText: null,
          task: null,
          choices: [],
          rewards: { ...emptyReward(), flags: { endingId } },
          requiredState: emptyRequirement(),
          next: null,
          fallbackNext: null,
          estimatedMinutes: 1,
          safetyNotice: null,
        },
      ],
      endings: [
        {
          id: endingId,
          title: 'Mock ending',
          summary: 'The local demonstration is complete.',
          requiredState: emptyRequirement(),
        },
      ],
      hiddenEnding: null,
      stateDefinition: {
        initialEffectScores: {
          truth: 0,
          memory: 0,
          empathy: 0,
          courage: 0,
          connection: 0,
        },
        initialClues: [],
        initialItems: [],
        initialFlags: {},
      },
    },
    fallbackUsed: true,
    fallbackReason: 'STORY_GRAPH_INVALID',
  })
}
