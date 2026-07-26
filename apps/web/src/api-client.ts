import {
  ApiErrorSchema,
  GenerateStoryRequestSchema,
  GenerateStoryResponseSchema,
  PlanRouteRequestSchema,
  PlanRouteResponseSchema,
  type GenerateStoryResponse,
  type JourneyPreferences,
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
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload)
    throw new ApiRequestError(
      apiError.success ? apiError.data.message : '请求失败，请稍后重试。',
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
