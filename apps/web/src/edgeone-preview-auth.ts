interface EdgeOnePreviewAuthState {
  initialized: boolean
  token: string | null
  expiresAt: string | null
}

const state: EdgeOnePreviewAuthState = {
  initialized: false,
  token: null,
  expiresAt: null,
}

function readPreviewParams() {
  if (typeof window === 'undefined') return
  const params = new URL(window.location.href).searchParams
  state.token = params.get('eo_token') || null
  state.expiresAt = params.get('eo_time') || null
}

export function initEdgeOnePreviewAuth(): void {
  if (state.initialized) return
  readPreviewParams()
  state.initialized = true
}

export function getEdgeOnePreviewToken(): string | null {
  if (!state.initialized || !state.token) readPreviewParams()
  return state.token
}

export function isEdgeOnePreviewHostname(hostname: string): boolean {
  return (
    hostname === 'edgeone.app' ||
    hostname.endsWith('.edgeone.app') ||
    hostname === 'edgeone.cool' ||
    hostname.endsWith('.edgeone.cool')
  )
}

export function isEdgeOnePreviewSession(): boolean {
  return typeof window !== 'undefined' && getEdgeOnePreviewToken() !== null
}

export function isEdgeOnePreviewTokenExpired(): boolean {
  const expiresAt = Number(state.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt * 1_000 <= Date.now()
}

export function withEdgeOnePreviewNavigation(path: string): string {
  if (typeof window === 'undefined' || !isEdgeOnePreviewSession()) return path

  const url = new URL(path, window.location.origin)
  if (
    url.origin !== window.location.origin ||
    url.pathname.startsWith('/api')
  ) {
    return path
  }

  url.searchParams.set('eo_token', getEdgeOnePreviewToken()!)
  if (state.expiresAt) url.searchParams.set('eo_time', state.expiresAt)
  return `${url.pathname}${url.search}${url.hash}`
}

export function installEdgeOnePreviewNavigation(): void {
  if (typeof window === 'undefined' || !isEdgeOnePreviewSession()) return

  const history = window.history
  const decorate = (url?: string | URL | null) =>
    typeof url === 'string' ? withEdgeOnePreviewNavigation(url) : url
  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (data, unused, url) =>
    originalPushState(data, unused, decorate(url))
  history.replaceState = (data, unused, url) =>
    originalReplaceState(data, unused, decorate(url))
}
