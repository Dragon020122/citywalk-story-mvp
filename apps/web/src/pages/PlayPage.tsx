import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Compass,
  Copy,
  Navigation,
  Pause,
  Play,
  Route,
  XCircle,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { rerouteJourney } from '../api-client'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ArchiveLabel, StatusBadge } from '../components/Labels'
import { PageShell } from '../components/PageShell'
import { OfflineBanner } from '../components/States'
import { Toast } from '../components/Toast'
import { InventoryPanel } from '../gameplay/InventoryPanel'
import { TaskRenderer } from '../gameplay/TaskComponents'
import { useGameplay } from '../gameplay/use-gameplay'
import type { RestoredGameplay } from '../gameplay/gameplay-storage'
import type { ResumeState } from '../gameplay/gameplay-machine'
import {
  loadGenerationResult,
  saveGenerationResult,
  type GenerationResult,
} from '../journey-storage'
import { copyPoiAddress, openTencentNavigation } from '../maps/navigation'
import { RouteMap } from '../maps/RouteMap'
import { useStoredGameplay } from '../persistence/hooks'

const stateLabels = {
  idle: '尚未开始',
  navigating: '前往地点',
  arrived: '已经到达',
  reading: '阅读剧情',
  tasking: '现场任务',
  choosing: '剧情选择',
  node_completed: '节点完成',
  rerouting: '正在改线',
  paused: '漫游暂停',
  ending: '结局生成',
  completed: '漫游完成',
  abandoned: '漫游已放弃',
  error: '需要处理',
} as const

const unavailableReasons = [
  '地点暂时关闭',
  '现场不方便前往',
  '我想跳过这里',
] as const

export function PlayPage() {
  const { storyId } = useParams()
  const [result, setResult] = useState<GenerationResult | null | undefined>(
    undefined,
  )
  useEffect(() => {
    let active = true
    void loadGenerationResult(storyId).then((stored) => {
      if (active) setResult(stored)
    })
    return () => {
      active = false
    }
  }, [storyId])
  const restored = useStoredGameplay(storyId, result?.story.storyGraph)

  if (result === undefined || restored === undefined) {
    return (
      <PageShell title="恢复离线档案" eyebrow="LOCAL DATABASE">
        <Card>
          <h2>正在读取此设备上的故事</h2>
          <p>路线、剧情与运行状态正在从 IndexedDB 恢复。</p>
        </Card>
      </PageShell>
    )
  }
  if (!result || !storyId || result.story.blueprint.storyId !== storyId) {
    return <Navigate to="/create" replace />
  }

  return (
    <GameplayScreen
      key={storyId}
      storyId={storyId}
      initialResult={result}
      restored={restored}
    />
  )
}

interface GameplayScreenProps {
  storyId: string
  initialResult: GenerationResult
  restored: RestoredGameplay | null
}

