import type { TencentMapNamespace } from './tencent-map-types'

const SCRIPT_ID = 'tencent-map-gl-script'
const SCRIPT_BASE = 'https://map.qq.com/api/gljs'

let loaderPromise: Promise<TencentMapNamespace> | null = null

export class TencentMapLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TencentMapLoadError'
  }
}

export function loadTencentMap(
  browserKey: string,
): Promise<TencentMapNamespace> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new TencentMapLoadError('Tencent Map requires a browser environment'),
    )
  }
  if (!browserKey.trim()) {
    return Promise.reject(
      new TencentMapLoadError('VITE_TENCENT_MAP_BROWSER_KEY is missing'),
    )
  }
  if (window.TMap) return Promise.resolve(window.TMap)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<TencentMapNamespace>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script')

    const cleanupListeners = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanupListeners()
      if (window.TMap) {
        resolve(window.TMap)
        return
      }
      loaderPromise = null
      script.remove()
      reject(new TencentMapLoadError('Tencent Map loaded without TMap'))
    }
    const handleError = () => {
      cleanupListeners()
      loaderPromise = null
      script.remove()
      reject(new TencentMapLoadError('Tencent Map script failed to load'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existing) {
      script.id = SCRIPT_ID
      script.charset = 'utf-8'
      script.async = true
      script.src = `${SCRIPT_BASE}?v=1.exp&key=${encodeURIComponent(browserKey)}`
      document.head.append(script)
    }
  })
  return loaderPromise
}

export function resetTencentMapLoaderForTests() {
  loaderPromise = null
  if (typeof window !== 'undefined') delete window.TMap
  if (typeof document !== 'undefined') {
    document.getElementById(SCRIPT_ID)?.remove()
  }
}
