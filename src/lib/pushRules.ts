/**
 * A task can be pushed to the next day at most this many times. Lives on
 * its own, separate from `store.ts`, so any module that needs the real
 * bound - not just the actions that enforce it - has one place to read it
 * from rather than a copy that can drift. `store.ts` re-exports this so
 * nothing that already imports MAX_PUSHES from there has to change.
 */
export const MAX_PUSHES = 2
