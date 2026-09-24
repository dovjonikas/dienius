import type { BrowserContext } from '@playwright/test'

/**
 * GitHub's Contents API held in a test, with its lock: a write names the
 * version it read, and a stale one is refused - the repo the backup, sync
 * and the archive write to, for the browser walks that need one
 * (docs/SYNC-AUDIT.md). Every call to api.github.com from a context the repo
 * serves comes here.
 */

type File = { sha: string; text: string }

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
}

export function fakeRepo() {
  const files = new Map<string, File>()
  let version = 0
  return {
    files,
    /** Every call to api.github.com from this context goes to the repo in this test. */
    async serve(context: BrowserContext): Promise<void> {
      await context.route('https://api.github.com/**', async route => {
        const request = route.request()
        const path = decodeURIComponent(new URL(request.url()).pathname.replace(/^.*\/contents\//, ''))
        const method = request.method()
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
        if (method === 'GET') {
          const file = files.get(path)
          if (!file) return route.fulfill({ status: 404, headers: cors, body: '{"message":"Not Found"}' })
          if ((request.headers()['accept'] ?? '').includes('raw')) return route.fulfill({ status: 200, headers: cors, body: file.text })
          return route.fulfill({
            status: 200,
            headers: { ...cors, 'content-type': 'application/json' },
            body: JSON.stringify({ sha: file.sha, content: Buffer.from(file.text, 'utf8').toString('base64') }),
          })
        }
        if (method === 'PUT') {
          const body = JSON.parse(request.postData() ?? '{}') as { content: string; sha?: string }
          const file = files.get(path)
          if (file ? body.sha !== file.sha : body.sha !== undefined) {
            return route.fulfill({ status: 409, headers: cors, body: '{"message":"does not match"}' })
          }
          const sha = `v${++version}`
          files.set(path, { sha, text: Buffer.from(body.content, 'base64').toString('utf8') })
          return route.fulfill({
            status: 201,
            headers: { ...cors, 'content-type': 'application/json' },
            body: JSON.stringify({ content: { sha }, commit: { committer: { date: new Date().toISOString() } } }),
          })
        }
        return route.fulfill({ status: 405, headers: cors })
      })
    },
    /** Every task title in a plan file, sorted - the sync file unless another is named. */
    titles(path = 'data/sync.json'): string[] {
      const file = files.get(path)
      if (!file) return []
      const plan = JSON.parse(file.text) as { days: Record<string, { tasks: { title: string }[] }> }
      return Object.values(plan.days).flatMap(d => d.tasks.map(t => t.title)).sort()
    },
  }
}

export type Repo = ReturnType<typeof fakeRepo>
