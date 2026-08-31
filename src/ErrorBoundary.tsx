import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getData } from './lib/store'
import { exportJson, STORAGE_KEY } from './lib/storage'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  confirmReset: boolean
}

// Catches a render crash anywhere below it and shows a way out instead of a
// permanently blank screen. validate() keeps most bad data from ever
// reaching a component, but this is the backstop for whatever it does not
// catch - a screen still needs an honest explanation and an exit.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, confirmReset: false }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dienius could not render this screen.', error, info)
  }

  handleExport = (): void => {
    try {
      const blob = new Blob([exportJson(getData())], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dienius-backup.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      // If the export itself fails there is nothing left to automate;
      // the reset button below is still available.
    }
  }

  handleResetClick = (): void => {
    if (this.state.confirmReset) {
      localStorage.removeItem(STORAGE_KEY)
      window.location.reload()
    } else {
      this.setState({ confirmReset: true })
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="app crash">
        <h2>Something went wrong</h2>
        <p>
          Dienius hit an error it could not recover from while showing this screen. Nothing you
          have entered is lost - it is still sitting in this browser's storage.
        </p>
        <p>Export a backup to be safe, then reset if reloading does not clear it.</p>
        <div className="row">
          <button className="primary" onClick={this.handleExport}>
            Export backup
          </button>
          <button
            className={this.state.confirmReset ? 'danger' : ''}
            onClick={this.handleResetClick}
          >
            {this.state.confirmReset ? 'Confirm reset?' : 'Reset app data'}
          </button>
        </div>
      </div>
    )
  }
}
