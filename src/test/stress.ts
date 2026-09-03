import { defaultData } from '../lib/storage'
import { actions } from '../lib/store'

/**
 * Measuring how much a load costs, without measuring the machine.
 *
 * CONVENTIONS.md section 3: a stress test asserts a *ratio* against a
 * baseline measured the same way, never a number of milliseconds. The suite
 * runs ninety files in parallel on whatever CI hands out, and a millisecond
 * budget fails for reasons that have nothing to do with the change under
 * test - one of these did exactly that once, under a dev server and a
 * browser running alongside it, then passed on its own. A test that fails
 * for no reason gets its threshold raised until it means nothing.
 *
 * So: the same operation twice, once empty and once loaded, alternating so a
 * machine that gets busier partway through slows both equally, keeping the
 * fastest of several rounds because the slow rounds are the ones where
 * something else was running.
 *
 * Shared rather than copied into each stress test, because there are four of
 * them and they were four slightly different copies of the same
 * `performance.now()` pair.
 */

/** Enough rounds that one unlucky pause cannot decide the result. */
const ROUNDS = 5

/**
 * The most a loaded store may cost over an empty one for the same operation.
 *
 * Deliberately loose. What these catch is a change in *shape* - a lookup
 * that became a scan, a memo that stopped holding, a render that started
 * walking every day in the store - which shows up as an order of magnitude,
 * not as a few percent. Measured ratios in this environment sit between
 * 1 and 3.
 */
export const SLOWDOWN_LIMIT = 8

/**
 * The per-test timeout these need.
 *
 * Each runs the operation ten times, and the first render in a process also
 * pays React's one-time module setup. Vitest's default 5s is not enough for
 * that on a busy machine, and being killed by the harness tells nobody
 * anything - the assertion below is what should decide the outcome.
 */
export const STRESS_TIMEOUT_MS = 30_000

export interface StressResult {
  empty: number
  loaded: number
  ratio: number
}

/**
 * Times `operation` against a store built by `baseline` and against one
 * built by `load`, and reports how much the second cost over the first.
 *
 * The baseline is a parameter rather than always-empty because the honest
 * baseline differs per test. For a year strip it is an empty store, because
 * the same 366 cells are drawn either way and only the lookups change. For a
 * list of two hundred rows it is a *small* list, because two hundred rows
 * genuinely do cost more than none and the question worth asking is whether
 * they cost proportionally more or quadratically more.
 *
 * `operation` is expected to render and clean up after itself - the store is
 * reset between every single measurement, so nothing carries over.
 */
export function measureSlowdown(baseline: () => void, load: () => void, operation: () => number): StressResult {
  let empty = Infinity
  let loaded = Infinity

  for (let round = 0; round < ROUNDS; round++) {
    const runBaseline = () => {
      actions.resetForTests(defaultData())
      baseline()
      empty = Math.min(empty, operation())
    }
    const runLoaded = () => {
      actions.resetForTests(defaultData())
      load()
      loaded = Math.min(loaded, operation())
    }
    // Alternated within the loop as well as between rounds: whichever side
    // goes first pays for the other's leftover garbage collection.
    if (round % 2 === 0) {
      runBaseline()
      runLoaded()
    } else {
      runLoaded()
      runBaseline()
    }
  }

  // A zero baseline is possible on a fast machine with a coarse clock, and
  // dividing by it says nothing at all. Half a millisecond is the floor.
  const floor = Math.max(empty, 0.5)
  return { empty: floor, loaded, ratio: loaded / floor }
}

/** Times one render-and-unmount, in milliseconds. */
export function timed(run: () => { unmount: () => void }): number {
  const t0 = performance.now()
  const { unmount } = run()
  const elapsed = performance.now() - t0
  unmount()
  return elapsed
}

/**
 * The same ratio measurement as `measureSlowdown`, for a pure function that
 * needs no store.
 *
 * `small` and `large` are the same operation over two sizes of input, and the
 * question is whether the larger costs proportionally more or catastrophically
 * more. The store-based version resets the store between measurements; this
 * one has nothing to reset, which is the whole difference.
 */
export function measureScaling(small: () => void, large: () => void): StressResult {
  let fastSmall = Infinity
  let fastLarge = Infinity

  const time = (run: () => void): number => {
    const t0 = performance.now()
    run()
    return performance.now() - t0
  }

  for (let round = 0; round < ROUNDS; round++) {
    if (round % 2 === 0) {
      fastSmall = Math.min(fastSmall, time(small))
      fastLarge = Math.min(fastLarge, time(large))
    } else {
      fastLarge = Math.min(fastLarge, time(large))
      fastSmall = Math.min(fastSmall, time(small))
    }
  }

  const floor = Math.max(fastSmall, 0.5)
  return { empty: floor, loaded: fastLarge, ratio: fastLarge / floor }
}
