import { db, quarantineRecord, type LocalPhotoRecord } from './database'

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
export const MAX_PHOTO_EDGE = 1280
export const PHOTO_QUALITY = 0.75

interface DecodedImage {
  width: number
  height: number
  source: CanvasImageSource
  close?: () => void
}

export interface PhotoCompressionEnvironment {
  decode: (file: File) => Promise<DecodedImage>
  createCanvas: (width: number, height: number) => HTMLCanvasElement
  encode: (
    canvas: HTMLCanvasElement,
    mimeType: 'image/jpeg' | 'image/webp',
    quality: number,
  ) => Promise<Blob>
}

export interface CompressedPhoto {
  blob: Blob
  mimeType: 'image/jpeg' | 'image/webp'
  width: number
  height: number
  size: number
}

export function fitImageDimensions(
  width: number,
  height: number,
  maxEdge = MAX_PHOTO_EDGE,
) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const defaultEnvironment: PhotoCompressionEnvironment = {
  decode: async (file) => {
    const image = await createImageBitmap(file)
    return {
      width: image.width,
      height: image.height,
      source: image,
      close: () => image.close(),
    }
  },
  createCanvas: (width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  },
  encode: (canvas, mimeType, quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('浏览器无法压缩这张照片。')),
        mimeType,
        quality,
      )
    }),
}

export async function compressPhoto(
  file: File,
  environment = defaultEnvironment,
): Promise<CompressedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件。')
  }

  const decoded = await environment.decode(file)
  try {
    let dimensions = fitImageDimensions(decoded.width, decoded.height)
    let blob: Blob | null = null
    let mimeType: 'image/jpeg' | 'image/webp' = 'image/webp'

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = environment.createCanvas(
        dimensions.width,
        dimensions.height,
      )
      const context = canvas.getContext('2d')
      if (!context) throw new Error('当前浏览器不支持照片压缩。')
      context.drawImage(
        decoded.source,
        0,
        0,
        dimensions.width,
        dimensions.height,
      )
      try {
        blob = await environment.encode(canvas, 'image/webp', PHOTO_QUALITY)
        if (blob.type !== 'image/webp') {
          throw new Error('WebP encoding is unavailable')
        }
      } catch {
        mimeType = 'image/jpeg'
        blob = await environment.encode(canvas, 'image/jpeg', PHOTO_QUALITY)
        if (blob.type !== 'image/jpeg') {
          throw new Error('浏览器无法生成 JPEG 或 WebP 照片。')
        }
      }
      if (blob.size <= MAX_PHOTO_BYTES) break
      dimensions = fitImageDimensions(
        Math.round(dimensions.width * 0.8),
        Math.round(dimensions.height * 0.8),
        MAX_PHOTO_EDGE,
      )
    }

    if (!blob || blob.size > MAX_PHOTO_BYTES) {
      throw new Error('压缩后照片仍超过 2MB，请选择另一张照片。')
    }
    return {
      blob,
      mimeType,
      width: dimensions.width,
      height: dimensions.height,
      size: blob.size,
    }
  } finally {
    decoded.close?.()
  }
}

export async function saveLocalPhoto(input: {
  id?: string
  storyId: string
  nodeId: string
  taskId: string
  file: File
  environment?: PhotoCompressionEnvironment
}): Promise<LocalPhotoRecord> {
  const compressed = await compressPhoto(input.file, input.environment)
  const record: LocalPhotoRecord = {
    id:
      input.id ??
      `local_photo_${input.taskId}_${Date.now()}_${crypto.randomUUID()}`,
    storyId: input.storyId,
    nodeId: input.nodeId,
    taskId: input.taskId,
    ...compressed,
    createdAt: new Date().toISOString(),
  }
  await db.localPhotos.put(record)
  return record
}

export async function deleteLocalPhoto(photoId: string) {
  await db.localPhotos.delete(photoId)
}

export async function listLocalPhotos(storyId: string) {
  const photos = await db.localPhotos
    .where('storyId')
    .equals(storyId)
    .sortBy('createdAt')
  const valid: LocalPhotoRecord[] = []
  for (const photo of photos) {
    if (
      photo.blob instanceof Blob &&
      (photo.mimeType === 'image/jpeg' || photo.mimeType === 'image/webp') &&
      photo.size <= MAX_PHOTO_BYTES &&
      photo.width > 0 &&
      photo.height > 0
    ) {
      valid.push(photo)
    } else {
      await quarantineRecord({
        table: 'localPhotos',
        key: photo.id,
        raw: photo,
        error: 'Invalid local photo record',
      })
    }
  }
  return valid.reverse()
}
