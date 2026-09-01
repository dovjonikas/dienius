# Dienius - the timeline, and what replaces the if-then board

> Written 2026-08-31 after the owner used the app for a day and said the flat today-list does not
> work for him, that he wants an hour grid showing occupied time like the calendar apps do, and that
> the if-then board is dead weight as built. This doc is the design answer to both. Read
> `docs/DECISIONS.md` first - several choices here deliberately contradict what a normal calendar
> would do, and the reasons matter.

## 1. The problem with a flat list, honestly

A list of items with optional start times cannot answer the only question that matters at 9am:
**does today actually fit?**

Eight tasks look identical to three tasks plus a five-hour shift. The list has no notion of how much
of the day is already gone, so it invites planning a day that was never possible - and then the
score at the end measures a person against a plan that was fiction from the start. That is the exact
guilt the no-guilt score was built to avoid, arriving through a side door.

## 2. Why NOT to copy Google Calendar

The obvious fix is a grid where everything gets a slot. That fails for this owner specifically, and
the reason is in the brief: **times are anchors, not a minute grid.** Fix only what is really fixed.

Every calendar-first planner dies the same way. It demands a decision for every item (when exactly?),
most items have no honest answer, so the person either invents one or stops using the app. Placing a
task at 14:30 that could happen any time between lunch and evening is a lie you have to maintain.

So the grid stays, but it stops being a placement surface and becomes a **capacity surface.**

## 3. The twist - anchors, floats, and the gap between them

Three ideas, and the third is the product.

**Anchors** are things with a real time: the shift, the gym class, the call at 16:00. They are drawn
on the grid at their actual position, with a real height, because they genuinely occupy that time.

**Floats** are everything else: publish the video, guitar 20 minutes, call grandma. They have a size
but no position. They sit in a tray under the grid, unplaced, and that is a valid final state - a
float never has to be scheduled to be done.

**The gap** is the point. The app computes the free time between anchors and compares it against the
total size of the floats:

```
Anchors take 6h10. Free: 5h20 across 4 gaps.
Floats need about 6h. You are 40 min over.
```

That single line is the whole feature. It is the thing a list cannot say and a calendar refuses to
say, and it is the ADHD-relevant one: time blindness is not fixed by more boxes, it is fixed by
seeing the arithmetic before the day starts instead of at 23:00.

**No auto-scheduling.** Motion and its imitators place your tasks for you. Do not. The moment the app
decides where things go, the person stops holding their own day in their head, which is the one thing
the brief says the product is for ("kad jau turetume viska ir reiktu tik daryt kaip per pamokas" -
his words about knowing the day, not being told it).

## 4. What this needs in the data model

One required change and one optional field. Both are additive, both default to today's behaviour.

```ts
export interface Task {
  // ...existing
  time?: string          // start, already exists - now means ANCHORED at this time
  minutes?: number       // NEW. Estimated size. Absent = unsized.
}

export interface TemplateBlock {
  // ...existing
  minutes?: number       // NEW, same meaning - templates carry sizes so a stamped day arrives sized
}
```

A task with `time` is an anchor. A task without it is a float. That distinction already exists in the
data by accident - this just gives it a name and a consequence.

`minutes` absent means unsized, and unsized floats are counted separately ("+3 unsized") rather than
guessed at. Never invent a default duration; a wrong number is worse than a missing one because it
silently poisons the capacity line.

**Default sizes come from templates, not from the app.** When he builds a "Full day" template he sets
gym 90, guitar 20, deep work 120 once, and every stamped day inherits them. That is the
decision-once principle applied to duration, and it means the capacity line works from day one
without him ever typing a number into a task.

## 5. What the day view becomes

Three zones, top to bottom, on one screen at 375px - plus a fourth thing, the grid's own disclosure,
that decides whether zone 2 is actually on screen at all.

**Zone 1 - the capacity line.** One sentence, the arithmetic above. Never red, never a warning icon.
It only ever states the arithmetic - no "trim" or any other action is embedded in the sentence itself;
which float moves to tomorrow, if any, is decided on that float's own row in the tray instead, so the
app never pre-selects it.

