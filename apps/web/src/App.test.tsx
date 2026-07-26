import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { App } from './App'

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('应用路由', () => {
  const routes = [
    ['/create', '建立漫游档案'],
    ['/generating', '正在编档'],
    ['/story/mock_demo_007/preview', '故事预览'],
    ['/story/mock_test/play', '建立漫游档案'],
    ['/story/mock_test/inventory', '随身档案'],
    ['/story/mock_test/journal', '漫游手记'],
    ['/story/mock_test/result', '档案结案'],
    ['/history', '历史记录'],
    ['/settings', '偏好设置'],
  ] as const

  routes.forEach(([path, title]) => {
    it(`渲染 ${path}`, () => {
      renderRoute(path)
      expect(
        screen.getByText(title, { selector: 'strong' }),
      ).toBeInTheDocument()
    })
  })

  it('渲染离线页', () => {
    renderRoute('/offline')
    expect(
      screen.getByRole('heading', { name: '你暂时离开了网络' }),
    ).toBeInTheDocument()
  })

  it('未知路由显示 404', () => {
    renderRoute('/missing-archive')
    expect(screen.getByText('404 / NOT FOUND')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '这条暗线没有被收录' }),
    ).toBeInTheDocument()
  })
})

describe('首页交互与移动画布', () => {
  it('主按钮进入创建页，历史按钮进入历史页', async () => {
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(screen.getByRole('link', { name: /开始生成/ }))
    expect(
      screen.getByRole('heading', { name: '选择路线区域' }),
    ).toBeInTheDocument()
  })

  ;[360, 375, 390, 430].forEach((width) => {
    it(`支持 ${width}px 视口`, () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
      })
      renderRoute('/')
      const canvas = document.querySelector('.phone-canvas')
      expect(canvas).toBeInTheDocument()
      expect(getComputedStyle(canvas!).maxWidth).toBe('430px')
      expect(document.documentElement.style.overflowX).not.toBe('auto')
    })
  })
})
