/**
 * A task can be pushed to the next day at most this many times. Lives on
 * its own, separate from `store.ts`, so any module that needs the real
 * bound - not just the actions that enforce it - has one place to read it
 * from rather than a copy that can drift. `store.ts` re-exports this so
 * nothing that already imports MAX_PUSHES from there has to change.
 *
 * This was picked without a citation behind it - see docs/DECISIONS.md.
 * It earns its place on maintenance-burden grounds (a list that never
 * sheds a stalled item accretes silently), not on any evidence that two
 * is the right number specifically. It can be revised on its own terms;
 * nothing else in the app depends on it being exactly two.
 */
export const MAX_PUSHES = 2

/**
 * Whether a task can still be pushed to the next day - the real guard
 * behind MAX_PUSHES, not just the raw comparison against it. A task
 * marked `unbounded` has already answered the push bound's own
 * do-or-let-go-or-ongoing choice once, at the moment it reached the
 * bound, and skips that choice on every day after - so this is true for
 * it regardless of how many times it has actually moved. See
 * `Task.unbounded` in `types.ts` for what sets the flag and why it
 * persists across a push rather than being cleared like `core` is.
 *
 * Every place that decides whether a task can move - `rolloverUnfinished`
 * and `pushTask` in `store.ts`, the push button and the maxed-note in
 * `TaskRow.tsx`, the rollover count in `DayView.tsx` - reads this one
 * function rather than repeating the comparison, so the bound and its one
 * exemption can never drift apart between them.
 */
export function isPushable(task: { pushCount?: number; unbounded?: boolean }): boolean {
  return (task.pushCount ?? 0) < MAX_PUSHES || task.unbounded === true
}
