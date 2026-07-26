import { useCallback, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type {
  GenerateStoryResponse,
  JourneyPreferences,
  RoutePlan,
} from '@citywalk/shared'
import { generateJourneyStory, planJourneyRoute } from '../api-client'
import { loadPendingGeneration, saveGenerationResult } from '../journey-storage'

export type GenerationStatus =
  'idle' | 'running' | 'failed' | 'cancelled' | 'timed-out' | 'missing'

interface UseJourneyGenerationOptions {
  onComplete: (storyId: string) => void
}

export function useJourneyGeneration({
  onComplete,
}: UseJourneyGenerationOptions) {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [stage, setStage] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  const runningRef = useRef(false)
  const cancelReasonRef = useRef<'cancelled' | 'timed-out' | null>(null)

  const { mutateAsync: planRoute, reset: resetRouteMutation } = useMutation<
    RoutePlan,
    Error,
    { preferences: JourneyPreferences; signal: AbortSignal }
  >({
    mutationKey: ['route-plan'],
    mutationFn: ({ preferences, signal }) =>
      planJourneyRoute(preferences, signal),
  })

  const { mutateAsync: generateStory, reset: resetStoryMutation } = useMutation<
    GenerateStoryResponse,
    Error,
    {
      preferences: JourneyPreferences
      routePlan: RoutePlan
      signal: AbortSignal
    }
  >({
    mutationKey: ['story-generation'],
    mutationFn: ({ preferences, routePlan, signal }) =>
      generateJourneyStory(preferences, routePlan, signal),
  })

  const start = useCallback(async () => {
    if (runningRef.current) return
    const preferences = await loadPendingGeneration()
    if (!preferences) {
      setStatus('missing')
      setErrorMessage('没有找到待生成的行程设置，请先完成创建表单。')
      return
    }

    runningRef.current = true
    cancelReasonRef.current = null
    setStatus('running')
    setErrorMessage('')
    setStage(0)
    resetRouteMutation()
    resetStoryMutation()

    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = window.setTimeout(() => {
      cancelReasonRef.current = 'timed-out'
      controller.abort()
    }, 90_000)

    try {
      setStage(1)
      const routePlan = await planRoute({
        preferences,
        signal: controller.signal,
      })
      setStage(2)

      setStage(3)
      const story = await generateStory({
        preferences,
        routePlan,
        signal: controller.signal,
      })
      setStage(4)

      setStage(5)
      await saveGenerationResult({
        preferences,
        routePlan,
        story,
        savedAt: new Date().toISOString(),
      })
      onComplete(story.blueprint.storyId)
    } catch (error) {
      if (cancelReasonRef.current === 'timed-out') {
        setStatus('timed-out')
        setErrorMessage('生成超过 90 秒，已自动停止。你可以重新尝试。')
      } else if (
        cancelReasonRef.current === 'cancelled' ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        setStatus('cancelled')
        setErrorMessage('生成已取消，当前请求没有继续执行。')
      } else {
        setStatus('failed')
        setErrorMessage(
          error instanceof Error ? error.message : '生成失败，请稍后重试。',
        )
      }
    } finally {
      window.clearTimeout(timeout)
      controllerRef.current = null
      runningRef.current = false
    }
  }, [
    generateStory,
    onComplete,
    planRoute,
    resetRouteMutation,
    resetStoryMutation,
  ])

  const cancel = useCallback(() => {
    if (!runningRef.current) return
    cancelReasonRef.current = 'cancelled'
    controllerRef.current?.abort()
  }, [])

  return {
    status,
    stage,
    errorMessage,
    start,
    cancel,
    isRunning: status === 'running',
  }
}
