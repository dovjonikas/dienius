import { useEffect, useState } from 'react'
import { Explain } from './Explain'
import { actions } from '../lib/store'
import {
  describeSummary,
  formatBackupTime,
  getCloudBackupConfig,
  isCloudBackupOn,
  previewRestore,
  requestCloudBackup,
  setCloudBackupConfig,
  useCloudBackupStatus,
  type CloudBackupStatus,
  type RestorePreview,
} from '../lib/cloudBackup'

/**
 * Where the third copy is set up, and the only place its state is visible.
 *
 * Two fields, one status line, two buttons. The status is a sentence
 * about when, not a timestamp - "Last backup: today 21:40" is the question
 * being asked. Restore reads the cloud copy and says what it holds beside
 * what is here before the armed second press replaces anything; see
 * lib/cloudBackup.ts for the rules.
 */

function statusLine(status: CloudBackupStatus): { text: string; tone: 'ok' | 'busy' | 'bad' } {
  switch (status.phase) {
    case 'off':
      return { text: 'Off. Add a repo and a token to keep a copy on GitHub.', tone: 'busy' }
    case 'working':
      return { text: 'Backing up...', tone: 'busy' }
    case 'offline':
      return { text: status.message ?? 'No connection. It will try again.', tone: 'busy' }
    case 'error':
      return { text: status.message ?? 'Something went wrong. It will try again.', tone: 'bad' }
    case 'idle':
      return { text: `Last backup: ${formatBackupTime(status.lastBackupAt)}.`, tone: 'ok' }
  }
}

export function BackupSettings() {
  const status = useCloudBackupStatus()
  const saved = getCloudBackupConfig()
  const [repo, setRepo] = useState(saved.repo)
  const [token, setToken] = useState(saved.token)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [armed, setArmed] = useState(false)
  // The status is "today 21:40", which goes stale at midnight; a minute is
  // as often as it can change.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const dirty = repo.trim() !== saved.repo || token.trim() !== saved.token
  const line = statusLine(status)

  function save() {
    setCloudBackupConfig({ repo, token })
    setRepo(getCloudBackupConfig().repo)
  }

  async function readCloud() {
    setReading(true)
    setPreviewError(null)
    setPreview(null)
    setArmed(false)
    try {
      setPreview(await previewRestore())
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not read the backup.')
    } finally {
      setReading(false)
    }
  }

  function restore() {
    if (!preview) return
    actions.restoreState(preview.data)
    setPreview(null)
    setArmed(false)
  }

  return (
    <div className="settings-group" id="settings-backup">
      <h3>
        Backup
        <Explain id="backup" />
      </h3>

      <div className="setting-block">
        <div className="setting-label">
          <span className="setting-name">A copy on GitHub</span>
          <span className="setting-desc">
            A private repo you own, written to after the day closes and on the first open of a new
            day, as plain JSON you can read: <code>data/state.json</code>, and one file per day under{' '}
            <code>data/history/</code>. Make a fine-grained token with Contents read and write on that
            one repo, and nothing else. The token stays on this device - it is not in an export, and
            it does not sync.
          </span>
        </div>

        <div className="sync-fields">
          <label className="sync-field">
            <span>Repo</span>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you/dienius-data"
              value={repo}
              onChange={e => setRepo(e.target.value)}
            />
          </label>
          <label className="sync-field">
            <span>Token</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="github_pat_..."
              value={token}
              onChange={e => setToken(e.target.value)}
            />
          </label>
        </div>

        <div className="sync-actions">
          {dirty && (
            <button className="primary" onClick={save} disabled={!repo.trim() || !token.trim()}>
              Save
            </button>
          )}
          {!dirty && isCloudBackupOn() && (
            <button
              className="btn-secondary"
              onClick={() => void requestCloudBackup('manual')}
              disabled={status.phase === 'working'}
            >
              Back up now
            </button>
          )}
          {!dirty && isCloudBackupOn() && (
            <button className="btn-secondary" onClick={() => void readCloud()} disabled={reading}>
              {reading ? 'Reading...' : 'Restore from cloud'}
            </button>
          )}
          {!dirty && isCloudBackupOn() && (
            <button className="btn-secondary" onClick={() => setCloudBackupConfig({ repo: '', token: '' })}>
              Turn off
            </button>
          )}
        </div>

        <p className={`sync-status sync-status-${line.tone}`} role="status">
          {line.text}
        </p>

        {previewError && (
          <p className="sync-status sync-status-bad" role="status">
            {previewError}
          </p>
        )}

        {preview && (
          <div className="backup-preview" role="group" aria-label="Restore from cloud">
            <p className="backup-preview-line">
              <strong>Cloud:</strong> {describeSummary(preview.cloud)}.
            </p>
            <p className="backup-preview-line">
              <strong>Here:</strong> {describeSummary(preview.here)}.
            </p>
            <div className="sync-actions">
              <button
                type="button"
                className={armed ? 'btn-danger is-armed' : 'btn-danger'}
                onClick={() => (armed ? restore() : setArmed(true))}
                onBlur={() => setArmed(false)}
              >
                {armed ? 'Replace everything here?' : 'Replace what is here with the cloud copy'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>
                Keep what is here
              </button>
            </div>
          </div>
        )}

        <p className="setting-desc">
          This is the third copy, not a replacement for the other two: sync keeps your devices
          agreeing, the daily snapshots keep a week of this device's own history, and this one is
          off site, in a place you can open with a browser.
        </p>
      </div>
    </div>
  )
}
