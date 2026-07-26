import type { StoryNode } from '@citywalk/shared'

export const regenerateNodePrompt = (input: {
  node: StoryNode
  reason: string | undefined
}): string => `
Rewrite only the reader-facing copy for this node. Output:
{
  "storyText": string,
  "arrivalText": string | null,
  "taskCopy": {
    "title"?: string,
    "instructions"?: string,
    "photoPrompt"?: string,
    "question"?: string,
    "hint"?: string,
    "listeningPrompt"?: string,
    "journalPrompt"?: string,
    "interactionPrompt"?: string
  } | null,
  "choiceTexts": [{ "choiceId": string, "text": string }]
}

Do not change node id, poiId, type, task id/type, rewards,
requiredState, next, fallbackNext, choice ids, choice effects, or ending
conditions. storyText is at most 260 Chinese characters and arrivalText is
at most 100 Chinese characters. Keep the copy concise for mobile reading.
reason: ${input.reason ?? 'Improve mobile readability'}
node: ${JSON.stringify(input.node)}
`.trim()
