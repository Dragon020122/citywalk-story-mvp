import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import * as journeyStorage from './journey-storage'
import {
  loadJourneyDraft,
  loadGenerationResult,
  saveGenerationResult,
  saveJourneyDraft,
  savePendingGeneration,
  type JourneyDraft,
} from './journey-storage'
import { db } from './persistence/database'
import { queryClient } from './query-client'
import { testGenerationResult } from './test/generation-fixture'

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function saveDraft(step: number) {
  await saveJourneyDraft(step, testGenerationResult.preferences)
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

  it('选择 3 小时后可进入步骤 3，返回后仍保持选择', async () => {
    const user = userEvent.setup()
    renderRoute('/create')

    await user.click(screen.getByLabelText(/梧桐区档案线/))
    await user.click(screen.getByRole('button', { name: /下一步/ }))

    const threeHours = screen.getByLabelText(/3 小时/)
    await user.click(threeHours)
    expect(threeHours).toBeChecked()

    await user.click(screen.getByRole('button', { name: /下一步/ }))
    expect(
      screen.getByRole('heading', { name: '选择同行对象' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('请选择漫游时长。')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /上一步/ }))
    expect(screen.getByLabelText(/3 小时/)).toBeChecked()
    await user.click(screen.getByRole('button', { name: /下一步/ }))
    expect(
      screen.getByRole('heading', { name: '选择同行对象' }),
    ).toBeInTheDocument()
  })

  it('未选择时长时保留必填校验', async () => {
    const user = userEvent.setup()
    renderRoute('/create')

    await user.click(screen.getByLabelText(/梧桐区档案线/))
    await user.click(screen.getByRole('button', { name: /下一步/ }))
    await user.click(screen.getByRole('button', { name: /下一步/ }))

    expect(screen.getByText('请选择漫游时长。')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '设置时长和起点' }),
    ).toBeInTheDocument()
  })

  it.each(['2 小时', '3 小时', '4 小时'])(
    '%s 对应的数字时长可以通过步骤 2 校验',
    async (label) => {
      const user = userEvent.setup()
      renderRoute('/create')

      await user.click(screen.getByLabelText(/梧桐区档案线/))
      await user.click(screen.getByRole('button', { name: /下一步/ }))
      await user.click(screen.getByLabelText(new RegExp(label)))
      await user.click(screen.getByRole('button', { name: /下一步/ }))

      expect(
        screen.getByRole('heading', { name: '选择同行对象' }),
      ).toBeInTheDocument()
    },
  )

  it('迁移字符串旧草稿时长为数字，非法旧值会被移除', async () => {
    await db.draftPreferences.put({
      id: 'draft',
      step: 1,
      values: {
        ...testGenerationResult.preferences,
        durationMinutes: '180',
      },
      updatedAt: '2026-07-26T08:00:00.000Z',
    })

    await expect(loadJourneyDraft()).resolves.toMatchObject({
      values: { durationMinutes: 180 },
    })
    expect((await db.draftPreferences.get('draft'))?.values).toMatchObject({
      durationMinutes: 180,
    })

    await db.draftPreferences.put({
      id: 'draft',
      step: 1,
      values: {
        ...testGenerationResult.preferences,
        durationMinutes: 999,
      },
      updatedAt: '2026-07-26T08:00:00.000Z',
    })

    const invalidDraft = await loadJourneyDraft()
    expect(invalidDraft?.values).not.toHaveProperty('durationMinutes')
  })

  it('用户选择时长后不会被延迟完成的草稿恢复覆盖', async () => {
    const storedDraft: JourneyDraft = {
      step: 1,
      values: {
        ...testGenerationResult.preferences,
        durationMinutes: 120,
      },
    }
    let resolveDraft: ((value: JourneyDraft | null) => void) | undefined
    vi.spyOn(journeyStorage, 'loadJourneyDraft').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDraft = resolve
      }),
    )
    const user = userEvent.setup()
    renderRoute('/create')
    await waitFor(() => expect(resolveDraft).toBeDefined())

    await user.click(screen.getByLabelText(/梧桐区档案线/))
    await user.click(screen.getByRole('button', { name: /下一步/ }))
    await user.click(screen.getByLabelText(/3 小时/))

    await act(async () => {
      resolveDraft?.(storedDraft)
      await Promise.resolve()
    })

    expect(screen.getByLabelText(/3 小时/)).toBeChecked()
    expect(screen.getByLabelText(/2 小时/)).not.toBeChecked()
    expect(screen.queryByText('已恢复未提交草稿')).not.toBeInTheDocument()
  })

  it.each([0, 50, 100, 200, 300] as const)(
    '数字预算 %i 可以通过步骤 7 校验并进入确认页',
    async (budgetCny) => {
      const draftValues: JourneyDraft['values'] = {
        ...testGenerationResult.preferences,
      }
      delete draftValues.budgetCny
      await saveJourneyDraft(6, draftValues)
      const user = userEvent.setup()
      renderRoute('/create')
      await screen.findByText('已恢复未提交草稿')

      const budgetOption = screen.getByLabelText(
        budgetCny === 0 ? '免费' : `¥${budgetCny}`,
      )
      await user.click(budgetOption)

      expect(budgetOption).toBeChecked()
      expect(screen.queryByText('请选择预算上限。')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /下一步/ }))
      expect(
        screen.getByRole('heading', { name: '确认生成' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          budgetCny === 0 ? /免费 ·/ : new RegExp(`¥${budgetCny} ·`),
        ),
      ).toBeInTheDocument()
    },
  )

  it('未选择预算时停留在步骤 7 且不发起生成请求', async () => {
    const draftValues: JourneyDraft['values'] = {
      ...testGenerationResult.preferences,
    }
    delete draftValues.budgetCny
    await saveJourneyDraft(6, draftValues)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRoute('/create')
    await screen.findByText('已恢复未提交草稿')

    await user.click(screen.getByRole('button', { name: /下一步/ }))

    expect(screen.getByText('请选择预算上限。')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '设置预算与室内偏好' }),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('确认页提交前会重新校验完整表单并返回步骤 7', async () => {
    const draftValues: JourneyDraft['values'] = {
      ...testGenerationResult.preferences,
    }
    delete draftValues.budgetCny
    await saveJourneyDraft(7, draftValues)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRoute('/create')
    await screen.findByText('已恢复未提交草稿')

    await user.click(screen.getByRole('button', { name: /生成故事/ }))

    expect(
      screen.getByRole('heading', { name: '设置预算与室内偏好' }),
    ).toBeInTheDocument()
    expect(screen.getByText('请选择预算上限。')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('返回步骤 7 修改预算后，确认摘要使用最新数字预算', async () => {
    await saveDraft(6)
    const user = userEvent.setup()
    renderRoute('/create')
    await screen.findByText('已恢复未提交草稿')

    await user.click(screen.getByLabelText('¥100'))
    await user.click(screen.getByRole('button', { name: /下一步/ }))
    await user.click(screen.getByRole('button', { name: /上一步/ }))
    expect(screen.getByLabelText('¥100')).toBeChecked()

    await user.click(screen.getByLabelText('¥300'))
    await user.click(screen.getByRole('button', { name: /下一步/ }))
    expect(screen.getByText(/¥300 ·/)).toBeInTheDocument()
  })

  it.each([
    [{ budgetCny: '300' }, 300],
    [{ budget: 300 }, 300],
    [{ budgetLimit: 300 }, 300],
    [{ budgetCny: '0' }, 0],
  ] as const)(
    '迁移旧草稿预算 %# 为数字 budgetCny',
    async (legacy, expected) => {
      await db.draftPreferences.put({
        id: 'draft',
        step: 6,
        values: {
          ...testGenerationResult.preferences,
          budgetCny: undefined,
          ...legacy,
        },
        updatedAt: '2026-07-26T08:00:00.000Z',
      })

      await expect(loadJourneyDraft()).resolves.toMatchObject({
        values: { budgetCny: expected },
      })
      expect((await db.draftPreferences.get('draft'))?.values).toMatchObject({
        budgetCny: expected,
      })
      expect((await db.draftPreferences.get('draft'))?.schemaVersion).toBe(2)
    },
  )

  it('移除非法旧草稿预算并要求用户重新选择', async () => {
    await db.draftPreferences.put({
      id: 'draft',
      step: 6,
      values: {
        ...testGenerationResult.preferences,
        budgetCny: 999,
      },
      updatedAt: '2026-07-26T08:00:00.000Z',
    })

    const draft = await loadJourneyDraft()
    expect(draft?.values).not.toHaveProperty('budgetCny')
  })

  it('最多允许选择四项兴趣', async () => {
    await saveJourneyDraft(3, {
      ...testGenerationResult.preferences,
      interests: [],
    })
    const user = userEvent.setup()
    renderRoute('/create')
    await screen.findByText('已恢复未提交草稿')

    for (const interest of ['建筑细节', '城市声音', '街区历史', '光影观察']) {
      await user.click(screen.getByLabelText(interest))
    }
    expect(screen.getByLabelText('公共艺术')).toBeDisabled()
    expect(screen.getByText('已选择 4 / 4')).toBeInTheDocument()
  })

  it('恢复未提交草稿并保留所在步骤', async () => {
    await saveDraft(4)
    renderRoute('/create')

    expect(await screen.findByText('已恢复未提交草稿')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '选择剧情类型' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/城市悬疑/)).toBeChecked()
  })

  it('重复点击只提交一次生成任务', async () => {
    await saveDraft(7)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the first real request pending while duplicate clicks settle.
          }),
      ),
    )
    const fetchMock = vi.mocked(fetch)
    const user = userEvent.setup()
    renderRoute('/create')

    await user.dblClick(await screen.findByRole('button', { name: /生成故事/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(await db.draftPreferences.get('pending')).toBeTruthy()
  })
})

