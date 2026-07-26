import { useCallback, useEffect } from 'react'
import { Check, LoaderCircle, Signal, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { PageShell } from '../components/PageShell'
import { ProgressBar } from '../components/ProgressBar'
import { ErrorState } from '../components/States'
import { useJourneyGeneration } from '../hooks/useJourneyGeneration'

const generationStages = [
  '正在分析路线偏好',
  '正在筛选地点',
  '正在规划步行路径',
  '正在建立故事线索',
  '正在编排剧情分支',
  '正在检查安全与逻辑',
] as const

export function GeneratingPage() {
  const navigate = useNavigate()
  const handleComplete = useCallback(
    (storyId: string) =>
      navigate(`/story/${storyId}/preview`, { replace: true }),
    [navigate],
  )
  const generation = useJourneyGeneration({ onComplete: handleComplete })
  const { cancel, isRunning } = generation
  const handleBack = useCallback(() => {
    if (
      isRunning &&
      !window.confirm('故事仍在生成。确定取消请求并离开此页吗？')
    ) {
      return
    }
    cancel()
    navigate(-1)
  }, [cancel, isRunning, navigate])

  useEffect(() => {
    const startTask = window.setTimeout(() => void generation.start(), 0)
    return () => {
      window.clearTimeout(startTask)
      generation.cancel()
    }
  }, [generation.start, generation.cancel])

  useEffect(() => {
    if (!generation.isRunning) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [generation.isRunning])

  if (
    generation.status === 'failed' ||
    generation.status === 'cancelled' ||
    generation.status === 'timed-out' ||
    generation.status === 'missing'
  ) {
    return (
      <PageShell
        title="生成未完成"
        eyebrow="GENERATION INTERRUPTED"
        onBack={handleBack}
      >
        <ErrorState
          title={
            generation.status === 'cancelled'
              ? '已取消生成'
              : generation.status === 'timed-out'
                ? '生成超时'
                : '无法完成生成'
          }
          description={generation.errorMessage}
          action={
            generation.status === 'missing' ? (
              <Button onClick={() => navigate('/create')}>返回创建行程</Button>
            ) : (
              <Button onClick={() => void generation.start()}>重新尝试</Button>
            )
          }
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="正在编档"
      eyebrow="LIVE GENERATION"
      onBack={handleBack}
      action={
        <Button
          variant="secondary"
          fullWidth
          onClick={generation.cancel}
          disabled={!generation.isRunning}
        >
          <X aria-hidden="true" />
          取消生成
        </Button>
      }
    >
      <section className="generation-stage">
        <span className="signal-disc" aria-hidden="true">
          <Signal />
        </span>
        <span className="section-kicker">REQUEST PIPELINE / 02</span>
        <h1>正在连接城市暗线</h1>
        <p>路线与故事将依次通过真实服务端接口建立。</p>
        <ProgressBar
          value={Math.round(
            ((generation.stage + 1) / generationStages.length) * 100,
          )}
          label="生成进度"
        />
        <ol className="generation-stage-list">
          {generationStages.map((label, index) => {
            const complete = index < generation.stage
            const active = index === generation.stage
            return (
              <li
                className={active ? 'is-active' : undefined}
                key={label}
                aria-current={active ? 'step' : undefined}
              >
                <span>
                  {complete ? (
                    <Check aria-hidden="true" />
                  ) : active ? (
                    <LoaderCircle className="spin" aria-hidden="true" />
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </span>
                {label}
                <small>
                  {complete ? '已完成' : active ? '处理中' : '等待'}
                </small>
              </li>
            )
          })}
        </ol>
      </section>
      <p className="generation-leave-note">
        生成期间请保持页面开启。刷新或离开页面前，浏览器会提示确认。
      </p>
    </PageShell>
  )
}
