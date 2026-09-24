import { useEffect, useState } from 'react'
import { Explain } from './Explain'
import {
  chooseFirstSync,
  formatSyncedAt,
  getSyncConfig,
  isBehind,
  setSyncConfig,
  syncNow,
  useSyncStatus,
  type PlanSide,
  type SyncStatus,
} from '../lib/syncClient'
import { canSyncThroughGitHub } from '../lib/githubSync'
import { formatBackupTime, getCloudBackupConfig, useCloudBackupStatus } from '../lib/cloudBackup'

/**
 * Where sync is turned on, and the only place its state is visible.
 *
 * Two fields and a switch, and under them what this device last did: when it
 * last pulled and pushed, what waits to go, and whether the shared copy holds
 * anything this device has not taken - with one line, and a Pull, when this
 * device is behind. It was a single status sentence, which left "does the
 * phone have what I just did" to be answered by looking for the change
 * (docs/SYNC-AUDIT.md, path 9). The merge, the retries and the backoff stay
 * out of sight: a person who has to think about those is a person whose
 * sync does not work.
 */

/**
 * The status line.
 *
 * "Error" on its own tells you something is wrong and nothing about what to
 * do, so every message here names the thing to check. The good state says how
 * long ago rather than a timestamp: the question being asked is "is this
 * current", not "at what instant did it last run".
 */
