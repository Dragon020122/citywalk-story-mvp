import { Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import {
  CreatePage,
  GeneratingPage,
  HistoryPage,
  InventoryPage,
  JournalPage,
  NotFoundPage,
  OfflinePage,
  PlayPage,
  PreviewPage,
  ResultPage,
  SettingsPage,
} from './pages/RoutePages'
import './App.css'

export function App() {
  return (
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
  )
}
