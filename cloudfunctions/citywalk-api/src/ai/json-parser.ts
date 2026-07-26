import { z } from 'zod'

export class AiOutputParseError extends Error {
  readonly code = 'AI_GENERATION_ERROR'
  readonly issues: Array<{ path: string; message: string }>

  constructor(
    message: string,
    issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message)
    this.name = 'AiOutputParseError'
    this.issues = issues
  }
}

export const stripMarkdownCodeFence = (value: string): string => {
  const match = value
    .trim()
    .match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)
  return match?.[1]?.trim() ?? value.trim()
}

export const extractFirstJsonObject = (value: string): string | null => {
  let start = -1
  let depth = 0
  let insideString = false
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (insideString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        insideString = false
      }
      continue
    }

    if (character === '"') {
      insideString = true
    } else if (character === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
    } else if (character === '}' && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        return value.slice(start, index + 1)
      }
    }
  }

  return null
}

export const parseAiJson = <T>(
  rawOutput: string,
  schema: z.ZodType<T>,
): T => {
  const stripped = stripMarkdownCodeFence(rawOutput)
  let parsed: unknown

  try {
    parsed = JSON.parse(stripped)
  } catch {
    const objectText = extractFirstJsonObject(stripped)
    if (!objectText) {
      throw new AiOutputParseError('AI output does not contain valid JSON')
    }
    try {
      parsed = JSON.parse(objectText)
    } catch {
      throw new AiOutputParseError('AI output contains malformed JSON')
    }
  }

  const validated = schema.safeParse(parsed)
  if (!validated.success) {
    throw new AiOutputParseError(
      'AI output failed schema validation',
      validated.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    )
  }
  return validated.data
}