**The grid's disclosure - collapsed by default.** `docs/RESEARCH-ADHD.md` section 7 measured what
shipping the grid at full height actually does to the screen: at 375x812 with a realistic day (a
shift, an appointment, five floats) the grid alone ran 58 percent of the viewport, pushing the task
list - the thing the owner opens the app to act on - below the fold. Visual working memory holds
about four items, and a screen where the grid outweighs everything else is not showing more, it is
showing noise with the task list buried in it. The grid still earns its place - it is worth keeping
for how it makes the day read - but not the screen's first fold, and not by default.

So zone 2 is real markup only while a plain toggle button just under the capacity line - "Show
timeline" / "Hide timeline", a proper disclosure with `aria-expanded` and `aria-controls`, not a
CSS-hidden panel - says it should be. Collapsed is the default a fresh install starts at and the
default a payload from before this toggle existed migrates to, because the grid must never be the
reason the fold fails again. The choice itself is a single app-wide setting
(`settings.timelineExpanded`), not anything a day's own data carries: opening the grid once keeps it
open on every day after, and closing it again keeps it closed, because deciding this fresh every
morning is exactly the per-day decision this product refuses to add. A day with no anchors at all
shows no toggle either - there is nothing behind it to open.

**Zone 2 - the grid**, once opened. Vertical hours. Two rules that separate it from every calendar:

- **It shows only the waking window that is actually in use** - first anchor minus an hour to last
  anchor plus an hour, not 00:00 to 23:59. A day with two anchors should be two blocks and some air,
  not a wall of empty rows to scroll past.
- **The gaps are drawn as real objects,** not as blank space. A 90-minute hole between the shift and
  the gym is a labelled, tappable region: "1h30 free". Tapping it offers the floats that fit. That is
  the one calendar-like interaction worth having, and it is opt-in per gap rather than mandatory for
  every task.

Anchors show a title, their time range, and the day-type colour they came from. Nothing else fits at
375px and nothing else is needed.

**Zone 3 - the float tray.** The current task list, unchanged in behaviour: quick add, check off,
push. Each item shows its size as a small chip if it has one. Dragging a float onto a gap anchors it;
dragging it back to the tray un-anchors it. Drag is a convenience, never the only path - a long-press
menu does the same thing, because the calendar drag already has a documented history of not working
on touch in this repo.

Zone 3 sits directly under the disclosure in the markup, whether or not zone 2 is currently open -
the grid, when collapsed, occupies no vertical space at all rather than reserving a slot for itself,
which is what keeps quick-add and the first task in the tray on screen at 375x812 regardless of how
tall a given day's grid would be if opened.

## 6. What replaces the if-then board

The board is not a bad idea badly built. It is a correct idea in the wrong place.

Implementation intentions work because the decision is already made when the trigger arrives.
A separate tab requires a person to remember to open it - which is precisely the state they are not
in when the trigger fires. A rule nobody reads at the right moment is not a rule, it is a note.

**Delete the tab.** Keep the data. Change where it appears.

**Attach rules to day types.** An `IfThenEntry` gains an optional `dayTypes?: DayType[]`. Night-shift
rules only surface on night days. This is where his real ones live: the sleep protocol matters on a
night, not on a rest day.

**Surface exactly one, on the day view, under the capacity line.** One rule, quiet, no styling that
demands attention. It rotates: the one most relevant to today's type, then least-recently-shown.
Tapping it opens the full list, which is where editing lives.

**Add optional time bands.** A rule can carry `when?: 'morning' | 'day' | 'evening' | 'any'`. The
evening trigger surfaces in the evening. This is a two-line change and it is most of what makes the
feature actually fire.

Still nothing is measured. No "did you use this rule" counter, no streak, no done flag. The moment a
rule becomes a task it stops being a pre-made decision and becomes one more thing to fail at - that
reasoning is already in `docs/DECISIONS.md` and it stands.

## 7. What is worth taking from other planners

- **Sunsama** - the daily planning ritual and, crucially, the planned-time-versus-available-time
  readout. That readout is the direct ancestor of the capacity line. What to skip: the ceremony. It
  is a five-minute guided flow every morning and it is too much for someone who wants zero decisions.
- **Structured (iOS)** - the visual timeline that reads as a single ribbon rather than a spreadsheet.
  Worth stealing the shape. What to skip: it wants everything placed.
- **Amazing Marvin** - built for ADHD; time estimates on tasks and a "today is overcommitted" signal.
  What to skip: everything else, it drowns in options.
