import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Guard debug logs in production
if (import.meta.env.PROD) {
  const originalLog = console.log;
  console.log = (...args) => {
    if (typeof args[0] === 'string' && (args[0].includes('[DEBUG]') || args[0].includes('[PERF]'))) {
      return;
    }
    originalLog(...args);
  };
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && (args[0].includes('[DEBUG]') || args[0].includes('[PERF]'))) {
      return;
    }
    originalWarn(...args);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
