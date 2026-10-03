import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { BuyerPage } from './pages/BuyerPage'
import { DemoPage } from './pages/DemoPage'
import { JoinPage } from './pages/JoinPage'
import { SellerPage } from './pages/SellerPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/seller" element={<SellerPage />} />
        <Route path="/buyer" element={<BuyerPage />} />
        <Route path="/demo" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