- **Motion / Reclaim** - auto-scheduling. Explicitly do not copy, see section 3.
- **Google Calendar** - the only thing worth taking is the hour grid's legibility at a glance.

The synthesis: Structured's ribbon, Sunsama's capacity readout, Marvin's estimates, and the
push rule and no-guilt score that are already this app's own.

## 8. Build order

1. **Done.** `minutes` on `Task` and `TemplateBlock`, plus the size chip in the template editor.
   Additive, nothing else changed. A task's own size can also be set or changed after the fact
   through a quiet control on its own row - never through quick-add, which stays one input and one
   Enter. `validate()` in `storage.ts` accepts both shapes: absent minutes loads exactly as it did
   before this field existed, and a present value must be a non-negative whole number or the payload
   is rejected the same way a bad `pushCount` already was.
2. **Done.** `capacity.ts` - pure functions: free gaps from anchors, total float size, the resulting
   sentence. Unit tested with no React anywhere near it, same as `score.ts`.

   The window free time is measured against is **a fixed waking window: 07:00-23:00 for an ordinary
   day, 13:00-24:00 for a `night`-type one.** Two earlier versions of this were both wrong. The
   anchor span (first anchor's start to last anchor's end) failed by ignoring everything outside the
   anchors themselves - a midday shift with real hours free before and after it reported "no free
   time," and a morning-only anchor silently ignored an entire afternoon and evening. The calendar day
   (00:00-24:00) fixed that but broke the feature the other way: it counted sleep as free time, so a
   09:00-21:00 shift reported twelve hours free when most of that was the middle of the night, and
   the overage line would as a result almost never fire - technically true, practically useless.

   A fixed waking window is neither. It is not configured per day - section 9 still rules that out -
   it is simply narrower than the full calendar day, the same way section 5's own grid window (first
   anchor minus an hour to last anchor plus an hour) is narrower without being a setting. `dayType`
   already exists on every day (`dayScore` already reads it the same way), so reading it here to pick
   between two fixed windows asks the owner nothing new - it uses information already given once,
   when the template was built. A night day's window starts later and runs to midnight rather than
   stopping short of it: its own morning is spent asleep, recovering from or resting before a shift,
   the same way an ordinary day's late night already is, and there is no pre-sleep wind-down to
   exclude at the end the way there is for a normal day - the shift itself is the end of the day's
   usable time. This is a coarse reading of one label, not a measurement of any specific person's
   actual shift time, and is flagged as such in `capacity.ts`'s own comments; if a real month of night
   days shows the bounds are off, the fix is to adjust the two numbers, not to make the window
   configurable.

   Anchors are clipped to the window rather than counted outside it: a shift that starts before the
   window opens or runs past where it closes only contributes the portion that falls inside, and an
   anchor entirely outside the window (a stray task logged for 03:00) contributes nothing. Clipping
   means an anchor can never push free time negative, and it degrades correctly with no special
   casing - zero anchors mean nothing is claimed, reported as `null` rather than a fabricated "16h
   free," and a single anchor that fills or overruns the whole window correctly leaves nothing free.
   An anchor whose own `minutes` is unknown is treated with the same honesty as an unsized float: it
   is left out of the occupied total and, because its true length is unknown, it also blocks any
   free-time figure from being asserted at all - the app says "free time isn't known" rather than
   guessing around a gap that anchor might actually run through.
3. **Done.** The capacity line on the day view, one plain sentence at the top. Never red, never an
   icon, never a warning word; "about" appears exactly once, on the floats estimate, since that is
   the one number built from guesses rather than clock time. The line only ever states the
   arithmetic - it does not embed a "trim" action or pre-select which float would move. Each float's
   own row carries a quiet "push to tomorrow" control instead, using the same `pushTask` mechanism
   `rolloverUnfinished` already uses and bound by the same `MAX_PUSHES`, so which float actually moves
   stays the owner's decision rather than the app's guess at it.
