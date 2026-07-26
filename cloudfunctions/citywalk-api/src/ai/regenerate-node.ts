import {
  StoryNodeSchema,
  type StoryNode,
} from '@citywalk/shared'
import { z } from 'zod'
import type { AiTextClient } from './ai-client.js'
import { parseAiJson } from './json-parser.js'
import {
  regenerateNodePrompt,
  systemPrompt,
} from './prompts/index.js'

const TaskCopySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    instructions: z.string().trim().min(1).optional(),
    photoPrompt: z.string().trim().min(1).optional(),
    question: z.string().trim().min(1).optional(),
    hint: z.string().trim().min(1).optional(),
    listeningPrompt: z.string().trim().min(1).optional(),
    journalPrompt: z.string().trim().min(1).optional(),
    interactionPrompt: z.string().trim().min(1).optional(),
  })
  .nullable()

const RegeneratedNodeCopySchema = z.object({
  storyText: z.string().trim().min(1).max(260),
  arrivalText: z.string().trim().min(1).max(100).nullable(),
  taskCopy: TaskCopySchema,
  choiceTexts: z.array(
    z.object({
      choiceId: z.string().trim().min(1),
      text: z.string().trim().min(1),
    }),
  ),
})

export const regenerateNodeCopy = async (input: {
  aiClient: AiTextClient
  node: StoryNode
  reason?: string | undefined
  signal?: AbortSignal | undefined
}): Promise<StoryNode> => {
  const output = await input.aiClient.generateText({
    system: systemPrompt,
    prompt: regenerateNodePrompt({
      node: input.node,
      reason: input.reason,
    }),
    signal: input.signal,
  })
  const copy = parseAiJson(output, RegeneratedNodeCopySchema)
  const task =
    input.node.task && copy.taskCopy
      ? { ...input.node.task, ...copy.taskCopy }
      : input.node.task
  const choiceCopy = new Map(
    copy.choiceTexts.map((choice) => [choice.choiceId, choice.text]),
  )

  return StoryNodeSchema.parse({
    ...input.node,
    storyText: copy.storyText,
    arrivalText: copy.arrivalText,
    task,
    choices: input.node.choices.map((choice) => ({
      ...choice,
      text: choiceCopy.get(choice.id) ?? choice.text,
    })),
  })
}
