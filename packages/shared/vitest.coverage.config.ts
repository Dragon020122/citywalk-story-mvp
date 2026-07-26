import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/content-mode.ts',
        'src/route-engine.ts',
        'src/run.ts',
        'src/story.ts',
        'src/story-runtime.ts',
      ],
      thresholds: {
        lines: 90,
        'src/route-engine.ts': { lines: 90 },
        'src/story-runtime.ts': { lines: 90 },
      },
    },
  },
})
