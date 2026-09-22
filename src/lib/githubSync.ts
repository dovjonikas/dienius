import { isCloudBackupOn, putRepoFile, readRepoFile, GitHubError, type PutOptions } from './cloudBackup'

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

/**
 * What the file held the last time this device read or wrote it, in a form
 * that ignores key order. A write that would put back exactly what is there
 * is skipped: every write is a commit, and a poll or a merge that changed
 * nothing would otherwise leave a commit saying so, once a minute.
 */
let lastSeen: string | null = null

/** JSON with keys sorted at every depth, so two equal plans stringify the same. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map(k => [k, (v as Record<string, unknown>)[k]]))
      : v,
  )
}

/** Test seam. */
export function resetGitHubSyncForTests(): void {
  lastSeen = null
}

/** Whether the GitHub transport has what it needs. It shares the backup's repo and token. */
export function canSyncThroughGitHub(): boolean {
  return isCloudBackupOn()
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
  // Through the backup's reader, which also reads a file past a megabyte -
  // see readRepoFile. The shared plan is compact JSON, but it grows too.
  const { sha, text } = await readRepoFile(SYNC_PATH)
  if (text === null || text === '') return { state: null, sha }
  try {
    const state = JSON.parse(text) as unknown
    lastSeen = stable(state)
    return { state, sha }
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
export async function writeSyncState(state: unknown, sha: string | null, options: PutOptions = {}): Promise<{ written: boolean; sha: string | null }> {
  const same = stable(state)
  if (same === lastSeen) return { written: false, sha }
  let next: string | null
  try {
    next = await putRepoFile(
      SYNC_PATH,
      JSON.stringify(state),
      `Dienius sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      sha,
      // The push made as the page goes: the browser carries it past the page
      // where the plan is small enough for it to be allowed to.
      options,
    )
  } catch (err) {
    // 409 is the lock; 422 is what the Contents API answers when a create is
    // sent for a path that has appeared since, which is the same race seen
    // from the other end.
    if (err instanceof GitHubError && (err.status === 409 || err.status === 422)) {
      throw new SyncConflictError('The other device wrote while this one was merging.')
    }
    throw err instanceof GitHubError ? new GitHubError(err.status, `GitHub answered ${err.status} writing the shared plan.`) : err
  }
  // Nothing sent: the page is going and the browser would not carry it.
  if (next === null && options.onlyIfCarried) return { written: false, sha }
  lastSeen = same
  return { written: true, sha: next }
}
