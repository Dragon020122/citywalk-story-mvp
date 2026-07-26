import type {
  RoutePlan,
  StoryBlueprint,
} from '@citywalk/shared'
import type { StoryPoiContext } from '../story-poi-context.js'

export const graphPrompt = (input: {
  blueprint: StoryBlueprint
  routePlan: RoutePlan
  pois: StoryPoiContext[]
}): string => `
根据 StoryBlueprint 生成 StoryGraph JSON。

必须满足：
- nodes 为 7 至 10 个，node id 不重复，且 poiId 只使用 selectedPoiIds。
- 若路线 POI 少于节点数，travel、choice 或 ending_gate 可复用输入 poiId；不得创建新 POI。
- 图为有限有向结构，不得有死循环。
- 至少 2 个 choice 节点产生不同的后续节点或状态影响。
- 至少 1 个 side_quest 节点可进入且可退出。
- 至少 3 个可达 ending_gate；每个 ending_gate 的 rewards.flags.endingId 对应一个普通结局。
- clues、items、flags 和分数必须使普通结局条件可满足。
- storyText 最多 260 个中文字符，arrivalText 最多 100 个中文字符。
- 任务只能使用 POI taskHooks 和 observationAnchors 支持的安全公共空间任务。

输入：
${JSON.stringify({
  blueprint: input.blueprint,
  route: {
    routeId: input.routePlan.routeId,
    selectedPoiIds: input.routePlan.selectedPois.map((poi) => poi.id),
    totalEstimatedMinutes: input.routePlan.totalEstimatedMinutes,
  },
  pois: input.pois,
})}
`.trim()
