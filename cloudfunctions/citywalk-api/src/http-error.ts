import type { ApiErrorCode } from '@citywalk/shared'

export class HttpError extends Error {
  readonly statusCode: number
  readonly code: ApiErrorCode
  readonly details: unknown

  constructor(options: {
    statusCode: number
    code: ApiErrorCode
    message: string
    details?: unknown
  }) {
    super(options.message)
    this.name = 'HttpError'
    this.statusCode = options.statusCode
    this.code = options.code
    this.details = options.details
  }
}
