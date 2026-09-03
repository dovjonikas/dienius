import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { registerServiceWorker } from './pwa'
import { watchInstallPrompt } from './lib/install'
import { startSync } from './lib/syncClient'
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
// A no-op on a device where sync was never set up, which is the default. See
// lib/syncClient.ts - it pulls once here and then lives off store commits.
startSync()
