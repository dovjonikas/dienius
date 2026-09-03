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
  ...(args.origin ? [args.origin] : []),
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
