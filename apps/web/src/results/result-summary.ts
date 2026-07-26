import type {
  EffectScoreKey,
  StoryBlueprint,
  StoryGraph,
  StoryRuntimeState,
  RoutePlan,
} from '@citywalk/shared'

const SCORE_LABELS: Record<EffectScoreKey, string> = {
  truth: '求真',
  memory: '记忆',
  empathy: '共情',
  courage: '勇气',
  connection: '联结',
}

const ROLE_TITLES: Record<EffectScoreKey, string> = {
  truth: '真相校准者',
  memory: '城市记忆守望人',
  empathy: '回声倾听者',
  courage: '暗线破局者',
  connection: '街巷联结者',
}

const GENRE_LABELS = {
  mystery: '城市悬疑',
  healing: '治愈漫游',
  relationship: '关系叙事',
  urban_fantasy: '都市奇想',
} as const

export interface ResultSummary {
  storyTitle: string
  endingTitle: string
  endingSummary: string
  roleTitle: string
  completedStops: number
  completedTasks: number
  clueCount: number
  sideQuestStatus: string
  walkDistance: string
  duration: string
  tendencyLines: string[]
  places: string[]
  keywords: string[]
  noteSummary: string
}

function strongestScore(
  scores: StoryRuntimeState['effectScores'],
): EffectScoreKey {
  const keys: EffectScoreKey[] = [
    'truth',
    'memory',
    'empathy',
    'courage',
    'connection',
  ]
  return keys.reduce((best, key) => (scores[key] > scores[best] ? key : best))
}

function summarizeTendencies(
  scores: StoryRuntimeState['effectScores'],
): string[] {
  const values = Object.values(scores)
  const maximum = Math.max(1, ...values.map((value) => Math.abs(value)))
  return (Object.keys(SCORE_LABELS) as EffectScoreKey[]).map((key) => {
    const level = Math.max(
      0,
      Math.min(5, Math.round((scores[key] / maximum) * 5)),
    )
    return `${SCORE_LABELS[key]} ${'●'.repeat(level)}${'○'.repeat(5 - level)}`
  })
}

function summarizeSideQuest(
  graph: StoryGraph,
  runtime: StoryRuntimeState,
): string {
  const sideQuestNodes = graph.nodes.filter(
    (node) => node.type === 'side_quest',
  )
  if (!sideQuestNodes.length) return '本故事无支线'
  const completed = sideQuestNodes.filter((node) =>
    runtime.completedNodeIds.includes(node.id),
  ).length
  const declined = sideQuestNodes.filter((node) =>
    runtime.declinedSideQuestNodeIds.includes(node.id),
  ).length
  if (completed === sideQuestNodes.length) return '全部完成'
  if (completed) return `完成 ${completed}/${sideQuestNodes.length}`
  if (declined) return '已婉拒'
  return '未触发或未完成'
}

function summarizeNotes(runtime: StoryRuntimeState): string {
  const text = runtime.journalEntries
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join('；')
  if (!text) return '没有留下本地笔记'
  return text.length > 120 ? `${text.slice(0, 120)}…` : text
}

export function buildResultSummary(input: {
  blueprint: StoryBlueprint
  graph: StoryGraph
  routePlan: RoutePlan
  runtime: StoryRuntimeState
}): ResultSummary {
  const { blueprint, graph, routePlan, runtime } = input
  const completedPoiIds = new Set(
    graph.nodes
      .filter((node) => runtime.completedNodeIds.includes(node.id))
      .map((node) => node.poiId)
      .filter((id): id is string => Boolean(id)),
  )
  const strongest = strongestScore(runtime.effectScores)
  const choiceKeywords = Object.keys(runtime.selectedChoices)
    .slice(0, 2)
    .map(() => SCORE_LABELS[strongest])

  return {
    storyTitle: blueprint.title,
    endingTitle: runtime.endingTitle ?? '未收录结局',
    endingSummary:
      runtime.endingSummary ?? '故事仍在进行，结局尚未写入本地档案。',
    roleTitle: ROLE_TITLES[strongest],
    completedStops: completedPoiIds.size,
    completedTasks: runtime.completedTaskIds.length,
    clueCount: runtime.clues.length,
    sideQuestStatus: summarizeSideQuest(graph, runtime),
    walkDistance: `${(routePlan.totalWalkMeters / 1000).toFixed(1)} 公里`,
    duration: `预计 ${routePlan.totalEstimatedMinutes} 分钟`,
    tendencyLines: summarizeTendencies(runtime.effectScores),
    places: routePlan.selectedPois
      .filter((poi) => completedPoiIds.has(poi.id))
      .map((poi) => poi.shortName),
    keywords: [
      GENRE_LABELS[blueprint.genre],
      ...blueprint.actStructure.slice(0, 2).map((act) => act.title),
      ...choiceKeywords,
    ].filter((value, index, values) => values.indexOf(value) === index),
    noteSummary: summarizeNotes(runtime),
  }
}
