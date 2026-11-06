import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { installPaletteVars } from './app/palette'
import { AppProviders } from './app/providers'
import { ErrorBoundary } from './app/ErrorBoundary'
import './styles/global.css'
import './styles/print.css'

installPaletteVars()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
