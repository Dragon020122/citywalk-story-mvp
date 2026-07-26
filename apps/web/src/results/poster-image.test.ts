import { beforeEach, describe, expect, it, vi } from 'vitest'

const { toPng } = vi.hoisted(() => ({ toPng: vi.fn() }))
vi.mock('html-to-image', () => ({ toPng }))

import { downloadPoster } from './poster-image'

describe('share poster image generation', () => {
  beforeEach(() => {
    toPng.mockResolvedValue('data:image/png;base64,poster')
  })

  it.each([
    ['1080x1440', 1440],
    ['1080x1920', 1920],
  ] as const)('generates the %s local PNG size', async (size, height) => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const node = document.createElement('article')

    await downloadPoster(node, size, `poster-${size}.png`)

    expect(toPng).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        width: 1080,
        height,
        canvasWidth: 1080,
        canvasHeight: height,
      }),
    )
    expect(click).toHaveBeenCalled()
  })
})
