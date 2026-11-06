import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { OverviewPage } from '@/pages/OverviewPage'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { ProvidersPage } from '@/pages/ProvidersPage'
import { ModelComparisonPage } from '@/pages/ModelComparisonPage'
import { ResourceEstimatorPage } from '@/pages/ResourceEstimatorPage'
import { ResearchAuditPage } from '@/pages/ResearchAuditPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="comparison" element={<ModelComparisonPage />} />
          <Route path="estimator" element={<ResourceEstimatorPage />} />
          <Route path="research" element={<ResearchAuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