function statusLine(status: SyncStatus, where: string): { text: string; tone: 'ok' | 'busy' | 'bad' } {
  if (status.phase === 'choice') return { text: 'Waiting for you: which plan this device keeps, below.', tone: 'bad' }
  if (status.phase !== 'off' && status.phase !== 'syncing' && isBehind(status)) {
    return { text: `This device is behind ${where}. Press Pull.`, tone: 'bad' }
  }
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
      // Two facts, because they answer two different questions. "Last synced"
      // says this device talked to the meeting place; the second says whether
      // anything was there. The one a person actually asks - does the phone
      // have what I just did - is the second, and until this it was answered
      // by looking for the change with your eyes.
      return {
        text: `Last synced ${formatSyncedAt(status.lastSyncedAt)}. ${
          status.lastReceivedAt
            ? `The other device's last change arrived ${formatSyncedAt(status.lastReceivedAt)}.`
            : 'Nothing from another device yet.'
        }`,
        tone: 'ok',
      }
  }
}

/** What the shared copy holds, as far as this device knows. */
function remoteLine(status: SyncStatus): string {
  if (status.choice) return 'Holds a plan this device has not taken - see below.'
  if (status.pullError) return `Could not be read. ${status.pullError}`
  if (!status.lastPullAt) return 'Not read yet.'
  return `Nothing newer than here, as of ${formatSyncedAt(status.lastPullAt)}.`
}

/** "12 tasks across 4 days, last changed today 21:40" - one side of the first connection's question. */
function describeSide(side: PlanSide): string {
  if (side.tasks === 0 && side.days === 0 && side.templates === 0) return `nothing yet, last changed ${formatBackupTime(side.changedAt)}`
  const tasks = `${side.tasks} ${side.tasks === 1 ? 'task' : 'tasks'} across ${side.days} ${side.days === 1 ? 'day' : 'days'}`
  const templates = side.templates > 0 ? `, ${side.templates} ${side.templates === 1 ? 'template' : 'templates'}` : ''
  return `${tasks}${templates}, last changed ${formatBackupTime(side.changedAt)}`
}

export function SyncSettings() {
  const status = useSyncStatus()
  const backup = useCloudBackupStatus()
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
  const [keepArmed, setKeepArmed] = useState(false)
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
  const where = (saved.via ?? 'server') === 'github' ? 'GitHub' : 'the server'
  const line = statusLine(status, where)
  const behind = saved.enabled && status.phase !== 'choice' && status.phase !== 'syncing' && isBehind(status)

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
            Each device pulls when you come back to it and pushes a few seconds after every change, so the
            phone shows what the computer just did. Nothing goes to anyone else, and there is no account.
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
              ? `Through ${repo}, in a file of its own beside the backup, with the same token. Backup alone does not join the other device: turn sync on here and there, first on the device whose plan is the right one.`
              : 'Set the repo and token in Backup first, just above. Sync uses the same two.'}
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
          {/* One press either way - a round trip reads before it writes - and
              called what the line above asks for when this device is behind. */}
          {saved.enabled && !dirty && status.phase !== 'choice' && (
            <button className="btn-secondary" onClick={() => void syncNow()} disabled={status.phase === 'syncing'}>
              {behind ? 'Pull' : 'Sync now'}
            </button>
          )}
        </div>

        <p className={`sync-status sync-status-${line.tone}`} role="status">
          {line.text}
        </p>

        {/* Two plans that never meet, said where sync is switched on - see
            cloudBackup.ts, othersUnseenAt. Only with sync off here: with it
            on, the other device's changes arrive through sync anyway. */}
        {!saved.enabled && backup.othersUnseenAt && (
          <p className="sync-status sync-status-bad">
            Another device backs up to this repo, and sync is off here, so the two plans do not see each other. Turn
            sync on, on both devices.
          </p>
        )}

        {/* The first connection of a device with a plan of its own, to a
            shared copy that has another - docs/SYNC-AUDIT.md, path 4.
            Nothing has been written anywhere while this is on screen. */}
        {status.choice && (
          <div className="backup-preview sync-choice" role="group" aria-label="Which plan this device keeps">
            <p className="backup-preview-line">
              This device has a plan of its own, and {where} has another. Nothing is written anywhere until you choose.
            </p>
            <p className="backup-preview-line">
              {where === 'GitHub' ? 'GitHub' : 'The server'}: {describeSide(status.choice.remote)}.
            </p>
            <p className="backup-preview-line">This device: {describeSide(status.choice.here)}.</p>
            <p className="backup-preview-line">
              Take puts the shared plan on this device in place of this one - the answer on the device that should
              show what the other one has. Today&apos;s snapshot in Settings keeps this one as it was on its first
              open today.
            </p>
            <p className="backup-preview-line">
              Keep this one puts this device&apos;s plan in place of the shared one, here and on your other devices at
              their next sync, and takes off them what only they have - the answer on the device whose plan is the
              right one.
            </p>
            <p className="backup-preview-line">
              Merge keeps both, one thing at a time - where both changed the same thing, the later change wins - and
              sends the result to your other devices.
            </p>
            <div className="sync-actions">
              <button type="button" className="btn-secondary" onClick={() => void chooseFirstSync('merge')}>
                Merge
              </button>
              {/* It deletes what only the other devices have, so it asks
                  twice, the way Replace everything in Backup does. */}
              <button
                type="button"
                className={keepArmed ? 'btn-danger is-armed' : 'btn-secondary'}
                onClick={() => (keepArmed ? void chooseFirstSync('keep') : setKeepArmed(true))}
                onBlur={() => setKeepArmed(false)}
              >
                {keepArmed ? 'Keep this one?' : 'Keep this one'}
              </button>
              <button type="button" className="primary" onClick={() => void chooseFirstSync('take')}>
                {where === 'GitHub' ? 'Take from GitHub' : 'Take from the server'}
              </button>
            </div>
          </div>
        )}

        {saved.enabled && (
          <div role="group" aria-label="This device">
            <dl className="sync-facts">
              <dt>Last pull</dt>
              <dd>{formatSyncedAt(status.lastPullAt)}</dd>
              <dt>Last push</dt>
              <dd>{formatSyncedAt(status.lastPushAt)}</dd>
              <dt>Waiting to send</dt>
              <dd>{status.pending ? `Changes from ${formatBackupTime(status.owedSince)}` : 'Nothing'}</dd>
              <dt>{where === 'GitHub' ? 'GitHub' : 'The server'}</dt>
              <dd>{remoteLine(status)}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
