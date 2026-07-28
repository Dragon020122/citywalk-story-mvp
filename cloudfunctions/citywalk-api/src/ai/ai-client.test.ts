import { beforeEach, describe, expect, it, vi } from 'vitest'

const cloudBaseMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  createModel: vi.fn(),
  ai: vi.fn(),
  initialize: vi.fn(),
}))

vi.mock('../cloudbase-sdk.js', () => ({
  initializeCloudBase: cloudBaseMocks.initialize,
}))

import {
  AI_TIMEOUT_MS,
  AiClientError,
  CloudBaseAiClient,
  DEFAULT_AI_MODEL,
} from './ai-client.js'

describe('CloudBaseAiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cloudBaseMocks.createModel.mockReturnValue({
      generateText: cloudBaseMocks.generateText,
    })
    cloudBaseMocks.ai.mockReturnValue({
      createModel: cloudBaseMocks.createModel,
    })
    cloudBaseMocks.initialize.mockReturnValue({ ai: cloudBaseMocks.ai })
  })

  it('initializes CloudBase and returns generated text', async () => {
    cloudBaseMocks.generateText.mockResolvedValue({
      text: '  validated story  ',
    })

    const client = new CloudBaseAiClient({
      environmentId: 'test-env',
      modelName: 'test-model',
      timeoutMs: 500,
    })

    await expect(
      client.generateText({ system: 'rules', prompt: 'story' }),
    ).resolves.toBe('  validated story  ')
    expect(cloudBaseMocks.initialize).toHaveBeenCalledWith({ env: 'test-env' })
    expect(cloudBaseMocks.createModel).toHaveBeenCalledWith('cloudbase')
    expect(cloudBaseMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        temperature: 0.2,
        maxSteps: 1,
      }),
      { timeout: 500 },
    )
  })

  it('uses the documented defaults', async () => {
    cloudBaseMocks.generateText.mockResolvedValue({ text: 'story' })
    const client = new CloudBaseAiClient()

    await client.generateText({ system: 'rules', prompt: 'story' })

    expect(cloudBaseMocks.initialize).toHaveBeenCalledWith()
    expect(cloudBaseMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_AI_MODEL }),
      { timeout: AI_TIMEOUT_MS },
    )
  })

  it('rejects an already aborted request without calling the model', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      new CloudBaseAiClient().generateText({
        system: 'rules',
        prompt: 'story',
        signal: controller.signal,
      }),
    ).rejects.toThrow('AI generation was aborted')
    expect(cloudBaseMocks.generateText).not.toHaveBeenCalled()
  })

  it('normalizes empty and provider error responses', async () => {
    const client = new CloudBaseAiClient()
    cloudBaseMocks.generateText.mockResolvedValueOnce({
      text: ' ',
      error: null,
    })
    await expect(
      client.generateText({ system: 'rules', prompt: 'story' }),
    ).rejects.toBeInstanceOf(AiClientError)

    cloudBaseMocks.generateText.mockRejectedValueOnce(new Error('secret stack'))
    await expect(
      client.generateText({ system: 'rules', prompt: 'story' }),
    ).rejects.toEqual(new AiClientError())
  })

  it('times out and responds to an abort signal', async () => {
    vi.useFakeTimers()
    cloudBaseMocks.generateText.mockImplementation(() => new Promise(() => {}))

    const timedOut = new CloudBaseAiClient({ timeoutMs: 10 }).generateText({
      system: 'rules',
      prompt: 'story',
    })
    const timeoutExpectation = expect(timedOut).rejects.toThrow(
      'AI generation timed out',
    )
    await vi.advanceTimersByTimeAsync(10)
    await timeoutExpectation

    const controller = new AbortController()
    const aborted = new CloudBaseAiClient({ timeoutMs: 100 }).generateText({
      system: 'rules',
      prompt: 'story',
      signal: controller.signal,
    })
    controller.abort()
    await expect(aborted).rejects.toThrow('AI generation was aborted')
    vi.useRealTimers()
  })
})
