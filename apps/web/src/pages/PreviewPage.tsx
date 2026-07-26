import { ArrowRight, Footprints, Map, RotateCcw, Route } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ArchiveLabel, Chip, StatusBadge } from '../components/Labels'
import { PageShell } from '../components/PageShell'
import { genreOptions } from '../journey-options'
import { savePendingGeneration } from '../journey-storage'
import { LazyRouteMap } from '../maps/LazyRouteMap'
import { useStoredStory } from '../persistence/hooks'

const nodeTypeLabels: Record<string, string> = {
  intro: '开场',
  travel: '移动',
  discovery: '发现',
  task: '任务',
  puzzle: '谜题',
  choice: '选择',
  side_quest: '支线',
  checkpoint: '检查点',
  climax: '高潮',
  ending_gate: '结局门',
}

const taskTypeLabels: Record<string, string> = {
  observe: '观察',
  photo: '拍照',
  puzzle: '谜题',
  soundscape: '声音',
  journal: '手记',
  companion: '同行',
}

function countLabels(values: string[], labels: Record<string, string>) {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1
    return result
  }, {})
  return Object.entries(counts).map(
    ([value, count]) => `${labels[value] ?? value} ${count}`,
  )
}

function MapPlaceholder() {
  return (
    <section className="map-placeholder" aria-label="路线地图占位">
      <Map aria-hidden="true" />
      <div className="map-placeholder__line" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <span>腾讯地图路线将在漫游阶段加载</span>
      <small>此处仅显示路线结构占位，不提供真实导航</small>
    </section>
  )
}

function OverviewSection({
  nodeTypes,
  taskTypes,
  warnings,
}: {
  nodeTypes: string[]
  taskTypes: string[]
  warnings: string[]
}) {
  return (
    <>
      <Card>
        <span className="section-kicker">NODE OVERVIEW</span>
        <h2>节点类型概览</h2>
        <div className="chip-row">
          {nodeTypes.map((label) => (
            <Chip key={label}>{label}</Chip>
          ))}
        </div>
      </Card>
      <Card>
        <span className="section-kicker">TASK OVERVIEW</span>
        <h2>任务类型概览</h2>
        <div className="chip-row">
          {taskTypes.length ? (
            taskTypes.map((label) => <Chip key={label}>{label}</Chip>)
          ) : (
            <p className="muted">本次故事没有额外现场任务。</p>
          )}
        </div>
      </Card>
      <aside className="content-warning">
        <strong>内容提醒</strong>
        <ul>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </aside>
    </>
  )
}

function DemoPreview() {
  return (
    <>
      <section className="preview-cover">
        <ArchiveLabel>MOCK_DEMO_007</ArchiveLabel>
        <span className="preview-cover__type">固定示范故事</span>
        <h1>第七码头没有钟</h1>
        <p>一张不存在于班次表中的船票，将你带向被城市漏记的一分钟。</p>
      </section>
      <div className="preview-facts">
        <Card>
          <span>角色身份</span>
          <strong>临时时间校对员</strong>
        </Card>
        <Card>
          <span>核心任务</span>
          <strong>找回被拿走的整点</strong>
        </Card>
      </div>
      <Card>
        <StatusBadge>固定 Mock 档案</StatusBadge>
        <div className="preview-metrics">
          <span>城市悬疑</span>
          <span>75 分钟</span>
          <span>5 站</span>
          <span>3.1 公里</span>
          <span>预算 ¥50</span>
        </div>
      </Card>
      <MapPlaceholder />
      <OverviewSection
        nodeTypes={['开场 1', '发现 2', '选择 1', '结局门 1']}
        taskTypes={['观察 2', '谜题 1']}
        warnings={['固定内容仅用于产品演示', 'Mock POI 不可用于真实导航']}
      />
    </>
  )
}

