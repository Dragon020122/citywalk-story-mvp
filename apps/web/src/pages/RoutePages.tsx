import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  Check,
  Download,
  RotateCcw,
  Settings,
  Signal,
  WifiOff,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BottomActionBar } from '../components/BottomActionBar'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ArchiveLabel, Chip, StatusBadge } from '../components/Labels'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import { RouteStep } from '../components/RouteStep'
import { ScreenHeader } from '../components/ScreenHeader'
import { EmptyState, ErrorState, OfflineBanner } from '../components/States'
import { Toast } from '../components/Toast'
import { InventoryPanel } from '../gameplay/InventoryPanel'
import { savePendingGeneration } from '../journey-storage'
import {
  useStoredGameplay,
  useStoredStory,
  useStoryHistory,
} from '../persistence/hooks'
import { db, deleteStoryCascade } from '../persistence/database'

interface PageShellProps extends PropsWithChildren {
  title: string
  eyebrow: string
  action?: ReactNode
}

function PageShell({ title, eyebrow, action, children }: PageShellProps) {
  return (
    <>
      <ScreenHeader title={title} eyebrow={eyebrow} back />
      <main className="screen route-page">{children}</main>
      {action && <BottomActionBar>{action}</BottomActionBar>}
    </>
  )
}

function StoryIdLabel() {
  const { storyId = 'mock_unknown' } = useParams()
  return <ArchiveLabel>{storyId.toUpperCase()}</ArchiveLabel>
}

