import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './ToastProvider.jsx'
import { registerServiceWorker } from './push.js'

// 手機／瀏覽器推播需要 service worker（public/sw.js）
registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
