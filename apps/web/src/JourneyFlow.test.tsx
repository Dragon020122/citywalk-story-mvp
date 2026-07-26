import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import {
  GENERATION_RESULT_KEY,
  JOURNEY_DRAFT_KEY,
  PENDING_GENERATION_KEY,
  saveGenerationResult,
  savePendingGeneration,
} from './journey-storage'
import { queryClient } from './query-client'
import { testGenerationResult } from './test/generation-fixture'

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function saveDraft(step: number) {
  window.localStorage.setItem(
    JOURNEY_DRAFT_KEY,
    JSON.stringify({
      version: 1,
      step,
      values: testGenerationResult.preferences,
    }),
  )
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
  queryClient.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('创建行程表单', () => {
  it('按步骤前进并阻止缺少路线的提交', async () => {
    const user = userEvent.setup()
    renderRoute('/create')

    await user.click(screen.getByRole('button', { name: /下一步/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '选择路线区域' }),
    ).toBeInTheDocument()

    await user.click(screen.getByLabelText(/梧桐区档案线/))
    await user.click(screen.getByRole('button', { name: /下一步/ }))
    expect(
      screen.getByRole('heading', { name: '设置时长和起点' }),
    ).toBeInTheDocument()
  })

  it('最多允许选择四项兴趣', async () => {
    saveDraft(3)
    window.localStorage.setItem(
      JOURNEY_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        step: 3,
        values: { ...testGenerationResult.preferences, interests: [] },
      }),
    )
    const user = userEvent.setup()
    renderRoute('/create')

    for (const interest of ['建筑细节', '城市声音', '街区历史', '光影观察']) {
      await user.click(screen.getByLabelText(interest))
    }
    expect(screen.getByLabelText('公共艺术')).toBeDisabled()
    expect(screen.getByText('已选择 4 / 4')).toBeInTheDocument()
  })

  it('恢复未提交草稿并保留所在步骤', () => {
    saveDraft(4)
    renderRoute('/create')

    expect(screen.getByText('已恢复未提交草稿')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '选择剧情类型' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/城市悬疑/)).toBeChecked()
  })

  it('重复点击只提交一次生成任务', async () => {
    saveDraft(7)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the first real request pending while duplicate clicks settle.
          }),
      ),
    )
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    const user = userEvent.setup()
    renderRoute('/create')

    await user.dblClick(screen.getByRole('button', { name: /生成故事/ }))

    const pendingWrites = storageSpy.mock.calls.filter(
      ([key]) => key === PENDING_GENERATION_KEY,
    )
    expect(pendingWrites).toHaveLength(1)
  })
})

describe('生成请求与预览保护', () => {
  it('生成失败后显示错误并允许重试', async () => {
    savePendingGeneration(testGenerationResult.preferences)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ROUTE_NOT_FOUND',
          message: '没有符合条件的路线',
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRoute('/generating')

    expect(
      await screen.findByRole('heading', { name: '无法完成生成' }),
    ).toBeInTheDocument()
    expect(screen.getByText('没有符合条件的路线')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重新尝试' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('使用真实两段请求并明确显示 Mock 回退', async () => {
    savePendingGeneration(testGenerationResult.preferences)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ routePlan: testGenerationResult.routePlan }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(testGenerationResult.story), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderRoute('/generating')

    expect(
      await screen.findByText('AI 剧情校验未通过，已启用 Mock 回退故事'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByText('这段完整剧情不应出现在预览页面。'),
    ).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(GENERATION_RESULT_KEY)).toBeTruthy()
  })

  it('可以取消正在进行的请求', async () => {
    savePendingGeneration(testGenerationResult.preferences)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          }),
      ),
    )
    const user = userEvent.setup()
    renderRoute('/generating')

    const cancel = screen.getByRole('button', { name: /取消生成/ })
    await waitFor(() => expect(cancel).toBeEnabled())
    await user.click(cancel)
    expect(
      await screen.findByRole('heading', { name: '已取消生成' }),
    ).toBeInTheDocument()
  })

  it('没有匹配生成结果时保护预览路由', async () => {
    renderRoute('/story/story_missing/preview')

    expect(
      await screen.findByRole('heading', { name: '选择路线区域' }),
    ).toBeInTheDocument()
  })

  it('合法生成结果可以进入预览', () => {
    saveGenerationResult({
      ...testGenerationResult,
      story: {
        ...testGenerationResult.story,
        fallbackUsed: false,
        fallbackReason: null,
      },
    })
    renderRoute('/story/story_test/preview')

    expect(
      screen.getByRole('heading', { name: '失物电台测试档案' }),
    ).toBeInTheDocument()
    expect(screen.getByText('节点类型概览')).toBeInTheDocument()
    expect(screen.getByText('任务类型概览')).toBeInTheDocument()
  })
})
