import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CHIME_PROFILES, isChimeProfile, MAX_RINGING_S, playChime } from './chime'

/**
 * The sound cannot be listened to from here, so what is checked is the shape
 * of what was asked for: how many oscillators, at what times, at what
 * frequencies, and that every one of them is ramped rather than cut.
 *
 * A fake `AudioContext` records every call. It is deliberately thin - it is
 * not an audio engine, it is a notepad - and the one thing it models
 * faithfully is `currentTime`, because every schedule in `chime.ts` is
 * relative to it and a fake that always answered zero would hide a whole
 * class of mistake.
 *
 * The renders in `docs/audio` are the other half of this. A test can say the
 * alarm has three tones rising; only an ear can say whether it is the right
 * three.
 */

interface FakeParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
  /** Every ramp, so a test can say a tone ends in silence rather than at full. */
  ramps: { to: number; at: number }[]
}

function param(initial = 1): FakeParam {
  const ramps: { to: number; at: number }[] = []
  return {
    value: initial,
    ramps,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn((to: number, at: number) => ramps.push({ to, at })),
    cancelScheduledValues: vi.fn(),
  }
}

interface FakeOsc {
  type: string
  frequency: { value: number }
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  startedAt: number | null
  stops: number[]
}

interface FakeGain {
  gain: FakeParam
  connect: ReturnType<typeof vi.fn>
}

class FakeContext {
  currentTime = 0
  closed = false
  oscillators: FakeOsc[] = []
  gains: FakeGain[] = []
  destination = { id: 'destination' }

  createOscillator(): FakeOsc {
    const osc: FakeOsc = {
      type: 'sine',
      frequency: { value: 0 },
      startedAt: null,
      stops: [],
      connect: vi.fn(() => ({ connect: vi.fn() })),
      start: vi.fn((at: number) => {
        osc.startedAt = at
      }),
      stop: vi.fn((at: number) => osc.stops.push(at)),
    }
    this.oscillators.push(osc)
    return osc
  }

  createGain(): FakeGain {
    const g: FakeGain = { gain: param(), connect: vi.fn() }
    this.gains.push(g)
    return g
  }

  close(): void {
    this.closed = true
  }
}

let made: FakeContext[] = []

beforeEach(() => {
  made = []
  vi.useFakeTimers()
  ;(window as unknown as { AudioContext: unknown }).AudioContext = function () {
    const ctx = new FakeContext()
    made.push(ctx)
    return ctx
  } as unknown as typeof AudioContext
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as unknown as { AudioContext?: unknown }).AudioContext
})

const latest = () => made[made.length - 1]

test('off makes nothing at all - no context, no oscillator', () => {
  const handle = playChime('off', 1)
  expect(made).toHaveLength(0)
  // And its handle is still a handle, so a caller never has a null to check.
  expect(() => handle.stop()).not.toThrow()
})

test('a volume of nothing is the same as off', () => {
  playChime('bell', 0)
  expect(made).toHaveLength(0)
})

test('the soft chime is two sine tones, the second overlapping the first', () => {
  playChime('soft', 1)
  const ctx = latest()
  expect(ctx.oscillators).toHaveLength(2)
  expect(ctx.oscillators.map(o => o.frequency.value)).toEqual([880, 1320])
  expect(ctx.oscillators.every(o => o.type === 'sine')).toBe(true)

  const [first, second] = ctx.oscillators
  expect(second.startedAt).toBeGreaterThan(first.startedAt!)
  // Overlapping, not one after the other: it reads as one gesture.
  expect(second.startedAt!).toBeLessThan(first.stops[0])
})

test('the bell is one low tone and a quieter octave, dying away for seconds', () => {
  playChime('bell', 1)
  const ctx = latest()
  expect(ctx.oscillators.map(o => o.frequency.value)).toEqual([440, 880])

  // The tone gains are on the gains made after the master, in order.
  const [, fundamental, octave] = ctx.gains
  const peakOf = (g: FakeGain) => Math.max(...g.gain.ramps.map(r => r.to))
  expect(peakOf(octave)).toBeLessThan(peakOf(fundamental))

  // Long, and slower to arrive than the soft chime, so it does not startle.
  const end = ctx.oscillators[0].stops[0]
  expect(end).toBeGreaterThan(4)
})

