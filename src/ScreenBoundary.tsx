import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getData } from './lib/store'
import { exportJson } from './lib/storage'
import { downloadText } from './lib/download'

interface Props {
  /** What a person calls the thing that failed: "Kitchen", "The journal". */
  name: string
  /**
   * `page`: one of the rail's pages - its name where every page's title
   * stands, and a card saying what happened. `sheet`: something drawn over
   * the page - one line over it, with Close. `inline`: a part of a screen -
   * one line where it would have been.
   */
  kind?: 'page' | 'sheet' | 'inline'
  /** A sheet's own way out, which also clears the line. */
  onClose?: () => void
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * One screen that fails, and only that one.
 *
 * Until the freeze the app-wide ErrorBoundary in main.tsx was the only one,
 * so a page that could not draw took the header, the rail and every other
 * page with it, and the way on it offered - reload - opened the same page
 * into the same error. Now each page, each sheet and each panel of the
 * header is in one of these: what cannot draw says so where it would have
 * been, the rail still goes everywhere else, and moving to another page and
 * back, or Try again, draws it afresh. See DECISIONS "One screen fails, not
 * the app".
 *
 * The data is never touched from here. A failed screen is a reading
 * problem: the plan is as it was, which is what the line says, and Export
 * backup is offered on a page because it is the one thing worth having
 * before anything else is tried.
 */
export class ScreenBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Dienius could not show ${this.props.name}.`, error, info)
  }

  private retry = (): void => {
    this.setState({ error: null })
  }

  private close = (): void => {
    this.setState({ error: null })
    this.props.onClose?.()
  }

  private exportBackup = (): void => {
    try {
      downloadText('dienius-backup.json', exportJson(getData()))
    } catch {
      // A plan that cannot even be written out is past what this page can
      // help with; Settings and the app-wide boundary still offer theirs.
    }
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const { name, kind = 'page', onClose } = this.props

    if (kind !== 'page') {
      return (
        <div className={kind === 'sheet' ? 'screen-crash-line is-sheet' : 'screen-crash-line'} role="alert">
          <span className="demo-banner-mark sync-banner-mark" aria-hidden="true" />
          <span className="screen-crash-line-text">{name} could not be shown. Nothing is lost.</span>
          {kind === 'sheet' && onClose && (
            <button type="button" className="btn-secondary" onClick={this.close}>
              Close
            </button>
          )}
        </div>
      )
    }

    return (
      <section className="screen-crash">
        <h2>{name}</h2>
        <div className="page-body">
          <div className="screen-crash-card" role="alert">
            <p className="screen-crash-lead">
              <span className="demo-banner-mark sync-banner-mark" aria-hidden="true" />
              This page could not be shown.
            </p>
            <p>
              Something in the plan is not what this page expects. Nothing is lost - the plan is as it was,
              and every other page still works.
            </p>
            <p className="screen-crash-error">{error.message}</p>
            <div className="screen-crash-actions">
              <button type="button" className="primary" onClick={this.retry}>
                Try again
              </button>
              <button type="button" className="btn-secondary" onClick={this.exportBackup}>
                Export backup
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }
}
