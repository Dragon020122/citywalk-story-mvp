import { forwardRef } from 'react'
import type { PosterSize } from './poster-image'
import type { ResultSummary } from './result-summary'

interface SharePosterProps {
  summary: ResultSummary
  size: PosterSize
  date: string
  website: string
  includeNotes: boolean
  includePlaces: boolean
  photoUrl: string | undefined
}

export const SharePoster = forwardRef<HTMLElement, SharePosterProps>(
  function SharePoster(
    { summary, size, date, website, includeNotes, includePlaces, photoUrl },
    ref,
  ) {
    return (
      <article
        ref={ref}
        className={`share-poster share-poster--${size}`}
        aria-label="分享海报预览"
      >
        <header>
          <span>CITYWALK STORY</span>
          <small>{date}</small>
        </header>
        {photoUrl && (
          <img
            className="share-poster__photo"
            src={photoUrl}
            alt="用户选择加入海报的本地照片"
          />
        )}
        <div className="share-poster__body">
          <p>你的城市故事档案</p>
          <h1>{summary.storyTitle}</h1>
          <div className="share-poster__ending">
            <span>ENDING</span>
            <strong>{summary.endingTitle}</strong>
          </div>
          <p className="share-poster__summary">{summary.endingSummary}</p>
          <div className="share-poster__role">{summary.roleTitle}</div>
          <dl>
            <div>
              <dt>路线</dt>
              <dd>
                {summary.completedStops} 站 · {summary.walkDistance} ·{' '}
                {summary.duration}
              </dd>
            </div>
            {includePlaces && (
              <div>
                <dt>经过地点</dt>
                <dd>{summary.places.join(' → ') || '未记录'}</dd>
              </div>
            )}
            {includeNotes && (
              <div>
                <dt>本地笔记</dt>
                <dd>{summary.noteSummary}</dd>
              </div>
            )}
          </dl>
        </div>
        <footer>
          <span>{summary.keywords.map((item) => `#${item}`).join(' ')}</span>
          <strong>{website}</strong>
        </footer>
      </article>
    )
  },
)