export function PreviewPage() {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const result = useStoredStory(storyId)
  const demo = storyId === 'mock_demo_007'

  if (!demo && result === undefined) {
    return (
      <PageShell title="故事预览" eyebrow="LOCAL DATABASE">
        <Card>
          <h2>正在恢复故事</h2>
          <p>正在从此设备读取离线剧情与路线。</p>
        </Card>
      </PageShell>
    )
  }
  if (!demo && (!result || result.story.blueprint.storyId !== storyId)) {
    return <Navigate to="/create" replace />
  }

  const regenerate = async () => {
    if (!result) return
    await savePendingGeneration(result.preferences)
    navigate('/generating', { replace: true })
  }

  const changeRoute = () => {
    navigate('/create')
  }

  return (
    <PageShell
      title="故事预览"
      eyebrow="ARCHIVE PREVIEW"
      action={
        <Link
          className="button button--primary button--full"
          to={demo ? '/create' : `/story/${storyId}/play`}
        >
          {demo ? '创建我的漫游' : '开始漫游'}
          <ArrowRight aria-hidden="true" />
        </Link>
      }
    >
      {demo ? (
        <DemoPreview />
      ) : (
        result && (
          <>
            {result.story.fallbackUsed && (
              <div className="fallback-banner" role="status">
                <strong>AI 剧情校验未通过，已启用 Mock 回退故事</strong>
                路线规划结果保持不变；你可以继续体验或重新生成剧情。
              </div>
            )}
            <section className="preview-cover">
              <ArchiveLabel>{result.story.blueprint.storyId}</ArchiveLabel>
              <span className="preview-cover__type">
                {
                  genreOptions.find(
                    (option) => option.value === result.story.blueprint.genre,
                  )?.label
                }
              </span>
              <h1>{result.story.blueprint.title}</h1>
              <p>{result.story.blueprint.subtitle}</p>
            </section>
            <div className="preview-facts">
              <Card>
                <span>角色身份</span>
                <strong>{result.story.blueprint.role}</strong>
              </Card>
              <Card>
                <span>核心任务</span>
                <strong>{result.story.blueprint.mission}</strong>
              </Card>
            </div>
            <Card className="preview-route-card">
              <div className="preview-route-card__heading">
                <StatusBadge
                  tone={result.routePlan.degraded ? 'warning' : 'success'}
                >
                  {result.routePlan.degraded ? '降级路线' : '路线已规划'}
                </StatusBadge>
                <Route aria-hidden="true" />
              </div>
              <div className="preview-metrics">
                <span>
                  {
                    genreOptions.find(
                      (option) => option.value === result.preferences.genre,
                    )?.label
                  }
                </span>
                <span>{result.routePlan.totalEstimatedMinutes} 分钟</span>
                <span>{result.routePlan.selectedPois.length} 站</span>
                <span>
                  <Footprints aria-hidden="true" />
                  {(result.routePlan.totalWalkMeters / 1000).toFixed(1)} 公里
                </span>
                <span>预算 ¥{result.preferences.budgetCny}</span>
              </div>
            </Card>
            <LazyRouteMap
              routePlan={result.routePlan}
              currentPoiId={result.routePlan.selectedPois[0]?.id}
              nextPoiId={result.routePlan.selectedPois[1]?.id}
            />
            <OverviewSection
              nodeTypes={countLabels(
                result.story.storyGraph.nodes.map((node) => node.type),
                nodeTypeLabels,
              )}
              taskTypes={countLabels(
                result.story.storyGraph.nodes.flatMap((node) =>
                  node.task ? [node.task.type] : [],
                ),
                taskTypeLabels,
              )}
              warnings={[
                ...result.story.blueprint.contentWarnings,
                result.story.blueprint.fictionNotice,
              ]}
            />
            <div className="preview-secondary-actions">
              <Button variant="secondary" onClick={changeRoute}>
                更换路线
              </Button>
              <Button variant="quiet" onClick={() => void regenerate()}>
                <RotateCcw aria-hidden="true" />
                重新生成剧情
              </Button>
            </div>
          </>
        )
      )}
    </PageShell>
  )
}
