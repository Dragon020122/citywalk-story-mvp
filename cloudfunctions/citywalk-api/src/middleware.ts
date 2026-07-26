import { createHash } from 'node:crypto'
import type {
  ErrorRequestHandler,
  Request,
  RequestHandler,
} from 'express'
import { nanoid } from 'nanoid'
import type { z } from 'zod'
import { HttpError } from './http-error.js'
import type {
  ApiLogger,
  RateLimitRepository,
  TelemetryRepository,
} from './repositories/index.js'

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex')

const getRequestId = (request: Request): string =>
  request.get('x-request-id')?.trim() || nanoid()

export const requestContext: RequestHandler = (
  request,
  response,
  next,
) => {
  const requestId = getRequestId(request)
  const ipHash = hash(request.ip || request.socket.remoteAddress || 'unknown')
  const userAgentDigest = hash(request.get('user-agent') ?? 'unknown')
  const deviceId = request.get('x-device-id')?.trim() || 'anonymous'

  response.locals.requestId = requestId
  response.locals.clientIdHash = hash(
    `${ipHash}:${userAgentDigest}:${deviceId}`,
  )
  response.setHeader('x-request-id', requestId)
  next()
}

export const requestLogger = (options: {
  logger: ApiLogger
  telemetry: TelemetryRepository
  now: () => Date
}): RequestHandler => (request, response, next) => {
  const startedAt = options.now().getTime()

  response.on('finish', () => {
    const durationMs = options.now().getTime() - startedAt
    const context = {
      requestId: String(response.locals.requestId),
      clientIdHash: String(response.locals.clientIdHash),
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs,
    }
    options.logger.info('http_request', context)
    void options.telemetry
      .record({
        id: nanoid(),
        eventName: 'http_request',
        requestId: context.requestId,
        clientIdHash: context.clientIdHash,
        properties: {
          method: context.method,
          path: context.path,
          statusCode: context.statusCode,
          durationMs,
        },
        createdAt: options.now().toISOString(),
      })
      .catch((error: unknown) => {
        options.logger.warn('telemetry_record_failed', {
          requestId: context.requestId,
          error:
            error instanceof Error ? error.message : 'unknown telemetry error',
        })
      })
  })

  next()
}

export const requestTimeout = (
  timeoutMs: number,
): RequestHandler => (_request, response, next) => {
  const timer = setTimeout(() => {
    if (!response.headersSent) {
      response.status(504).json({
        code: 'INTERNAL_ERROR',
        message: 'Request timed out',
        requestId: String(response.locals.requestId),
      })
    }
  }, timeoutMs)

  const clearTimer = (): void => clearTimeout(timer)
  response.once('finish', clearTimer)
  response.once('close', clearTimer)
  next()
}

export const validateBody = (
  schema: z.ZodType,
): RequestHandler => (request, _response, next) => {
  const parsed = schema.safeParse(request.body)
  if (!parsed.success) {
    next(
      new HttpError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request body validation failed',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    )
    return
  }

  request.body = parsed.data
  next()
}

export const rateLimit = (options: {
  repository: RateLimitRepository
  scope: 'common' | 'generate' | 'regenerate'
  limit: number
  windowMs: number
  now: () => Date
}): RequestHandler => async (_request, response, next) => {
  try {
    const decision = await options.repository.consume({
      key: `${String(response.locals.clientIdHash)}:${options.scope}`,
      limit: options.limit,
      windowMs: options.windowMs,
      now: options.now(),
    })
    response.setHeader('x-ratelimit-limit', String(options.limit))
    response.setHeader('x-ratelimit-remaining', String(decision.remaining))
    response.setHeader('x-ratelimit-reset', decision.resetAt)

    if (!decision.allowed) {
      next(
        new HttpError({
          statusCode: 429,
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded for ${options.scope} requests`,
          details: { resetAt: decision.resetAt },
        }),
      )
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}

const isPayloadTooLargeError = (
  error: unknown,
): error is { type: string } =>
  typeof error === 'object' &&
  error !== null &&
  'type' in error &&
  error.type === 'entity.too.large'

const isMalformedJsonError = (
  error: unknown,
): error is { type: string } =>
  typeof error === 'object' &&
  error !== null &&
  'type' in error &&
  error.type === 'entity.parse.failed'

export const errorHandler = (
  logger: ApiLogger,
): ErrorRequestHandler => (error, _request, response, _next) => {
  void _next
  const requestId = String(response.locals.requestId ?? nanoid())

  if (response.headersSent) {
    logger.warn('http_error_after_response', {
      requestId,
      error: error instanceof Error ? error.message : 'unknown error',
    })
    return
  }

  const normalizedError = isPayloadTooLargeError(error)
    ? new HttpError({
        statusCode: 413,
        code: 'VALIDATION_ERROR',
        message: 'JSON request body is too large',
      })
    : isMalformedJsonError(error)
      ? new HttpError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'JSON request body is malformed',
        })
    : error instanceof HttpError
      ? error
      : new HttpError({
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        })

  if (normalizedError.statusCode >= 500) {
    logger.error('http_error', {
      requestId,
      code: normalizedError.code,
      error: error instanceof Error ? error.message : 'unknown error',
    })
  }

  response.status(normalizedError.statusCode).json({
    code: normalizedError.code,
    message: normalizedError.message,
    requestId,
    ...(normalizedError.details !== undefined
      ? { details: normalizedError.details }
      : {}),
  })
}
