import { withEdgeOnePreviewToken } from './edgeone-preview-auth'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api')
  .trim()
  .replace(/\/+$/u, '')

export const buildApiUrl = (path: string): string =>
  withEdgeOnePreviewToken(`${apiBaseUrl}${path}`)