export function CreatePage() {
  const [error, setError] = useState('')

  return (
    <PageShell
      title="建立漫游档案"
      eyebrow="CREATE / 01"
      action={
        <Button
          fullWidth
          onClick={() => setError('请选择一条 Mock 路线后再继续。')}
        >
          生成故事档案
          <ArrowRight aria-hidden="true" />
        </Button>
      }
    >
      <section className="page-intro">
        <ArchiveLabel>输入偏好</ArchiveLabel>
        <h1>今晚，想进入哪一种城市？</h1>
        <p>第七阶段暂用 Mock API；你的选择只用于验证页面流程。</p>
      </section>
      <form className="stack" aria-label="漫游偏好">
        <fieldset aria-describedby={error ? 'route-error' : undefined}>
          <legend>路线包</legend>
          <label className="choice-row">
            <input type="radio" name="route" value="mock_wukang_night" />
            <span>
              <strong>梧桐区失物电台</strong>
              <small>90 分钟 · 城市悬疑</small>
            </span>
          </label>
          <label className="choice-row">
            <input type="radio" name="route" value="mock_river_tide" />
            <span>
              <strong>潮汐线以北</strong>
              <small>120 分钟 · 记忆叙事</small>
            </span>
          </label>
          {error && (
            <p className="field-error" id="route-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      </form>
    </PageShell>
  )
}

export function GeneratingPage() {
  return (
    <PageShell title="正在编档" eyebrow="GENERATING / 02">
      <section className="center-stage">
        <span className="signal-disc" aria-hidden="true">
          <Signal />
        </span>
        <ArchiveLabel>MOCK PROCESS</ArchiveLabel>
        <h1>正在连接城市暗线</h1>
        <p>编排路线编号、章节节点与现场安全提示。</p>
        <ProgressBar value={68} label="编档进度" />
        <div className="process-list" aria-label="编档步骤">
          <span>
            <Check aria-hidden="true" /> 路线骨架已锁定
          </span>
          <span>
            <Check aria-hidden="true" /> 剧情节点已编排
          </span>
          <span className="is-active">
            <RotateCcw aria-hidden="true" /> 正在整理档案封面
          </span>
        </div>
      </section>
    </PageShell>
  )
}

export function PreviewPage() {
  const { storyId = 'mock_demo_007' } = useParams()
  return (
    <PageShell
      title="故事预览"
      eyebrow="ARCHIVE PREVIEW"
      action={
        <Link
          className="button button--primary button--full"
          to={`/story/${storyId}/play`}
        >
          开始漫游
          <ArrowRight aria-hidden="true" />
        </Link>
      }
    >
      <section className="poster-card">
        <StoryIdLabel />
        <span className="poster-card__chapter">固定示范故事</span>
        <h1>第七码头没有钟</h1>
        <p>
          你收到一张不存在于任何班次表里的船票，背面只写着：在潮水退去前找到失踪的整点。
        </p>
        <div className="chip-row">
          <Chip>城市悬疑</Chip>
          <Chip>约 75 分钟</Chip>
          <Chip>3.1 公里</Chip>
        </div>
      </section>
      <Card>
        <span className="section-kicker">故事任务</span>
        <h2>找回被拿走的整点</h2>
        <p className="muted">
          沿三处 Mock 节点收集时间票据，在终点做出一次选择。
        </p>
      </Card>
    </PageShell>
  )
}

export function PlayPage() {
  return (
    <PageShell
      title="漫游进行中"
      eyebrow="SCENE / 03"
      action={
        <Button fullWidth>
          记录现场线索
          <ArrowRight aria-hidden="true" />
        </Button>
      }
    >
      <OfflineBanner />
      <StoryIdLabel />
      <section className="story-scene">
        <span className="section-kicker">第三幕 / 频率 87.6</span>
        <h1>雨棚下的电流声</h1>
        <p>
          你停在第二个编号前。雨水沿着旧门牌向下，一段断续的广播从街角传来：“请不要替城市回答。”
        </p>
      </section>
      <Card>
        <StatusBadge tone="warning">现场任务</StatusBadge>
        <h2>辨认三个重复出现的数字</h2>
        <p className="muted">只在公共区域观察，不要进入门内或影响现场通行。</p>
      </Card>
      <div className="route-steps">
        <RouteStep number="01" title="旧票据亭" meta="已完成 · 18:24" />
        <RouteStep number="02" title="雨棚编号" meta="距离约 120 米" active />
        <RouteStep number="03" title="无名转角" meta="完成当前任务后解锁" />
      </div>
    </PageShell>
  )
}

export function InventoryPage() {
  const { storyId = '' } = useParams()
  const result = useStoredStory(storyId)
  const restored = useStoredGameplay(storyId, result?.story.storyGraph)

  return (
    <PageShell title="随身档案" eyebrow="INVENTORY">
      <StoryIdLabel />
      {result && restored ? (
        <InventoryPanel
          storyId={storyId}
          blueprint={result.story.blueprint}
          graph={result.story.storyGraph}
          runtime={restored.runtime}
        />
      ) : (
        <EmptyState
          title="还没有可恢复的线索背包"
          description="开始漫游并完成一个节点后，线索与道具会保存在当前设备。"
        />
      )}
    </PageShell>
  )
}

export function JournalPage() {
  const { storyId = '' } = useParams()
  const result = useStoredStory(storyId)
  const restored = useStoredGameplay(storyId, result?.story.storyGraph)

  return (
    <PageShell title="漫游手记" eyebrow="JOURNAL">
      <StoryIdLabel />
      {restored?.runtime.journalEntries.map((entry, index) => (
        <Card className="journal-entry" key={`${entry.nodeId}-${index}`}>
          <span>节点记录 · {String(index + 1).padStart(2, '0')}</span>
          <h2>
            {result?.story.storyGraph.nodes.find(
              (node) => node.id === entry.nodeId,
            )?.title ?? entry.nodeId}
          </h2>
          <p>{entry.text}</p>
        </Card>
      ))}
      {!restored?.runtime.journalEntries.length && (
        <EmptyState
          title="还没有新的手记"
          description="完成手记任务后，新的记录会出现在这里。"
        />
      )}
    </PageShell>
  )
}

export function ResultPage() {
  const { storyId = '' } = useParams()
  const result = useStoredStory(storyId)
  const restored = useStoredGameplay(storyId, result?.story.storyGraph)

  return (
    <PageShell title="档案结案" eyebrow="RESULT">
      <section className="result-mark">
        <span>{restored?.runtime.endingId ?? 'ENDING UNKNOWN'}</span>
        <strong>{restored?.runtime.endingTitle ?? '结局尚未收录'}</strong>
      </section>
      <Card>
        <StatusBadge
          tone={restored?.state === 'completed' ? 'success' : 'warning'}
        >
          {restored?.state === 'completed' ? '已结案' : '未完成'}
        </StatusBadge>
        <h2>{restored?.runtime.endingTitle ?? '故事仍在进行'}</h2>
        <p className="muted">
          {restored?.runtime.endingSummary ??
            '返回漫游页继续推进节点，或选择提前结束生成未完成结局。'}
        </p>
      </Card>
    </PageShell>
  )
}

export function HistoryPage() {
  const navigate = useNavigate()
  const history = useStoryHistory()
  const corruptRecords = useLiveQuery(() => db.corruptRecords.toArray(), [])

  const reuse = async (
    preferences: NonNullable<typeof history>[number]['result']['preferences'],
  ) => {
    await savePendingGeneration(preferences)
    navigate('/generating')
  }

  return (
    <PageShell title="历史记录" eyebrow="ARCHIVE INDEX">
      {corruptRecords?.map((record) => (
        <Card className="state-card state-card--error" key={record.id}>
          <h2>有一条本地记录已损坏</h2>
          <p>记录已隔离，不会影响应用启动。你可以清理这条隔离记录。</p>
          <Button
            variant="secondary"
            onClick={() =>
              record.id === undefined
                ? undefined
                : void db.corruptRecords.delete(record.id)
            }
          >
            清理该条记录
          </Button>
        </Card>
      ))}
      {history?.map(({ record, result }) => (
        <Card className="history-record" key={record.id}>
          <div className="history-record__heading">
            <ArchiveLabel>{record.id}</ArchiveLabel>
            <StatusBadge
              tone={record.status === 'completed' ? 'success' : 'warning'}
            >
              {record.status === 'completed' ? '已完成' : '可继续'}
            </StatusBadge>
          </div>
          <h2>{record.title}</h2>
          <p className="muted">
            更新于 {new Date(record.updatedAt).toLocaleString('zh-CN')}
          </p>
          <div className="history-record__actions">
            {record.status === 'completed' ? (
              <Link
                className="button button--secondary"
                to={`/story/${record.id}/result`}
              >
                查看结局
              </Link>
            ) : (
              <Link
                className="button button--secondary"
                to={`/story/${record.id}/play`}
              >
                继续
              </Link>
            )}
            <Button
              variant="quiet"
              onClick={() => void reuse(result.preferences)}
            >
              复用偏好生成
            </Button>
            <Button
              variant="quiet"
              onClick={() => void deleteStoryCascade(record.id)}
            >
              删除
            </Button>
          </div>
        </Card>
      ))}
      {history?.length === 0 && (
        <EmptyState
          title="还没有本地历史"
          description="生成的故事会保留最近 5 条。"
        />
      )}
    </PageShell>
  )
}

export function SettingsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [safetyNotices, setSafetyNotices] = useState(true)
  const stored = useLiveQuery(() => db.settings.get('app'), [])

  useEffect(() => {
    if (
      stored?.value &&
      typeof stored.value === 'object' &&
      'safetyNotices' in stored.value
    ) {
      setSafetyNotices(Boolean(stored.value.safetyNotices))
    }
  }, [stored])

  const saveSettings = async () => {
    await db.settings.put({
      key: 'app',
      value: { safetyNotices },
      updatedAt: new Date().toISOString(),
    })
    setModalOpen(false)
    setToastVisible(true)
    window.setTimeout(() => setToastVisible(false), 1800)
  }

  return (
    <PageShell title="偏好设置" eyebrow="SETTINGS">
      <Card>
        <Settings aria-hidden="true" />
        <h2>现场提示</h2>
        <label className="toggle-row">
          <span>
            <strong>始终显示风险提示</strong>
            <small>在每个现场节点重复显示安全信息</small>
          </span>
          <input
            type="checkbox"
            checked={safetyNotices}
            onChange={(event) => setSafetyNotices(event.target.checked)}
            aria-label="始终显示风险提示"
          />
        </label>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setModalOpen(true)}
        >
          保存设置
        </Button>
      </Card>
      <Modal
        open={modalOpen}
        title="确认保存"
        onClose={() => setModalOpen(false)}
      >
        <p className="muted">设置仅保存在当前设备的 Mock 环境中。</p>
        <Button fullWidth onClick={() => void saveSettings()}>
          确认
        </Button>
      </Modal>
      <Toast message="设置已保存" visible={toastVisible} />
    </PageShell>
  )
}

