import { useEffect } from 'react'
import type { Poi } from '@citywalk/shared'
import { createMarkerIcon } from './marker-icon'
import type {
  TencentMapNamespace,
  TMapClickEvent,
  TMapInstance,
} from './tencent-map-types'

interface CurrentPoiMarkerProps {
  tmap: TencentMapNamespace
  map: TMapInstance
  poi: Poi
  onSelect: (poi: Poi) => void
}

export function CurrentPoiMarker({
  tmap,
  map,
  poi,
  onSelect,
}: CurrentPoiMarkerProps) {
  useEffect(() => {
    const layer = new tmap.MultiMarker({
      id: `current-${poi.id}`,
      map,
      styles: {
        current: new tmap.MarkerStyle({
          width: 42,
          height: 50,
          anchor: { x: 21, y: 50 },
          src: createMarkerIcon('#d84a3a', '当'),
        }),
      },
      geometries: [
        {
          id: poi.id,
          styleId: 'current',
          position: new tmap.LatLng(poi.latitude, poi.longitude),
        },
      ],
    })
    const handleClick = (event: TMapClickEvent) => {
      if (event.geometry?.id === poi.id) onSelect(poi)
    }
    layer.on?.('click', handleClick)
    return () => {
      layer.off?.('click', handleClick)
      layer.setMap(null)
    }
  }, [map, onSelect, poi, tmap])

  return null
}
