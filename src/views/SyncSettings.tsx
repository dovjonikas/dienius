import { useEffect, useState } from 'react'
import { Explain } from './Explain'
import {
  formatSyncedAt,
  getSyncConfig,
  setSyncConfig,
  syncNow,
  useSyncStatus,
  type SyncStatus,
} from '../lib/syncClient'
import { canSyncThroughGitHub } from '../lib/githubSync'
import { getCloudBackupConfig } from '../lib/cloudBackup'

/**
 * Where sync is turned on, and the only place its state is visible.
 *
 * Two fields and a switch. Everything else about sync - the merge, the
 * retries, the backoff - is deliberately invisible, because a person who has
 * to think about their sync is a person whose sync does not work. The one
 * thing worth showing is whether it is currently working, in a sentence.
 */

/**
 * The status line.
 *
 * "Error" on its own tells you something is wrong and nothing about what to
 * do, so every message here names the thing to check. The good state says how
 * long ago rather than a timestamp: the question being asked is "is this
 * current", not "at what instant did it last run".
 */
function statusLine(status: SyncStatus): { text: string; tone: 'ok' | 'busy' | 'bad' } {
  switch (status.phase) {
    case 'off':
      return { text: 'Off - this device keeps its own plan.', tone: 'busy' }
    case 'syncing':
      return { text: 'Syncing…', tone: 'busy' }
    case 'offline':
      return { text: 'No connection. It will catch up on its own.', tone: 'busy' }
    case 'error':
      return { text: status.message ?? 'Sync did not go through. Nothing on this device was changed.', tone: 'bad' }
    case 'idle':
      if (status.pending) return { text: 'Changes to send…', tone: 'busy' }
      return { text: `Last synced ${formatSyncedAt(status.lastSyncedAt)}.`, tone: 'ok' }
  }
}

export function SyncSettings() {
  const status = useSyncStatus()
  const saved = getSyncConfig()
  const [url, setUrl] = useState(saved.url)
  const [token, setToken] = useState(saved.token)
  // A device already syncing shows what it is actually doing. One that is
  // not yet opens on the route that needs nothing set up, where there is a
  // repo to use - which is the answer to "without pressing much".
  const [via, setVia] = useState<'server' | 'github'>(
    saved.enabled ? (saved.via ?? 'server') : canSyncThroughGitHub() ? 'github' : 'server',
  )
  const repo = getCloudBackupConfig().repo
  // The status text is a relative time, so it goes stale sitting on screen.
  // A minute is as often as it can change.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const dirty = url.trim() !== saved.url || token.trim() !== saved.token || via !== (saved.via ?? 'server')
  // The repo route has nothing of its own to fill in: it uses the repo and
  // the token Backup already holds on this device.
  const ready = via === 'github' ? canSyncThroughGitHub() : !!url.trim() && !!token.trim()
  const line = statusLine(status)

  function save(enabled: boolean) {
    setSyncConfig({ url: url.trim(), token: token.trim(), enabled, via })
  }

  return (
    <div className="settings-group" id="settings-sync">
      {/* Sync and Backup sit two headings apart in Settings and are widely
          assumed to be the same feature. They are not, and the difference is
          the difference between losing an afternoon and losing everything -
          so both say what they are for, in a sentence, where they are. */}
      <h3>
        <Explain id="sync">Sync</Explain>
      </h3>

      <div className="setting-block">
        <div className="setting-label">
          <span className="setting-name">Between your devices</span>
          <span className="setting-desc">
            Off by default, and the app works fully without it. Each device pulls when you come back
            to it and pushes as you put it down, so picking up the phone shows what the computer just
            did. Nothing is sent to anyone else, and there is no account.
          </span>
        </div>

        {/* Two ways for two devices to meet. The repo needs nothing to be
            running anywhere, which is the only reason it is the first one
            offered - the server is quicker and stays for whoever has one. */}
        <div className="segmented sync-via" role="group" aria-label="Where your devices meet">
          <button
            type="button"
            className={via === 'github' ? 'active' : ''}
            aria-pressed={via === 'github'}
            onClick={() => setVia('github')}
          >
            Your GitHub repo
          </button>
          <button
            type="button"
            className={via === 'server' ? 'active' : ''}
            aria-pressed={via === 'server'}
            onClick={() => setVia('server')}
          >
            A server of your own
          </button>
        </div>

        {via === 'github' ? (
          <p className="setting-desc sync-via-note">
            {repo
              ? `Through ${repo}, in a file of its own beside the backup - the same repo and the same token, so there is nothing else to set up. Put the same repo and token into Backup on your other device and it joins.`
              : 'Set the repo and token in Backup first, just above. Sync uses the same two and adds nothing of its own.'}
          </p>
        ) : (
        <div className="sync-fields">
          <label className="sync-field">
            <span>Server address</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://your-pc.your-tailnet.ts.net"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </label>
          <label className="sync-field">
            <span>Token</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="from data/token.txt"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
          </label>
        </div>
        )}

        <div className="sync-actions">
          {saved.enabled ? (
            <button className="btn-secondary" onClick={() => save(false)}>
              Turn off
            </button>
          ) : (
            <button className="primary" onClick={() => save(true)} disabled={!ready}>
              Turn on
            </button>
          )}
          {saved.enabled && dirty && (
            <button className="btn-secondary" onClick={() => save(true)}>
              Save
            </button>
          )}
          {saved.enabled && !dirty && (
            <button className="btn-secondary" onClick={() => void syncNow()} disabled={status.phase === 'syncing'}>
              Sync now
            </button>
          )}
        </div>

        <p className={`sync-status sync-status-${line.tone}`} role="status">
          {line.text}
        </p>

        <p className="setting-desc">
          Your daily snapshots stay on this device. A backup that travels the same wire as the thing
          it is backing up is not a backup.
        </p>
      </div>
    </div>
  )
}