function GameplayScreen({
  storyId,
  initialResult,
  restored,
}: GameplayScreenProps) {
  const [result, setResult] = useState(initialResult)
  const [navigationMessage, setNavigationMessage] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  const rerouteController = useRef<AbortController | null>(null)
  const { state, graph, runtime, send } = useGameplay(
    storyId,
    result.story.storyGraph,
    restored,
  )
  const currentNode = graph.nodes.find(
    (node) => node.id === runtime.currentNodeId,
  )
  const currentPoi =
    result.routePlan.selectedPois.find(
      (poi) => poi.id === currentNode?.poiId,
    ) ?? result.routePlan.selectedPois[0]
  const nextNode = currentNode
    ? graph.nodes.find((node) => node.id === currentNode.next)
    : undefined
  const nextPoi = result.routePlan.selectedPois.find(
    (poi) => poi.id === nextNode?.poiId,
  )

  const rerouteMutation = useMutation({
    mutationKey: ['story-reroute', storyId, currentPoi?.id],
    mutationFn: async () => {
      if (!currentPoi) throw new Error('当前节点没有可用地点。')
      send({ type: 'START_REROUTE' })
      const controller = new AbortController()
      rerouteController.current = controller
      return rerouteJourney(
        {
          storyId,
          currentPoiId: currentPoi.id,
          unavailablePoiIds: [currentPoi.id],
          preferences: result.preferences,
          routePlan: result.routePlan,
        },
        controller.signal,
      )
    },
    onSuccess: async (rerouted) => {
      const updated = {
        ...result,
        routePlan: rerouted.routePlan,
        story: { ...result.story, storyGraph: rerouted.storyGraph },
        savedAt: new Date().toISOString(),
      }
      await saveGenerationResult(updated)
      setResult(updated)
      send({ type: 'REROUTE_SUCCESS', graph: rerouted.storyGraph })
    },
    onError: (error: Error) => {
      send({ type: 'REROUTE_FAILURE', message: error.message })
    },
    onSettled: () => {
      rerouteController.current = null
    },
  })

  useEffect(
    () => () => {
      rerouteController.current?.abort()
    },
    [],
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (!currentNode || !currentPoi) {
      send({ type: 'FAIL', message: '当前节点或 POI 不存在。' })
    }
  }, [currentNode, currentPoi, send])

  const navigationConfig = {
    baseUrl:
      import.meta.env.VITE_TENCENT_MAP_NAV_BASE_URL ||
      'https://apis.map.qq.com/uri/v1/routeplan',
    referer: import.meta.env.VITE_TENCENT_MAP_NAV_REFERER || 'citywalk-story',
  }

  const openNavigation = async () => {
    if (!currentPoi) return
    const outcome = await openTencentNavigation(currentPoi, navigationConfig)
    setNavigationMessage(
      outcome === 'opened'
        ? '已打开腾讯地图路线页面'
        : outcome === 'copied'
          ? '无法打开地图，已复制目的地地址'
          : '无法打开地图，请手动复制目的地地址',
    )
  }

  const copyAddress = async () => {
    if (!currentPoi) return
    setNavigationMessage(
      (await copyPoiAddress(currentPoi))
        ? '目的地地址已复制'
        : '复制失败，请长按地址手动复制',
    )
  }

  const completedCount = runtime.completedNodeIds.length
  const activePausable = ![
    'idle',
    'paused',
    'ending',
    'completed',
    'abandoned',
    'error',
  ].includes(state)

  return (
    <PageShell
      title="漫游执行引擎"
      eyebrow={`${stateLabels[state]} · ${completedCount}/${graph.nodes.length}`}
    >
      {!online && <OfflineBanner />}
      <div className="play-route-heading">
        <ArchiveLabel>{storyId}</ArchiveLabel>
        <StatusBadge
          tone={
            state === 'error' || state === 'abandoned' ? 'danger' : 'success'
          }
        >
          {stateLabels[state]}
        </StatusBadge>
      </div>

      {currentPoi && (
        <RouteMap
          routePlan={result.routePlan}
          currentPoiId={currentPoi.id}
          nextPoiId={nextPoi?.id}
        />
      )}

      {state === 'idle' && (
        <Card className="gameplay-stage">
          <span className="section-kicker">READY</span>
          <h1>{result.story.blueprint.title}</h1>
          <p>{result.story.blueprint.mission}</p>
          <Button fullWidth onClick={() => send({ type: 'START' })}>
            <Play aria-hidden="true" />
            开始前往第一站
          </Button>
        </Card>
      )}

      {state === 'navigating' && currentPoi && currentNode && (
        <Card className="gameplay-stage">
          <span className="section-kicker">NAVIGATING</span>
          <h1>{currentPoi.shortName}</h1>
          <p>{currentPoi.address}</p>
          <Button fullWidth onClick={() => void openNavigation()}>
            <Navigation aria-hidden="true" />
            打开腾讯地图导航
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => send({ type: 'ARRIVE' })}
          >
            我已到达
          </Button>
          <Button variant="quiet" onClick={() => void copyAddress()}>
            <Copy aria-hidden="true" />
            复制地址
          </Button>
        </Card>
      )}

      {state === 'arrived' && currentNode && (
        <Card className="gameplay-stage">
          <span className="section-kicker">ARRIVAL</span>
          <h1>{currentNode.title}</h1>
          <p>
            {currentNode.arrivalText ??
              '你已抵达故事节点，周围的细节开始进入档案。'}
          </p>
          {currentNode.safetyNotice && (
            <small>{currentNode.safetyNotice}</small>
          )}
          <Button fullWidth onClick={() => send({ type: 'READ_ARRIVAL' })}>
            阅读剧情
          </Button>
        </Card>
      )}

      {state === 'reading' && currentNode && (
        <section className="story-scene gameplay-stage">
          <span className="section-kicker">STORY</span>
          <h1>{currentNode.title}</h1>
          <p>{currentNode.storyText}</p>
          <Button fullWidth onClick={() => send({ type: 'FINISH_READING' })}>
            继续
          </Button>
        </section>
      )}

      {state === 'tasking' && currentNode?.task && (
        <Card className="gameplay-stage">
          <StatusBadge tone="warning">{currentNode.task.title}</StatusBadge>
          <h2>完成现场任务</h2>
          <TaskRenderer
            task={currentNode.task}
            storyId={storyId}
            nodeId={currentNode.id}
            onComplete={(completion) =>
              send({ type: 'COMPLETE_TASK', ...completion })
            }
          />
        </Card>
      )}

      {state === 'choosing' && currentNode && (
        <Card className="gameplay-stage">
          <span className="section-kicker">
            {currentNode.type === 'side_quest' ? 'SIDE QUEST' : 'CHOICE'}
          </span>
          <h2>
            {currentNode.type === 'side_quest'
              ? '接受、拒绝或结束这条支线'
              : '做出选择'}
          </h2>
          <div className="choice-actions">
            {currentNode.choices.map((choice) => (
              <Button
                variant="secondary"
                key={choice.id}
                onClick={() =>
                  send({ type: 'SUBMIT_CHOICE', choiceId: choice.id })
                }
              >
                {choice.text}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {state === 'node_completed' && currentNode && (
        <Card className="gameplay-stage reward-card">
          <StatusBadge tone="success">节点已完成</StatusBadge>
          <h2>{currentNode.title}</h2>
          <p>
            奖励已记入档案：{currentNode.rewards.clues.length} 条线索，
            {currentNode.rewards.items.length} 件道具。
          </p>
          <Button fullWidth onClick={() => send({ type: 'ADVANCE' })}>
            前往下一站
            <Route aria-hidden="true" />
          </Button>
        </Card>
      )}

      {state === 'rerouting' && (
        <Card className="gameplay-stage">
          <h2>正在计算备用节点</h2>
          <p>只会从人工策展的备用 POI 中选择。</p>
        </Card>
      )}

      {state === 'paused' && (
        <Card className="gameplay-stage">
          <h2>漫游已暂停</h2>
          <p>进度已经保存在当前设备，恢复后继续原来的状态。</p>
          <Button fullWidth onClick={() => send({ type: 'RESUME' })}>
            <Play aria-hidden="true" />
            恢复漫游
          </Button>
        </Card>
      )}

      {state === 'ending' && (
        <Card className="gameplay-stage ending-card">
          <ArchiveLabel>{runtime.endingId ?? 'ENDING'}</ArchiveLabel>
          <h1>{runtime.endingTitle}</h1>
          <p>{runtime.endingSummary}</p>
          <Button fullWidth onClick={() => send({ type: 'FINISH_ENDING' })}>
            收录结局
          </Button>
        </Card>
      )}

      {state === 'completed' && (
        <Card className="gameplay-stage">
          <StatusBadge tone="success">漫游完成</StatusBadge>
          <h1>{runtime.endingTitle}</h1>
          <p>{runtime.endingSummary}</p>
          <Link
            className="button button--primary button--full"
            to={`/story/${storyId}/result`}
          >
            查看结案页
          </Link>
        </Card>
      )}

      {state === 'abandoned' && (
        <Card className="gameplay-stage">
          <h2>本次漫游已放弃</h2>
          <Link className="button button--secondary button--full" to="/">
            返回首页
          </Link>
        </Card>
      )}

      {state === 'error' && (
        <Card className="gameplay-stage">
          <StatusBadge tone="danger">运行时错误</StatusBadge>
          <h2>节点无法继续</h2>
          <p>{runtime.error}</p>
          <Button fullWidth onClick={() => send({ type: 'RETRY_NODE' })}>
            回退到安全节点
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => send({ type: 'END_EARLY' })}
          >
            生成未完成结局
          </Button>
        </Card>
      )}

      {!['completed', 'abandoned', 'ending', 'error'].includes(state) && (
        <section className="gameplay-controls" aria-label="漫游控制">
          {activePausable && (
            <Button
              variant="secondary"
              onClick={() =>
                send({ type: 'PAUSE', from: state as ResumeState })
              }
            >
              <Pause aria-hidden="true" />
              暂停
            </Button>
          )}
          <Button variant="quiet" onClick={() => send({ type: 'END_EARLY' })}>
            <XCircle aria-hidden="true" />
            提前结束
          </Button>
        </section>
      )}

      {state === 'navigating' && (
        <section
          className="poi-unavailable"
          aria-labelledby="unavailable-title"
        >
          <span className="section-kicker">ROUTE EXCEPTION</span>
          <h2 id="unavailable-title">这个地点无法继续？</h2>
          <p>选择现场情况后，仅从人工策展的备用节点重新规划。</p>
          <div>
            {unavailableReasons.map((reason) => (
              <Button
                variant="secondary"
                key={reason}
                disabled={rerouteMutation.isPending}
                onClick={() => rerouteMutation.mutate()}
              >
                {reason}
              </Button>
            ))}
          </div>
        </section>
      )}

      <InventoryPanel
        storyId={storyId}
        blueprint={result.story.blueprint}
        graph={graph}
        runtime={runtime}
      />
      {nextPoi && (
        <Card className="next-poi-card">
          <Compass aria-hidden="true" />
          <span>
            <small>下一地点</small>
            <strong>{nextPoi.shortName}</strong>
          </span>
          <Route aria-hidden="true" />
        </Card>
      )}
      <Toast message={navigationMessage} visible={Boolean(navigationMessage)} />
    </PageShell>
  )
}