4. **Done.** The grid, read-only: anchors and labelled gaps, collapsed window.

   `timelineLayout.ts` (`src/widgets/day-plan/`) is the pure module - anchor position and height,
   gap detection, and the display window itself, all unit tested with no React nearby, the same
   posture `capacity.ts` and `score.ts` already take. `TimelineGrid.tsx` only turns that layout into
   pixels; it does not compute one.

   **This window is not `computeCapacity`'s window, and the two are meant to disagree at the
   edges.** `computeCapacity` measures against a fixed waking window (07:00-23:00, or 13:00-24:00 on
   a night day) - a real clock boundary its own arithmetic answers to. The grid instead crops to
   where anchors actually are: first anchor's start minus one hour to last anchor's end plus one
   hour, exactly as this section already specified. A day whose first anchor is at 09:00 draws a
   window opening at 08:00 even though the capacity line's own window opened at 07:00 and would
   report that missing hour as real free time - the grid does not draw it, because doing so would
   mean either a fourth gap object dangling off the top edge with nothing on its other side, or
   quietly padding the window back out toward 00:00-23:59, the wall of empty rows this section rules
   out. The one-hour buffer on each edge is air for the eye, never a `TimelineGap` - only the
   stretches strictly between two anchors become gap objects, matching this section's own example
   ("a 90-minute hole between the shift and the gym"). A day with no anchors draws no grid at all -
   nothing anchors a window, so there is nothing to crop to and nothing to show.

   An anchor with no `minutes` has no honest height, so none is invented. It draws at its real start
   time with a fixed placeholder height (a UI floor, not a duration guess) and a plain "size unknown"
   label instead of a time range. Exactly like `computeCapacity`, one unsized anchor suppresses every
   gap for that day - its real length is unknown, so it might run through what would otherwise look
   like free time, and reporting a gap around it would be a guess dressed up as arithmetic. A quiet
   note under the grid says gaps aren't shown when this happens.

   Overlapping anchors are placed in side-by-side columns rather than drawn on top of each other, the
   standard interval-graph packing a calendar view needs. An anchor clipped by the window's own edge
   (a night shift running past midnight) still states its real time range, wrapped onto the next
   day's clock, with only the drawn block itself stopping short and a soft fade saying so.

   Entirely `aria-hidden`. Every anchor the grid draws is also an ordinary row in the task list
   below it, already reachable with its title, time, checkbox and controls intact - the grid adds a
   second, purely visual reading of the same information rather than a second, worse copy of an
   interactive one, following the same reasoning `YearStrip.tsx` already documents for dropping a
   half-true role rather than asserting one. When gap interaction arrives in step 5, the gap elements
   that become genuinely interactive should be pulled out from under this wrapper and given their own
   accessible name at that point.
5. **Done.** Gap interaction: tap a gap, pick a float that fits.

   `gapPlacement.ts` is the pure logic - which floats fit a given gap, and what the picker shows
   when it opens - unit tested with no React nearby, the same posture every other pure module in
   this feature takes. A sized float fits when its own `minutes` is no larger than the gap's; equal
   counts as fitting. An unsized float is never said to fit - `capacity.ts` already refuses to
   invent a duration rather than guess one that could poison the arithmetic, and this is the same
   refusal applied to one gap - so it is offered separately, under its own "size unknown" label,
   rather than hidden outright or claimed to fit. A float larger than every gap is left out of
   every picker entirely; there is nothing honest to say about it there. The picker caps what it
   shows to four rows before asking - `docs/RESEARCH-ADHD.md` section 7, visual working memory
   holds about four integrated objects - with a "show N more" step that reveals the rest in place
   rather than a second screen.

   Tapping a gap opens a bottom sheet (`GapPicker.tsx`), a real `role="dialog"` pulled out from
   under the grid's own `aria-hidden` wrapper with its own accessible name, focus trap, and
   Escape/scrim dismissal - the one part of step 4's note this step resolves. Placing a float sets
   its `time` to the gap's own start; nothing else about the task changes, and the day's tasks are
   the only state either the grid or the capacity line ever read, so both update immediately from
   the same store write with no separate refresh path. A gap with nothing that fits still opens and
   says so plainly rather than either a dead control or an empty list.

   Undo does not wait for step 7's drag: any task with a `time` - however it got one - carries a
   quiet "remove time" control on its own row in the task list, clearing `time` and nothing else.
   It is not hidden behind a hover state the way `push` and `delete` are, since it exists
   specifically so a placement made by accident on a phone is easy to reverse without hunting.
   `actions.placeFloat` and `actions.unanchorTask` in `store.ts` are the two store actions
   underneath both directions; step 7's drag calls the same two rather than inventing a third path.
