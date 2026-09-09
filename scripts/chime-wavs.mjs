/**
 * `node scripts/chime-wavs.mjs` - the four timer sounds, as files you can play.
 *
 * A test can say the alarm is three tones rising and repeating every three
 * seconds. Only an ear can say whether it is the right three, whether the
 * bell is calming or funereal, and whether the alarm carries into the next
 * room without being the thing that makes somebody hate their own planner.
 * So the sounds are rendered to `docs/audio/` and the owner listens to them
 * without starting the app.
 *
 * **Rendered by the app's own code**, not by a second copy of the synthesis.
 * A node script computing sine waves from the same table would be a
 * reimplementation that can drift, and a file that no longer matches what the
 * timer does is worse than no file. This drives a real browser, imports
 * `lib/chime.ts` off the dev server, and swaps `AudioContext` for an
 * `OfflineAudioContext` - so what is written is what `playChime` produced,
 * one function, one table, one sound.
 *
 * Needs the dev server: `npm run dev -- --port 4176`, or pass PORT for one
 * already up. Re-run it whenever the numbers in `PROFILES` change, and say in
 * the commit that you listened.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'docs', 'audio')
const PORT = process.env.PORT ?? '4176'
const BASE = `http://localhost:${PORT}/dienius/`
/** Where the dev server serves the module from. A variable, not a literal, so
 *  the typechecker reads it as a URL to fetch rather than as a file to find. */
const MODULE = '/dienius/src/lib/chime.ts'

/**
 * How much of each sound is rendered.
 *
 * The alarm goes on for a minute in the app and eight seconds of it is two
 * repeats and a gap - which is what somebody needs to hear to know whether
 * they could live with it, and a great deal smaller than a minute of wav.
 */
const SECONDS = { off: 1, soft: 2, bell: 6, alarm: 8 }

/** The volume every file is rendered at, which is the app's own default. */
const VOLUME = 0.5

const RATE = 44100

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(BASE)

  const report = []
  for (const [profile, seconds] of Object.entries(SECONDS)) {
    const rendered = await page.evaluate(
      async (/** @type {{ profile: string; seconds: number; volume: number; rate: number; module: string }} */ { profile, seconds, volume, rate, module }) => {
        const { playChime } = await import(/* @vite-ignore */ module)

        // The one substitution: playChime asks for `new AudioContext()` with
        // no arguments, so the offline one is wrapped in a class that knows
        // how long it is rendering for. Everything else is the real thing.
        /** @type {any} */
        let made = null
        /** @type {any} */
        const w = window
        const Real = w.AudioContext
        w.AudioContext = class {
          constructor() {
            made = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate)
            return made
          }
        }
        const handle = playChime(profile, volume)
        w.AudioContext = Real
        if (!made) return null

        const buffer = await made.startRendering()
        handle.stop()
        const samples = buffer.getChannelData(0)

        // Peak and RMS, so a change in the numbers can be seen as well as
        // heard - and so the three can be compared to each other.
        let peak = 0
        let sum = 0
        for (const s of samples) {
          const a = Math.abs(s)
          if (a > peak) peak = a
          sum += s * s
        }

        // A 16-bit mono wav, written here because the whole point is a file
        // that opens in anything.
        const bytes = new DataView(new ArrayBuffer(44 + samples.length * 2))
        const ascii = (/** @type {number} */ at, /** @type {string} */ text) => {
          for (let i = 0; i < text.length; i += 1) bytes.setUint8(at + i, text.charCodeAt(i))
        }
        ascii(0, 'RIFF')
        bytes.setUint32(4, 36 + samples.length * 2, true)
        ascii(8, 'WAVEfmt ')
        bytes.setUint32(16, 16, true)
        bytes.setUint16(20, 1, true)
        bytes.setUint16(22, 1, true)
        bytes.setUint32(24, rate, true)
        bytes.setUint32(28, rate * 2, true)
        bytes.setUint16(32, 2, true)
        bytes.setUint16(34, 16, true)
        ascii(36, 'data')
        bytes.setUint32(40, samples.length * 2, true)
        for (let i = 0; i < samples.length; i += 1) {
          const clamped = Math.max(-1, Math.min(1, samples[i]))
          bytes.setInt16(44 + i * 2, Math.round(clamped * 32767), true)
        }

        let binary = ''
        const raw = new Uint8Array(bytes.buffer)
        for (let i = 0; i < raw.length; i += 1) binary += String.fromCharCode(raw[i])
        return { wav: btoa(binary), peak, rms: Math.sqrt(sum / samples.length) }
      },
      { profile, seconds, volume: VOLUME, rate: RATE, module: MODULE },
    )

    if (!rendered) {
      // Off opens no context at all, which is the whole of what it does. The
      // file is still written, as silence, so nobody wonders whether the
      // fourth one was forgotten.
      const silence = Buffer.alloc(44 + SECONDS.off * RATE * 2)
      silence.write('RIFF', 0); silence.writeUInt32LE(36 + SECONDS.off * RATE * 2, 4); silence.write('WAVEfmt ', 8)
      silence.writeUInt32LE(16, 16); silence.writeUInt16LE(1, 20); silence.writeUInt16LE(1, 22)
      silence.writeUInt32LE(RATE, 24); silence.writeUInt32LE(RATE * 2, 28); silence.writeUInt16LE(2, 32)
      silence.writeUInt16LE(16, 34); silence.write('data', 36); silence.writeUInt32LE(SECONDS.off * RATE * 2, 40)
      writeFileSync(join(OUT, `${profile}.wav`), silence)
      report.push({ profile, seconds, peak: 0, rms: 0 })
      continue
    }

    writeFileSync(join(OUT, `${profile}.wav`), Buffer.from(rendered.wav, 'base64'))
    report.push({ profile, seconds, peak: +rendered.peak.toFixed(4), rms: +rendered.rms.toFixed(5) })
  }

  await browser.close()
  console.log(`rendered at volume ${VOLUME} into docs/audio`)
  for (const r of report) {
    console.log(`  ${r.profile.padEnd(6)} ${String(r.seconds).padStart(2)}s  peak ${String(r.peak).padEnd(7)} rms ${r.rms}`)
  }
  console.log('\nThe one thing this cannot answer is whether the alarm carries')
  console.log('into the next room. Play alarm.wav at the volume you would use.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
