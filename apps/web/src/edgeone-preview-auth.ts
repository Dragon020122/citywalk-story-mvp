const initialPreviewToken =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('eo_token') || null

export function getEdgeOnePreviewToken(): string | null {
  return initialPreviewToken
}

export function isEdgeOnePreviewRuntime(): boolean {
  if (typeof window === 'undefined') return false
  return isEdgeOnePreviewHostname(window.location.hostname)
}

export function isEdgeOnePreviewHostname(hostname: string): boolean {
  return hostname === 'edgeone.app' || hostname.endsWith('.edgeone.app')
}

export function withEdgeOnePreviewToken(apiUrl: string): string {
  if (typeof window === 'undefined' || !initialPreviewToken) return apiUrl

  const url = new URL(apiUrl, window.location.origin)
  if (
    url.origin !== window.location.origin ||
    (url.pathname !== '/api' && !url.pathname.startsWith('/api/'))
  ) {
    return apiUrl
  }

  url.searchParams.set('eo_token', initialPreviewToken)
  return `${url.pathname}${url.search}${url.hash}`
}
