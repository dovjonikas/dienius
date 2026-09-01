# Dienius - a wide-screen layout

> Written 2026-09-01 after the owner sent a screenshot of Sunsama's three-day view and asked for
> something wide-screen of our own: the calendar and the tasks clearly visible, filling the screen,
> our own thing in place of Sunsama's CHANNELS and CALENDARS lists, and a way to switch fully between
> a tasks view and a calendar view. Read `docs/TIMELINE.md` sections 2, 3, 5 and 9 first, and
> `docs/RESEARCH-ADHD.md` sections 7 and 12 - this document does not repeat their reasoning, it
> applies it to more screen space. This was a specification only when first written; it was then
> built in full, in the six pieces section 6 lists, on `feature/wide-layout`. Section 6 marks each
> step done. See `.superpowers/sdd/2026-08-31-dienius-mvp/feature-wide-layout-report.md` for the full
> build report, and `docs/OPEN-QUESTIONS.md` items 14-15 for the two things flagged rather than
> decided unilaterally during the build.

## 1. What the owner asked for

A screenshot of Sunsama's three-day view, and, in his own words: the calendar and the tasks clearly
visible, filling the screen. Sunsama's left rail has a CHANNELS list (hash-tagged project channels)
and a CALENDARS list (connected calendar accounts, colour dots) - he wants something of ours in that
place, because Dienius has only its own calendar and no notion of channels. He likes the task panel,
because untimed tasks can live there and you can decide to place one mid-day; otherwise you use a
template and stamp it. And he wants to be able to switch fully between the tasks view and the
calendar view.

That last sentence matters and is easy to read too literally. He is not asking to hide the calendar
behind a tab the way Sunsama does when it runs out of room - he is asking for a way to focus on one
side when he wants to, on a screen that has room to show both by default. Section 3 below is built
around that reading.

## 2. What already exists that serves this

Dienius is not starting from nothing. Every concept a wide day view needs already exists; what is
missing is a layout wide enough to put them in.

- **Anchors, floats, and the gap between them** (`docs/TIMELINE.md` sections 2-3). The timeline grid
  draws anchors at their real time; floats sit in a tray with a size but no position; the capacity
  line states the arithmetic between them. This is already the exact split Sunsama's centre-plus-right
  panels represent, built for a different reason: Sunsama splits calendar from tasks because it is
  aggregating other people's tools, Dienius splits anchors from floats because forcing every task onto
  a time is how these apps die.
- **The collapsible grid** (`docs/TIMELINE.md` section 5, `fix-day-view-hierarchy-report.md`). The
  grid is mounted only while `settings.timelineExpanded` says so, collapsed by default, because at
  375x812 a full-height grid pushes the task list below the fold. That constraint is specifically a
  phone constraint - the report measured it at 375x812 and confirmed the same day fits comfortably at
  1280x900 with room to spare. A wide layout is exactly the situation that constraint does not apply
  to.
- **The material pass** (`docs/RESEARCH-TIMELINE-UI.md`). Filled, borderless anchor blocks, a lighter
  half-hour rule, a current-time indicator in `--accent`, gaps as plain tinted rectangles. All of this
  carries over unchanged to a wider grid; nothing here is a phone-only treatment.
- **Templates and stamping** (`docs/DECISIONS.md`, "Templates instead of recurring tasks"). A named,
  coloured list of blocks, stamped onto a date through `actions.stamp`. This is the one list-shaped
  thing in the whole data model, and it is the strongest candidate for what replaces CHANNELS - see
  section 3.
- **The month grid and the year strip** (`src/views/CalendarView.tsx`, `src/widgets/year-strip/`).
  Dienius already has its own calendar, at two zoom levels. A wide day view does not need to invent a
  second one; it needs a smaller version of the one that exists, for navigation, not for stamping.
- **The if-then rule's placement** (`docs/TIMELINE.md` section 6, `docs/RESEARCH-ADHD.md` section 2).
  Already deliberately moved out of its own tab onto the day view, under the capacity line, because
  Barkley's point-of-performance principle argues against a rule filed somewhere that has to be
  remembered and opened. It already has the right home; a wide layout should not relocate it.
