import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { registerServiceWorker } from './pwa'
import { watchInstallPrompt } from './lib/install'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
// Armed before React mounts: the browser fires beforeinstallprompt early and
// exactly once, and an event nobody was listening for is an install offer
// that never appears. See lib/install.ts.
watchInstallPrompt()
