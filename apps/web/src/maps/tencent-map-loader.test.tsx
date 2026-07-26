import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RouteMap } from './RouteMap'
import {
  loadTencentMap,
  resetTencentMapLoaderForTests,
} from './tencent-map-loader'
import type { TencentMapNamespace } from './tencent-map-types'
import { testGenerationResult } from '../test/generation-fixture'

afterEach(() => {
  resetTencentMapLoaderForTests()
})

describe('Tencent Map script loader', () => {
  it('loads the script only once for concurrent callers', async () => {
    const first = loadTencentMap('browser-key')
    const second = loadTencentMap('browser-key')
    const scripts = document.querySelectorAll('#tencent-map-gl-script')

    expect(scripts).toHaveLength(1)
    window.TMap = {} as TencentMapNamespace
    scripts[0]?.dispatchEvent(new Event('load'))

    await expect(first).resolves.toBe(window.TMap)
    await expect(second).resolves.toBe(window.TMap)
  })

  it('removes a failed script and allows retry', async () => {
    const first = loadTencentMap('browser-key')
    document
      .querySelector('#tencent-map-gl-script')
      ?.dispatchEvent(new Event('error'))
    await expect(first).rejects.toThrow('failed to load')
    expect(document.querySelector('#tencent-map-gl-script')).toBeNull()

    const retry = loadTencentMap('browser-key')
    const retryScript = document.querySelector('#tencent-map-gl-script')
    expect(retryScript).not.toBeNull()
    window.TMap = {} as TencentMapNamespace
    retryScript?.dispatchEvent(new Event('load'))
    await expect(retry).resolves.toBe(window.TMap)
  })
})

describe('RouteMap fallback', () => {
  it('shows an abstract route when the browser key is missing', () => {
    render(<RouteMap routePlan={testGenerationResult.routePlan} />)

    expect(
      screen.getByRole('region', { name: '抽象路线图' }),
    ).toBeInTheDocument()
    expect(screen.getByText('浏览器地图 Key 未配置')).toBeInTheDocument()
    expect(screen.getByText('模拟 A1')).toBeInTheDocument()
  })
})
