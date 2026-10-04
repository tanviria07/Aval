import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { DemoPage } from './pages/DemoPage'
import { GuardianPage } from './pages/GuardianPage'
import { JoinPage } from './pages/JoinPage'
import { MomPage } from './pages/MomPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/mom" element={<MomPage />} />
        <Route path="/guardian" element={<GuardianPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/seller" element={<Navigate to="/mom" replace />} />
        <Route path="/buyer" element={<Navigate to="/guardian" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
