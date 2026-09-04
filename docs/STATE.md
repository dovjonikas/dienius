# Where this project actually is

You are picking this up cold. This file is the handover: what exists, how it
got here, and what is still owed. Read it, then
[`CONVENTIONS.md`](CONVENTIONS.md) for how work is done here, then
[`ARCHITECTURE.md`](ARCHITECTURE.md) for where the code lives. Those three
should leave you able to start without re-reading the repo.

**Last updated:** after v1.10 - the reading plan on request, the tour walked
and rebuilt around what a stranger actually sees, the store in ten files,
and a real browser in the suite. Tagged v1.0 through v1.10.

---

## 1. What Dienius is

A day planner for a brain that needs the plan to be visible or it stops
existing. It is two things at once, and both matter to how decisions get made:

1. **A tool one person uses every day.** Every feature has to survive a real
   bad Tuesday, not a demo.
2. **A public portfolio piece.** github.com/Quicasha/dienius, deployed at
   quicasha.github.io/dienius. Everything is public: the code, the commit
   messages, the docs. It has to read as a professional codebase, and nothing
   anywhere may look machine-generated.

The whole philosophy - why no streaks, why the push bound stops at two, why
goals never show progress - is in [`DECISIONS.md`](DECISIONS.md) and
[`RESEARCH-ADHD.md`](RESEARCH-ADHD.md). Do not re-litigate those without
reading them.

---

## 2. Every feature, one line each

### The day (the Today tab)

| Feature | What it is |
|---|---|
| Quick-add | Three parts on one line: a time control, the field, a duration control. Both controls open holding an answer, so a title and Enter is a placed, sized task |
| Capture mode | The same field writes to the day or to the inbox, chosen by a toggle |
| Categories | Six, one colour each, picked before typing; the same colour on the card and on the timeline block |
| Timeline grid | Anchored tasks at their real time and size, free gaps as labelled regions, a line at now; collapsed behind a disclosure on a phone, always open at the wide breakpoint |
| Drag and resize | Move a block in time or pull its bottom edge; drop it back on the task list to un-anchor it |
| Capacity line | One sentence: what is anchored, how much free time across how many gaps, what the untimed still need |
| Score | Done over planned for today. No percentage, no streak, nothing on a day with no plan |
| Day types and core tasks | A twelve-hour shift is not scored like an ordinary Tuesday |
| Push twice, then decide | An unfinished task moves to tomorrow twice; after that, finish it, delete it, or mark it ongoing |
| Yesterday banner | What yesterday left, stated once, moved forward in one tap - never automatically |
| Replan | Three doors for a day that broke: something came up, shift the rest, away and back. See `widgets/day-plan/replan.ts` |
| Scratch | One key (S or backtick) or a floating button, and you are typing. Its own stream, `#tags` as filters, a #bug export. A leading `!` or the Note/Task toggle sends the line to the inbox instead |
| Quick-add time | The control on the left: the next free slot by default, arrows for a quarter hour either way, the picker on a tap, and No time when you want a float |
| Task detail | Everything the card does not show: exact minute, note, sub-steps, repeat, the three-a-day key mark. Panel on desktop, bottom sheet on a phone, right-click menu for the common ones |
| Focus | One task, its own planned time, a ring, a way out. Not a pomodoro |
| Timer and stopwatch | Survive a refresh, run on every tab, keep time in a background tab, put the countdown in the tab title |
| Day digest | In the wide rail: what is next, and how the day is going |
| North line | One goal under the day's title, rotating daily, expanding on hover/tap/focus |
| North card | After a slow day or on a Monday, one goal comes forward with its reason. Never a word about how yesterday went |
| Evening close | A quiet card at a set time, or the moment the last task is ticked. One sentence about the day, an optional line about the best moment, and a way to end it. Never a word about what was not done - see CONVENTIONS section 15 |

### The other tabs

