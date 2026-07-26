import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/api-client.ts',
        'src/journey-resolver.ts',
        'src/journey-storage.ts',
        'src/gameplay/gameplay-machine.ts',
        'src/gameplay/gameplay-storage.ts',
        'src/hooks/useJourneyGeneration.ts',
        'src/maps/navigation.ts',
        'src/maps/tencent-map-loader.ts',
        'src/persistence/database.ts',
        'src/persistence/photo-storage.ts',
        'src/persistence/sync-queue.ts',
        'src/results/poster-image.ts',
        'src/results/result-summary.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
})
