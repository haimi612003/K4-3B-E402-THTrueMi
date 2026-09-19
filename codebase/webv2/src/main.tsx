import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter, Routes, Route, Link } from 'react-router'
import LandingPage from './LandingPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<App />} />
        <Route path="*" element={<main className="grid min-h-dvh place-content-center gap-5 text-center"><h1 className="text-3xl font-semibold">Không tìm thấy trang</h1><Link to="/" className="underline">Về trang chủ</Link></main>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