| Tab | What it is |
|---|---|
| **Calendar → Month** | A month that fits without scrolling; every past day shows its ratio, a thin bar, what was carried on, a dot when every key task was kept. No red at any threshold |
| **Calendar → Week** | Seven columns of one shared timeline. Drag a block between days, tap to open, tap empty space to add, stamp per column or the whole week. Three days at a time on a phone |
| **Calendar → Year** | One cell per day, shaded by fullness, coloured by template |
| **Templates** | Named, coloured sets of blocks; stamped onto dates by clicking or dragging, nothing commits until Save |
| **Library** | Lists worked through a unit at a time. Lists fold and a chip row jumps between them; in each, the item you are on gets a card with its progress and its pace note while everything behind it is one quiet line. An item can be counted in the list unit, in pages, as a film, or as seasons and episodes. A session goes onto a day in two taps, or onto a template in one flow; ticking it off advances the book |
| **Review** | Week and month statistics, all derived from the days themselves |
| **Settings** | General, North, Sleep, Week, Nudges, Rules, Calendars, Sync, Appearance. General also replays the tour, in a sandbox |

### Across the app

| Feature | What it is |
|---|---|
| Weekday templates | A template per weekday, so a new day opens already set up. A stamp by hand always wins |
| Repeating tasks | Daily, weekdays or weekly, materialised as real tasks. "Just this day" vs "every day it repeats" is a standing choice |
| If-then rules | Trigger plus action, surfaced by day type and time of day. Never measured |
| Inbox | Catch a thought without deciding what day it belongs on |
| Backlog | Decided, undated tasks, in the order you would pull them. Collapsed behind a plain count, nothing ever says how old anything is |
| Keyboard layer | Single keys for common actions; a card behind `?`. Never fires while typing in a box, except Escape |
| Command palette | Ctrl-K / Cmd-K: run a command or find a thing. Linear scan, no index |
| Undo | One app-wide offer, five seconds, on the expensive mistakes |
| Snapshots | A full copy once a day in IndexedDB, seven kept, restorable from Settings |
| Export / import | Plain JSON, both ways, deliberately manual |
| Sync | Optional, off by default, through a server you host. Per-entity last-write-wins with tombstones |
| External calendars | ICS subscriptions or file import, as a read-only layer. Free time counts them |
| Demo mode | `?demo=1` fills a sample fortnight under its own storage key. Today is lived up to the clock (never earlier than one o'clock), yesterday is finished so no banner sits above the first screen, and the seed carries a bound book, a backlog, a scratch stream and a task with a note and sub-steps |
| The tour | Nine steps, each ending on a real action rather than a Next button. Reached from the first-run offer, the `?` card and the palette. Whatever a step points at is forced visible and never behind a sheet; the card's line follows the person ("Now press Enter"); every step ends on a caption saying what happened. A step that cannot end says so and offers to do itself - it never skips on its own. Data in `lib/tour.ts`, engine in `views/tour/Tour.tsx` |
| Themes | Dark, Light, Midnight; accent colour, density, text size. Every ink measured against WCAG AA by a test |
| PWA | Installs, works offline, versioned cache, background update with a quiet Reload notice |

---

## 3. Version history

| Version | What it added |
|---|---|
| **v1.0** | Templates, stamping, the day view, the timeline grid, categories, the capacity line, the push bound, themes |
| **v1.1** | Library, task detail sheet, sleep schedules |
| **v1.2** | PWA, touch hardening, the keyboard layer, timer background reliability, a real test suite |
| **v1.3** | Automation (repeat rollover, weekday→template, midnight banner, task reminders), the Review tab, the command palette, snapshots and undo, `ARCHITECTURE.md` |
| **v1.4** | North (goals with no progress), calendar compact + per-day stats, the year heatmap. Mid-wave: `Task.origin`, which is what stopped push and stamp doubling everything |
| **v1.5** | Sync between devices (entities, merge, tombstones, server, client), DayView split six ways, the repeat lookback removed |
| **v1.6** | Week view, external calendars, demo mode, the 44px touch pass, README rework. Closed with two critique cycles that moved the week's own bar into the calendar bar and gave the phone's grid back 82px |
| **v1.7** | The interactive tour: a spotlight, nine steps, each ending when the thing actually happens. Sandbox replay from Settings |
| **v1.8** | Replan (something came up / shift the rest / away and back), Scratch, the quick-add time picker, and a responsive pass over every view at seven viewports |
| **v1.9** | Quick-add as three controls that already hold an answer; the backlog; Library v2 (folding lists, one loud item each, pages/film/series tracks, pace notes, add-to-template, the reading plan seeded); the tour hardened with three ways in and three ways out of a stuck step; the evening close; every millisecond budget turned into a ratio |

| **v1.10** | The reading plan seeds only from the palette (the privacy fix); the tour engine's standing rules - the target is visible, never behind a sheet, the card says what to do now, every step names its outcome, nothing skips on its own - after the owner's walk found seven problems, plus the scroll-position feedback loop and the Escape-under-a-sheet bug the walks exposed; quick-add fitting its column and the column fitting a 1024px window; `store.ts` split into ten area modules with no import changed; Playwright end-to-end tests for a first day, the naive tour on two viewports, and two-device sync |

Tags exist for v1.0 through v1.10.

---

## 4. Open work

### Nothing is half-built

Everything through v1.10 is tagged, the suite is green (1745 tests, 98 files,
plus five Playwright tests across two viewports),
the typecheck and the build are clean and the working tree is empty.
What follows is wanted rather than owed.

### Asked for, not yet built

Nothing at the moment. The screenshots, the last item here, landed in v1.11.

### Known debts, oldest first

| Debt | Detail |
|---|---|
| **Week blocks are small targets** | A 20-minute block at a week's scale is ~20px tall. Sized by duration, so it cannot be 44px. `min-height: 20px` on coarse pointers is the compromise |
| **`storage.ts` is ~830 lines** | Almost all of it is `validate()`, a hand-written deep type guard. Deliberate - it is the import path for a file a person may have edited - but it is long |
| **`timelineLayout.ts` at ~810 lines** | Dense geometry. Well tested, but the next person to touch it will need a while |
| **Screenshot tooling** | There is no way to produce image files from the agent environment. Any visual regression checking is by measurement (`getBoundingClientRect`, computed styles) rather than by pixels |
| **Sync has no conflict UI** | Last-write-wins per entity, silently. Correct for one person with two devices; it would not be for two people |
| **ICS: monthly and yearly rules are skipped** | Named in the parse result rather than approximated. A meeting on the wrong day is worse than one not shown |
| **ICS: named time zones are read as local** | Doing it properly needs the IANA database. Reported in `ignored`, so it is not silent |
| **Imported .ics calendars are device-local** | They have no address to refresh from, so they do not sync. Stated in the UI |
| **The wide day view scrolls on a short laptop** | At 1366x768 and 1600x900 a ten-block day is taller than the room the grid gets. This is the documented outcome, not a bug: the per-segment floors (32px sized, 44px unsized) are touch targets, and `fitPxPerMinute` correctly refuses to go below them. CONVENTIONS.md section 4 overstates the zero-scroll rule for this one case; it now says so |

### Resolved debts, so you do not chase them

- ~~Screenshots, and no way to make them~~ - `npm run shots` since v1.11,
  Playwright writing PNGs from the dev server with the clock pinned. The
  README leads with the hero it produces. Visual regression checking is
  still by measurement; the script is for the README, not for diffing.
- ~~The wide day view scrolls on a short laptop~~ - closed in v1.11 two
  ways. The gap and unsized-anchor floors follow the pointer, so a mouse
  gets 28px and 32px where a finger keeps 44px, and a nine-block day fits
  1440x900. Where it still cannot fit - 1366x768 - the grid's column takes
  the overflow, opened at now, and the page itself never grows.
  `e2e/demo.e2e.ts` measures both. Found on the way: the two
  `visually-hidden` live regions had no `top`, sat at their static
  position in an implicit grid row 700px under the window, and made a
  page that fitted its screen scroll anyway.
- ~~No end-to-end tests~~ - Playwright against the production build since
  v1.10, and since v1.11 covering the real flows: `npm run e2e`, ten files
  under `e2e/`. A first day (stamp, add, tick, the evening close arriving
  on the last tick, the reading plan from the palette), the tour walked
  naively on a desktop and on a phone doing only what each card says, two
  browser contexts syncing a task both ways through the real
  `server/sync-server.mjs` on a spare port, the demo's first screen, the
  three replan doors, a book bound to a template and ticked, a backlog pull,
  a night passing with a daily repeat and the yesterday banner, a week-view
  drag, scratch's two ways out, export-erase-import, a snapshot restore, and
  an .ics file over the day. Every test that depends on the hour pins the
  browser clock (`openFreshAt` in `e2e/app.ts`) to a Wednesday in
  Vilnius, so the same blocks are ahead of now on every run. CI runs it in
  its own job; the deploy does not wait for it.
- ~~Three bugs the browser tests found in v1.11~~ - the yesterday banner
  vanished on "Push to today" instead of saying what moved, because its
  early return on "nothing unfinished" ran before the confirmation branch;
  the source of a repeating series was pushed like a one-off, so the next
  day held it twice beside the instance the series had made
  (`sourceCovers` in `repeats.ts`); and `isTaskMarkOnly` in scratch read
  `/^s*!s*$/` with its backslashes missing, so " !" was written to the
  stream and deleted a keystroke later. Each has its unit test now.
- ~~`store.ts` at ~1600 lines~~ - split in v1.10 into ten area modules
  under `lib/store/`, with `store.ts` left as the facade so no import
  changed. Every action kept its doc comment and body; the one edit inside a
  body is reading the state through `getData()` instead of a module
  variable. `store.test.ts` checks that no action is defined in two areas.
- ~~The reading plan seeded itself on first open~~ - fixed after v1.9. It
  fired for anybody who opened the live demo and handed them the owner's
  actual bookshelf. The data and the stable ids stayed; the mount effect in
  `App.tsx` went, and the call sits behind "Load my reading plan" in the
  palette. Nothing in `librarySeed.test.ts` assumed the automatic trigger,
  and two tests in `App.test.tsx` now hold the new shape: an open writes no
  library, the command fills it.
- ~~The 400-day repeat lookback~~ - removed in v1.5. It was an expiry date
  pretending to be an optimisation.
- ~~`DayView.tsx` at 1238 lines~~ - split six ways in v1.5; it is 397 now.
- ~~The 38px button debt~~ - closed in v1.6. Every control on Today and the
  calendar meets 44px on a coarse pointer.
- ~~`normalizeLoaded` dropping optional settings~~ - fixed in v1.6. It had
  silently eaten `northDismissedOn` since v1.4.
- ~~Snapshot restore never reaching storage~~ - fixed in v1.5.
- ~~The backlog nobody had built~~ - shipped in v1.9, as a fourth shelf
  under the inbox rather than a seventh tab. It records no age, because
  nothing that cannot be recorded can ever be shown.
- ~~A season ending finished the whole series~~ - fixed in v1.9. Watching the
  last episode of season one of three filed the series under Finished and
  took the offer to start season two with it.
- ~~Text fields were not touch targets~~ - fixed in v1.9. The 44px floor was
  applied per class, so every field added since the last audit was 39px on a
  phone. It is on the base rule now.
- ~~Two 28px buttons on every inbox row~~ - fixed in v1.9. They had been
  there since v1.4 and survived the v1.6 touch pass because an inbox is
  collapsed by default and was empty every time the audit ran.
- ~~Timing tests asserting milliseconds~~ - all ten of them became ratios in
  v1.9, against a baseline measured the same way, alternating sides and
  keeping the fastest round. The shared machinery is `src/test/stress.ts`,
  and there is no absolute millisecond assertion left in the suite.
- ~~The rescue re-timed routine blocks~~ - fixed in v1.9. A missed Standup
  was fitted into the evening because the evening was free. `isRoutine`
  already existed; the rescue simply never asked.
- ~~`--week-days` was a custom property nobody set~~ - removed in v1.9.

---

## 5. Phone checklist

Run this at **390x844** in the browser pane before calling any wave done. The
owner is an iPhone user; Android and desktop must work too, but the phone is
the one that gets checked first.

- [ ] **Today** - header, North line, capacity line, timeline disclosure, task
      list, Done fold, inbox, rollover button. Scrolls vertically (expected),
      never horizontally.
- [ ] **Calendar → Month** - fits without scrolling. This is a hard constraint;
      if something must give, reduce stat detail, never raise cell height.
- [ ] **Calendar → Week** - three columns, no scroll in either direction,
      template chip inside its own column.
- [ ] **Settings** - every section reachable from the pill row; the row itself
      scrolls sideways and the first pill is not clipped.
- [ ] **Every visible button ≥ 44px**, or carrying a `::after` hit-area
      overlay. Measure it, do not read it - see `CONVENTIONS.md`.
- [ ] **No horizontal overflow anywhere**:
      `document.documentElement.scrollWidth > clientWidth` must be false.
- [ ] **Both themes** - dark and light. `--muted` and `--danger` are gated at
      4.5:1 by a test, but check that nothing new hard-codes a colour.
- [ ] **A task detail sheet** opens as a bottom sheet and can be swiped away,
      clear of the home bar.
- [ ] **Settings and the detail sheet** get measured too. The v1.6 pass
      measured Today and the calendar and stopped there, which is how a 38px
      pill row and four sub-44px controls in the sheet survived two versions.
- [ ] **Replan** - open all three doors. The summary must be on screen without
      scrolling, with five things in the way. It is the sentence the screen
      exists to produce.
- [ ] **Scratch** - the floating button, and the close cross: on a phone the
      overlay is the whole screen, so there is no scrim to tap.
- [ ] **The four shelves** - a task, an inbox line and a backlog item from the
      same field, and the Backlog fold under the inbox. Every row's actions on
      their own line, all of them 44px.
- [ ] **Library** - the chip row, a list folded and unfolded, the active card,
      and a detail panel opened from a row. The picker for a page-counted book
      is typed, not stepped.
- [ ] **Evening close** - the card at its time and the card on a finished day.
      It must span the content columns rather than land in the rail, and it
      must never say anything about what was not done.
- [ ] **The tour** - both platforms, all nine steps, then once more doing
      only what each card says. The spotlight has to follow into a bottom
      sheet, which is where it first failed; the dots on the Walk card have
      to be visible while pointed at; the caption after the goal has to land
      on the North line under the day's title. This is not optional polish:
      CONVENTIONS.md section 13 makes a stale tour a P0 bug, because it is
      the first thing a new person sees.
- [ ] **The quick-add row against the cards under it** - the duration
      control's right edge and the cards' right edge are one line, and the
      placeholder is whole. Both broke once without anybody measuring.
- [ ] **Library counts** - every row's count ends on the same x, the active
      card's included.
- [ ] **The wide layout with an empty day**, in each of the three focus
      states. Both rules that collapse the grid have to agree about the
      column names - see the grid-area note in section 6.

The measurement snippet that has been used for the target audit:

```js
[...document.querySelectorAll('button, [role="button"]')]
  .filter(b => {
    if (!b.offsetParent) return false
    const r = b.getBoundingClientRect()
    if (r.height === 0) return false
    const after = getComputedStyle(b, '::after')
    const overlay = after.content !== 'none' && after.position === 'absolute'
    return r.height < 44 && !overlay
  })
  .map(b => ({ t: (b.textContent || b.ariaLabel || '').trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height), c: b.className }))
```

---

## 6. Things that will bite you

Collected from waves where they actually did.

- **`store.ts` calls `loadData()` at import time.** Anything that needs to
  influence what the store reads has to happen inside `loadData`, not in
  `main.tsx` - module imports are evaluated before the importing module's body.
  This ate the first version of demo seeding.
- **`normalizeLoaded` is where a new settings field lives or dies.** It spreads
  now, so you are fine, but the test in `storage.test.ts` is what keeps it that
  way.
- **`SYNCED_SETTINGS` is checked for exhaustiveness at compile time.** Add a
  field to `Settings` and the build fails until you say whether it syncs. That
  is deliberate.
- **A `Response` body can only be read once.** Test doubles must return a fresh
  one per call, or the second reader gets an empty body - this made a sync test
  fail for a reason that had nothing to do with sync.
- **`vi.unstubAllGlobals()` does not restore spies.** A `vi.spyOn` on
  `navigator.onLine` leaked across a whole test file and made two later tests
  pass by doing nothing. Use `vi.restoreAllMocks()` too.
- **The dev server caches modules hard.** If the browser shows an error naming
  a variable you already deleted, kill the dev server, `rm -rf node_modules/.vite`,
  restart. Do not debug the phantom.
- **jsdom has no layout and no hit testing.** `getBoundingClientRect()` returns
  zeroes and `document.elementFromPoint` does not exist until you define it.
  Any geometry has to be a pure function tested directly.
- **Line endings.** The repo is CRLF. A script doing string replacement has to
  detect which the file uses; several edits failed silently on this.
- **The browser pane's screenshot crops sometimes.** Retry, or open a fresh
  tab. Measurement via `javascript_tool` is more reliable than pixels anyway.
- **A grid-area naming an area no template declares is not ignored.** It is
  placed in an implicit track, so the grid quietly grows columns nobody
  declared. Two rules collapsed the day view to two columns and disagreed
  about the surviving column's name (`pane` against `tasks`); on an empty day
  with the Tasks focus both matched and the header was squeezed into 151px in
  a four-column grid. `gridAreas.test.ts` reads the stylesheet as text and
  fails on any name a template does not offer.
- **One stylesheet means class names are global.** `.palette` was the colour
  row in the template editor until the command palette took the same name in
  v1.3, after which eight swatches rendered stacked inside a 560px card. Grep
  the stylesheet for a name before using it. A script that lists every class
  defined twice at the top level takes four lines and found two more.
- **`.chip` is the category swatch.** It sets a dark ink for the coloured
  background its callers supply inline, so borrowing it without one gives a
  browser-default white pill with near-black text - loud, and wrong in the
  dark theme.
- **A popover needs a positioned ancestor.** `.time-picker-panel` is absolute
  at `top: 100%`; dropped into the quick-add row without one, it measured
  itself against the whole task column.
- **An effect that both sets state and clears a timer will clear its own
  timer.** The tour showed a tick for ever because the effect that started the
  advance timer re-ran the moment it set `celebrating`, and its cleanup killed
  the timer it had just made. Two effects.
- **For one render after the tour advances, `celebrating` belongs to the
  old step and `step` is already the new one.** Any effect keyed on both
  has to check `before.step === index` first, or the new step's caption
  fires on the old step's tick - which is how the goal step's relocation
  sent the shell to the day view on top of the index effect's `settings`.
- **A layout hook must not measure anything the page's scroll position
  moves.** `useAvailableGridHeight` read the grid's viewport-relative top;
  scrolled down, the grid claimed a screen it did not have, grew, pushed
  the document taller, moved under the scroll settling back, and re-measured
  - a feedback loop the tour exposed by scrolling Settings and switching
  tabs. It reads the document-relative top now.
- **The browser pane throttles a hidden tab.** Timers fire once a second
  and animation frames not at all, and after a few minutes chained timers
  fire once a *minute*. A page script with several `await sleep()` calls
  then takes minutes, every later tool call queues behind it, and it looks
  exactly like a locked renderer - three "hangs" in one session were this.
  Put waits between tool calls, never inside the page, and dispatch keys on
  elements rather than trusting `computer` key presses to land.
