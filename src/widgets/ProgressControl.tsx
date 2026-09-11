import { useEffect, useState } from 'react'
import { itemProgress, progressLabel, stepsOneAtATime, unitPlural } from '../lib/library'
import { actions } from '../lib/store'
import { usePointerCoarse } from '../lib/viewport'
import { todayKey } from '../lib/dates'
import type { LibraryItem, LibraryList } from '../lib/types'

/**
 * Where a number is put in: how far through a book, a course, a series.
 *
 * One control in two places, because the answer is wanted in both and the
 * owner should not have to go looking for the second one. It was in the
 * library and nowhere else, so recording a page meant leaving the day, and on
 * the day itself the same figure was drawn as a sentence with no way to
 * change it.
 *
 * **The number is typed, in every track.** The page track already had a field
 * and everything else had a plus and a minus, on the reasoning in
 * `stepsOneAtATime`: a chapter moves one at a time and a page does not. That
 * reasoning is right about the *step* and was wrong about the *number*. The
 * owner's list counts in pages, one at a time, in a book of 264 - and the
 * only way in was a plus button. "Nereiktu spaudinet o galetum ir skaiciu
 * irasyt."
 *
 * So the plus and the minus stay where they earn their place, and the figure
 * between them is a box. Typing does not replace stepping; it is the way in
 * for the times stepping is absurd.
 */
export interface ProgressControlProps {
  list: LibraryList
  item: LibraryItem
  /** For the name a screen reader reads out, since the visible label varies. */
  title?: string
}

export function ProgressControl({ list, item, title = item.title }: ProgressControlProps) {
  const done = itemProgress(item)
  const [typed, setTyped] = useState(String(done))
  // The figure can move from under this box - a plus pressed here, a step
  // taken on the day, the same item open in another pane - and a box showing
  // a stale number is worse than no box.
  useEffect(() => setTyped(String(done)), [done])

  const commit = () => {
    const next = Number(typed.trim())
    if (Number.isInteger(next) && next >= 0) actions.setLibraryItemProgress(list.id, item.id, next, todayKey())
    else setTyped(String(done))
  }

  const field = (
    <input
      className="library-page-input"
      inputMode="numeric"
      // The page track has a better sentence for this than "how far
      // through" does, and it is the one a screen reader was already
      // reading out.
      aria-label={item.track === 'pages' ? `Page you are on in ${title}` : `How far through ${title}`}
      value={typed}
      onChange={e => setTyped(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )

  // Out of how many, and of what, beside the box rather than inside it: a
  // number you are meant to overtype should hold the number and nothing else.
  //
  // The word comes from the track first and the list second, because the two
  // can disagree and the track is the one that is right. A list counted in
  // chapters can hold a book tracked by page number, and reading "of 499
  // chapters" off a 499-page book is the list answering a question about the
  // item.
  const counted = item.track === 'pages' ? 'pages' : item.track === 'series' ? 'episodes' : unitPlural(list)
  const outOf = (
    <span className="progress-of">
      {item.total !== undefined ? `of ${item.total} ` : ''}
      {counted}
    </span>
  )

  if (!stepsOneAtATime(item)) {
    return (
      <>
        {field}
        {outOf}
        {/* A sitting is ten or twenty-five pages more often than it is one,
            and typing the new number means remembering the old. */}
        {[10, 25].map(step => (
          <button
            key={step}
            type="button"
            className="library-step library-step-wide"
            aria-label={`${step} ${counted} more of ${title}`}
            onClick={() => actions.setLibraryItemProgress(list.id, item.id, done + step, todayKey())}
          >
            +{step}
          </button>
        ))}
      </>
    )
  }

  return (
    <div className="library-item-progress">
      <button
        type="button"
        className="library-step"
        aria-label={`One fewer ${list.unit} of ${title}`}
        disabled={done === 0}
        onClick={() => actions.stepLibraryItem(list.id, item.id, -1, todayKey())}
      >
        &minus;
      </button>
      {field}
      {outOf}
      <button
        type="button"
        className="library-step"
        aria-label={`One more ${list.unit} of ${title}`}
        onClick={() => actions.stepLibraryItem(list.id, item.id, 1, todayKey())}
      >
        +
      </button>
    </div>
  )
}

/**
 * The same number, on the card itself.
 *
 * The day draws "p. 0/139" beside a reading task, and until v2.21 that was a
 * label: to change it you opened the task, or you went to the library. The
 * owner, looking at the card: "padaryk kad paspaudus cia ant p 0/139 tiesiog
 * atsidaro ir gali pakeist fast".
 *
 * So the label is a press, and what it opens is itself: the chip becomes a
 * box holding the number, already selected, and Enter or moving away puts it
 * in. Escape leaves it as it was. Nothing else on the screen moves, which is
 * what makes it fast - a sheet that slides in to hold one number is the thing
 * this replaces.
 *
 * It stops the press reaching the card underneath, the way LinkOut does and
 * for the same reason: pressing a card already means something, and this
 * means the other thing.
 */
export function ProgressChip({ list, item, className, onOpenDetails }: ProgressControlProps & { className?: string; onOpenDetails?: () => void }) {
  const done = itemProgress(item)
  // On a finger, the same press opens the task instead.
  //
  // Not a preference: a field below 16px makes iOS Safari zoom the page when
  // it takes focus, which is why every input here is held at --t-input - and
  // a 16px box in a card's meta line is half the row. The sheet already
  // holds this control at a size a finger can use, so the press goes there
  // and the number is still two presses from the card rather than four.
  const coarse = usePointerCoarse()
  const [editing, setEditing] = useState(false)
  const [typed, setTyped] = useState(String(done))
  useEffect(() => setTyped(String(done)), [done, editing])

  if (!editing) {
    return (
      <button
        type="button"
        className={className ? `${className} task-library-open` : 'task-library-open'}
        aria-label={`How far through ${item.title}: ${progressLabel(list, item)}. Press to change it.`}
        onClick={e => {
          e.stopPropagation()
          if (coarse && onOpenDetails) onOpenDetails()
          else setEditing(true)
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        {progressLabel(list, item)}
      </button>
    )
  }

  const close = (save: boolean) => {
    if (save) {
      const next = Number(typed.trim())
      if (Number.isInteger(next) && next >= 0) actions.setLibraryItemProgress(list.id, item.id, next, todayKey())
    }
    setEditing(false)
  }

  return (
    <input
      className="task-library-input"
      inputMode="numeric"
      autoFocus
      aria-label={`How far through ${item.title}`}
      value={typed}
      onFocus={e => e.currentTarget.select()}
      onChange={e => setTyped(e.target.value)}
      onBlur={() => close(true)}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') close(true)
        if (e.key === 'Escape') close(false)
      }}
    />
  )
}
