import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Analytics } from '@vercel/analytics/react'
import { materialTheme } from './theme/materialTheme'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={materialTheme}>
      <CssBaseline />
      <App />
      <Analytics />
    </ThemeProvider>
  </StrictMode>,
)
