/**
 * Lighthouse on the production build: a phone and a desktop, an empty app
 * and the demo's fortnight (`?demo=1` builds it on open, under its own key).
 * The freeze's point 4 asked for performance, accessibility and best
 * practices at both sizes; the numbers and what holds each under 100 are in
 * docs/SPEED.md.
 *
 *   npm run build && node scripts/lighthouse.mjs
 *
 * Lighthouse is not a dependency of the app: npx fetches the version named
 * below the first time. The browser is Playwright's headless shell, the one
 * every other pass here measures with. Reports, JSON and HTML, go to a
 * folder in the system's temporary directory, named on the last line.
 *
 * Two things learned the slow way. The server lives in this process, so the
 * audits are run with spawn, never spawnSync - a blocked event loop answers
 * no request, and every run waited out its timeout. And Lighthouse ends
 * with EPERM on Windows while it removes its temporary profile, after the
 * report is written: the report is what counts.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const LIGHTHOUSE = 'lighthouse@13.5.0'
const PORT = 4188
const OUT = join(tmpdir(), 'dienius-lighthouse')
mkdirSync(OUT, { recursive: true })

const playwright = join(chromium.executablePath(), '..', '..', '..')
const shellDir = readdirSync(playwright).find(d => d.startsWith('chromium_headless_shell-'))
if (!shellDir) throw new Error('No Playwright headless shell: npx playwright install chromium')
const platformDir = readdirSync(join(playwright, shellDir)).find(d => d.startsWith('chrome-headless-shell-')) ?? ''
const SHELL = join(playwright, shellDir, platformDir, process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell')

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' })

/** @param {string[]} args @returns {Promise<void>} */
const run = args =>
  new Promise(resolve => {
    const child = spawn('npx', args, { shell: true, stdio: 'ignore', env: { ...process.env, CHROME_PATH: SHELL } })
    const timer = setTimeout(() => child.kill(), 300_000)
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })

/** @type {string[]} */
const lines = []
for (const state of ['empty', 'demo']) {
  for (const form of ['mobile', 'desktop']) {
    const name = `${form}-${state}`
    const url = `http://localhost:${PORT}/dienius/${state === 'demo' ? '?demo=1' : ''}`
    for (const f of [`${name}.report.json`, `${name}.report.html`]) rmSync(join(OUT, f), { force: true })
    const args = ['-y', LIGHTHOUSE, url, '--chrome-flags="--headless"', '--output=json', '--output=html', `--output-path=${join(OUT, name)}`, '--only-categories=performance,accessibility,best-practices', '--quiet']
    if (form === 'desktop') args.push('--preset=desktop')
    await run(args)
    const file = join(OUT, `${name}.report.json`)
    if (!existsSync(file)) {
      lines.push(`${name}: no report`)
      continue
    }
    /** @type {{ categories: Record<string, { score: number | null, auditRefs: { id: string }[] }>, audits: Record<string, { score: number | null, scoreDisplayMode: string, displayValue?: string, title: string }> }} */
    const report = JSON.parse(readFileSync(file, 'utf8'))
    /** @param {string} id */
    const score = id => Math.round((report.categories[id]?.score ?? 0) * 100)
    /** @param {string} id */
    const metric = id => report.audits[id]?.displayValue ?? '-'
    lines.push(`${name}: performance ${score('performance')}, accessibility ${score('accessibility')}, best practices ${score('best-practices')}; FCP ${metric('first-contentful-paint')}, LCP ${metric('largest-contentful-paint')}, TBT ${metric('total-blocking-time')}, CLS ${metric('cumulative-layout-shift')}`)
    for (const cat of ['performance', 'accessibility', 'best-practices']) {
      for (const ref of report.categories[cat].auditRefs) {
        const a = report.audits[ref.id]
        if (!a || a.score === null || a.score >= 1 || ['notApplicable', 'informative', 'manual'].includes(a.scoreDisplayMode)) continue
        lines.push(`    ${cat}: ${ref.id} ${a.displayValue ?? ''} - ${a.title}`)
      }
    }
  }
}
await server.close()
console.log(lines.join('\n'))
console.log(`\nReports: ${OUT}`)
