import { useEffect } from 'react'
import type { Poi } from '@citywalk/shared'
import { createMarkerIcon } from './marker-icon'
import type {
  TencentMapNamespace,
  TMapClickEvent,
  TMapInstance,
} from './tencent-map-types'

interface PoiMarkerProps {
  tmap: TencentMapNamespace
  map: TMapInstance
  poi: Poi
  index: number
  kind?: 'normal' | 'next' | 'alternative'
  onSelect: (poi: Poi) => void
}

export function PoiMarker({
  tmap,
  map,
  poi,
  index,
  kind = 'normal',
  onSelect,
}: PoiMarkerProps) {
  useEffect(() => {
    const colors = {
      normal: '#383a3d',
      next: '#d84a3a',
      alternative: '#8b7851',
    }
    const layer = new tmap.MultiMarker({
      id: `poi-${poi.id}`,
      map,
      styles: {
        marker: new tmap.MarkerStyle({
          width: kind === 'alternative' ? 30 : 36,
          height: kind === 'alternative' ? 36 : 43,
          anchor: { x: 18, y: 43 },
          src: createMarkerIcon(
            colors[kind],
            kind === 'alternative' ? '备' : String(index + 1),
          ),
        }),
      },
      geometries: [
        {
          id: poi.id,
          styleId: 'marker',
          position: new tmap.LatLng(poi.latitude, poi.longitude),
          properties: { poiId: poi.id },
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
  }, [index, kind, map, onSelect, poi, tmap])

  return null
}
