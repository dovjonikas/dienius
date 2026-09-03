import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { actions, getData, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { busyIntervals, useCalendarCache } from '../../lib/calendars'
import { CATEGORIES, DEFAULT_CATEGORY, categoryColor, categoryLabel, type CategoryId } from '../../lib/categories'
import { TimeColumns } from '../../views/TimeColumns'
import { MinuteStepInput } from '../../views/MinuteStepInput'
import { clearDraft, consumeDraft, saveDraft } from './draft'
import { durationToText, parseQuickAdd, replaceLeadingTime, replaceTrailingDuration } from './parse'
import { formatDuration } from './capacity'
import { stepToQuarter, suggestSlot } from './autoSlot'
import { DURATION_CHOICES, readLastDuration, rememberDuration } from './quickAddPrefs'

/**
 * Quick-add: a time control, a line of text, and a duration control.
 *
 * The whole point is the ordinary path. Type "Call mom", press Enter, and the
 * task is already at a real clock time for a real length, because both
 * controls opened holding an answer rather than an empty box. Nobody drags a
 * finger across a number pad to type "14:00" and then "30" thirty times a
 * week; that was the daily papercut this replaces.
 *
 * The power path is untouched and is the reason the controls are wired the
 * way they are: "14:00 Call mom 45min" still parses out of the prose, and
 * when it does, the *text wins* and the controls redraw to show what was
 * understood. Push an arrow or tap a chip while the line carries its own time
 * or duration and the words themselves are rewritten - see
 * `replaceLeadingTime` and `replaceTrailingDuration` in parse.ts. There is
 * one truth on screen at a time, never a field and a control quietly
 * disagreeing about what Enter is going to do.
 *
 * Its own component rather than markup inside TaskPane because everything in
 * here is one feature that has to behave identically wherever capture
 * happens - and because it is what the tour points at, which makes it a
 * contract, not a layout detail.
 */

export interface QuickAddProps {
  date: string
  /** Everything already on the day - what the auto time is measured around. */
  tasks: Task[]
}

/** What the time control is currently getting its answer from. */
type TimeMode = 'auto' | 'set' | 'none'

export function QuickAdd({ date, tasks }: QuickAddProps) {
  const data = useAppData()
  const calendarCache = useCalendarCache()
  const [input, setInput] = useState(() => consumeDraft(date))
  // Which category the next quick-added task gets. Session state, not stored:
  // it follows what you are doing right now, and the point of a default is
  // that most tasks typed in one sitting belong together - carrying that
  // across days would be a guess about tomorrow instead.
  const [newCategory, setNewCategory] = useState<CategoryId>(DEFAULT_CATEGORY)
  // Which of the two things Enter does. A mode rather than a second field: one
  // input with one cursor, and the thing being typed goes wherever the toggle
  // says, so capturing costs a tap once rather than a decision every time
  // about which box to aim at.
  const [captureMode, setCaptureMode] = useState<'task' | 'inbox'>('task')
  const [timeMode, setTimeMode] = useState<TimeMode>('auto')
  const [setTime, setSetTime] = useState('')
  const [duration, setDuration] = useState(() => readLastDuration())
  const [timeOpen, setTimeOpen] = useState(false)
  const [durationOpen, setDurationOpen] = useState(false)
  const timeRef = useRef<HTMLDivElement>(null)
  const durationRef = useRef<HTMLDivElement>(null)

  // Re-parsed on every keystroke. Cheap - one regex pass over a short string -
  // and the alternative (parsing only on Enter) is what the chips exist to fix.
  const draft = parseQuickAdd(input)

  const isToday = date === todayKey()
  const now = new Date()
  const day = data.days[date]
  const template = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
  const autoTime = suggestSlot({
    tasks,
    durationMinutes: draft?.minutes ?? duration,
    busy: busyIntervals(date, data.settings.calendars, calendarCache),
    sleepProfileId: day?.sleepProfileId ?? template?.sleepProfileId,
    sleep: { profiles: data.settings.sleepProfiles },
    notBefore: isToday ? now.getHours() * 60 + now.getMinutes() : undefined,
  })

  // What Enter would actually use, in the order the three sources outrank each
  // other: the typed line first, then whatever the control was pushed to, then
  // the free slot the day suggests on its own.
  const effectiveTime =
    draft?.time ?? (timeMode === 'none' ? undefined : timeMode === 'set' ? setTime || undefined : autoTime)
  const effectiveMinutes = draft?.minutes ?? duration
  const fromText = draft?.time !== undefined

  useClickAway(timeRef, timeOpen, () => setTimeOpen(false))
  useClickAway(durationRef, durationOpen, () => setDurationOpen(false))

  function handleInputChange(text: string) {
    setInput(text)
    saveDraft(date, text)
  }

  /**
   * Moves the time on by a quarter hour. When the line carries its own time
   * the words are what move; otherwise the control takes over from whatever
   * it was showing, which is what makes the arrows work as a nudge to the
   * suggestion rather than a separate setting that starts from nowhere.
   */
  function stepBy(delta: number) {
    if (fromText) {
      handleInputChange(replaceLeadingTime(input, stepToQuarter(draft!.time!, delta)))
      return
    }
    setTimeMode('set')
    // Stepped from the previous value rather than from `effectiveTime` in this
    // render's closure. Two presses inside one frame - a double tap, a held
    // key - both read the same stale value that way and the second one is
    // swallowed; measured in a browser, two clicks on the arrow moved the time
    // by fifteen minutes rather than thirty.
    setSetTime(previous => stepToQuarter(previous || autoTime || clockNow(now), delta))
  }

  function pickTime(time: string) {
    if (fromText) {
      handleInputChange(replaceLeadingTime(input, time))
      return
    }
    setTimeMode('set')
    setSetTime(time)
  }

  function pickDuration(minutes: number) {
    if (draft?.minutes !== undefined) {
      handleInputChange(replaceTrailingDuration(input, minutes))
      return
    }
    setDuration(minutes)
    rememberDuration(minutes)
  }

  function handleAdd() {
    if (captureMode === 'inbox') {
      // Straight in, exactly as typed - no parsing, because an inbox item is
      // not a task yet and a time or a duration in it is just part of the note
      // somebody wrote to themselves.
      if (!input.trim()) return
      actions.addInboxItem(input)
      setInput('')
      clearDraft()
      return
    }
    const parsed = parseQuickAdd(input)
    if (!parsed) return
    actions.addTask(date, parsed.title, effectiveTime, newCategory)
    const added = getData().days[date]?.tasks.at(-1)
    if (added) actions.setTaskMinutes(date, added.id, effectiveMinutes)
    setInput('')
    // Back to auto, so the next thing typed lands after the thing just added
    // rather than on top of it. The duration is deliberately kept: a run of
    // tasks typed in one sitting is usually a run of similar-sized tasks, and
    // re-picking 45m five times is the papercut again.
    setTimeMode('auto')
    setSetTime('')
    setTimeOpen(false)
    setDurationOpen(false)
    clearDraft()
  }

  const timeLabel = effectiveTime ?? 'No time'
  const timeTitle = fromText
    ? `${effectiveTime} - read from what you typed`
    : timeMode === 'none'
      ? 'No time: this goes on the day without a slot'
      : effectiveTime
        ? timeMode === 'auto'
          ? `${effectiveTime} - the next free slot. Change it, or leave it.`
          : `${effectiveTime}. Change it, or leave it.`
        : 'Nothing free left today - this goes on the day without a slot'

  return (
    <div className="quick-add-block">
      <div className="capture-mode segmented" role="group" aria-label="What Enter does">
        <button
          type="button"
          className={captureMode === 'task' ? 'active' : ''}
          aria-pressed={captureMode === 'task'}
          onClick={() => setCaptureMode('task')}
        >
          Task
        </button>
        <button
          type="button"
          className={captureMode === 'inbox' ? 'active' : ''}
          aria-pressed={captureMode === 'inbox'}
          onClick={() => setCaptureMode('inbox')}
        >
          Inbox
        </button>
      </div>

      <div className="quick-add-row">
        {/* An inbox line has no day and therefore no hour and no length, so
            both controls go rather than sit there greyed out - a disabled
            control still asks to be read. */}
        {captureMode === 'task' && (
          <div className="quick-add-time-control time-stepper" ref={timeRef} data-tour="quick-add-time">
            <button
              type="button"
              className={effectiveTime ? 'quick-add-time-value' : 'quick-add-time-value is-none'}
              aria-expanded={timeOpen}
              aria-label={timeTitle}
              title={timeTitle}
              onClick={() => setTimeOpen(open => !open)}
            >
              {timeLabel}
            </button>
            <div className="time-stepper-buttons">
              <button
                type="button"
                className="time-step"
                aria-label="A quarter of an hour later"
                onClick={() => stepBy(1)}
              />
              <button
                type="button"
                className="time-step is-down"
                aria-label="A quarter of an hour earlier"
                onClick={() => stepBy(-1)}
              />
            </div>
            {timeOpen && (
              <div className="quick-add-time-panel">
                <div className="quick-add-time-modes">
                  <button
                    type="button"
                    className={!fromText && timeMode === 'auto' ? 'is-on' : ''}
                    onClick={() => {
                      setTimeMode('auto')
                      setTimeOpen(false)
                    }}
                  >
                    {autoTime ? `Next free slot - ${autoTime}` : 'Next free slot - none left'}
                  </button>
                  <button
                    type="button"
                    className={!fromText && timeMode === 'none' ? 'is-on' : ''}
                    onClick={() => {
                      setTimeMode('none')
                      setTimeOpen(false)
                    }}
                  >
                    No time
                  </button>
                </div>
                <TimeColumns value={effectiveTime ?? ''} onPick={pickTime} />
              </div>
            )}
          </div>
        )}

        <input
          className="quick-add"
          /* Marked rather than reached by a ref chain from the shell: the N
             shortcut lives at the app root and has no business knowing this
             view's internals - see App.tsx. */
          data-quick-add=""
          placeholder={captureMode === 'inbox' ? 'Catch a thought, decide later...' : 'Add a task, and press Enter'}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />

        {captureMode === 'task' && (
          <div className="quick-add-duration" ref={durationRef} data-tour="quick-add-duration">
            <button
              type="button"
              className="quick-add-duration-value"
              aria-expanded={durationOpen}
              aria-label={`${formatDuration(effectiveMinutes)} long. Change how long.`}
              title={`${formatDuration(effectiveMinutes)} long`}
              onClick={() => setDurationOpen(open => !open)}
            >
              {durationToText(effectiveMinutes)}
            </button>
            {durationOpen && (
              <div className="quick-add-duration-panel">
                <div className="quick-add-duration-chips" role="group" aria-label="How long">
                  {DURATION_CHOICES.map(minutes => (
                    <button
                      key={minutes}
                      type="button"
                      className={effectiveMinutes === minutes ? 'is-on' : ''}
                      aria-pressed={effectiveMinutes === minutes}
                      onClick={() => {
                        pickDuration(minutes)
                        setDurationOpen(false)
                      }}
                    >
                      {durationToText(minutes)}
                    </button>
                  ))}
                </div>
                {/* Anything the four chips do not cover, without leaving the
                    row: the same stepper the template editor uses, so a
                    duration is entered one way in this app and not two. */}
                <MinuteStepInput
                  value={String(effectiveMinutes)}
                  onChange={next => {
                    const minutes = Number(next)
                    if (Number.isInteger(minutes) && minutes > 0) pickDuration(minutes)
                  }}
                  ariaLabel="How long, in minutes"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* What the line was understood as, live, before Enter is pressed.
          Quick-add accepts a leading time and a trailing duration inside
          ordinary prose, which is fast to type and impossible to be sure of -
          "Read 20 pages" must keep its 20 and "Read 20 min" must not. Showing
          the parse removes the doubt at the moment it exists, which is
          cheaper than an error afterwards. Nothing here is a control: it is
          the input describing itself. */}
      {draft && captureMode === 'task' && (
        <div className="quick-add-chips" aria-live="polite">
          {effectiveTime && <span className="quick-add-chip is-time">{effectiveTime}</span>}
          <span className="quick-add-chip is-size">{formatDuration(effectiveMinutes)}</span>
          <span
            className="quick-add-chip is-cat"
            style={{ ['--cat' as string]: categoryColor(newCategory) } as React.CSSProperties}
          >
            {categoryLabel(newCategory)}
          </span>
          <span className="quick-add-chip-title">{draft.title}</span>
        </div>
      )}

      {/* Which colour the next task gets, chosen before typing rather than
          asked about afterward - six swatches is one glance and one tap,
          where a follow-up dialog would be a second decision at exactly the
          moment the thought is meant to be leaving your head. Each is a real
          toggle button carrying its own name, so the choice is reachable and
          readable without relying on the colour. */}
      {captureMode === 'task' && (
        <div className="category-picker" role="group" aria-label="Category for the next task">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={c.id === newCategory ? 'category-swatch selected' : 'category-swatch'}
              style={{ ['--cat' as string]: c.color } as React.CSSProperties}
              aria-pressed={c.id === newCategory}
              aria-label={c.label}
              title={c.label}
              onClick={() => setNewCategory(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function clockNow(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Closes a panel on a pointerdown outside it or on Escape - never on the
 * first pick inside it. Closing on a pick meant an hour and a minute cost
 * four taps: choose the hour, watch it shut, open it again, choose the
 * minute. Pointerdown rather than click, so the panel is gone before whatever
 * was under it reacts.
 */
function useClickAway(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
    // close and ref are stable for the life of the panel being open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