test('the alarm is three rising tones, repeating every three seconds up to a minute', () => {
  playChime('alarm', 1)
  const ctx = latest()

  const rounds = Math.ceil(MAX_RINGING_S / 3)
  expect(ctx.oscillators).toHaveLength(rounds * 3)

  const firstRound = ctx.oscillators.slice(0, 3).map(o => o.frequency.value)
  expect(firstRound).toEqual([...firstRound].sort((a, b) => a - b))
  expect(new Set(firstRound).size).toBe(3)

  // A triangle, for the reason in chime.ts: a sine does not cross a room.
  expect(ctx.oscillators.every(o => o.type === 'triangle')).toBe(true)

  // The second round starts three seconds after the first, on the audio
  // clock rather than on a timeout a background tab is allowed to clamp.
  expect(ctx.oscillators[3].startedAt).toBeCloseTo(ctx.oscillators[0].startedAt! + 3, 5)
  // And the last one is inside the minute, not past it.
  expect(ctx.oscillators[ctx.oscillators.length - 1].startedAt!).toBeLessThan(MAX_RINGING_S)
})

test('the alarm at half volume is louder than the soft chime at full', () => {
  playChime('soft', 1)
  const softPeak = Math.max(...latest().gains.slice(1).flatMap(g => g.gain.ramps.map(r => r.to))) * 1

  playChime('alarm', 0.5)
  const alarmCtx = latest()
  const alarmPeak = Math.max(...alarmCtx.gains.slice(1).flatMap(g => g.gain.ramps.map(r => r.to))) * 0.5

  // The whole reason for having profiles rather than one sound and a slider.
  expect(alarmPeak).toBeGreaterThan(softPeak)
})

test('the volume multiplies whatever the profile asked for, on one node', () => {
  playChime('bell', 0.4)
  expect(latest().gains[0].gain.value).toBeCloseTo(0.4, 5)
})

test('every tone ends in silence rather than being cut off', () => {
  for (const profile of ['soft', 'bell', 'alarm'] as const) {
    playChime(profile, 1)
    for (const gain of latest().gains.slice(1)) {
      const ramps = gain.gain.ramps
      expect(ramps.length, profile).toBeGreaterThanOrEqual(2)
      expect(ramps[ramps.length - 1].to, profile).toBeLessThan(0.001)
    }
  }
})

test('stop ramps it down and stops every oscillator, and is safe twice', () => {
  const handle = playChime('alarm', 1)
  const ctx = latest()
  const scheduled = ctx.oscillators.map(o => o.stops.length)

  handle.stop()
  // Every one of them told to stop again, at the ramp's end rather than now.
  expect(ctx.oscillators.every((o, i) => o.stops.length === scheduled[i] + 1)).toBe(true)
  const master = ctx.gains[0]
  expect(master.gain.cancelScheduledValues).toHaveBeenCalled()
  expect(master.gain.ramps[master.gain.ramps.length - 1].to).toBeLessThan(0.001)

  const after = ctx.oscillators.map(o => o.stops.length)
  handle.stop()
  expect(ctx.oscillators.map(o => o.stops.length)).toEqual(after)
})

test('a sound nobody stops closes its own context once it has finished', () => {
  playChime('soft', 1)
  const ctx = latest()
  expect(ctx.closed).toBe(false)
  vi.advanceTimersByTime(60_000)
  expect(ctx.closed).toBe(true)
})

test('an alarm left alone stops itself at the minute', () => {
  playChime('alarm', 1)
  const ctx = latest()
  vi.advanceTimersByTime(MAX_RINGING_S * 1000 + 500)
  // Nothing is scheduled past the minute, so there is nothing left to ring.
  expect(Math.max(...ctx.oscillators.map(o => o.startedAt ?? 0))).toBeLessThan(MAX_RINGING_S)
  vi.advanceTimersByTime(1000)
  expect(ctx.closed).toBe(true)
})

test('a browser with no AudioContext is silent rather than broken', () => {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext
  expect(() => playChime('alarm', 1).stop()).not.toThrow()
  expect(made).toHaveLength(0)
})

test('a profile is only one of the four names', () => {
  for (const name of CHIME_PROFILES) expect(isChimeProfile(name)).toBe(true)
  for (const junk of ['banana', '', 'Soft', 0, null, undefined, {}]) expect(isChimeProfile(junk)).toBe(false)
})
