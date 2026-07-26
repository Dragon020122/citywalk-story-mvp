import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { CreatePage } from './pages/CreatePage'
import { HomePage } from './pages/HomePage'
import { queryClient } from './query-client'
import './App.css'

const GeneratingPage = lazy(() =>
  import('./pages/GeneratingPage').then((module) => ({
    default: module.GeneratingPage,
  })),
)
const PreviewPage = lazy(() =>
  import('./pages/PreviewPage').then((module) => ({
    default: module.PreviewPage,
  })),
)
const PlayPage = lazy(() =>
  import('./pages/PlayPage').then((module) => ({
    default: module.PlayPage,
  })),
)
const routePages = () => import('./pages/RoutePages')
const InventoryPage = lazy(() =>
  routePages().then((module) => ({ default: module.InventoryPage })),
)
const JournalPage = lazy(() =>
  routePages().then((module) => ({ default: module.JournalPage })),
)
const ResultPage = lazy(() =>
  routePages().then((module) => ({ default: module.ResultPage })),
)
const HistoryPage = lazy(() =>
  routePages().then((module) => ({ default: module.HistoryPage })),
)
const SettingsPage = lazy(() =>
  routePages().then((module) => ({ default: module.SettingsPage })),
)
const OfflinePage = lazy(() =>
  routePages().then((module) => ({ default: module.OfflinePage })),
)
const NotFoundPage = lazy(() =>
  routePages().then((module) => ({ default: module.NotFoundPage })),
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="phone-canvas">
        <Suspense
          fallback={
            <main className="screen" role="status">
              正在加载本地页面…
            </main>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/generating" element={<GeneratingPage />} />
            <Route path="/story/:storyId/preview" element={<PreviewPage />} />
            <Route path="/story/:storyId/play" element={<PlayPage />} />
            <Route
              path="/story/:storyId/inventory"
              element={<InventoryPage />}
            />
            <Route path="/story/:storyId/journal" element={<JournalPage />} />
            <Route path="/story/:storyId/result" element={<ResultPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
    </QueryClientProvider>
  )
}
