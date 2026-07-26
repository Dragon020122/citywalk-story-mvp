import type {
  RoutePlan,
  StoryBlueprint,
} from '@citywalk/shared'
import type { StoryGraphValidationIssue } from '../validate-story-graph.js'

export const repairPrompt = (input: {
  blueprint: StoryBlueprint
  routePlan: RoutePlan
  invalidOutput: string
  errors: StoryGraphValidationIssue[]
}): string => `
修复 StoryGraph，并只输出完整、替换后的纯 JSON 对象。

不得新增或更改 POI；不得扩大故事范围；只修复下面的结构化错误。所有安全限制继续有效。

allowedPoiIds:
${JSON.stringify(input.routePlan.selectedPois.map((poi) => poi.id))}

blueprint:
${JSON.stringify(input.blueprint)}

validationErrors:
${JSON.stringify(input.errors)}

invalidOutput:
${input.invalidOutput}
`.trim()
