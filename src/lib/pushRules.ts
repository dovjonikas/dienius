/**
 * A task can be pushed to the next day at most this many times. Lives on
 * its own, separate from `store.ts`, so pure logic that needs the same
 * bound - `capacity.ts`'s trim candidate, for one - can import it without
 * pulling React into a module that has none, the same way `score.ts`
 * never does. `store.ts` re-exports this so nothing that already imports
 * MAX_PUSHES from there has to change.
 */
export const MAX_PUSHES = 2