export function OfflinePage() {
  const counts = useLiveQuery(
    async () => ({
      stories: await db.stories.count(),
      photos: await db.localPhotos.count(),
      queued: await db.syncQueue.filter((entry) => entry.attempts < 3).count(),
    }),
    [],
  )

  return (
    <PageShell title="离线档案" eyebrow="OFFLINE">
      <section className="center-stage">
        <span className="signal-disc" aria-hidden="true">
          <WifiOff />
        </span>
        <ArchiveLabel>LOCAL COPY</ArchiveLabel>
        <h1>你暂时离开了网络</h1>
        <p>
          应用外壳、故事 JSON、POI
          基础信息和抽象路线均可离线读取；腾讯地图瓦片与在线生成不会缓存。
        </p>
        <div className="offline-metrics">
          <span>{counts?.stories ?? 0} 个本地故事</span>
          <span>{counts?.photos ?? 0} 张本地照片</span>
          <span>{counts?.queued ?? 0} 条待同步</span>
        </div>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          <Download aria-hidden="true" />
          重新检查连接
        </Button>
      </section>
    </PageShell>
  )
}

export function NotFoundPage() {
  return (
    <PageShell title="档案不存在" eyebrow="404 / NOT FOUND">
      <ErrorState
        title="这条暗线没有被收录"
        description="链接可能已失效，或档案编号输入有误。"
        action={
          <Link className="button button--secondary" to="/">
            返回城市暗线
          </Link>
        }
      />
    </PageShell>
  )
}
