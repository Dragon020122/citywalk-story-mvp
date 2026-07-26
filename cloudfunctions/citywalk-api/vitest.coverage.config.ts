import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/app.ts',
        'src/middleware.ts',
        'src/route/**/*.ts',
        'src/ai/ai-client.ts',
        'src/ai/generate-*.ts',
        'src/ai/json-parser.ts',
        'src/ai/mock-story.ts',
        'src/ai/story-workflow.ts',
        'src/ai/validate-story-graph.ts',
        'src/repositories/memory-repositories.ts',
      ],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 80,
      },
    },
  },
})