6. **Done.** If-then relocation: `dayTypes` and `when` fields, one rule on the day view, tab
   deleted.

   `docs/RESEARCH-ADHD.md` sections 1 and 2, written the same night as this section, raised the
   stakes on this step specifically: implementation intentions are the best-evidenced mechanism in
   the app (Gollwitzer and Sheeran 2006, d = 0.65 across 94 tests), the effect is larger still in
   populations with impaired executive control, and Barkley's point-of-performance principle argues
   directly against a rule filed in a tab nobody remembers to open. The 2025 update to that
   meta-analysis also found effects are larger when a plan has been rehearsed at least once - a
   direct argument for a rule seen daily on the screen already open, rather than one reviewed
   nowhere at all.

   `IfThenEntry` gains two optional fields and one piece of invisible scheduling metadata:
   `dayTypes?: DayType[]` (absent means every day), `when?: 'morning' | 'day' | 'evening' | 'any'`
   (absent and `'any'` mean the same thing - a rule saved through the app always writes the former),
   and `lastSurfaced?: string`, a plain date key recording which day the rule was last chosen to
   surface. That last field is scheduling metadata for rotation, never a use counter and never
   rendered - `docs/RESEARCH-ADHD.md` section 12 rules out any measurement of an if-then rule by
   name, and this records when the app last chose to show the rule, not whether it was read or
   acted on.

   `pickIfThenRule` in the new `src/widgets/if-then/select.ts` is the pure selection module, unit
   tested the same way `capacity.ts` and `score.ts` already are. Eligibility is a strict filter, not
   a soft ranking: a rule scoped to specific day types or a specific time band simply does not
   surface outside them. Among what remains eligible, the most specific rule wins - a rule pinned to
   this exact day type and band outranks one that applies everywhere - and ties break toward
   whichever eligible rule has gone longest without a turn. A rule already chosen for the exact date
   being viewed keeps being the pick for that date even after `lastSurfaced` is written, so rotation
   moves from one day to the next and never flips mid-day.

   `IfThenDayRule` (`src/widgets/if-then/DayRule.tsx`) is the quiet line itself, mounted directly
   under the capacity line on the day view: same plain surface and border treatment the timeline
   toggle already uses, `--safe-ink` for the text, each of the two lines capped to one row with an
   ellipsis so a long trigger or action can never grow past the two lines this is budgeted for.
   Tapping it opens `IfThenSheet`, a bottom-sheet dialog copying `GapPicker.tsx`'s own hand-rolled
   dialog exactly - focus moves to the dialog on open, Escape and the scrim close it, Tab is
   trapped - hosting the full, unmodified `IfThenBoard` list, which is where creating, editing and
   deleting a rule all still live. `IfThenBoard` itself gained two small controls in its form: a
   multi-select day-type row reusing the tag filter's own `.chip` pattern, and a single-select
   time-of-day row reusing the template editor's own `.segmented` control - no third visual language
   for the same two kinds of choice this app already has.

   The board's old stacked section under the day plan is gone; `src/widgets/registry.ts` now lists
   only `day-plan`. Real installs from before this step have `'if-then'` sitting in
   `settings.enabledWidgets` with nothing left to open it - `normalizeLoaded` in `storage.ts` strips
   that id out on every load, migrated or not, so nobody's data keeps carrying a reference to a
   widget that no longer exists. `validate()` accepts an `IfThenEntry` with neither new field, the
   same absence-is-fine treatment every other optional field in this app already gets.

   Measured at 375x812 with a realistic seeded day (a 4-hour shift, an appointment, five floats,
   five if-then rules across different day types and time bands): the first task sat at `top: 375`
   before this step and `top: 454` after - the one quiet line added 79px, nowhere near the fold, and
   the correctly-scoped rule (a night-only sleep-protocol trigger, on a seeded night day) was exactly
   the one that surfaced. Checked in both a dark and a light theme; the day-type chips needed their
   own themed background rather than the tag filter's bare `.chip` default, which falls back to the
   browser's native button chrome and reads as an unstyled leftover against a dark surface - scoped
   to `.if-then-scope-chips` rather than changed on `.chip` itself, so the tag pills and filter chips
   elsewhere keep the look they already had.
