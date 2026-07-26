import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { GenerationResult } from '../journey-storage'
import { Compass, Copy, Navigation, Route } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { rerouteJourney } from '../api-client'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ArchiveLabel, StatusBadge } from '../components/Labels'
import { PageShell } from '../components/PageShell'
import { Toast } from '../components/Toast'
import { loadGenerationResult, saveGenerationResult } from '../journey-storage'
import { copyPoiAddress, openTencentNavigation } from '../maps/navigation'
import { RouteMap } from '../maps/RouteMap'

const unavailableReasons = [
  '地点暂时关闭',
  '现场不方便前往',
  '我想跳过这里',
] as const

export function PlayPage() {
  const { storyId } = useParams()
  const initialResult = loadGenerationResult()
  const [result, setResult] = useState<GenerationResult | null>(initialResult)
  const [currentIndex] = useState(0)
  const [navigationMessage, setNavigationMessage] = useState('')
  const rerouteController = useRef<AbortController | null>(null)
  const currentPoi = result?.routePlan.selectedPois[currentIndex]
  const nextPoi = result?.routePlan.selectedPois[currentIndex + 1]
  const currentNode = useMemo(
    () =>
      result?.story.storyGraph.nodes.find(
        (node) => node.poiId === currentPoi?.id,
      ),
    [currentPoi?.id, result?.story.storyGraph.nodes],
  )

  const rerouteMutation = useMutation({
    mutationKey: ['story-reroute', storyId],
    mutationFn: async () => {
      if (!result || !storyId || !currentPoi) {
        throw new Error('当前故事或地点不存在。')
      }
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
    onSuccess: (rerouted) => {
      if (!result) return
      const updated: GenerationResult = {
        ...result,
        routePlan: rerouted.routePlan,
        story: {
          ...result.story,
          storyGraph: rerouted.storyGraph,
        },
        savedAt: new Date().toISOString(),
      }
      saveGenerationResult(updated)
      setResult(updated)
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

  if (!result || !storyId || result.story.blueprint.storyId !== storyId) {
    return <Navigate to="/create" replace />
  }
  if (!currentPoi) return <Navigate to="/create" replace />

  const destination = nextPoi ?? currentPoi
  const navigationConfig = {
    baseUrl:
      import.meta.env.VITE_TENCENT_MAP_NAV_BASE_URL ||
      'https://apis.map.qq.com/uri/v1/routeplan',
    referer: import.meta.env.VITE_TENCENT_MAP_NAV_REFERER || 'citywalk-story',
  }

  const openNavigation = async () => {
    const outcome = await openTencentNavigation(destination, navigationConfig)
    setNavigationMessage(
      outcome === 'opened'
        ? '已打开腾讯地图路线页面'
        : outcome === 'copied'
          ? '无法打开地图，已复制目的地地址'
          : '无法打开地图，请手动复制目的地地址',
    )
  }

  const copyAddress = async () => {
    setNavigationMessage(
      (await copyPoiAddress(destination))
        ? '目的地地址已复制'
        : '复制失败，请长按地址手动复制',
    )
  }

  return (
    <PageShell
      title="漫游进行中"
      eyebrow={`STOP ${String(currentIndex + 1).padStart(2, '0')}`}
      action={
        <Button fullWidth onClick={() => void openNavigation()}>
          <Navigation aria-hidden="true" />
          打开腾讯地图导航
        </Button>
      }
    >
      <div className="play-route-heading">
        <ArchiveLabel>{storyId}</ArchiveLabel>
        <StatusBadge tone={result.routePlan.degraded ? 'warning' : 'success'}>
          {result.routePlan.degraded ? '人工距离路线' : '腾讯步行路线'}
        </StatusBadge>
      </div>
      <RouteMap
        routePlan={result.routePlan}
        currentPoiId={currentPoi.id}
        nextPoiId={nextPoi?.id}
      />
      <Card className="current-poi-card">
        <span className="section-kicker">CURRENT POI</span>
        <h1>{currentPoi.shortName}</h1>
        <p>{currentPoi.address}</p>
        {currentNode && (
          <>
            <h2>{currentNode.title}</h2>
            <p>{currentNode.storyText}</p>
          </>
        )}
        <Button variant="quiet" onClick={() => void copyAddress()}>
          <Copy aria-hidden="true" />
          复制目的地地址
        </Button>
      </Card>
      {nextPoi && (
        <Card className="next-poi-card">
          <Compass aria-hidden="true" />
          <span>
            <small>下一点</small>
            <strong>{nextPoi.shortName}</strong>
          </span>
          <Route aria-hidden="true" />
        </Card>
      )}
      <section className="poi-unavailable" aria-labelledby="unavailable-title">
        <span className="section-kicker">ROUTE EXCEPTION</span>
        <h2 id="unavailable-title">这个地点无法继续？</h2>
        <p>请选择现场情况，我们会调用 reroute 接口更换人工策展的备用节点。</p>
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
        {rerouteMutation.isSuccess && (
          <p className="reroute-success" role="status">
            已替换为备用地点并更新路线。
          </p>
        )}
        {rerouteMutation.isError && (
          <p className="field-error" role="alert">
            {rerouteMutation.error.message}
          </p>
        )}
      </section>
      <Toast message={navigationMessage} visible={Boolean(navigationMessage)} />
    </PageShell>
  )
}
