import { useCallback, useEffect, useRef, useState } from 'react'
import type { Poi, RoutePlan } from '@citywalk/shared'
import { Button } from '../components/Button'
import { CurrentPoiMarker } from './CurrentPoiMarker'
import { MapFallback } from './MapFallback'
import { PoiMarker } from './PoiMarker'
import { RoutePolyline } from './RoutePolyline'
import { loadTencentMap } from './tencent-map-loader'
import type { TencentMapNamespace, TMapInstance } from './tencent-map-types'

interface RouteMapProps {
  routePlan: RoutePlan
  currentPoiId?: string | undefined
  nextPoiId?: string | undefined
  onSelectPoi?: ((poi: Poi) => void) | undefined
}

export function RouteMap({
  routePlan,
  currentPoiId,
  nextPoiId,
  onSelectPoi,
}: RouteMapProps) {
  const browserKey = (import.meta.env.VITE_TENCENT_MAP_BROWSER_KEY ?? '').trim()
  const containerRef = useRef<HTMLDivElement>(null)
  const [tmap, setTmap] = useState<TencentMapNamespace | null>(null)
  const [map, setMap] = useState<TMapInstance | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null)

  const selectPoi = useCallback(
    (poi: Poi) => {
      setSelectedPoi(poi)
      onSelectPoi?.(poi)
    },
    [onSelectPoi],
  )

  useEffect(() => {
    if (!browserKey) return
    let active = true
    setLoadFailed(false)
    void loadTencentMap(browserKey)
      .then((namespace) => {
        if (active) setTmap(namespace)
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [browserKey, retryToken])

  useEffect(() => {
    const container = containerRef.current
    const firstPoi = routePlan.selectedPois[0]
    if (!container || !tmap || !firstPoi) return
    const instance = new tmap.Map(container, {
      center: new tmap.LatLng(firstPoi.latitude, firstPoi.longitude),
      zoom: 15,
      pitch: 0,
      rotation: 0,
      showControl: false,
    })
    const allPois = [...routePlan.selectedPois, ...routePlan.alternativePois]
    const latitudes = allPois.map((poi) => poi.latitude)
    const longitudes = allPois.map((poi) => poi.longitude)
    if (allPois.length > 1 && instance.fitBounds) {
      const bounds = new tmap.LatLngBounds(
        new tmap.LatLng(Math.min(...latitudes), Math.min(...longitudes)),
        new tmap.LatLng(Math.max(...latitudes), Math.max(...longitudes)),
      )
      instance.fitBounds(bounds, { padding: 48 })
    }
    setMap(instance)
    return () => {
      setMap(null)
      instance.destroy?.()
    }
  }, [routePlan.alternativePois, routePlan.selectedPois, tmap])

  if (!browserKey) {
    return (
      <MapFallback
        routePlan={routePlan}
        currentPoiId={currentPoiId}
        nextPoiId={nextPoiId}
        reason="missing-key"
        onSelectPoi={selectPoi}
      />
    )
  }

  if (loadFailed) {
    return (
      <MapFallback
        routePlan={routePlan}
        currentPoiId={currentPoiId}
        nextPoiId={nextPoiId}
        reason="load-error"
        onSelectPoi={selectPoi}
        onRetry={() => setRetryToken((value) => value + 1)}
      />
    )
  }

  return (
    <section className="route-map-shell" aria-label="腾讯地图路线">
      <div className="route-map-container" ref={containerRef} />
      {tmap && map && (
        <>
          <RoutePolyline
            tmap={tmap}
            map={map}
            segments={routePlan.routeSegments}
            pois={routePlan.selectedPois}
          />
          {routePlan.selectedPois.map((poi, index) =>
            poi.id === currentPoiId ? (
              <CurrentPoiMarker
                key={poi.id}
                tmap={tmap}
                map={map}
                poi={poi}
                onSelect={selectPoi}
              />
            ) : (
              <PoiMarker
                key={poi.id}
                tmap={tmap}
                map={map}
                poi={poi}
                index={index}
                kind={poi.id === nextPoiId ? 'next' : 'normal'}
                onSelect={selectPoi}
              />
            ),
          )}
          {routePlan.alternativePois.map((poi, index) => (
            <PoiMarker
              key={poi.id}
              tmap={tmap}
              map={map}
              poi={poi}
              index={index}
              kind="alternative"
              onSelect={selectPoi}
            />
          ))}
        </>
      )}
      {!map && <div className="route-map-loading">正在加载腾讯地图…</div>}
      {selectedPoi && (
        <div className="route-map-poi-card" role="status">
          <span>
            {selectedPoi.verificationStatus === 'mock' ? 'MOCK POI' : 'POI'}
          </span>
          <strong>{selectedPoi.shortName}</strong>
          <small>{selectedPoi.address}</small>
          <Button variant="quiet" onClick={() => setSelectedPoi(null)}>
            关闭
          </Button>
        </div>
      )}
    </section>
  )
}
