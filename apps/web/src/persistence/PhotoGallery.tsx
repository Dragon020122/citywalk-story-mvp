import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Button } from '../components/Button'
import { deleteLocalPhoto, listLocalPhotos } from './photo-storage'

function LocalPhoto({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img src={url} alt={alt} />
}

export function PhotoGallery({ storyId }: { storyId: string }) {
  const photos = useLiveQuery(() => listLocalPhotos(storyId), [storyId])
  if (!photos?.length) return null

  return (
    <section className="local-photo-gallery" aria-labelledby="photos-title">
      <h3 id="photos-title">本地照片</h3>
      <p className="local-only-notice">
        照片仅保存在此设备，不会上传 CloudBase。
      </p>
      <div>
        {photos.map((photo) => (
          <article key={photo.id}>
            <LocalPhoto blob={photo.blob} alt="任务现场记录" />
            <Button
              variant="quiet"
              onClick={() => void deleteLocalPhoto(photo.id)}
              aria-label="删除本地照片"
            >
              <Trash2 aria-hidden="true" />
              删除
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
