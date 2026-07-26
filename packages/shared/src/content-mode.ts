import { z } from 'zod'
import type { Poi } from './poi.js'

export const ContentModeSchema = z.enum(['mock', 'verified'])
export type ContentMode = z.infer<typeof ContentModeSchema>

export const DEFAULT_CONTENT_MODE: ContentMode = 'mock'

export const parseContentMode = (
  value: string | undefined,
): ContentMode => ContentModeSchema.parse(value ?? DEFAULT_CONTENT_MODE)

export const filterPoisForContentMode = (
  pois: readonly Poi[],
  contentMode: ContentMode,
): Poi[] =>
  pois.filter((poi) => poi.verificationStatus === contentMode)

export type InsufficientPoiContentCode =
  | 'INSUFFICIENT_MOCK_POIS'
  | 'INSUFFICIENT_VERIFIED_POIS'

export class InsufficientPoiContentError extends Error {
  readonly code: InsufficientPoiContentCode
  readonly contentMode: ContentMode
  readonly routePackId: string
  readonly requiredCount: number
  readonly availableCount: number

  constructor(options: {
    contentMode: ContentMode
    routePackId: string
    requiredCount: number
    availableCount: number
  }) {
    const code =
      options.contentMode === 'verified'
        ? 'INSUFFICIENT_VERIFIED_POIS'
        : 'INSUFFICIENT_MOCK_POIS'
    super(
      `${code}: route pack ${options.routePackId} requires ${options.requiredCount} ${options.contentMode} POIs but only ${options.availableCount} are available`,
    )
    this.name = 'InsufficientPoiContentError'
    this.code = code
    this.contentMode = options.contentMode
    this.routePackId = options.routePackId
    this.requiredCount = options.requiredCount
    this.availableCount = options.availableCount
  }
}

export const selectRoutePackPois = (options: {
  pois: readonly Poi[]
  routePackId: string
  contentMode: ContentMode
  minimumPoiCount: number
}): Poi[] => {
  const selectedPois = filterPoisForContentMode(
    options.pois.filter((poi) => poi.routePackId === options.routePackId),
    options.contentMode,
  )

  if (selectedPois.length < options.minimumPoiCount) {
    throw new InsufficientPoiContentError({
      contentMode: options.contentMode,
      routePackId: options.routePackId,
      requiredCount: options.minimumPoiCount,
      availableCount: selectedPois.length,
    })
  }

  return selectedPois
}
