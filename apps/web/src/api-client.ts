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
import { buildApiUrl } from './api-base'
import {
  getEdgeOnePreviewToken,
  isEdgeOnePreviewRuntime,
} from './edgeone-preview-auth'

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

export function classifyHttpError(
  status: number,
  hasPreviewToken: boolean,
  isPreviewRuntime: boolean,
): string {
  if (status !== 401) return 'API_ERROR'
  if (hasPreviewToken) return 'EDGEONE_PREVIEW_TOKEN_EXPIRED'
  if (isPreviewRuntime) return 'EDGEONE_PREVIEW_TOKEN_MISSING'
  return 'HTTP_UNAUTHORIZED'
}

async function postJson(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await apiFetch(path, {
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
    const previewToken = getEdgeOnePreviewToken()
    const isUnauthorized = response.status === 401
    const code = isUnauthorized
      ? classifyHttpError(
          response.status,
          previewToken !== null,
          isEdgeOnePreviewRuntime(),
        )
      : apiError.success
        ? apiError.data.code
        : 'API_ERROR'
    const message =
      code === 'EDGEONE_PREVIEW_TOKEN_EXPIRED'
        ? 'EdgeOne 预览链接可能已失效，请返回控制台重新生成预览链接。'
        : code === 'EDGEONE_PREVIEW_TOKEN_MISSING'
          ? '当前预览链接缺少访问凭证，请从 EdgeOne 控制台重新打开预览。'
          : code === 'HTTP_UNAUTHORIZED'
            ? '当前请求未获授权，请确认访问权限后重试。'
            : apiError.success && apiError.data.code === 'AI_GENERATION_ERROR'
              ? '故事生成服务暂不可用，请检查 CloudBase AI 配置后重试。'
              : apiError.success
                ? apiError.data.message
                : `生成服务返回异常响应（HTTP ${response.status}），请稍后重试。`
    throw new ApiRequestError(message, response.status, code)
  }
  return payload
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(buildApiUrl(path), init)
}

export async function getApiHealth(signal?: AbortSignal): Promise<Response> {
  return signal ? apiFetch('/health', { signal }) : apiFetch('/health')
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
