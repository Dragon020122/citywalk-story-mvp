const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api')
  .trim()
  .replace(/\/+$/u, '')

export const buildApiUrl = (path: string): string => `${apiBaseUrl}${path}`
