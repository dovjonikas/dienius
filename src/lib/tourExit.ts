import { actions } from './store'
import { endTour } from './tourState'
import { exitTourSandbox, isTourSandbox } from './tourMode'

/**
 * How the tour ends, wherever it is ended from.
 *
 * Its own function because there are now three doors out - the two buttons on
 * the last card, Skip on every other card, and Escape from anywhere - and the
 * third of those is handled in App.tsx's Escape chain, where the overlay's own
 * component is not in scope. Three copies of "and if this was the sandbox,
 * throw the sandbox away" is two copies too many; that clause is the whole
 * reason this is not just `endTour`.
 *
 * A sandbox replay never asks keep-or-clean, because the answer is already
 * known: the sandbox is a separate storage key and everything in it goes when
 * it closes. Asking would be offering somebody a choice about data that is
 * about to stop existing either way.
 */
export function leaveTour(outcome: 'keep' | 'clean'): void {
  if (isTourSandbox()) {
    endTour()
    exitTourSandbox()
    return
  }
  if (outcome === 'clean') actions.discardTourCreated()
  else actions.keepTourCreated()
  endTour()
}