- **`data-tray-zone` and `resolveDrop`** (`src/widgets/day-plan/DayView.tsx`, `dragDrop.ts`). The one
  surviving live-drag gesture - dragging an anchor's own block back onto the tray - already resolves
  its drop target with `document.elementFromPoint` and a `[data-tray-zone]` lookup, independent of
  where in the DOM that zone actually sits. It does not need to change to work across two columns
  instead of one scrolling stack.
- **`display: contents` for a layout wrapper that must not exist for accessibility purposes**
  (`CalendarView.tsx`'s week rows). Already the established technique in this codebase for grouping
  markup into a CSS layout without adding a real box to the accessibility tree or the visual flow
  below a breakpoint. The wide layout reuses it rather than inventing something else.

## 3. The design

### 3.1 What replaces the channels list and the calendars list

Sunsama needs both lists because it aggregates other people's tools: multiple projects, multiple
connected calendars. Dienius has one local calendar and no projects. Putting something in that space
just to match Sunsama's silhouette would be exactly the "filled rail that adds no information" the
brief warns against - so each candidate has to earn its place on its own, not by looking like the
thing it is replacing.

**Rejected candidates, and why:**

- **Day types.** Four fixed values (`full`, `shift`, `night`, `rest`), not a list a person curates or
  browses independently - a day's type is a fact copied from whichever template stamped it, already
  shown as the template chip in the day header. A rail widget for day types would be a second, weaker
  echo of the template list already chosen below, not a distinct source of information.
- **The capacity line and the if-then rule.** Both already have a considered, tested home at the top
  of the day pane. Moving or duplicating either into a rail does not add information, it relocates
  information that is already on screen - and `docs/RESEARCH-ADHD.md` section 7 is explicit that the
  design consequence of a four-item working-memory ceiling is hierarchy, not addition. Splitting
  attention across more zones costs more than it gives.
- **Nothing at all.** Seriously considered, and the brief is right that an empty rail beats a filled
  one with no information in it. It loses only because two candidates below clear that bar on their
  own merits, not because "something" is inherently better than "nothing."

**What earns the space:**

- **The templates list, in place of CHANNELS.** This is the one part of the data model that has the
  actual shape of Sunsama's channel list: named, coloured, a small number of items a person picks
  from. It also matches what the owner said directly - "you use a template and stamp it." A rail
  widget listing `data.templates` as coloured chips, where tapping one calls the same `actions.stamp`
  the calendar's own stamp bar already calls, restamping the date currently open in the day view. This
  does not add a decision - stamping already happens today, only through the Calendar tab - it removes
  a detour. It is additive-only, matching what `actions.stamp` already does: clearing a stamp stays a
  Calendar-tab action, unchanged, not a new gap introduced here.
- **A mini month calendar, in place of CALENDARS.** Not a copy of the calendar-accounts list Sunsama
  shows there - Dienius has one calendar and nothing to toggle - but the position it occupies is
  filled with the thing Sunsama's own rail also carries above those two lists: fast date navigation
  without leaving the screen you are planning from. Today the day view can only step one day at a time
  with the prev/next arrows; jumping two weeks out means switching to the Calendar tab. A small month
  grid, read-only, click-to-navigate, reusing the exact cell logic `CalendarView.tsx` already has
  (`monthGrid`, template colouring, `taskState`), closes that gap without inventing a second
  navigation model.

Both of these are judgment calls about which existing concept best fills the space, not evidence-backed
claims - there is no research measuring rail content specifically. The reasoning is that each earns its
place independently: the templates list does something the owner already does today, faster; the mini
calendar does something the current day view cannot do at all. Neither exists just to fill a slot
Sunsama happens to have one.

### 3.2 What the tasks-versus-calendar toggle actually toggles

Copying Sunsama's version - a toggle that swaps the entire centre pane, hiding the other view behind
navigation - would work against the owner's own stated default: calendar and tasks both clearly
visible, filling the screen. On a wide screen there is no reason both cannot be on screen at once, and
hiding one by default would be a straight regression from what a wide layout is supposed to buy.

But the owner asked for the "switch fully" capability by name, and it should not be waved away as a
leftover from an app with more to hide. The honest reading is that he wants to choose to look at only
one side sometimes - for focus, not because the other side does not fit.

**The design:** both panes visible by default. A small three-way control - Both / Calendar / Tasks -
changes which pane currently gets the width, without unmounting the underlying day (the tasks, the
capacity arithmetic, the grid all stay computed from the same store data regardless of which pane is
showing). Selecting Calendar gives the day pane (capacity line, if-then rule, grid) the full remaining
width and unmounts the task pane; selecting Tasks does the reverse. This is a width redistribution, not
a navigation event - nothing about the underlying day changes, and switching back to Both costs nothing.
The rail (mini calendar, templates) stays visible in every state, exactly as Sunsama's own sidebar
persists no matter which centre view is showing.

This is a fourth persisted app-wide setting alongside `theme`, `enabledWidgets` and `timelineExpanded` -
`settings.dayLayoutFocus: 'both' | 'calendar' | 'tasks'`, defaulting to `'both'`. It follows the exact
pattern `timelineExpanded` already established and that `fix-day-view-hierarchy-report.md` verified:
one app-wide choice, not a per-day one, defaulting to the state that shows the most by default,
backfilled on load for any payload written before the field existed. It only has a visible effect once
the layout is wide enough to have more than one pane to redistribute between - below the breakpoint,
the control does not render and the day view looks exactly as it does today.

This is the one place this document adds a genuine new piece of state rather than only rearranging
existing pieces, and it should be treated as a design decision worth the owner's own confirmation, not
a pure implementation detail. The alternative - leaving the toggle out entirely and shipping only the
side-by-side default - is a fallback worth naming: it satisfies "clearly visible, filling the screen"
completely on its own, and drops only the explicit "switch fully" request. If the segmented control
turns out to add more chrome than it earns once built, it is the one piece of this design cheapest to
cut without unwinding anything else.

### 3.3 One day or several

Sunsama shows three day columns. Dienius should show one, exactly as it does now, and the calendar tab
already handles browsing across days at the month and year level.

Multi-day was weighed and rejected, not overlooked. Three reasons, in order of how much they matter:

1. **It directly invites what the rules forbid.** Several day columns side by side is the natural
   setting for comparing one day against another - "Tuesday was fuller than Wednesday" - and the brief
   is explicit: no cross-day comparison. A single day on screen cannot be compared to anything; three
   days on screen invite it by construction, regardless of what any one column's own content does.
2. **It works against the whole reason the grid stopped being a placement surface.**
   `docs/TIMELINE.md` section 2 rejects a calendar-first planner because most tasks have no honest
   answer to "when exactly," and a grid that demands one is how these apps die. A three-day grid
   multiplies exactly that pressure - a float unplaced on today's column, sitting next to two more
   columns that read as more complete, reads as unfinished business in a way a single day's tray does
   not.
3. **The cost is real and the demand for it is not.** The owner's brief was "fill the screen," not
   "show more than one day" - the three columns are an artifact of the screenshot he sent, not a
   feature he asked for by name. Building it means a new drop-target model (which day does a dragged
   float land in), a new question about what "today" means when three days are all in view, and a
   second navigation surface competing with the mini calendar in section 3.1. None of that is needed
   to answer what was actually asked for.

The wide layout should spend its extra width making one day easier to read - a bigger grid, a
comfortably wide task pane, room for both without either fighting the other for the fold - not on
showing more days.

### 3.4 What survives on the phone

The rule is that nothing below the breakpoint changes. Every new piece of markup in this design -
the rail, the grid areas, the focus control - is either gated behind a `min-width: 1024px` media
query with no matching change below it, or, where it is genuinely new interactive content (the mini
calendar, the template rail, the focus control), not mounted in the DOM at all below the breakpoint,
the same way the timeline grid itself is not mounted while collapsed. That second point matters for
the same reason it mattered for the timeline toggle: a screen reader on a phone should never land on
a rail that is not there, and a phone's tab order should never include controls a phone user cannot
usefully reach relevant content through.

Concretely, nothing changes below 1024px:

- The day view is one column, in the same order it is today: day-nav, capacity line, if-then rule,
  timeline toggle, quick-add, first-run or empty state, task list, rollover button.
- `settings.timelineExpanded` still governs the grid exactly as it does today - collapsed by default,
  one tap to open, persisted app-wide. Nothing about the wide layout auto-expands it below the
  breakpoint.
- `settings.dayLayoutFocus` exists in storage but has no visible effect - the control that changes it
  is not rendered.
- Touch targets, 16px inputs, and every existing interaction (tap-a-gap, long-press menu, anchor drag
  to the tray) are byte-for-byte unchanged.

The only two files that need any conditional logic at all to guarantee this are `DayView.tsx` (the new
markup wrapped in an `isWide` check) and the new `useIsWide()` hook itself - everything else is a
`@media (min-width: 1024px)` block in `styles.css` that simply does not match below that width.

### 3.5 Placing an untimed task into the day

Both existing mechanisms survive unchanged:

- **The tap-a-gap picker (`GapPicker.tsx`).** Stays exactly as it is - a modal bottom sheet, one
  interaction path regardless of viewport. There is a temptation to replace it with an inline popover
  anchored to the tapped gap once there is room for one, but that means maintaining two
  implementations of the same action for no real gain: the sheet already caps its list to four rows
  with a "show more" step, already handles the empty case, and nothing about a wider screen changes
  what it needs to do. One code path stays one code path.
- **The row actions menu / long-press sheet (`TaskActionsSheet.tsx`).** Unchanged. Still the fallback
  that works with the grid collapsed, still reachable identically at any width.

The one thing that changes is not a mechanism, it is reliability. The only live pointer-drag gesture
left in the app - an anchor's own block in the grid, dragged back onto the tray to un-anchor it - drops
onto whatever element under the pointer has `[data-tray-zone]`, resolved with
`document.elementFromPoint`. On a phone, that gesture has to work inside one long scrolling column,
where the tray may not even be on screen when the drag starts. On the wide layout, the grid and the
tray are two fixed columns, both on screen at once, with no scrolling required to reach either during
the drag. Side-by-side panes make this specific interaction strictly easier, not harder - the source
and the only valid destination are both visible for the whole gesture, which is the situation a drag
gesture is best suited to. This needs no code change; `data-tray-zone`'s detection is already
DOM-position-agnostic. It is worth verifying on a real wide layout, not assumed.

What this document does **not** propose is reviving drag-from-tray-into-grid for floats. That gesture
existed once and was deliberately removed - `docs/TIMELINE.md` section 5, "the dedicated drag handle
came off entirely," because the tap-a-gap picker and the actions menu already covered the same
outcome without a pointer-only mechanism that added weight to every row. A wide screen does not change
that reasoning; it was about the row's own density and about touch reliability, not about available
width. Reviving it is a real feature decision on its own, not implied by giving the layout more room,
and is out of scope here.

## 4. What was deliberately not taken from Sunsama, and why

- **A permanent app-wide sidebar shell.** Sunsama's rail exists across its entire app, because the
  whole app is one workspace with different views inside it. Dienius's four tabs - Today, Calendar,
  Templates, Settings - are genuinely different screens, not facets of one workspace: a month grid, a
  template editor, and a settings form do not want a day's rail sitting next to them. The top tab bar
  stays exactly as it is; the rail is scoped to the Today tab alone, which is where the request
  actually lives, and keeps every other screen untouched by this document.
- **The channels-as-tags mechanic underneath the channels list.** Sunsama's channels are not just a
  list, they are how a task gets filed. Dienius has no per-task categorization anywhere - a manual
  task can never be marked core, cannot carry a tag, cannot belong to anything (`docs/DECISIONS.md`,
  "Manual tasks are never core"). Building a tagging system just to have real content for a rail list
  would be inventing a feature to serve a layout, backwards from how everything else in this app has
  been decided.
- **The calendars list's real semantics.** Multiple connected calendar accounts, colour-coded, each
  toggleable. Dienius has exactly one calendar and no accounts (`docs/DECISIONS.md`, "No accounts").
  There is nothing honest to put there in that literal shape; the mini calendar in section 3.1 fills
  the position, not the concept.
- **The red/yellow workload alarm on Sunsama's own capacity readout.** Already refused in
  `docs/RESEARCH-TIMELINE-UI.md` section 1 - Dienius's capacity line states arithmetic, never a
  warning, never a colour that means trouble. Nothing about more screen space changes that.
- **Three day columns.** Covered in full in section 3.3.
- **The five-to-fifteen-minute guided planning ritual that produces Sunsama's view in the first
  place.** Already refused in `docs/RESEARCH-ADHD.md` sections 11 and 12. The wide layout has to open
  showing whatever the day already has - no wizard, no forced review step, regardless of how much
  screen space is available to put one in.
- **A toggle that unmounts the other pane by navigating away from it.** Covered in section 3.2 - kept
  the capability, changed the mechanism to a width redistribution that never drops the underlying
  data.

## 5. Build specification

Nothing here touches the data model beyond one additive field. Nothing here touches
`timelineLayout.ts`, `capacity.ts`, `gapPlacement.ts`, `dragDrop.ts`, or any pure logic module - this
is markup, CSS, and one small hook.

**Breakpoint: `1024px`.** Judgment, not a measurement of the owner's own monitor. Reasoning: the
three-column layout below needs a rail (`minmax(200px, 240px)`), a day pane
(`minmax(420px, 1fr)`), and a task pane (`minmax(320px, 380px)`), plus two 24px gaps and the app's own
horizontal padding - roughly 1020px of minimum content width before anything looks cramped. 1024px is
also conventional as a tablet-landscape/small-laptop line, which makes it a reasonable place to draw
the line even without a specific device to test against.

**New file: `src/lib/viewport.ts`.**

```ts
export const WIDE_BREAKPOINT_PX = 1024

export function useIsWide(): boolean {
  // Same matchMedia-plus-listener shape App.tsx already uses for the
  // system-theme watcher, including the try/catch guard for an
  // environment where matchMedia can throw or be absent.
}
```

**`src/lib/types.ts`.** One new required field on `Settings`, matching exactly how `timelineExpanded`
was added:

```ts
export interface Settings {
  // ...existing
  dayLayoutFocus: 'both' | 'calendar' | 'tasks'
}
```

**`src/lib/storage.ts`.** `defaultData()` sets `'both'`. `isSettings()` accepts the field only when
present and one of the three literal strings. `normalizeLoaded()` backfills `'both'` on load and
import whenever the field is missing, the same migration `timelineExpanded` already goes through.

**`src/lib/store.ts`.** `actions.setDayLayoutFocus(focus)`, mirroring `actions.setTimelineExpanded`
exactly - flips only that field, leaves the rest of `settings` untouched.

**`src/lib/calendarCell.ts` (new, extracted).** `taskState()` and the template-lookup-and-colour logic
currently private to `CalendarView.tsx` move here so `MiniCalendar.tsx` can share them instead of
re-deriving the same rules. `CalendarView.tsx` imports them back; no behaviour change there.

**`src/widgets/day-plan/MiniCalendar.tsx` (new).** A small month grid: `monthGrid()` from
`lib/dates.ts`, cells coloured by `data.templates`/`data.days` via `calendarCell.ts`, no paint-drag, no
stamping. Clicking a cell calls the same `onDateChange` `DayView` already receives - no new prop wiring
needed above `DayView`. Rendered only when `useIsWide()` is true.

**`src/widgets/day-plan/TemplateRail.tsx` (new).** Lists `data.templates` as coloured chips reusing the
`.chip` pattern the calendar's own stamp bar already uses. Tapping one calls
`actions.stamp({ [date]: template.id })` against the day currently open. The currently-stamped
template, if any, renders with the existing `.chip.selected` treatment. Rendered only when
`useIsWide()` is true.

**`src/widgets/day-plan/DayView.tsx`.** Structural change, gated entirely on `useIsWide()`:

- Day-nav (unchanged) stays a full-width header.
- Capacity line, if-then rule, and the timeline grid group into a `day-pane` region. At wide widths
  the grid mounts unconditionally, bypassing `settings.timelineExpanded`, and the "Show timeline / Hide
  timeline" button does not render - there is no fold to protect once the pane has its own column, and
  the setting continues to govern the phone layout exactly as before. This does not write to
  `timelineExpanded` based on viewport; the stored value is untouched, so resizing back below the
  breakpoint restores whatever the phone's own choice already was. This one piece is a judgment call
  worth stating plainly: `docs/TIMELINE.md` section 5 says the expand/collapse choice must never be
  re-derived from context, and the intent there was clearly about not asking the same question again
  each day, not about screen width. Width is a device fact, not a daily decision, and every other
  breakpoint already in this codebase (the theme gallery's columns, the update notice's position)
  already varies by width without that being read as a new decision. Flagged here so the owner can
  overrule it if the reading feels wrong.
- Quick-add, the first-run/empty state, the task list, and the rollover button group into a `task-pane`
  region.
- `settings.dayLayoutFocus` decides which of `day-pane` / `task-pane` actually renders (`'calendar'`
  unmounts the task pane, `'tasks'` unmounts the day pane, `'both'` renders both) and drives a small
  segmented control - Both / Calendar / Tasks - rendered next to the day-nav header, only when
  `useIsWide()` is true.
- `MiniCalendar` and `TemplateRail` mount into a `rail` region, only when `useIsWide()` is true,
  regardless of `dayLayoutFocus` - the rail is not part of what that control redistributes.

Below the breakpoint, none of the four regions above exist as separate boxes - the existing JSX order
is preserved exactly, wrapped where needed in `display: contents` groupings (the same technique
`CalendarView.tsx`'s week rows already use) so grouping the markup for the grid does not add a real
box, change spacing, or change the accessibility tree on a phone.

**`src/App.tsx`.** One line: `<main className={view === 'day' ? 'main-day' : ''}>`, so only the Today
tab's wrapper can escape `.app`'s existing `max-width: 760px` at the breakpoint. Every other tab keeps
its current width unchanged - this document does not touch Calendar, Templates, or Settings.

**`src/styles.css`, all inside `@media (min-width: 1024px)`:**

```css
.main-day { max-width: 1600px; }

.day-view-wide {
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(420px, 1fr) minmax(320px, 380px);
  grid-template-areas:
    "rail   header header"
    "rail   day    tasks";
  gap: 24px;
}
.day-view-wide.focus-calendar { grid-template-columns: minmax(200px, 240px) 1fr; }
.day-view-wide.focus-tasks    { grid-template-columns: minmax(200px, 240px) 1fr; }
```

- `1600px` on `.main-day`: judgment, not evidence. Large enough to read as "filling the screen" on a
  typical 1280-1920px desktop without stretching to an uncomfortable line length on an ultrawide
  monitor. Worth checking against the owner's actual screen before treating as final.
- `24px` gap: judgment, a step up from the 12-16px gaps already used elsewhere in this file, chosen to
  read as three distinct columns rather than one wide one with faint seams.
- Rail `minmax(200px, 240px)`: 200px is roughly the narrowest a template chip plus a mini-calendar
  week row stays legible at; 240px caps it from growing to compete with the panes doing the actual
  work.
- Day pane `minmax(420px, 1fr)`: 420px is the narrowest the timeline grid's own gutter (44px) plus a
  comfortably readable anchor block stays legible at, checked against the grid's existing material
  spec in `docs/RESEARCH-TIMELINE-UI.md` rather than newly measured here.
- Task pane `minmax(320px, 380px)`: 320px is the narrowest a `TaskRow` (checkbox, time, title, size
  chip, actions-menu button) stays comfortable at without truncating the title aggressively; 380px caps
  it so the pane does not visually dominate over the timeline it sits next to.

**Optional, later, not part of the first build:** raise `.timeline-grid-scroll`'s existing
`max-height: min(58vh, 520px)` cap at the same breakpoint, since the grid is a dedicated column at
that width, not competing with a task list stacked below it. This is a real improvement but a
separate, smaller change with its own value to pick - keep it out of the first pass so the layout
change and the grid-height change can be verified independently.

## 6. Build order

Smallest useful step first, each one shippable and checkable on its own. All six are built, on
`feature/wide-layout`, each its own commit - see the full report at
`.superpowers/sdd/2026-08-31-dienius-mvp/feature-wide-layout-report.md`.

1. **DONE - Widen the Today tab only.** `App.tsx`'s one-line class change plus `.main-day`'s
   `max-width` at the breakpoint. No component changes. Immediately less wasted whitespace on a
   desktop browser, and proves the breakpoint mechanism before anything depends on it. Built with
   `.app:has(.main-day)` widening the app shell itself, since a child's `max-width` cannot exceed a
   parent box that is still capped at 760px.
2. **DONE - Auto-show the grid at wide widths.** Add `useIsWide()`, bypass `timelineExpanded` and hide
   the toggle above the breakpoint. Still one column. Verifies the viewport-gating logic in isolation
   before the layout itself changes.
3. **DONE - Split into day-pane and task-pane.** The core of the ask: capacity line, if-then rule, and
   grid on one side, quick-add and the task list on the other, both visible at once. Wrapped in
   `display: contents` below the breakpoint so the phone layout is provably untouched.
4. **DONE - Add `dayLayoutFocus` and the Both/Calendar/Tasks control.** Delivers the "switch fully"
   request directly. Cheapest to cut later if it turns out not to earn its place - see the note in
   section 3.2 - one setting, one control block, nothing else depends on it.
5. **DONE - Add the rail: `MiniCalendar` first, `TemplateRail` second.** Two independent, read-mostly
   components; either can ship without the other and both degrade gracefully to "not rendered" below
   the breakpoint. `taskState`/`resolveTemplate`/`cellLabel` extracted to `src/lib/calendarCell.ts` so
   `MiniCalendar` and `CalendarView` share one set of rules.
6. **DONE - Verification pass.** Re-ran the same three day shapes `fix-day-view-hierarchy-report.md`
   used (a realistic day, one long anchor with no floats, floats with no anchors); the phone layout is
   pixel-identical below 1024px in both a light and dark theme (measured against a `main`-branch
   baseline built in a separate worktree, not assumed); all three `dayLayoutFocus` states render
   correctly in Slate and Legal pad; `GapPicker`, `TaskActionsSheet`, `TaskGapOffers` and `IfThenSheet`
   all still span the full viewport and correctly trap focus regardless of which panes are showing,
   confirmed live under both single-pane focus states; the tab order was confirmed live in a real
   browser to follow rail, then header, then day pane, then task pane with no interleaving across all
   67 focusable elements on a realistic day. The one thing this step did **not** confirm working: the
   anchor-to-tray drag - see the concern below, this is a pre-existing bug unrelated to this branch.

Steps 1-3 are what make the layout wide. Step 4 is the one place this document asks for a real product
decision rather than only rearranging what already exists. Steps 5-6 are the picture and the proof.

**One pre-existing bug found during step 6, not caused by this work:** the anchor-block drag-back-to-
tray gesture (section 3.5) cannot actually be started by a real pointer in any browser, at any width -
`.timeline-anchor` inherits `pointer-events: none` from its `aria-hidden` ancestor in `TimelineGrid.tsx`
with nothing re-enabling it, so a real click or touch on an anchor block never reaches its handler; it
only appeared to work because the test suite dispatches events directly to elements, bypassing real
hit-testing. Confirmed identical on `main` (`git diff main..feature/wide-layout --
src/widgets/day-plan/TimelineGrid.tsx` is empty). Deliberately not fixed on this branch - it touches a
file and a feature outside this document's stated scope. See `docs/OPEN-QUESTIONS.md` item 15 and
background task `task_4d948b75`.

**One trade-off flagged, not fixed:** the rail's own `minmax(200px, 240px)` cannot fit a 7-column
month grid at this app's usual 44px touch target - `MiniCalendar.tsx`'s cells measure roughly 33x33px
live. See `docs/OPEN-QUESTIONS.md` item 14.
