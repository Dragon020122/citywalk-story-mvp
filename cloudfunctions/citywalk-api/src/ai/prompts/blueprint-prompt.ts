import type {
  JourneyPreferences,
  RoutePlan,
} from '@citywalk/shared'
import type { StoryPoiContext } from '../story-poi-context.js'

export const blueprintPrompt = (input: {
  preferences: JourneyPreferences
  routePlan: RoutePlan
  pois: StoryPoiContext[]
}): string => `
生成 StoryBlueprint JSON。

结构要求：
- actStructure 必须正好 3 幕。
- clueChain 至少 4 条，每条 sourcePoiId 必须来自输入 POI。
- items 必须 1 至 3 件。
- branchPlan 至少 2 个关键分支。
- sideQuestPlan 至少 1 条支线。
- endingPlan 必须有 3 个 hidden=false 的普通结局，可再有 1 个 hidden=true 的隐藏结局。
- fictionNotice 明确说明故事为虚构。
- 地点信息仅能使用 pois 中的受控字段。

输入：
${JSON.stringify({
  preferences: input.preferences,
  route: {
    routeId: input.routePlan.routeId,
    routePackId: input.routePlan.routePackId,
    selectedPoiIds: input.routePlan.selectedPois.map((poi) => poi.id),
    totalEstimatedMinutes: input.routePlan.totalEstimatedMinutes,
  },
  pois: input.pois,
})}
`.trim()
