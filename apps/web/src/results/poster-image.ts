import { toPng } from 'html-to-image'

export type PosterSize = '1080x1440' | '1080x1920'

export const POSTER_DIMENSIONS: Record<
  PosterSize,
  { width: number; height: number }
> = {
  '1080x1440': { width: 1080, height: 1440 },
  '1080x1920': { width: 1080, height: 1920 },
}

export async function downloadPoster(
  node: HTMLElement,
  size: PosterSize,
  filename: string,
): Promise<string> {
  const dimensions = POSTER_DIMENSIONS[size]
  const dataUrl = await toPng(node, {
    ...dimensions,
    canvasWidth: dimensions.width,
    canvasHeight: dimensions.height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#101113',
  })
  const anchor = document.createElement('a')
  anchor.download = filename
  anchor.href = dataUrl
  anchor.click()
  return dataUrl
}