describe('生成请求与预览保护', () => {
  it('无法连接 API 时显示可操作的网络错误', async () => {
    await savePendingGeneration(testGenerationResult.preferences)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    renderRoute('/generating')

    expect(
      await screen.findByText('无法连接生成服务，请确认本地 API 已启动后重试。'),
    ).toBeInTheDocument()
  })

  it('生成失败后显示错误并允许重试', async () => {
    await savePendingGeneration(testGenerationResult.preferences)
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
    await savePendingGeneration(testGenerationResult.preferences)
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
    const routeRequest = JSON.parse(
      String(vi.mocked(fetchMock).mock.calls[0]?.[1]?.body),
    ) as { preferences: Record<string, unknown> }
    const storyRequest = JSON.parse(
      String(vi.mocked(fetchMock).mock.calls[1]?.[1]?.body),
    ) as { preferences: Record<string, unknown> }
    for (const request of [routeRequest, storyRequest]) {
      expect(request.preferences.budgetCny).toBe(50)
      expect(typeof request.preferences.budgetCny).toBe('number')
      expect(request.preferences).not.toHaveProperty('budget')
      expect(request.preferences).not.toHaveProperty('budgetLimit')
    }
    expect(
      screen.queryByText('这段完整剧情不应出现在预览页面。'),
    ).not.toBeInTheDocument()
    expect(await loadGenerationResult('story_test')).toBeTruthy()
  })

  it('可以取消正在进行的请求', async () => {
    await savePendingGeneration(testGenerationResult.preferences)
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

  it('合法生成结果可以进入预览', async () => {
    await saveGenerationResult({
      ...testGenerationResult,
      story: {
        ...testGenerationResult.story,
        fallbackUsed: false,
        fallbackReason: null,
      },
    })
    renderRoute('/story/story_test/preview')

    expect(
      await screen.findByRole('heading', { name: '失物电台测试档案' }),
    ).toBeInTheDocument()
    expect(screen.getByText('节点类型概览')).toBeInTheDocument()
    expect(screen.getByText('任务类型概览')).toBeInTheDocument()
  })
})
