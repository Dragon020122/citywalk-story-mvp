export interface TMapLatLng {
  lat?: number
  lng?: number
}

export interface TMapLayer {
  setMap(map: TMapInstance | null): void
  on?(event: string, handler: (event: TMapClickEvent) => void): void
  off?(event: string, handler: (event: TMapClickEvent) => void): void
}

export interface TMapClickEvent {
  geometry?: {
    id?: string
    properties?: Record<string, unknown>
  }
}

export interface TMapInstance {
  destroy?(): void
  fitBounds?(bounds: unknown, options?: { padding?: number }): void
}

export interface TencentMapNamespace {
  LatLng: new (latitude: number, longitude: number) => TMapLatLng
  LatLngBounds: new (southwest: TMapLatLng, northeast: TMapLatLng) => unknown
  Map: new (
    container: HTMLElement,
    options: {
      center: TMapLatLng
      zoom: number
      pitch?: number
      rotation?: number
      showControl?: boolean
    },
  ) => TMapInstance
  MarkerStyle: new (options: Record<string, unknown>) => unknown
  PolylineStyle: new (options: Record<string, unknown>) => unknown
  MultiMarker: new (options: Record<string, unknown>) => TMapLayer
  MultiPolyline: new (options: Record<string, unknown>) => TMapLayer
}

declare global {
  interface Window {
    TMap?: TencentMapNamespace
  }
}
