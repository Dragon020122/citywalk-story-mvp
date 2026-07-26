export const reroutePrompt = (input: {
  storyId: string
  currentNodeId: string
  allowedPoiIds: string[]
}): string => `
为既有虚构故事准备重路由建议。只输出纯 JSON，不得创建新 POI，不得改变既有 poiId，不得补充真实历史事实。
任务必须适合公共空间，并遵守全部安全限制。

input:
${JSON.stringify(input)}
`.trim()