7. **Done.** Drag between tray and grid, pointer-events, tested on a real phone before it is trusted.

   Follows `CalendarView.tsx`'s own pointer approach exactly, since that component already solved
   touch drag in this repo the hard way: release pointer capture on `pointerdown` so the browser
   keeps delivering events to whatever is actually under the finger, track the current drop target
   with `document.elementFromPoint` + `closest` during `pointermove` rather than `pointerenter`
   (which never fires once a touch has captured the pointer to the element the gesture started on),
   and clean up on document-level `pointerup`/`pointercancel` so a finger lifted anywhere - off the
   day view entirely, past the edge of the screen - always ends the drag rather than leaving it stuck
   on. `touch-action: none` is scoped to the smallest possible element rather than the whole row: a
   small dedicated grip handle on each float and anchor row, and the anchor's own visual block inside
   the grid, so the row's own tap-to-toggle area and the rest of the page keep the browser's default
   scroll behaviour. A minimum-movement guard (8px) tells a genuine drag apart from a bare tap, which
   matters specifically for an anchor block: it has no click behaviour of its own, so without the
   guard a plain tap on it would resolve to "dropped on the tray" and un-anchor the task with nothing
   actually dragged.

   `dragDrop.ts`'s `resolveDrop` is the pure "what does dropping this here do" logic, unit tested with
   no React nearby, the same posture every other pure module in this feature already takes. It reuses
   `gapPlacement.ts`'s own fit rule (`canPlaceFloatInGap`, factored out of `offerForGap` rather than
   re-derived) so a float can never be dropped where the tap-a-gap picker would refuse it. A float only
   ever resolves to `place`, and only onto an allowed gap; an anchor only ever resolves to `unanchor`,
   and only when dropped on the tray - dropped on a gap, it is refused rather than re-timing it, since
   that is a third behaviour this drag was never asked to have.

   A float picked up while the grid is collapsed has nothing to land on - the gaps it would drop onto
   only exist once the grid is mounted. `DayView.tsx` expands it the moment the drag starts, exactly
   what tapping "Show timeline" does by hand, rather than a silent pickup with no valid target. This is
   a product call the spec left open, recorded in `docs/OPEN-QUESTIONS.md`. When there is no anchor at
   all, there is nothing to expand into either, and the toggle itself is not shown - dragging a float
   on such a day simply has nowhere to go, which the long-press menu below explains plainly rather than
   leaving silent.

   **The long-press menu** (`TaskActionsSheet.tsx`, opened via `useLongPress.ts`) is the touch-safe
   fallback the spec calls for by name, and it is deliberately independent of the drag machinery: it
   needs only a still pointer for 500ms, never sustained pointer capture or cross-element tracking, so
   it keeps working even if drag itself fails on a real device the way the calendar's first attempt
   did. For a float it lists every gap `canPlaceFloatInGap` allows, computed straight from
   `computeTimelineLayout` - independent of whether the grid is currently expanded, which is what makes
   it the sensible answer to a collapsed grid rather than only a drag fallback. For an anchor it offers
   exactly one action, remove its time. A gesture that starts on a task's own `<label>` (its content,
   not the small trailing action buttons) and would otherwise toggle it done on release is intercepted
   via `onClickCapture` + `preventDefault()` in the capture phase, verified live in the browser (not
   only in jsdom) - see the step's own report for the real-browser evidence.

   Verified live in the browser, not only in unit tests: a real pointer sequence (no jsdom mocking)
   dragged a float onto a gap and it placed at the gap's own start with the capacity line, grid and
   task list all updating from the same store write; the reverse drag un-anchored a task back to the
   tray; a bare tap on an anchor block changed nothing; an oversized float dropped on a gap was
   refused; the page still scrolled normally at 375px with the grid expanded; and the long-press menu
   opened and placed correctly with the grid collapsed, without expanding it. Not verified: real touch
   hardware. Every check above used synthetic `PointerEvent`s with `pointerType: 'touch'` dispatched in
   a desktop browser, which exercises the same code path but cannot reproduce a real touchscreen's own
   gesture recognition (see `docs/BACKLOG.md`'s standing real-device item, which this step's own work
   now shares with the calendar's stamp-drag) - flagged again in `docs/OPEN-QUESTIONS.md`.

Steps 1 to 3 are the ones that change how the day feels. Everything after is the picture.

## 9. The one thing to protect

Every step here can be built in a way that quietly demands more decisions per day. If a change means
he has to answer one more question before the day can start, it is the wrong version of that change -
even when the feature is right. The product is a day you decided once, not a day you negotiate every
morning.
