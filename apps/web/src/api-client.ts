import {
  ApiErrorSchema,
  GenerateStoryRequestSchema,
  GenerateStoryResponseSchema,
  PlanRouteRequestSchema,
  PlanRouteResponseSchema,
  RerouteRequestSchema,
  RerouteResponseSchema,
  type GenerateStoryResponse,
  type JourneyPreferences,
  type RerouteResponse,
  type RoutePlan,
} from '@citywalk/shared'

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

async function postJson(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiRequestError(
      '无法连接生成服务，请确认本地 API 已启动后重试。',
      0,
      'NETWORK_ERROR',
    )
  }
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload)
    const message =
      apiError.success && apiError.data.code === 'AI_GENERATION_ERROR'
        ? '故事生成服务暂不可用，请检查 CloudBase AI 配置后重试。'
        : apiError.success
          ? apiError.data.message
          : `生成服务返回异常响应（HTTP ${response.status}），请稍后重试。`
    throw new ApiRequestError(
      message,
      response.status,
      apiError.success ? apiError.data.code : undefined,
    )
  }
  return payload
}

export async function planJourneyRoute(
  preferences: JourneyPreferences,
  signal: AbortSignal,
): Promise<RoutePlan> {
  const request = PlanRouteRequestSchema.parse({ preferences })
  const payload = await postJson('/v1/routes/plan', request, signal)
  return PlanRouteResponseSchema.parse(payload).routePlan
}

export async function generateJourneyStory(
  preferences: JourneyPreferences,
  routePlan: RoutePlan,
  signal: AbortSignal,
): Promise<GenerateStoryResponse> {
  const request = GenerateStoryRequestSchema.parse({
    preferences,
    routePlan,
  })
  const payload = await postJson('/v1/stories/generate', request, signal)
  return GenerateStoryResponseSchema.parse(payload)
}

export async function rerouteJourney(
  input: {
    storyId: string
    currentPoiId: string
    unavailablePoiIds: string[]
    preferences: JourneyPreferences
    routePlan: RoutePlan
  },
  signal: AbortSignal,
): Promise<RerouteResponse> {
  const request = RerouteRequestSchema.parse(input)
  const payload = await postJson(
    `/v1/stories/${encodeURIComponent(input.storyId)}/reroute`,
    request,
    signal,
  )
  return RerouteResponseSchema.parse(payload)
}
