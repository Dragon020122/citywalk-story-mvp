import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import {
  initEdgeOnePreviewAuth,
  installEdgeOnePreviewNavigation,
} from './edgeone-preview-auth'
import { installOnlineSync } from './persistence/sync-queue'
import './index.css'

initEdgeOnePreviewAuth()
installEdgeOnePreviewNavigation()
installOnlineSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
