import { FeedbackRequestSchema } from '@citywalk/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Home, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Chip, StatusBadge } from '../components/Labels'
import {
  saveJourneyDraft,
  savePendingGeneration,
  type GenerationResult,
} from '../journey-storage'
import { db, resetStoryProgress } from '../persistence/database'
import { listLocalPhotos } from '../persistence/photo-storage'
import { processSyncQueue, queueFeedback } from '../persistence/sync-queue'
import type { RestoredGameplay } from '../gameplay/gameplay-storage'
import { downloadPoster, type PosterSize } from './poster-image'
import { buildResultSummary } from './result-summary'
import { SharePoster } from './SharePoster'

const RATING_FIELDS = [
  ['overallRating', '整体体验'],
  ['storyCoherence', '剧情连贯'],
  ['routeQuality', '路线质量'],
  ['taskQuality', '任务质量'],
  ['safetyFeeling', '安全感受'],
] as const

const LIKED_TAGS = ['剧情氛围', '路线节奏', '现场任务', '角色代入', '城市发现']
const ISSUE_TAGS = ['剧情跳跃', '路线绕行', '任务不清', '安全顾虑', '技术问题']

interface ResultsExperienceProps {
  storyId: string
  result: GenerationResult
  restored: RestoredGameplay
}

export function ResultsExperience({
  storyId,
  result,
  restored,
}: ResultsExperienceProps) {
  const navigate = useNavigate()
  const storyRecord = useLiveQuery(() => db.stories.get(storyId), [storyId])
  const photos = useLiveQuery(() => listLocalPhotos(storyId), [storyId]) ?? []
  const [includePhoto, setIncludePhoto] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [includePlaces, setIncludePlaces] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState('')
  const [posterSize, setPosterSize] = useState<PosterSize>('1080x1440')
  const [posterStatus, setPosterStatus] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string>()
  const [feedback, setFeedback] = useState({
    overallRating: 5,
    storyCoherence: 5,
    routeQuality: 5,
    taskQuality: 5,
    safetyFeeling: 5,
    likedTags: [] as string[],
    issueTags: [] as string[],
    comment: '',
  })
  const posterRef = useRef<HTMLElement>(null)
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId)
  useEffect(() => {
    if (!includePhoto || !selectedPhoto) {
      setPhotoUrl(undefined)
      return
    }
    const nextPhotoUrl = URL.createObjectURL(selectedPhoto.blob)
    setPhotoUrl(nextPhotoUrl)
    return () => URL.revokeObjectURL(nextPhotoUrl)
  }, [includePhoto, selectedPhoto])
  useEffect(() => {
    const firstPhotoId = photos[0]?.id
    if (firstPhotoId && !selectedPhotoId) setSelectedPhotoId(firstPhotoId)
  }, [photos, selectedPhotoId])

  const summary = buildResultSummary({
    blueprint: result.story.blueprint,
    graph: result.story.storyGraph,
    routePlan: result.routePlan,
    runtime: restored.runtime,
  })

  const toggleTag = (field: 'likedTags' | 'issueTags', value: string) => {
    setFeedback((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((tag) => tag !== value)
        : [...current[field], value],
    }))
  }

  const generatePoster = async () => {
    if (!posterRef.current) return
    setPosterStatus('正在生成本地图片…')
    try {
      await downloadPoster(
        posterRef.current,
        posterSize,
        `citywalk-${storyId}-${posterSize}.png`,
      )
      setPosterStatus('海报已生成并下载，未上传任何私人内容。')
    } catch {
      setPosterStatus('海报生成失败，请稍后重试。')
    }
  }

  const submitFeedback = async () => {
    const payload = FeedbackRequestSchema.safeParse({
      storyId,
      routePackId: result.routePlan.routePackId,
      ...feedback,
      fallbackUsed: result.story.fallbackUsed,
    })
    if (!payload.success) {
      setFeedbackStatus('请检查评分和文字长度后重试。')
      return
    }
    await queueFeedback(payload.data)
    if (navigator.onLine) {
      const sync = await processSyncQueue()
      setFeedbackStatus(
        sync.failed
          ? '暂时无法发送，反馈已安全保存在本地队列。'
          : '感谢反馈，已匿名提交。',
      )
    } else {
      setFeedbackStatus('当前离线，反馈已入队，联网后会自动提交。')
    }
  }

  const replay = async () => {
    await resetStoryProgress(storyId)
    navigate(`/story/${storyId}/play`, { replace: true })
  }

  const regenerate = async () => {
    await savePendingGeneration(result.preferences)
    navigate('/generating')
  }

  const createWithPreferences = async () => {
    await saveJourneyDraft(0, result.preferences)
    navigate('/create')
  }

  return (
    <>
      <section className="result-mark">
        <span>{restored.runtime.endingId ?? 'ENDING UNKNOWN'}</span>
        <strong>{summary.endingTitle}</strong>
      </section>

      <Card className="result-overview">
        <StatusBadge
          tone={restored.state === 'completed' ? 'success' : 'warning'}
        >
          {restored.state === 'completed' ? '已结案' : '未完成'}
        </StatusBadge>
        <span className="section-kicker">{summary.storyTitle}</span>
        <h1>{summary.roleTitle}</h1>
        <p>{summary.endingSummary}</p>
        <div className="result-metrics">
          <span>
            <strong>{summary.completedStops}</strong>完成站数
          </span>
          <span>
            <strong>{summary.completedTasks}</strong>完成任务
          </span>
          <span>
            <strong>{summary.clueCount}</strong>线索
          </span>
        </div>
      </Card>

      <Card>
        <h2>本次漫游</h2>
        <dl className="result-facts">
          <div>
            <dt>支线状态</dt>
            <dd>{summary.sideQuestStatus}</dd>
          </div>
          <div>
            <dt>步行距离</dt>
            <dd>{summary.walkDistance}</dd>
          </div>
          <div>
            <dt>时长</dt>
            <dd>{summary.duration}</dd>
          </div>
          <div>
            <dt>经过地点</dt>
            <dd>{summary.places.join(' → ') || '未记录'}</dd>
          </div>
          <div>
            <dt>本地照片</dt>
            <dd>{photos.length} 张（仅此设备）</dd>
          </div>
        </dl>
        <div className="chip-row">
          {summary.keywords.map((keyword) => (
            <Chip key={keyword}>{keyword}</Chip>
          ))}
        </div>
      </Card>

      <Card>
        <h2>选择倾向 · 文字雷达</h2>
        <div className="tendency-radar">
          {summary.tendencyLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <h3>用户笔记摘要</h3>
        <p>{summary.noteSummary}</p>
      </Card>

      <Card className="poster-controls">
        <span className="section-kicker">PRIVACY FIRST</span>
        <h2>生成分享海报</h2>
        <p>以下私人内容默认均不加入。图片只在本机生成。</p>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includePhoto}
            onChange={(event) => setIncludePhoto(event.target.checked)}
          />
          <span>
            <strong>加入本地照片</strong>
            <small>仅使用你选择的这一张</small>
          </span>
        </label>
        {includePhoto && photos.length > 0 && (
          <select
            aria-label="选择海报照片"
            value={selectedPhotoId}
            onChange={(event) => setSelectedPhotoId(event.target.value)}
          >
            {photos.map((photo, index) => (
              <option key={photo.id} value={photo.id}>
                本地照片 {index + 1}
              </option>
            ))}
          </select>
        )}
        {includePhoto && photos.length === 0 && <p>当前故事没有本地照片。</p>}
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
          />
          <span>
            <strong>加入笔记</strong>
            <small>可能包含你的私人感受</small>
          </span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includePlaces}
            onChange={(event) => setIncludePlaces(event.target.checked)}
          />
          <span>
            <strong>加入经过地点</strong>
            <small>会展示本次路线节点</small>
          </span>
        </label>
        <label className="select-field">
          海报尺寸
          <select
            value={posterSize}
            onChange={(event) =>
              setPosterSize(event.target.value as PosterSize)
            }
          >
            <option value="1080x1440">1080 × 1440</option>
            <option value="1080x1920">1080 × 1920</option>
          </select>
        </label>
        <Button fullWidth onClick={() => void generatePoster()}>
          <Download aria-hidden="true" />
          生成并下载
        </Button>
        {posterStatus && <p role="status">{posterStatus}</p>}
      </Card>

      <Card className="feedback-form">
        <span className="section-kicker">ANONYMOUS FEEDBACK</span>
        <h2>体验反馈</h2>
        <p>不收集姓名、手机号或精确实时位置。</p>
        {RATING_FIELDS.map(([field, label]) => (
          <label className="feedback-rating" key={field}>
            <span>{label}</span>
            <select
              value={feedback[field]}
              onChange={(event) =>
                setFeedback((current) => ({
                  ...current,
                  [field]: Number(event.target.value),
                }))
              }
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} 分
                </option>
              ))}
            </select>
          </label>
        ))}
        <fieldset>
          <legend>喜欢的部分</legend>
          <div className="feedback-tags">
            {LIKED_TAGS.map((tag) => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={feedback.likedTags.includes(tag)}
                  onChange={() => toggleTag('likedTags', tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>遇到的问题</legend>
          <div className="feedback-tags">
            {ISSUE_TAGS.map((tag) => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={feedback.issueTags.includes(tag)}
                  onChange={() => toggleTag('issueTags', tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="task-field">
          补充意见（最多 1000 字）
          <textarea
            maxLength={1000}
            value={feedback.comment}
            onChange={(event) =>
              setFeedback((current) => ({
                ...current,
                comment: event.target.value,
              }))
            }
          />
        </label>
        <Button fullWidth onClick={() => void submitFeedback()}>
          匿名提交反馈
        </Button>
        {feedbackStatus && <p role="status">{feedbackStatus}</p>}
      </Card>

      <Card className="restart-actions">
        <h2>接下来</h2>
        <Button fullWidth onClick={() => void replay()}>
          <RotateCcw aria-hidden="true" />
          同路线同剧情重玩
        </Button>
        <Button variant="secondary" fullWidth onClick={() => void regenerate()}>
          <Sparkles aria-hidden="true" />
          同路线重新生成剧情
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void createWithPreferences()}
        >
          保留偏好创建新故事
        </Button>
        <Link className="button button--quiet button--full" to="/">
          <Home aria-hidden="true" />
          返回首页
        </Link>
      </Card>

      <div className="poster-render-stage" aria-hidden="true">
        <SharePoster
          ref={posterRef}
          summary={summary}
          size={posterSize}
          date={new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(
            new Date(storyRecord?.completedAt ?? Date.now()),
          )}
          website={window.location.origin}
          includeNotes={includeNotes}
          includePlaces={includePlaces}
          photoUrl={photoUrl}
        />
      </div>
    </>
  )
}
