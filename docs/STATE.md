# Where this project actually is

You are picking this up cold. This file is the handover: what exists, how it
got here, and what is still owed. Read it, then
[`CONVENTIONS.md`](CONVENTIONS.md) for how work is done here, then
[`ARCHITECTURE.md`](ARCHITECTURE.md) for where the code lives. Those three
should leave you able to start without re-reading the repo.

**Last updated:** stage 1 of the wave after v2.0 - categories are the owner's
now, a list in the data with an editor in Settings and a delete that moves
what it would orphan. Tagged v1.0 through v2.0; this sits on top of the tag,
untagged, and five more stages are owed before v2.0's own tag moves. The wave
table in section 4 is where to start.

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
| Task detail | Everything the card does not show: exact minute, note, sub-steps, repeat, the three-a-day key mark. The size is a stepper with six chips beside it; the repeat is four buttons. Panel on desktop, bottom sheet on a phone, right-click menu for the common ones |
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
| **Library** | Lists worked through a unit at a time. The add line is the words plus a unit control and a count control that already hold an answer, remembering the unit per list; a typed "Dune, 20 chapters" still works and the controls redraw to show it. Lists fold and a chip row jumps between them; in each, the item you are on gets a card with its progress and its pace note while everything behind it is one quiet line. An item can be counted in the list unit, in pages, as a film, or as seasons and episodes. A session goes onto a day in two taps, or onto a template in one flow; ticking it off advances the book. When one ends, the list says what it moved on to and puts a sitting on today in one press - the block was already bound to the *list*, and until v2.0 nothing said so |
| **Review** | Week and month statistics, all derived from the days themselves |
| **Settings** | General, North, Sleep, Week, Nudges, Rules, Calendars, Backup, Sync, Appearance. General also replays the tour, in a sandbox |

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
| Cloud backup | The third copy: the plan as JSON in a private GitHub repo, written after the evening close, on the first open of a new day, and on a button. Token on this device only. Restore describes both copies before an armed replace. See ARCHITECTURE section 7 |
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
| **v1.10** | The reading plan seeds only from the palette (the privacy fix); the tour engine's standing rules - the target is visible, never behind a sheet, the card says what to do now, every step names its outcome, nothing skips on its own - after the owner's walk found seven problems, plus the scroll-position feedback loop and the Escape-under-a-sheet bug the walks exposed; quick-add fitting its column and the column fitting a 1024px window; `store.ts` split into ten action areas plus `core.ts` with no import changed; Playwright end-to-end tests for a first day, the naive tour on two viewports, and two-device sync |
| **v1.11** | `npm run shots`: the README's screenshots generated from the demo under a pinned clock; the demo's first screen fitting 1366x768 with one notice at a time, a thin demo line, pointer-aware grid floors and a column that scrolls instead of the page; seven more Playwright files (replan's three doors, a bound book, the backlog and scratch, a night passing, a week drag, export-erase-import, a snapshot, an .ics file) and the three bugs they found; ICS time zones through Intl and the plain monthly and yearly rules; `validate()` as tables in `validate.ts`, a map at the top of `timelineLayout.ts`, the tour's scrim rebuilt so it stops repainting the window; a pen for Scratch in the header; the third copy of the plan in a private GitHub repo; every control opening on an answer - the library's add line, duration chips, a repeat as four buttons; the README rewritten to what a stranger needs in thirty seconds, and every doc read against the code |

| **v2.0** | The desktop closed as a product. The library's queue says it is a queue: what ended today, what the list moved on to, and one press that puts a sitting on it - plus the bound card on the day reading "finished - next is Deep Work" instead of "ch 12/12". Typing lag measured rather than assumed and found not to reproduce at 4x, then fixed where it does reproduce, with `contain: layout style` rather than a debounce. Fourteen defects from walking the app as its owner at 1920x1080, 1600x900 and 1366x768 in both themes on a realistic full day and a twenty-task one - the worst being a task list squeezed to zero pixels with seven tasks in it, and a month grid drawing a whole extra week of the next month. Every copy of the plan driven live in a browser: the GitHub chain in thirteen steps against a stand-in Contents API, two devices ticking, editing and deleting at each other, and a snapshot that really brings a day back. `DAILY.md`, walked step by step on an empty install rather than written and hoped for |

| *(untagged)* | Categories became the owner's: a list in `AppData` rather than a literal in a module, an editor in Settings, twelve curated colours with a readability gate, and a delete that moves what it would orphan in one commit with one undo. Three bugs on the way - category edits would never have synced at all, because `stampChanges` had no diff for the new collection; and the library's dot row had been a control that did nothing since it was built, writing values `validate` would have rejected on the next load. `adee903` |

Tags exist for v1.0 through v2.0. The row above is on `main` and is not tagged:
it is stage 1 of a six-stage wave, and the tag waits for stage 6.

---

## 4. Open work

### Nothing is half-built

Still true, and checked rather than assumed at `adee903`. The suite is green -
**1925 tests in 108 files, plus 24 Playwright tests in 11 files across two
viewports** - the typecheck and the build are clean, `npm run sweep` reports
nothing on the desktop and its self-check sees five shapes out of five, and
the working tree is empty. Everything through v2.0 is tagged; the categories
work on top of it is committed and pushed but not tagged.

What follows in this section is in two parts: the wave that is running, which
is owed, and then the phone and the debts, which are wanted.

### The wave in progress, and what is owed

Two waves were briefed by the owner in one sitting. This one is a sixth done;
the second has not started and must not start before this one closes.

| # | Stage | State |
|---|---|---|
| 1 | **Categories the owner owns** | **Done** - `adee903`. Three bugs found on the way, two of them shipped; two existing tests changed, both named in that commit |
| 2 | **North window: goals and if-then in one place** | **Done**. North is the sixth tab, rules live under the goal they protect, and the old day-view surfacing is gone with the three fields it needed |
| 3 | **The explanation layer** | **Done**. Twenty terms audited, one tooltip component, all the copy in `lib/explain.ts` |
| 4 | **Library lanes: MIND, CRAFT, LIGHT** | **Done**. One queue of twenty became three that advance on their own |
| 5 | Clean checkup | Not started |
| 6 | Closing: desktop QA, DAILY.md, regression, tag v2.0 | Not started |
| - | **Week templates** (its own wave) | Queued *after* stage 6. Its own stage 3 wants tooltips for "Week template", "Add to" and "Copy to", and the tooltip component is stage 3 of this wave, so the order is not negotiable |

The working tree is empty at `adee903` and stage 2 was never begun, so there
is nothing half-written to pick up - only the briefs below, which are the
owner's own words turned into something a session can start coding from.

#### Stage 2 - North becomes a window, and if-then moves into it

The reported problem: **if-then is useless as it stands.** It is a list in
Settings that nobody ever sees, surfaced by day type and time of day into a
day view where it reads as noise. The fix is not to surface it harder; it is
to put every rule under the goal it protects.

- **North becomes its own view.** In the nav, reachable from the North line on
  Today, and in the command palette. `views/north/` beside `views/week/`.
- **Each goal is a calm card**: what / why / who it makes you, exactly the
  three fields `Goal` already carries, with no progress, no checkbox and no
  count of anything. ARCHITECTURE section 6 is the constraint and none of it
  moves. The rotation stays.
- **Under each card, "What pulls me off this"** - the if-then lines belonging
  to *that goal*. Written in the second person the owner writes in: "If I
  catch myself scrolling at 23:00 -> phone in the kitchen, book in hand."
- **Limits: four goals** (already `MAX_ACTIVE_GOALS`), **five rules per goal.**
- **A rule is never measured and never nudges.** It appears in exactly two
  places: the North window, and the slack-trigger card - where, under the
  why, *one* rule from that goal appears as "here is what you wrote yourself".
  The day-type and time-of-day surfacing of the old if-then board goes.
- **Data**: `IfThenEntry` gains an optional `goalId`. Optional because every
  rule on disk predates it - see the migration below - and because a rule can
  legitimately sit unassigned for a while.
- **Migration**: existing rules land in North as "unassigned", with an offer to
  put each under a goal. Nothing is deleted and nothing is guessed at.
  Settings -> Rules goes, replaced by a line pointing at North.
- **DECISIONS gets the sentence this is all for**: a rule with no goal is
  noise; under a goal it is armour.
- **The tour's North step is updated** - CONVENTIONS section 13 makes a stale
  tour a P0, and this moves the thing that step points at.
- Tests: the goal-rule link, the migration of unassigned rules, the slack
  card showing exactly one rule from the right goal, and both limits refusing
  rather than evicting.

#### Stage 3 - the explanation layer

The reported problem, in the owner's words: *"arriving for the first time I
would not even know what Ongoing means."*

- **Audit every unexplained term and control first, and put the list in the
  report.** The ones already named: Ongoing, Day type and each of its four
  values, Key task, Push, Backlog against Inbox, Stamp, Focus, the three
  Replan doors, Library units, North, sleep schedule, and sync against backup.
- **One tooltip component**, built from the tokens like everything else: 400ms
  delay, one or two sentences, and on a phone an `(i)` or a long-press, since
  a finger has no hover. **All the text in one file**, so the copy can be read
  as copy.
- **Day type**: choosing one puts a line under it saying what that choice
  actually changes. **Ongoing**: the explanation sits beside the button.
- A DOM test that every term on the audit list has a tooltip - the list is the
  test's own data, so adding a term to the list without writing its copy
  fails.

#### Stage 4 - three reading lanes from the palette

`Ctrl-K` -> "Load my reading plan" fills **three** lists instead of one, and
is idempotent - running it twice changes nothing. All three are counted in
chapters. A blank count means the book has no useful chapter count and the
note carries the intent instead.

- **MIND**: The War of Art (pages, blank, "one section a day - finish Book
  Two, skim Book Three"), The Courage to Be Disliked (5), Daring Greatly (7),
  Attached (12), The Status Game (blank), How to Fail at Almost Everything and
  Still Win Big (38), Sapiens (20), Models (13), Atomic Habits (20), Four
  Thousand Weeks (14).
- **CRAFT**: Turning Pro (pages, blank, "short - about a week"), The Missing
  README (blank, "before day one at the job"), The Pragmatic Programmer
  (blank, "dip-in, 100 tips"), Never Split the Difference (10), Deep Work
  (blank, "when the YouTube era opens").
- **LIGHT**: The Psychology of Money (20, "finish it"), Siddhartha (12), You
  Are Not So Smart (48, "one mechanism per chapter"), The Subtle Art of Not
  Giving a F*ck (9), Crime and Punishment (blank), Musashi (blank, "winter").
- **"Up next" after an item ends** offers the next book *from the same list*,
  and only when there is not already one - `upNext` in `lib/library.ts`
  already does the arithmetic; this is about it being per lane.

This is seeded on request from the palette and never on first open. That rule
is not a detail - it was a privacy bug in v1.9 that handed the owner's actual
bookshelf to anybody who opened the live demo. See `librarySeed.ts`.

#### Stage 5 - the clean checkup

The owner's report: *"a lot of places are not clean."* Named, in order:

- **The template editor.** Eight large colour balls above the form become a
  small swatch beside the name. The day-type segment gets a line under it
  saying what it changes (shared with stage 3). The block-add row is
  overloaded - time, text, minutes, six dots, Ongoing and Add on one line - so
  split it over two levels or use the compact controls quick-add already has
  (`DurationControl`, `TimePicker`). Existing blocks become a tidy list with
  drag reorder.
- **The library add line.** "how many" is clipped and the unit, count and Add
  are crushed together. Rebuild it as a quick-add row: the words dominate, the
  controls line up.
- **Everywhere**: one vertical rhythm, no clipped placeholder, one button
  height per row, and every empty state carrying exactly one clear next action.
- **A screenshot before and after for every screen touched**, and **at least
  fifteen fixed places across the app**. Fewer than fifteen means the pass was
  not thorough enough and gets a second round.

Note for whoever runs this: the browser pane's screenshot went blank for
anything but scroll position zero during stage 1, while `javascript_tool`
measurement stayed reliable throughout. A fresh `preview_start`, or a fresh
tab that actually has layout - a background tab reports `innerWidth: 0` and
every ref reads as off-canvas - is the thing to try first.

#### Stage 6 - closing

- **Desktop QA on a realistic day** - twenty tasks, three Library lists,
  thirty in the backlog, North with rules - at 1920x1080 and 1366x768 in both
  themes, aimed at what is *new*: the North window, categories, the tooltips
  and the rebuilt forms.
- **`DAILY.md` updated** (it exists): the North window with its if-then lines,
  editing categories, and the three Library lists with their template bindings.
- Full regression - unit and e2e - `npm run sweep`, `npm run shots` rerun,
  every doc read against the code, DECISIONS carrying the North/if-then
  reasoning, the tour walked, then commit, push and **tag v2.0**.

#### The wave after: week templates

Briefed and queued, not started. **No personal seed data - the owner builds
their own template.** In short: "New template" first asks Day or Week
(`kind: 'day' | 'week'`, everything existing is a day and nothing changes); a
week editor of seven columns with "Add to" chips (this day / weekdays /
weekend / all days), Copy to, drag between columns, a per-column day type and
sleep override, and blocks sharing a `groupId` when added together so editing
one can ask "this day or everywhere" the way a repeat does. Stamping takes the
weekday's column; a weekday map holding a week template fills all seven in one
press; idempotency is `blockId` plus weekday. A week template's card shows a
seven-column preview. Then: "Start from a day template" to expand one day into
seven and edit the differences, `DAILY.md` on doing exactly that (a gym
rotation across the week, Reading and CRAFT blocks bound to Library lists), the
tour's stamp step checked against a week template, and tooltips for the new
terms.

### The desktop is closed; the phone is the next wave

v2.0 was a desktop pass on purpose. The phone still works - the month fits
390x844 again, which it had not for some time - but it was measured rather
than walked. `npm run sweep -- --phone` reports **84 findings, which are three
shapes** - the pass counts every occurrence, and the same control on ten
screens is ten findings. The three are below; the fourth job is the walk
itself. "Exactly two things and nothing else" is what this file said until the
count was read rather than remembered, and the third shape had never been
written down at all.

- **Quick-add's quarter-hour arrows are 22px each on a coarse pointer.**
  Two halves of one 44px column, and the `::after` overlay trick cannot
  save both: two 44px overlays stacked steal each other's taps. Needs a
  different shape for a stacked stepper, not a bigger hit area.
- **The Scratch button sits over the last cell of the month.** It is
  draggable, so it is a nuisance rather than a trap, but the default
  position covers a real control.
- **The focus bar's exit cross is 30px**, on seven screens - anywhere the bar
  can be showing. It is not in the `::after` overlay list and it is the one
  way out of a running Focus session, which makes it the worst of the three
  to miss.
- **A walk of every screen with a full day**, the way v2.0 walked the
  desktop: eyes on it, not just the sweep. A measuring pass finds what it
  was told to look for; the fourteen defects v2.0 fixed included several
  nothing would have thought to measure - two adjacent controls reading the
  same word, a red word on an action that carries no verdict, a month
  drawing a week of the next one.

### Built: categories the owner owns

Shipped, to the design this file carried. The six the app has always shipped
are still the six a fresh install opens with, and they are now a list in
`AppData` rather than a literal in `categories.ts` - renameable, recolourable,
deletable, and joinable by new ones.

**The six-category doctrine did not go, it moved.** DECISIONS still holds that
a day is only takeable-in-at-a-glance while the palette is about six, and
`RESEARCH-ADHD.md` section 7 is why. What changed is who decides *which* six.
No cap is enforced; the Settings copy says what the number is for, once, and
then gets out of the way.

What a reader should know without opening the diff:

- **`Category` is a top-level list beside `library` and `goals`**, not a
  settings field, because a settings field is one sync entity and two devices
  editing two different categories would fight over one key. `'category'` is
  an `EntityKind`; per-entity merge and tombstones come free.
- **`CategoryId` is `string`.** The six defaults keep their literal ids, so
  every task, template block and backlog item already on disk points at
  exactly what it pointed at before. A new one gets a `crypto.randomUUID()`.
- **Absent `color` means the built-in `--cat-*` pair**, which is what keeps a
  category meaning the same thing in Dark and Light. Only an edited or new one
  carries a literal hex. A category the owner made has no pair behind it, so
  its colour is required and "the app's own colour" is not offered there.
- **`validate` loosened the three fields that point at a category** from a
  closed list to `optional(text(1, 64))`, deliberately: an id somebody made up
  cannot be checked against a list nobody wrote. A category id is now what
  `templateId`, `libraryRef` and `sleepProfileId` already are.
- **A delete offers to move what it would orphan**, in one commit with one
  undo, and says what it is about to touch as a fact rather than a warning.
  The last one cannot go, and the disabled button says why.
- **A hand-picked colour is refused rather than clamped** when it will not
  read. The check is the one this file specified: the title mix at 22% against
  the strongest end of the wash at 30%, at 4.5:1, in every theme the app
  ships. `categories.test.ts` holds all twelve palette colours to it.

**One thing to know about that gate, said plainly**: with those numbers it is
a floor rather than a filter. The wash is 30% colour on the surface and the
title is 78% `--text`, so the pair stays close to text-on-surface and almost
any hex clears 4.5:1 - pure white in Dark measures 5.07. It genuinely refuses
anything that is not a hex at all, and it would catch a future change that
made the wash stronger, which is what it is for. What it does *not* police is
whether the 4px edge can be told apart from the surface. The twelve curated
colours are checked against that separately, in the test, at 3:1 in every
theme; a hand-typed hex is not. That was a deliberate call to implement the
gate this file specified rather than invent a second one, and it is the first
thing to look at if a hand-picked colour ever looks wrong on a card.

### Asked for, and now built

The three things the v1.11 brief named. Two are done and one turned out not
to be what it looked like:

- **An "up next" offer when a library item is finished.** Built in v2.0.
  `upNext(list, today)` in `lib/library.ts`, the offer line above the loud
  card in `LibraryView.tsx`, and "finished - next is Deep Work" on the bound
  task's card. Bounded to today, because it is a moment rather than a state.
- **Typing lag in quick-add under a slow CPU.** Measured again, the same
  way - Playwright, CDP `Emulation.setCPUThrottlingRate`, frame times from
  `requestAnimationFrame`, production build - across a realistic day, a
  twenty-task day, a twenty-task day with three thousand external calendar
  events, and a phone viewport. **At 4x nothing drops a frame**: every
  scenario sits at a flat 16.7ms and the synchronous React render a
  keystroke costs is 2 to 3ms. The old 50ms figure was a frame measurement
  that included the page's own baseline. It does reproduce at 8x on a
  170-task day - 66.7ms at the 95th percentile - and an inert input on the
  same page costs 50ms of that, so most of it was never quick-add. The rest
  was a layout invalidation walking out of quick-add's subtree into the day
  beside it, which `contain: layout style` on `.quick-add-block` and
  `.timeline-grid` cuts to 33.4ms. `busyIntervals` and `suggestSlot` are
  memoised on what they actually read, which is another 14% of the render.
  **Do not chase this further without a measurement that reproduces it.**
- **Outlook's Windows time zone names in .ics files.** Still open, and
  still the same question - see below.

### One flake, unreproduced, written down rather than argued away

`smoke.e2e.ts`'s first day failed once during v2.0's closing regression and
has not failed since: fifteen full runs after it, including four at four
workers, all green, and the test passes three for three on its own. No cause
was found and nothing was changed to chase it, because changing a test to fix
a failure you cannot reproduce usually means making it assert less.

If it comes back, the thing to know is that this same test failed
*deterministically* before v2.0 for a different reason - it read the real
clock and the evening close card appears after 21:30 - so a failure here is
worth reading carefully rather than re-running. CI retries once.

### Known debts, and why each one stays

Every one of these was looked at again in v2.0 and left. None is an
oversight; each is a trade with a reason, written here so nobody has to
guess whether it was noticed.

| Debt | Why it stays |
|---|---|
| **Week blocks are small targets** | A 20-minute block at a week's scale is ~20px tall, because its height *is* its duration - that is the whole of what the week view says. Raising it to 44px would make a twenty-minute thing look like an hour, which is a lie about the day in exchange for an easier tap; the block opens the same task the day view does, at a size that fits. `min-height: 20px` on coarse pointers is the compromise |
| **`timelineLayout.ts` at ~890 lines** | Dense geometry, and splitting it would put the two coordinate systems in different files, which is exactly where a bug would hide. Well tested, and it opens with a map - the two systems, the three windows, the invariants, and which function decides what - so the next person starts from the map rather than the middle. Kept whole on purpose |
| **Sync has no conflict UI** | Last-write-wins per entity, silently. For one person with two devices a real conflict means editing the same task on both within a few seconds, and "the later edit wins" is both correct and what anybody would expect; a dialog for it would be a question with no good answer, asked on the rare day when somebody is already busy. It would be wrong for two people, and this is not for two people |
| **Imported .ics calendars are device-local** | A file has no address to refresh from, so there is nothing to sync *to* - carrying the parsed events would make one device's stale copy authoritative on another. Subscriptions, which do have an address, sync. Stated in the UI where it matters |
| **Outlook's Windows time zone names are read as local** | "FLE Standard Time" is not an IANA name, so `Intl` does not know it and `ics.ts` says so rather than guessing. For the owner, in the zone the file was written in, that is right by accident; for a colleague's file two zones away it is wrong by hours. The open question is whether a table of the dozen Windows names that actually turn up is worth carrying - one map in `ics.ts`, consulted before `Intl`, with a test on the Outlook fixture already in `ics.test.ts`. Reading the file's own `VTIMEZONE` block would be exact and is a much bigger job; the table is the honest middle, and nobody has needed it yet |
| **The month's cells drop their ratio below about 720px of height** | The zero-scroll rule says the month fits, and something has to give when it cannot. Detail goes, never cell height: a 30px row is not a calendar. The shape of the month survives, which is what the grid is for |

### Resolved debts, so you do not chase them

- ~~The library's dot row was a control that did nothing~~ - found while
  categories were being rewired, and it was wrong twice over. `updateLibraryList`
  never carried `color` through its patch, so every button in that row had
  been inert since it was built; and the values it was writing were
  `var(--cat-*)` references, which `LIBRARY_LIST`'s own `validate` table only
  accepts as a hex - so the first list that had actually taken a colour would
  have made the whole payload fail to load and open as a clean default. It
  draws from `PALETTE_COLORS` now, like every other colour choice in the app.
- ~~The 20MB import test failed at random~~ - it was the default 5s per-test
  timeout acting as an absolute millisecond budget on a test that deliberately
  asserts a *ratio* (CONVENTIONS section 3). It builds a 20MB payload and
  imports it several times, which on a machine running a hundred test files in
  parallel is honest work that takes longer than five seconds. Reproduced on
  v2.0's own commit with nothing changed: two failures in four runs. It carries
  its own 60s timeout now, so the ratio is what can fail it.

- ~~The day view could stop showing the day~~ - fixed in v2.0. At 1366x768
  with the evening close card above it, `.task-list` measured zero pixels
  tall with seven tasks in it, and at 1920x1080 it showed four of seven
  behind an overlay scrollbar that draws nothing until a pointer is over it.
  The list has a floor of two cards when it has any, the pane scrolls when
  that floor cannot be honoured, and the list carries scroll shades so it
  says when there is more.
- ~~The month grid always drew six rows~~ - fixed in v2.0. `monthGrid`
  returned a flat 42 cells, so every five-week month carried a whole week of
  the next one. It emits the weeks the month is actually in, four to six, and
  the month fits 390x844 again.
- ~~Two anchors in one column could overlap~~ - fixed in v2.0. A cluster's
  floor was the largest any single member needed, so a column holding two
  32px blocks got 32px and the second was drawn over the first's title. The
  floor is the tallest column's stacked total, and a block is capped at the
  next one in its own column besides.
- ~~Typing lag in quick-add~~ - measured in v2.0 and mostly not there; see
  "Asked for, and now built" above for the numbers, and do not chase it
  without a measurement that reproduces it.
- ~~The library queue behaved like a conveyor and looked like a list~~ -
  fixed in v2.0.
- ~~The timeline fell off a cliff the moment a day stopped fitting~~ - fixed
  in v2.0.1. `fitPxPerMinute` returned the phone's own density when no
  density fit, which is the far end of the range from the answer: the starter
  template's nine-task day in the 445px column a 1990x860 window leaves drew
  at 1082px, six hundred pixels of scrolling for a day whose floors need 456.
  It aims at the floors' own height now and comes out at 464. The function
  had no tests at all, which is how it shipped; it has six.
- ~~Four ways to say a colour was chosen~~ - fixed in v2.0.1. The accent row,
  the six categories, a template's colour and a library dot each had their
  own idea of what "selected" looks like. One rule now, in DECISIONS: fill,
  a two-pixel gap in `--surface`, a two-pixel ring in the swatch's own colour
  through `--pick`, as a box-shadow so choosing one never moves the row.
- ~~The tick on a done task measured 2.42:1~~ - fixed in v2.0.1. It was a
  hard `#fff` on an accent fill, which is the exact case CONVENTIONS section
  5 was written about, on the most-looked-at mark in the app. 8.67:1 now, and
  the switch's thumb had the same bug. A check over every accent-filled
  surface in the stylesheet found those two and nothing else.
- ~~A percentage in the rail~~ - fixed in v2.0.1. The digest's ring carried
  `Math.round(fraction * 100)`, which is a percentage with the sign taken
  off, next to a "Done 1 of 9" that already said it correctly in words.
  `score.test.ts` had held the no-percentage rule for `formatDayScore` since
  it was written; the digest computed its own fraction and walked around it.
  The ring is a shape now, and `DayDigest.test.tsx` holds it.
- ~~Scroll shades that could not be seen~~ - fixed in v2.0.1, and it was a
  flaw in v2.0's own fix. The `background-attachment: local`/`scroll`
  gradient pair is the right answer only for a scroller whose children are
  transparent; a task card paints `--surface` edge to edge, so the shades sat
  behind the cards. `mask-image` driven by `useScrollEdges.ts`.
- ~~Three transitions mixed `0.15s` with `var(--dur-fast)`~~ - fixed in
  v2.0.1. The same number written two ways means the motion token no longer
  controls everything it claims to. The one genuinely bespoke duration left
  (the day progress bar at 0.35s) now says why.

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
  v1.10: `npm run e2e`, 23 tests in ten files under `e2e/`. A first day
  (stamp, add, tick, the evening close arriving on the last tick, the reading
  plan from the palette), the tour walked naively on a desktop and on a phone
  doing only what each card says, two browser contexts syncing through the
  real `server/sync-server.mjs` on a spare port - one task both ways, and
  since v2.0 a tick here against an edit there with a delete in the middle -
  the demo's first screen, the three replan doors, a book bound to a template
  and ticked and then finished so the list names the next one, a backlog
  pull, a night passing with a daily repeat and the yesterday banner, a
  week-view drag, scratch's two ways out, export-erase-import, two snapshot
  restores (the empty first-mount one, and one that really brings a wrecked
  day back), and an .ics file over the day. Every test that depends on the
  hour pins the browser clock (`openFreshAt` in `e2e/app.ts`) to a Wednesday
  in Vilnius - `smoke` and `tour` did not until v2.0, and failed on any
  machine run after 21:30, which is the default evening close time. CI runs
  it in its own job; the deploy does not wait for it.
- ~~`storage.ts` at ~830 lines, almost all of it `validate()`~~ - split in
  v1.11. The guard lives in `validate.ts` as tables: one per entity, a
  field and what a value in it may be, built from a dozen small checks
  (a string, a whole number in a range, one of a list, optional, a list
  of). Same strictness - every rule tighter than the type kept its reason
  beside it - and the 96 tests that hold the contract did not change.
  `storage.ts` is 347 lines and is about loading, saving and migrating.
- ~~The tour lagged on a slow machine~~ - profiled in v1.11 under a 4x CPU
  throttle. The scrim was one full-window SVG path with the hole cut out
  and its `d` transitioned, so every move of the hole re-rasterised the
  window for a fifth of a second; scrolling under the spotlight ran a 95th
  percentile frame of 56ms. It is four solid shades now, moved by
  transform (`shadesAround` in `Tour.tsx`), the ring is positioned by
  transform, and the poll goes through the same per-frame gate as the
  observers. Scrolling is at 40-47ms at the 95th percentile under the same
  throttle, and typing under the spotlight costs what typing costs with no
  tour at all - what is left is the app's own render at a quarter speed,
  not the tour's. The 3.2 second caption hold is untouched; that is a
  pause, not a lag.
- ~~ICS: named time zones were read as local~~ - resolved in v1.11 through
  `Intl.DateTimeFormat`, which carries the IANA tables the debt said were
  needed; there was never a database to ship. A zone the browser does not
  know (Outlook's Windows names) is still read as local and reported.
- ~~ICS: monthly and yearly rules were skipped~~ - the plain shapes are read
  since v1.11: the same day each month, the same date each year, with the
  RFC's rule that a month without the day has no occurrence. The exotic
  shapes stay named in `ignored`, for the reason the debt gave. Tests
  include a trimmed Google export and a trimmed Outlook export.
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
      list, Done fold, inbox, the rollover link (a button drawn as a link,
      exempt from the 44px audit by design). Scrolls vertically (expected),
      never horizontally.
- [ ] **Calendar → Month** - fits without scrolling. This is a hard constraint;
      if something must give, reduce stat detail, never raise cell height. It
      was 74px past the fold before v2.0, which is how a hard constraint goes
      quietly wrong: nothing measured it after the last thing that changed a
      height. Measure it, every time.
- [ ] **Calendar → Week** - three columns, no scroll in either direction,
      template chip inside its own column.
- [ ] **Settings** - every section reachable from the section list at the
      top, which is sticky; it must not cover the content at 390px, and the
      first entry is not clipped.
- [ ] **Every visible button ≥ 44px**, or carrying a `::after` hit-area
      overlay. Measure it, do not read it - see `CONVENTIONS.md`. Three
      documented exceptions, and nothing else: a week block (its height is
      its duration), a year cell (a heatmap mark), and quick-add's stacked
      quarter-hour arrows, which are 22px each and are the phone wave's
      first job. **A new class in the `@media (pointer: coarse)` overlay
      list has to go in twice** - the `position: relative` list and the
      `::after` list - and `.setting-quiet` shipped in v2.0 missing from
      both, which the measured phone run caught.
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

- **`store/core.ts` calls `loadData()` at import time.** Anything that needs to
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
- **`background` on a scroller paints behind its children.** The classic pair
  of `background-attachment: local` / `scroll` gradients that says "this list
  goes on" is the right answer only when the children are transparent. A task
  card paints `--surface` edge to edge, so the shades showed in the eight
  pixels between cards and nowhere else. What fades opaque children is
  `mask-image`, and a mask cannot be told to appear only while there is
  something to fade - hence `useScrollEdges.ts`.
- **A flex child with `min-height: 0` can be given nothing at all.** That is
  the point of it - it is what lets a column shrink - and it is also how the
  task list came to measure zero pixels with seven tasks in it on a 1366x768
  evening. Anything that must always show *something* needs a floor as well
  as permission to shrink, and the container needs somewhere for the
  overflow to go when the floor cannot be honoured.
- **An overlay scrollbar draws nothing until the pointer is over it.** On
  Windows Chrome with `scrollbar-width: thin`, a list that scrolls looks
  exactly like a list that ends. If a scroller matters, say so in the paint:
  the two `local`/`scroll` gradient shades on `.task-pane .task-list` are
  the pattern.
- **`:not(:empty)` is how a CSS floor stays off an empty list.** React
  renders no child nodes at all for an empty array, so `:empty` matches. A
  floor without that guard put a 120px ruled band under the first-run
  invitation, which reads as something failing to render.
- **A cluster's floor is not a member's floor.** `buildAnchorClusters`
  reserves per *column* - two anchors that do not overlap share a column and
  are stacked, so that column needs both floors end to end. It reserved one
  of them until v2.0 and drew "Wash the car" through the middle of "Reply to
  the landlord".
- **A test that reads the real clock fails at some hour of some day.**
  `smoke.e2e.ts` and `tour.e2e.ts` used `openFresh` rather than
  `openFreshAt`, so both failed on any machine run after 21:30 - the default
  evening close time - and had for as long as anybody ran the suite in the
  morning. CONVENTIONS section 10 already said to pin it.
- **The browser pane throttles a hidden tab.** Timers fire once a second
  and animation frames not at all, and after a few minutes chained timers
  fire once a *minute*. A page script with several `await sleep()` calls
  then takes minutes, every later tool call queues behind it, and it looks
  exactly like a locked renderer - three "hangs" in one session were this.
  Put waits between tool calls, never inside the page, and dispatch keys on
  elements rather than trusting `computer` key presses to land.
