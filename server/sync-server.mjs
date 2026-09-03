#!/usr/bin/env node
/**
 * The Dienius sync server.
 *
 * A deliberately stupid box that holds a JSON file and hands it back. It does
 * not merge, does not know what a task is, and has no opinion about the plan
 * inside it. All of the correctness lives in the client - see
 * `src/lib/syncMerge.ts` - because there is exactly one person using this and
 * putting the interesting logic where the tests are is worth more than putting
 * it where the uptime is.
 *
 * No dependencies, and none will be added. This runs on a PC on a home
 * network, reached from a phone over Tailscale, and it should keep running
 * across a Node upgrade without anybody touching an npm install.
 *
 *   node server/sync-server.mjs
 *   node server/sync-server.mjs --port 8787 --data ./data --origin http://localhost:5173
 *
 * On first run it writes `data/token.txt` with a fresh token and prints it.
 * Paste that into Settings -> Sync on each device.
 */

import { createServer } from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const PORT = Number(args.port ?? process.env.DIENIUS_PORT ?? 8787)
const DATA_DIR = resolve(args.data ?? process.env.DIENIUS_DATA ?? 'data')
const STATE_FILE = join(DATA_DIR, 'dienius-state.json')
const TOKEN_FILE = join(DATA_DIR, 'token.txt')

/**
 * Which origins may talk to this.
 *
 * A list rather than `*`, because `*` plus a bearer token is the combination
 * where any page you happen to open can read your whole planner if it ever
 * learns the token. Add your deployed URL with --origin.
 */
const ALLOWED_ORIGINS = new Set([
  'http://localhost:4173',
  'http://localhost:4176',
  'http://localhost:5173',
  'https://quicasha.github.io',
  ...(args.origin ? args.origin.split(',').map(o => o.trim()).filter(Boolean) : []),
])

/** Refuse anything absurd before parsing it. A phone's whole planner is small. */
const MAX_BODY_BYTES = 8 * 1024 * 1024

mkdirSync(DATA_DIR, { recursive: true })
const TOKEN = loadOrCreateToken()

createServer(handle).listen(PORT, () => {
  console.log(`Dienius sync on http://0.0.0.0:${PORT}`)
  console.log(`State:  ${STATE_FILE}`)
  console.log(`Token:  ${TOKEN}`)
  console.log('Paste that token into Settings -> Sync on each device.')
})

async function handle(req, res) {
  const origin = req.headers.origin
  const allowed = origin && ALLOWED_ORIGINS.has(origin)

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(allowed ? 204 : 403).end()
    return
  }

  // A same-origin or tool request has no Origin header at all; only a browser
  // page from somewhere unlisted does, and that is the case being refused.
  if (origin && !allowed) {
    return send(res, 403, { error: 'origin not allowed' })
  }

  if (!authorised(req)) {
    return send(res, 401, { error: 'bad token' })
  }

  try {
    if (req.method === 'GET' && req.url?.startsWith('/state')) {
      return send(res, 200, readState())
    }
    if (req.method === 'POST' && req.url?.startsWith('/state')) {
      const body = await readBody(req)
      if (!isPlainObject(body)) return send(res, 400, { error: 'not a state' })
      writeState(body)
      return send(res, 200, { ok: true })
    }
    if (req.method === 'GET' && req.url?.startsWith('/ics')) {
      return await proxyIcs(req, res)
    }
    if (req.method === 'GET' && req.url?.startsWith('/health')) {
      return send(res, 200, { ok: true, since: STARTED })
    }
    return send(res, 404, { error: 'no such thing here' })
  } catch (error) {
    console.error('request failed:', error)
    return send(res, 500, { error: 'server' })
  }
}

const STARTED = new Date().toISOString()

/** A calendar feed is text. Anything this size is not one. */
const MAX_ICS_BYTES = 8 * 1024 * 1024

/** Long enough for a slow corporate feed, short enough not to hang a sync. */
const ICS_TIMEOUT_MS = 15_000

/**
 * Fetches somebody's calendar feed on the browser's behalf.
 *
 * A page cannot fetch a Google or Outlook iCal address itself: those hosts
 * send no CORS headers, so the browser refuses the response before the page
 * sees it. The server has no such rule, and this is the smallest thing that
 * can stand in the gap - it fetches text and hands it back, and does not know
 * what iCalendar is. The parsing is in the client, where the tests are.
 *
 * The address is only ever one the owner of this server typed into their own
 * Settings, and the token is already required to get here. Even so it is
 * restricted to http and https and refuses anything on the local machine or
 * the private network, because "fetch this URL for me" is otherwise a way to
 * reach every device on the network from outside it - the request would come
 * from the server, which is inside.
 */
async function proxyIcs(req, res) {
  const target = new URL(req.url, 'http://localhost').searchParams.get('url')
  if (!target) return send(res, 400, { error: 'no url' })

  let url
  try {
    url = new URL(target)
  } catch {
    return send(res, 400, { error: 'not a url' })
  }
  // webcal: is what calendar apps hand out; it is https underneath.
  if (url.protocol === 'webcal:') url.protocol = 'https:'
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return send(res, 400, { error: 'only http and https' })
  }
  if (isPrivateHost(url.hostname)) {
    return send(res, 400, { error: 'that address is on the local network' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ICS_TIMEOUT_MS)
  try {
    const upstream = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!upstream.ok) return send(res, 502, { error: `the calendar answered ${upstream.status}` })
    const text = await upstream.text()
    if (text.length > MAX_ICS_BYTES) return send(res, 502, { error: 'that calendar is too large' })
    return send(res, 200, { text })
  } catch (error) {
    const why = error?.name === 'AbortError' ? 'the calendar took too long' : 'could not reach that calendar'
    return send(res, 502, { error: why })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Whether a hostname points back inside. Names as well as addresses, because
 * a name that resolves to 127.0.0.1 is the ordinary way around an
 * address-only check.
 */
function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host === '0.0.0.0') return true
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!v4) return false
  const [a, b] = [Number(v4[1]), Number(v4[2])]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  // Tailscale's own range. The sync server is reached over it, but that is no
  // reason to let it fetch from every other machine on the tailnet.
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

/**
 * Constant-time comparison, because a token check that returns faster on a
 * wrong first character is a token check that can be guessed one character at
 * a time. Cheap to do properly.
 */
function authorised(req) {
  const header = req.headers.authorization ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7) : ''
  const a = Buffer.from(given)
  const b = Buffer.from(TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readState() {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  } catch (error) {
    // A corrupt file is not a reason to hand a client garbage - it gets null,
    // which every client treats as "the server has nothing", and nothing local
    // is touched. The file is left alone for a human to look at.
    console.error('state file is unreadable:', error)
    return null
  }
}

/**
 * Write to a temporary file and rename over the target.
 *
 * A rename within one filesystem is atomic, so a reader either sees the whole
 * old file or the whole new one - never a half-written state, which is
 * precisely the file that would then fail to parse and lose a day.
 */
function writeState(state) {
  const tmp = `${STATE_FILE}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(state), 'utf-8')
  renameSync(tmp, STATE_FILE)
}

function loadOrCreateToken() {
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf-8').trim()
  const token = randomUUID().replace(/-/g, '')
  writeFileSync(TOKEN_FILE, token, 'utf-8')
  return token
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
      } catch {
        resolvePromise(null)
      }
    })
    req.on('error', reject)
  })
}

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    out[key] = value
  }
  return out
}
