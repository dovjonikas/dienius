import { getCloudBackupConfig, isCloudBackupOn, fromBase64, toBase64, GitHubError } from './cloudBackup'

/**
 * The same repo the backup already writes to, used as a place two devices can
 * agree through.
 *
 * The owner's question: how do the computer and the phone see the same plan
 * without running anything and without pressing much. The app already had
 * sync - pull on open, pull when a tab comes back, push a few seconds after
 * every change - and it wanted a server, which is a thing to own, keep awake
 * and reach. It also already had a private GitHub repo it pushes the whole
 * state to. Those are the same thing seen from two sides: a file both devices
 * can read and write.
 *
 * So this is a transport, not a second sync. Everything that decides *what*
 * to keep is `syncMerge.ts` and stays exactly where it is.
 *
 * **Its own file, beside the backup's.** The backup owns `data/state.json`
 * and a file per day under `data/history/`, written a few times a day and
 * meant to be opened and read by a person. Sync writes far more often and is
 * machinery; it gets `data/sync.json` rather than fighting the backup for the
 * same path. One repo, one token, two files with two jobs.
 *
 * **It will not write over what it did not read.** This is the part a plain
 * HTTP server cannot do. A read comes back with the file's `sha`, and the
 * write carries it: if the other device wrote in between, GitHub refuses,
 * this reports a conflict, and the caller pulls and merges again rather than
 * flattening the other device's day. Last write wins is the wrong answer when
 * the two writers are the same person on two machines.
 */

/** Where sync's own copy lives. Not STATE_PATH - see the note above. */
export const SYNC_PATH = 'data/sync.json'

/** Thrown when the file moved between the read and the write. */
export class SyncConflictError extends Error {}

/** Whether the GitHub transport has what it needs. It shares the backup's repo and token. */
export function canSyncThroughGitHub(): boolean {
  return isCloudBackupOn()
}

function apiUrl(path: string): string {
  return `https://api.github.com/repos/${getCloudBackupConfig().repo}/contents/${path}`
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getCloudBackupConfig().token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** What a read hands back: the state, and the version it was read at. */
export interface GitHubSyncRead {
  /** `null` where the file does not exist yet, which is every first sync. */
  state: unknown
  /** The version to write against. `null` when there is nothing there yet. */
  sha: string | null
}

/**
 * Reads the shared copy.
 *
 * `no-store`, like every read in cloudBackup.ts and for the reason written
 * there: GitHub sends `Cache-Control: private, max-age=60`, and a sync that
 * reads a minute-old copy out of the browser's own cache would merge against
 * a plan the other device has already moved on from.
 */
export async function readSyncState(): Promise<GitHubSyncRead> {
  const res = await fetch(apiUrl(SYNC_PATH), { headers: headers(), cache: 'no-store' })
  if (res.status === 404) return { state: null, sha: null }
  if (!res.ok) throw new GitHubError(res.status, `GitHub answered ${res.status} reading the shared plan.`)
  const body = (await res.json()) as { sha?: unknown; content?: unknown }
  const sha = typeof body.sha === 'string' ? body.sha : null
  if (typeof body.content !== 'string') return { state: null, sha }
  try {
    return { state: JSON.parse(fromBase64(body.content)) as unknown, sha }
  } catch {
    // Something is in the file and it is not a plan. Answered as "nothing
    // there", which the caller reports without touching anything local - the
    // worst outcome of a broken remote has to be "no sync", never "no data".
    return { state: null, sha }
  }
}

/**
 * Writes the shared copy, but only over the version that was read.
 *
 * No retry with a fresh sha, deliberately, and this is the difference between
 * this and `writeFile` in cloudBackup.ts. A backup that loses a race can read
 * the new sha and write again, because what it is writing is the whole truth
 * of this device. A sync cannot: the state in hand was merged against what
 * the file said *before* the other device wrote, so writing it again with a
 * newer sha would delete whatever they just did. The conflict goes back to
 * the caller, which pulls, merges, and tries again.
 */
export async function writeSyncState(state: unknown, sha: string | null): Promise<void> {
  const res = await fetch(apiUrl(SYNC_PATH), {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Dienius sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      content: toBase64(JSON.stringify(state)),
      ...(sha ? { sha } : {}),
    }),
  })
  if (res.ok) return
  // 409 is the lock; 422 is what the Contents API answers when a create is
  // sent for a path that has appeared since, which is the same race seen from
  // the other end.
  if (res.status === 409 || res.status === 422) {
    throw new SyncConflictError('The other device wrote while this one was merging.')
  }
  throw new GitHubError(res.status, `GitHub answered ${res.status} writing the shared plan.`)
}
