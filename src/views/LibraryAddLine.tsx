import { useRef, useState } from 'react'
import type { LibraryList, LibraryTrack } from '../lib/types'
import { actions } from '../lib/store'
import { lineHasShape, parseLibraryItemInput, shapeLine, shapeOf, stripTrailingShape, unitPlural, type LibraryShape } from '../lib/library'
import { readLastTrack, rememberLastTrack } from '../lib/libraryPrefs'
import { useClickAway } from '../lib/useClickAway'
import { Explain } from './Explain'
import { CountStepInput } from './CountStepInput'

/**
 * The library's add line, built the way quick-add is: the words, and two
 * controls that already hold an answer. The unit control opens on what the
 * list is counted in - or on what this list was last counted in on this
 * device - and offers the other shapes as chips; the count control is a
 * number with arrows, empty allowed, because a book with no known length
 * has no total and a guessed one would look like a fact.
 *
 * The words and the controls are one truth. A line that carries its own
 * shape - "Dune, 20 chapters", "Past Lives, movie" - wins, and the controls
 * redraw to show what was read. Press a chip or an arrow against such a
 * line and the words are rewritten to match, the same way quick-add
 * rewrites a typed time. A field saying one thing while a control beside it
 * says another is the bug this exists to make impossible.
 *
 * A film has no count, so the count control goes; a series has two - how
 * many seasons, and how many episodes in the one being watched.
 */

const TRACKS: (LibraryTrack | 'units')[] = ['units', 'pages', 'series', 'movie']

export function LibraryAddLine({ list }: { list: LibraryList }) {
  const [draft, setDraft] = useState('')
  const [track, setTrack] = useState<LibraryTrack | undefined>(() => readLastTrack(list.id))
  const [total, setTotal] = useState('')
  const [seasons, setSeasons] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)
  const unitRef = useRef<HTMLDivElement>(null)
  useClickAway(unitRef, unitOpen, () => setUnitOpen(false))

  const parsed = parseLibraryItemInput(draft)
  const fromText = lineHasShape(draft)
  // What Enter would make: the words first, then the controls.
  const typed = shapeOf(parsed)
  const effective: LibraryShape = fromText
    ? typed
    : {
        track,
        total: total === '' ? undefined : Number(total),
        seasons: track === 'series' && seasons !== '' ? Number(seasons) : undefined,
      }
  const effectiveTrack: LibraryTrack | 'units' = effective.track ?? 'units'

  // The order the chips are offered in: what this list is made of first. A
  // Watching list is films and series before it is anything counted in
  // episodes by hand.
  const watching = /^(episode|film|movie|season)s?$/i.test(list.unit)
  const order: (LibraryTrack | 'units')[] = watching ? ['movie', 'series', 'units', 'pages'] : TRACKS

  /** Changes the shape, in the words when the words carry one, else in the control. */
  function apply(next: LibraryShape) {
    if (fromText) {
      setDraft(shapeLine(stripTrailingShape(draft), next, list))
      return
    }
    setTrack(next.track)
    setTotal(next.total === undefined ? '' : String(next.total))
    setSeasons(next.seasons === undefined ? '' : String(next.seasons))
  }

  function pickTrack(next: LibraryTrack | 'units') {
    const chosen = next === 'units' ? undefined : next
    apply({ track: chosen, total: chosen === 'movie' ? undefined : effective.total, seasons: chosen === 'series' ? effective.seasons : undefined })
    rememberLastTrack(list.id, chosen)
    setUnitOpen(false)
  }

  function add() {
    if (!parsed) return
    const title = fromText ? parsed.title : draft.trim()
    if (!title) return
    actions.addLibraryItemShaped(list.id, { title, ...effective })
    setDraft('')
    // The shape is a habit, the count is not: the next book has its own length.
    setTotal('')
    setSeasons('')
  }

  const unitWord = (t: LibraryTrack | 'units') =>
    t === 'units' ? unitPlural(list) : t === 'movie' ? 'film' : t === 'series' ? 'series' : 'pages'

  return (
    <div className="library-add">
      <input
        value={draft}
        data-tour="library-add"
        placeholder={`Add - try "Something good, 12 ${unitPlural(list)}"`}
        aria-label={`Add to ${list.name}`}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      <Explain id="library-unit">
      <div className="duration-control library-unit" ref={unitRef}>
        <button
          type="button"
          className="duration-control-value"
          aria-expanded={unitOpen}
          aria-label={`Counted in ${unitWord(effectiveTrack)}. Change how it is counted.`}
          title={fromText ? 'Read from what you typed' : 'How this one is counted'}
          onClick={() => setUnitOpen(o => !o)}
        >
          {unitWord(effectiveTrack)}
        </button>
        {unitOpen && (
          <div className="duration-control-panel">
            <div className="duration-control-chips is-column" role="group" aria-label="How it is counted">
              {order.map(t => (
                <button
                  key={t}
                  type="button"
                  className={effectiveTrack === t ? 'is-on' : ''}
                  aria-pressed={effectiveTrack === t}
                  onClick={() => pickTrack(t)}
                >
                  {t === 'units' ? unitPlural(list) : t === 'movie' ? 'a film' : t === 'series' ? 'seasons and episodes' : 'pages'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      </Explain>
      {effectiveTrack !== 'movie' && effectiveTrack !== 'series' && (
        <CountStepInput
          value={effective.total === undefined ? '' : String(effective.total)}
          onChange={next => apply({ ...effective, total: next === '' ? undefined : Number(next) })}
          ariaLabel={effectiveTrack === 'pages' ? 'How many pages' : `How many ${unitPlural(list)}`}
          // Not the unit word: the control immediately to the left already
          // says "chapters", and two adjacent controls reading the same word
          // is one of them looking like a duplicate of the other. This one
          // asks how many; that one asks of what.
          // "how many" is a question, and it was being asked inside a box
          // sized for a two-digit answer - it read "how mar" on every screen
          // this app has. The question is in the label; the box shows the
          // shape of what goes in it.
          placeholder="12"
        />
      )}
      {effectiveTrack === 'series' && (
        <>
          <CountStepInput
            value={effective.seasons === undefined ? '' : String(effective.seasons)}
            onChange={next => apply({ ...effective, seasons: next === '' ? undefined : Number(next) })}
            ariaLabel="How many seasons"
            placeholder="seasons"
          />
          <CountStepInput
            value={effective.total === undefined ? '' : String(effective.total)}
            onChange={next => apply({ ...effective, total: next === '' ? undefined : Number(next) })}
            ariaLabel="Episodes in the season"
            placeholder="episodes"
          />
        </>
      )}
      <button type="button" className="btn-secondary" disabled={!draft.trim()} onClick={add}>
        Add
      </button>
    </div>
  )
}
