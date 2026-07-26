import { useState, type PropsWithChildren, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  MapPinned,
  PackageOpen,
  RotateCcw,
  Settings,
  Signal,
  WifiOff,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
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
  return (
    <PageShell title="随身档案" eyebrow="INVENTORY">
      <StoryIdLabel />
      <div className="metric-grid">
        <Card>
          <PackageOpen aria-hidden="true" />
          <strong>02</strong>
          <span>物件</span>
        </Card>
        <Card>
          <MapPinned aria-hidden="true" />
          <strong>03</strong>
          <span>线索</span>
        </Card>
      </div>
      <Card>
        <ArchiveLabel>ITEM / 002</ArchiveLabel>
        <h2>折叠过四次的船票</h2>
        <p className="muted">
          票面时间被红笔改成 19:17，背面压有一个不完整的圆形印章。
        </p>
      </Card>
    </PageShell>
  )
}

export function JournalPage() {
  return (
    <PageShell title="漫游手记" eyebrow="JOURNAL">
      <StoryIdLabel />
      <Card className="journal-entry">
        <span>今天 · 18:40</span>
        <h2>雨声盖住了一部分广播</h2>
        <p>我记得最后一句是“让没有编号的事物继续存在”。</p>
      </Card>
      <EmptyState
        title="还没有新的手记"
        description="完成现场任务后，新的记录会出现在这里。"
      />
    </PageShell>
  )
}

export function ResultPage() {
  return (
    <PageShell title="档案结案" eyebrow="RESULT">
      <section className="result-mark">
        <span>结局 02 / 04</span>
        <strong>留下那一分钟</strong>
      </section>
      <Card>
        <StatusBadge tone="success">已结案</StatusBadge>
        <h2>城市允许一个误差存在</h2>
        <p className="muted">
          你没有修正最后的钟。那一分钟留在河岸，成为只有步行者知道的暗线。
        </p>
      </Card>
    </PageShell>
  )
}

export function HistoryPage() {
  return (
    <PageShell title="历史记录" eyebrow="ARCHIVE INDEX">
      <Card className="history-row">
        <ArchiveLabel>CASE 017</ArchiveLabel>
        <div>
          <h2>梧桐区失物电台</h2>
          <p className="muted">进行中 · 今天 18:40</p>
        </div>
        <BookOpen aria-hidden="true" />
      </Card>
      <Card className="history-row">
        <ArchiveLabel>CASE 006</ArchiveLabel>
        <div>
          <h2>晚风保管处</h2>
          <p className="muted">已结案 · 7 月 19 日</p>
        </div>
        <Check aria-hidden="true" />
      </Card>
    </PageShell>
  )
}

export function SettingsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)

  const saveSettings = () => {
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
          <input type="checkbox" defaultChecked aria-label="始终显示风险提示" />
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
        <Button fullWidth onClick={saveSettings}>
          确认
        </Button>
      </Modal>
      <Toast message="设置已保存" visible={toastVisible} />
    </PageShell>
  )
}

export function OfflinePage() {
  return (
    <PageShell title="离线档案" eyebrow="OFFLINE">
      <section className="center-stage">
        <span className="signal-disc" aria-hidden="true">
          <WifiOff />
        </span>
        <ArchiveLabel>LOCAL COPY</ArchiveLabel>
        <h1>你暂时离开了网络</h1>
        <p>已缓存的页面仍可查看；生成故事、更新路线和同步进度需要重新联网。</p>
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
