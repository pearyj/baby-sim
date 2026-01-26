import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Analytics } from '@vercel/analytics/react'
import { BrowserRouter } from 'react-router-dom'
import { materialTheme } from './theme/materialTheme'
import './index.css'
import './i18n'
import App from './App.tsx'

// Hide the initial loader as soon as React starts rendering
declare global {
  interface Window {
    __hideLoader?: () => void;
  }
}

// Call hideLoader immediately - React is now taking over
if (typeof window !== 'undefined' && window.__hideLoader) {
  window.__hideLoader();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={materialTheme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Analytics />
    </ThemeProvider>
  </StrictMode>,
)
