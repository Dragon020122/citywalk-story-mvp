import type { Poi } from '@citywalk/shared'

export interface TencentNavigationConfig {
  baseUrl?: string
  referer?: string
}

export function buildTencentNavigationUrl(
  destination: Poi,
  config: TencentNavigationConfig = {},
): string {
  const baseUrl = config.baseUrl ?? 'https://apis.map.qq.com/uri/v1/routeplan'
  const url = new URL(baseUrl)
  url.searchParams.set('type', 'walk')
  url.searchParams.set('to', destination.shortName)
  url.searchParams.set(
    'tocoord',
    `${destination.latitude},${destination.longitude}`,
  )
  url.searchParams.set('policy', '0')
  url.searchParams.set('referer', config.referer ?? 'citywalk-story')
  return url.toString()
}

export async function copyPoiAddress(destination: Poi): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(destination.address)
    return true
  } catch {
    return false
  }
}

export async function openTencentNavigation(
  destination: Poi,
  config: TencentNavigationConfig = {},
): Promise<'opened' | 'copied' | 'failed'> {
  if (typeof window === 'undefined') return 'failed'
  const opened = window.open(
    buildTencentNavigationUrl(destination, config),
    '_blank',
    'noopener,noreferrer',
  )
  if (opened) return 'opened'
  return (await copyPoiAddress(destination)) ? 'copied' : 'failed'
}
