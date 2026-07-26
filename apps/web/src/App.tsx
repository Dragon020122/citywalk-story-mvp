import { QueryClientProvider } from '@tanstack/react-query'
import { Route, Routes } from 'react-router-dom'
import { CreatePage } from './pages/CreatePage'
import { GeneratingPage } from './pages/GeneratingPage'
import { HomePage } from './pages/HomePage'
import { PlayPage } from './pages/PlayPage'
import { PreviewPage } from './pages/PreviewPage'
import {
  HistoryPage,
  InventoryPage,
  JournalPage,
  NotFoundPage,
  OfflinePage,
  ResultPage,
  SettingsPage,
} from './pages/RoutePages'
import { queryClient } from './query-client'
import './App.css'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="phone-canvas">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/generating" element={<GeneratingPage />} />
          <Route path="/story/:storyId/preview" element={<PreviewPage />} />
          <Route path="/story/:storyId/play" element={<PlayPage />} />
          <Route path="/story/:storyId/inventory" element={<InventoryPage />} />
          <Route path="/story/:storyId/journal" element={<JournalPage />} />
          <Route path="/story/:storyId/result" element={<ResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </QueryClientProvider>
  )
}
