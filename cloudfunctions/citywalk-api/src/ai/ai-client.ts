import { initializeCloudBase } from '../cloudbase-sdk.js'

export const DEFAULT_AI_MODEL = 'deepseek-v4-flash'
export const AI_TIMEOUT_MS = 60_000

export interface GenerateTextInput {
  system: string
  prompt: string
  signal?: AbortSignal | undefined
}

export interface AiTextClient {
  generateText(input: GenerateTextInput): Promise<string>
}

export class AiClientError extends Error {
  readonly code = 'AI_GENERATION_ERROR'

  constructor(message = 'AI generation failed') {
    super(message)
    this.name = 'AiClientError'
  }
}

export interface CloudBaseAiClientOptions {
  environmentId?: string | undefined
  modelName?: string | undefined
  timeoutMs?: number | undefined
}

export class CloudBaseAiClient implements AiTextClient {
  private readonly model
  private readonly modelName: string
  private readonly timeoutMs: number

  constructor(options: CloudBaseAiClientOptions = {}) {
    const app = options.environmentId
      ? initializeCloudBase({ env: options.environmentId })
      : initializeCloudBase()
    this.model = app.ai().createModel('cloudbase')
    this.modelName =
      options.modelName ?? process.env.AI_MODEL ?? DEFAULT_AI_MODEL
    this.timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS
  }

  async generateText(input: GenerateTextInput): Promise<string> {
    if (input.signal?.aborted) {
      throw new AiClientError('AI generation was aborted')
    }

    let timeout: ReturnType<typeof setTimeout> | undefined
    let abortHandler: (() => void) | undefined

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new AiClientError('AI generation timed out')),
          this.timeoutMs,
        )
      })
      const abortPromise = new Promise<never>((_resolve, reject) => {
        abortHandler = () =>
          reject(new AiClientError('AI generation was aborted'))
        input.signal?.addEventListener('abort', abortHandler, {
          once: true,
        })
      })
      const generationPromise = this.model.generateText(
        {
          model: this.modelName,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.prompt },
          ],
          temperature: 0.2,
          maxSteps: 1,
          ...(input.signal ? { abortSignal: input.signal } : {}),
        },
        { timeout: this.timeoutMs },
      )
      const result = await Promise.race([
        generationPromise,
        timeoutPromise,
        abortPromise,
      ])

      if (result.error || !result.text.trim()) {
        throw new AiClientError()
      }
      return result.text
    } catch (error) {
      if (error instanceof AiClientError) {
        throw error
      }
      throw new AiClientError()
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
      if (abortHandler) {
        input.signal?.removeEventListener('abort', abortHandler)
      }
    }
  }
}
