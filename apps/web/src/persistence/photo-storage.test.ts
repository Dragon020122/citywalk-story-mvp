import { describe, expect, it, vi } from 'vitest'
import { db } from './database'
import {
  MAX_PHOTO_BYTES,
  compressPhoto,
  deleteLocalPhoto,
  fitImageDimensions,
  saveLocalPhoto,
  type PhotoCompressionEnvironment,
} from './photo-storage'

function environment(blobSize = 1_000): PhotoCompressionEnvironment {
  return {
    decode: vi.fn().mockResolvedValue({
      width: 3000,
      height: 2000,
      source: {} as CanvasImageSource,
      close: vi.fn(),
    }),
    createCanvas: (width, height) =>
      ({
        width,
        height,
        getContext: () => ({ drawImage: vi.fn() }),
      }) as unknown as HTMLCanvasElement,
    encode: vi
      .fn()
      .mockResolvedValue(
        new Blob([new Uint8Array(blobSize)], { type: 'image/webp' }),
      ),
  }
}

describe('本地照片', () => {
  it('最长边压缩到 1280 且质量产物不超过 2MB', async () => {
    expect(fitImageDimensions(3000, 2000)).toEqual({
      width: 1280,
      height: 853,
    })
    const compressed = await compressPhoto(
      new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      environment(MAX_PHOTO_BYTES),
    )
    expect(compressed).toMatchObject({
      width: 1280,
      height: 853,
      mimeType: 'image/webp',
      size: MAX_PHOTO_BYTES,
    })
  })

  it('照片保存到 IndexedDB 后可删除', async () => {
    const photo = await saveLocalPhoto({
      id: 'photo_test',
      storyId: 'story_test',
      nodeId: 'node_test',
      taskId: 'task_test',
      file: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      environment: environment(),
    })
    expect(await db.localPhotos.get(photo.id)).toBeTruthy()
    await deleteLocalPhoto(photo.id)
    expect(await db.localPhotos.get(photo.id)).toBeUndefined()
  })

  it('拒绝压缩后仍超过 2MB 的照片', async () => {
    await expect(
      compressPhoto(
        new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
        environment(MAX_PHOTO_BYTES + 1),
      ),
    ).rejects.toThrow('仍超过 2MB')
  })
})
