import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '城市暗线',
        short_name: '城市暗线',
        description: 'CityWalk 互动剧情生成器',
        theme_color: '#101010',
        background_color: '#101010',
        display: 'standalone',
      },
    }),
  ],
})
