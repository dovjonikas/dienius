# Architecture

A map of Dienius for somebody - or some session - arriving cold. It answers
four questions: what the data is, where it lives, how a change flows through,
and which file to open for a given job.

Read [`STATE.md`](STATE.md) first for where the project currently is and what
is still owed, and [`CONVENTIONS.md`](CONVENTIONS.md) for the rules work here
follows. For *why* the harder calls were made, see
[`DECISIONS.md`](DECISIONS.md). This file only describes what is there.

---

## 1. The shape of it in one paragraph

React 19 and TypeScript, built with Vite. No UI framework, no router, no state
library. The entire application state is **one object** in memory, persisted as
**one JSON string** in `localStorage`. Components read it through
`useSyncExternalStore`. Everything that is not a component - parsing, sorting,
scoring, stamping, capacity arithmetic, repeat generation, search, statistics,
the week's geometry, iCalendar - is a plain function in `src/lib` or beside its
widget, tested directly.

Two optional layers sit on top and neither is a dependency: **sync** between
your own devices, through a server of under three hundred lines you host (section 7), and
**external calendars**, read-only and laid over the plan (section 12). With
both off - the default - nothing degrades.

---

## 2. The data model

Everything hangs off one type, `AppData` in [`src/lib/types.ts`](../src/lib/types.ts).
That file is the place to start reading; every field carries a doc comment
explaining what absent means, because absent is a real state almost everywhere.

```
AppData
├── templates: Template[]        a named, coloured set of blocks
│   └── blocks: TemplateBlock[]  time?, title, minutes?, core?, category?,
│                                unbounded?, libraryListId?
├── days: Record<dateKey, DayPlan>
│   └── DayPlan                  templateId?, dayType?, sleepProfileId?,
│       │                        repeatSkips?, autoApplied?, away?,
│       │                        bestMoment?
│       └── tasks: Task[]        the one type most of the app is about
├── library: LibraryList[]       name + unit + items, colour?
│   └── items: LibraryItem[]     title, total?, progress?, finished?,
│                                track? (pages/movie/series), pace?, season?
├── goals: Goal[]                directions, never measured - see §6
├── categories: Category[]      what a day is made of; the owner's, not the app's
├── ifThens: IfThenEntry[]       trigger + action, never measured
├── inbox: InboxItem[]           one line of text, no date
├── backlog: BacklogItem[]       decided, undated, in priority order
├── scratch: ScratchNote[]       the stream under everything, text and an instant
├── settings: Settings           theme, sleepProfiles, weekdayTemplates,
│                                reminders, eveningClose, density, ...
├── settingsUpdatedAt            per-field stamps for the sync merge - section 7
└── tombstones                   what was deleted, and when, so a delete sticks
```

A **date key** is `YYYY-MM-DD`, always. It sorts lexically, which is why ranges
and comparisons throughout the app are plain string comparisons.

### The `Task`

Almost every feature since v1.0 is a field on `Task`, and each is optional so
that data written before it existed still loads:

| Field | Means |
|---|---|
| `time` | An *anchor* - it happens at a clock time. Absent is a *float*. |
| `minutes` | Its size. Absent is unsized, not zero. |
| `category` | One of `AppData.categories`; drives the colour everywhere it appears. A dangling id degrades like every other. |
| `core` | Counted on a non-full day. Set by a template, never by quick-add. |
| `unbounded` | Exempt from the two-push bound. |
| `pushCount` | How many days it has been carried. |
| `note`, `subtasks`, `highlight`, `repeat` | The task detail sheet (v1.1). |
| `libraryRef` | Which library item this is a session of. |
| `repeatOf` | The series source this was generated from (v1.3). |
| `origin` | Where it came from - template, repeat or manual (v1.4). |

**`origin` is a task's identity across days.** The pair
`(sourceId, blockId)` says that a template block stamped onto Tuesday and the
same block pushed from Monday are the same intention. Without it they were two
unrelated rows, which is how a day ended up holding two of everything with the
timeline drawing them as a clash. Everything that adds tasks to a day goes
through `addWithoutDuplicates`; a manual task deliberately has no identity,
because two tasks called "Call the bank" on one day are two calls.

**Dangling ids degrade, never crash.** A `templateId`, `libraryRef`,
`sleepProfileId`, `repeatOf` or `category` that resolves to nothing is treated
exactly as if it were absent. This contract is kept by every reader and is
tested.

`category` joined that list when categories became the owner's to author. It
used to be a closed union of six ids that `validate` could refuse anything
outside; an id from `crypto.randomUUID()` cannot be checked against a list
nobody wrote, so the three fields that point at one - on `Task`,
`TemplateBlock` and `BacklogItem` - are `optional(text(1, 64))` now. That is a
loosening, and it is the deliberate one: a number, an object or an empty
string in that field still fails the whole payload.

### What is *not* in `AppData`

A handful of things live under their own storage keys, on purpose, and none
of them is in a backup. The ones that hold something worth knowing about:

- **`dienius:clock-tools`** - the timer, stopwatch and focus session
  ([`clockTools.ts`](../src/lib/clockTools.ts)). A timer with ninety seconds
  left is not a plan worth restoring from last Tuesday.
- **`dienius:yesterday-dismissed`** - one date key. "I have seen this morning's
  banner" is a fact about this device today.
- **IndexedDB `dienius-snapshots`** - a week of daily full-state copies
  ([`snapshots.ts`](../src/lib/snapshots.ts)). A backup sharing a quota with the
  thing it backs up disappears exactly when the data grows enough to need it.
- **`dienius:sync`** - the sync server's address, token and on/off
  ([`syncClient.ts`](../src/lib/syncClient.ts)). Syncing the address of the
  sync server is circular, and a token is a device's own credential.
- **`dienius:quick-add-duration`** - how long the next quick-added task is
  assumed to take
  ([`quickAddPrefs.ts`](../src/widgets/day-plan/quickAddPrefs.ts)). A device
  habit rather than a plan: restoring a week-old snapshot has no business
  changing which chip is lit, and a phone and a laptop are allowed to
  disagree about it.
- **`dienius:cloud-backup`** - the GitHub repo, the token and the time of
  the last copy ([`cloudBackup.ts`](../src/lib/cloudBackup.ts)). The token is
  a device's own credential and must never travel; a test holds that it is in
  no export and no sync payload.
- **`dienius:calendars`** - the events fetched from external feeds
  ([`calendars.ts`](../src/lib/calendars.ts)). The *subscriptions* live in
  settings and do sync; what they contain is refetched per device, because a
  week of somebody's work meetings is not a plan worth carrying in a backup and
  is stale the moment it is written.

And a few device-local preferences under their own keys for the same
reason, each explained where it lives: the evening close's and the yesterday
banner's dismissals for the day, the quick-add draft, which library lists are
folded and what each was last counted in, where the scratch button sits, and
the tour's progress.

And one key that is a whole separate copy of everything:

- **`dienius:demo`** - the sample fortnight
  ([`demoMode.ts`](../src/lib/demoMode.ts)). Demo mode is a different file
  rather than a flag inside the same one, which is the only version of the
  isolation that is actually safe: a bug while somebody is poking at the sample
  week cannot touch a real plan, because the real plan is not the file that is
  open. `loadData` picks the key; nothing else in the app knows.

---

## 3. State flow

```
localStorage ──loadData()──> validate() ──> normalizeLoaded() ──> AppData
                                                                    │
                                                    ┌───────────────┤
                                                    │               │
                                            useAppData()      actions.*
                                            (components)     (the writers)
                                                    │               │
                                                    └───> commit() ─┘
                                                            │
                                                    saveData() + notify listeners
```

- [`storage.ts`](../src/lib/storage.ts) owns the boundary with `localStorage`.
  Nothing else touches it. `validate()` - in
  [`validate.ts`](../src/lib/validate.ts), as one table per entity - is a
  deep type guard: a payload that fails it is discarded whole rather than
  partly trusted, because this is also the import path for a file a person
  may have edited.
  `normalizeLoaded()` backfills every field added since, which is what makes an
  old backup still load.
- [`store.ts`](../src/lib/store.ts) is the facade over that object: one `actions`
  object spread together from ten area modules under [`store/`](../src/lib/store),
  each reading through `getData()` and writing through `commit()` in `store/core.ts`.
  Every one is `commit(next)`: replace the whole object, save, notify. There
  are no reducers and no action types - the function *is* the action.
- Components never mutate. They call an action and re-render from the store.

### Reading it in a component

```tsx
const data = useAppData()          // subscribes; re-renders on any commit
actions.addTask(date, 'Call mum')  // writes; everything subscribed updates
```

`getData()` is the same object without subscribing - for event handlers and
anything outside React.

---

## 4. Where things live

```
src/
  App.tsx              the shell: tabs, the keyboard layer, everything that
                       must outlive a tab change (focus bar, timer, palette,
                       undo toast, reminders)
  main.tsx             mount, service worker, install prompt, sync, the cloud copy
  pwa.ts               registers the worker in production, raises the update notice
  UpdateNotice.tsx     the quiet Reload line; never reloads on its own
  ErrorBoundary.tsx    the one screen that says something broke, with the way out

  lib/                 no React except where a hook is the API
    types.ts           AppData and everything in it - start here
    storage.ts         localStorage boundary, load/save, migrations, export/import
    validate.ts        the deep type guard, as tables: one per entity, a field and what it may hold
    store.ts           the facade: `actions` spread from the ten areas below core.ts
    store/
      core.ts          the one object, commit(), the subscriptions, dayOf/withDay
      days.ts          tasks and the day: details, pushes, the grid's moves, replan
      library.ts       lists, items, progress, sessions onto days and templates
      templates.ts     templates, stamping, the weekday map
      goals.ts         North's goals and settings
      backlog.ts       the inbox and the backlog, and the doors between them
      scratch.ts       the scratch stream and its two ways out
      calendars.ts     external calendar subscriptions
      settings.ts      theme, density, sleep schedules, reminders, the day view's switches
      ifThen.ts        if-then rules
      categories.ts    the category list, and the delete that moves what it would orphan
      lifecycle.ts     import, snapshot restore, the tour's two endings
    stamping.ts        template + dates -> day plans
    repeats.ts         which days a series owes, and what an instance carries
    review.ts          week/month statistics, all derived, nothing recorded
    north.ts           goals: rotation, ages, and when one comes forward
    eveningClose.ts    how a day ends, and what may be said about it
    dayStats.ts        one past day, small enough for a calendar cell
    taskIdentity.ts    what makes two tasks the same task across days
    ics.ts             a small iCalendar reader; no library, and none wanted
    calendars.ts       external feeds: the local cache, and what counts as busy
    demoMode.ts        whether this tab is on sample data, and which key it uses
    demo.ts            the sample fortnight, built from one date
    scratch.ts         the scratch stream: tags, filtering, the #bug export
    tour.ts            the tour as data - the steps, and what ends each one
    tourState.ts       whether a tour is running, and where it got to
    tourMode.ts        the replay sandbox, and which storage key it uses
    tourAssist.ts      "do it for me": the real action behind a stuck step
    tourExit.ts        how the tour ends, from any of its three doors
    replanState.ts     the one line between the palette and the replan sheet
    captureRequest.ts  the same one line, for which shelf quick-add opens on
    syncEntities.ts    splitting state into entities, stamping, tombstones
    syncMerge.ts       the per-entity last-write-wins merge
    syncClient.ts      pull, debounced push, retry, and the status a person sees
    cloudBackup.ts     the third copy: the plan as JSON in a private GitHub repo, through the Contents API
    search.ts          the palette's linear scan and its date parsing
    snapshots.ts       the IndexedDB daily copies
    undo.ts            one app-wide undo offer, five seconds
    shortcuts.ts       the keyboard layer and its two safety rules
    install.ts         holds the one beforeinstallprompt event
    library.ts         units, progress, tracks, the typed-line parser, what the queue moves on to
    librarySeed.ts     the reading plan, on request from the palette - see its own comment
    libraryPrefs.ts    which lists are folded, and what each was last counted in, per device
    useClickAway.ts    closes a popover on a press outside it or Escape
    dates.ts           date-key helpers, month grid
    onboarding.ts      what a first run is: a pure read, no flag
    starterTemplates.ts  the three starter templates, offered and never installed
    colors.ts          the one palette templates and if-then tags pick from
    calendarCell.ts    what a month cell says about a past day
    theme-color.ts     keeps <meta name="theme-color"> with the active theme
    theme-preview.ts   the gallery's card, resolved the way the page is
    useSystemPrefersDark.ts  the live prefers-color-scheme reading
    categories.ts      the six the app ships, the lookups over the owner's list, and whether a picked colour will read
    themes.ts          the three presets
    theme.ts           preset + overrides -> real CSS values
    contrast.ts        WCAG maths, used by the theme tests and --on-accent
    pushRules.ts       the two-push bound
    clockTools.ts      timer, stopwatch, focus session
    viewport.ts        the 1024px wide breakpoint

  views/               a tab, or a control shared between tabs
    scratch/           the scratch overlay, and the floating button on a phone
    tour/              the tour engine: a spotlight, a card, a predicate
                       (cardPlacement.ts is its geometry, tested on its own -
                        jsdom has no layout)
    CalendarView, TemplatesView, LibraryView, ReviewView, SettingsView
    CommandPalette, ShortcutsOverlay
    TimeColumns        the two scrolling columns inside the time picker
    BackupSettings, SyncSettings, CalendarSettings, NorthSettings, CategorySettings   Settings sections
    week/              the week view - see section 11
    DemoBanner         the line that says none of this is real
    TimePicker         the one time control in the app
    MinuteStepInput    a length in minutes, typed or stepped
    DurationControl    the length control: a button holding an answer, chips, the stepper - and DurationChips, the chips alone
    CountStepInput     a count with arrows that speed up when held
    LibraryAddLine     the library's add line: the words, a unit control, a count control, one truth between them
    AppearanceControls, ThemeGallery, ThemePreviewCard
    useListReorder     pointer-and-keyboard reordering

  widgets/
    day-plan/          the day view and everything on it
    if-then/           the if-then board and its rotation
    year-strip/        the year-at-a-glance strip
    clock/             timer popover, floating widget, focus bar, nudges
    UndoToast.tsx      the one undo offer
    registry.ts        which widgets the day view mounts

  styles.css           the whole stylesheet. One file on purpose - see §6.

  test/
    setup.ts           what jsdom does not implement, stubbed once
    stress.ts          ratio measurement for the stress tests - CONVENTIONS §3

e2e/                   Playwright against the production build - CONVENTIONS §10
  app.ts               a first open, the starter stamp, a quick-add line
  smoke.e2e.ts         a first day end to end, and the reading plan from the palette
  tour.e2e.ts          the naive walk, on a desktop and on a phone
  sync.e2e.ts          two browser contexts through the real server: one task, then a tick against an edit with a delete between them
  demo.e2e.ts          the sample fortnight's first screen: fits, one notice, part-lived
  replan.e2e.ts        the three doors: something came up, shift the rest, away and back
  library.e2e.ts       a book bound to a template, on the day by name, advanced by a tick, and the next one named when it ends
  shelves.e2e.ts       a backlog pull onto the day; scratch's "!" and the #bug export
  rollover.e2e.ts      a night passes: the daily repeat is there, yesterday is pushed once
  week.e2e.ts          a block dragged onto another day, with a real mouse
  data.e2e.ts          export, erase, import; two snapshot restores; an .ics file over the day
playwright.config.ts   the two projects, and the preview server they run against
scripts/
  generate-sw.mjs      after the build: the service worker's cache name and precache list
  shots.mjs            `npm run shots`: the README's screenshots, from the demo under a pinned clock
  sweep.mjs            `npm run sweep`: every screen at three sizes in both themes, measured
  audit.js             the measuring pass sweep.mjs injects into the page - see tsconfig for why it is not typechecked
  sample-day.js        one realistic day in localStorage, for the sweep and for looking at the app with something in it
```

### The day view

`widgets/day-plan/` is the largest area, and `DayView.tsx` is its shell. What
it delegates:

| File | Job |
|---|---|
| `DayHeader.tsx` | Which day, what time, how it is going, the North line |
| `TaskPane.tsx` | The task column, and everything only it owns |
| `useDayDrag.ts` | The pointer machinery: move, resize, drop back to the list |
| `useTaskSelection.ts` | "Where does this fit", and focus afterwards |
| `useDoneAnimation.ts` | The beat a checked task holds before moving to Done |
| `useScrollEdges.ts` | Whether the task list has more above or below, so the mask can say so |
| `rollover.ts` | Pushable, held, or covered by tomorrow already |
| `capacity.ts` | Waking windows, gaps, free time, the capacity sentence |
| `timelineLayout.ts` | Turning tasks into a drawable grid; density fitting |
| `TimelineGrid.tsx` | Drawing it, and the drag/resize gestures |
| `sort.ts` | The one order a day's tasks are shown in |
| `score.ts` | Done over planned, and how a non-full day is counted |
| `QuickAdd.tsx` | Capture: a time control, the line, a duration control |
| `parse.ts` | Quick-add: "14:00 Call mum 45min" -> a task, and back again |
| `autoSlot.ts` | The time the field opens holding: the first gap that fits |
| `quickAddPrefs.ts` | The one thing capture remembers between sessions |
| `gapPlacement.ts` | Which floats fit which gap |
| `dragDrop.ts` | Where a dropped block lands |
| `TaskRow.tsx` | One card |
| `TaskDetail.tsx` | Everything the card deliberately does not show |
| `replan.ts` | A day that broke: conflicts, shifting, the rescue, and one writer |
| `ReplanSheet.tsx` | The three screens that ask, and the one press that applies |
| `TaskActionsSheet`, `TaskContextMenu` | The two menus |
| `Backlog.tsx` | The fourth shelf: decided, undated, pulled from |
| `EveningClose.tsx` | The end of the day, said once - tone is the feature |
| `YesterdayBanner.tsx` | What yesterday left |

`DayView.tsx` itself is now only about the day: what it is made of and how its
parts sit next to each other. It was 1238 lines before v1.5 and did four
unrelated jobs; the first six rows above are where those went.

---

## 5. The automatic parts (v1.3)

One function is responsible for everything a day gets on its own:

```ts
actions.ensureDay(date)   // called by DayView on mount and on every date change
```

It does two things, once, and records `autoApplied` so it never does them
again for that day:

1. **The weekday map.** `settings.weekdayTemplates[weekday]` names a template;
   the day is stamped from it - unless the day already has a `templateId`,
   because a deliberate stamp outranks a standing rule.
2. **Repeats.** `materialiseRepeats` finds every task with `repeat` and no
   `repeatOf` dated before this day, and adds an instance for each series the
   day applies to and does not already have.

Generation is idempotent three ways, each of which is a bug otherwise: a series
already present is not added twice, a series in the day's `repeatSkips` is not
resurrected, and a source dated on or after the day never reaches backwards.

`autoApplied` is what makes automatic a *starting point*: delete the template's
tasks or a repeat instance, and re-opening the day leaves it deleted.

---

## 6. North, and the one thing this app refuses to measure

Everything else in Dienius measures something. North does not, and the refusal
is the feature rather than a gap in it. If you are changing anything in
`north.ts`, `NorthLine.tsx` or `NorthCard.tsx`, this is the constraint:

**Never show progress toward a goal.** No percentage, no milestones, no target
date, no streak, no checkbox, no count of anything that goes up. The behaviour
this is built around is well established: shown how far they have come toward
something they care about, people ease off - a visible advance reads as licence
to spend it. Shown instead *why* it matters, the same person keeps going.
Progress framing and commitment framing pull in opposite directions, and a
progress bar is the purest possible progress framing.

So a goal carries three things and no numbers:

| Field | Question |
|---|---|
| `title` | What you are doing, short, imperative |
| `why` | What it is for, in your own words |
| `identity` | Who it makes you - "I am someone who ..." |

The one number allowed near a goal is its **age** - "32 days lived toward
this". It is a fact, not a measurement: it cannot be earned or lost, it does
not move faster when you try harder, and it means the same thing on a bad week
as on a good one. If a future change makes the age respond to how the days
went, it has become a score and must be removed.

Three more rules the feature holds to:

- **Four active, and the cap refuses.** Quietly evicting the oldest would make
  the cap invisible and the choice arbitrary.
- **Editing lives in Settings, deliberately far from the day.** Something you
  can rewrite from the screen you look at every morning is something you will
  rewrite on a bad morning, and a goal rewritten on bad mornings is a mood.
- **The card that appears after a slow day never mentions the slow day.** No
  count, no percentage, nothing red. The app knows exactly how it went and
  says none of it: the moment that card contains a number about the past it is
  a report card, and a report card from a planner is a planner people stop
  opening.

The same tone rule governs the calendar's day stats (`dayStats.ts`): no red at
any threshold, and a day nobody planned is its own case rather than a zero.

## 7. Sync, snapshots, and the copy on GitHub

Three copies, and each covers a loss the other two do not:

| Copy | Where | What it is for | What it cannot do |
|---|---|---|---|
| **Sync** (`syncClient.ts`, section below) | A server you host, reached from your devices | Two devices agreeing, live, all day | Survive both devices and the server going at once; work with no server |
| **Snapshots** (`snapshots.ts`) | IndexedDB on this device, seven kept | This device's own last week - the mistake you did not see coming | Leave the device |
| **Cloud backup** (`cloudBackup.ts`) | A private GitHub repo you own | Off-site, readable with a browser, on any device that reaches github.com - with sync off, on a phone with no VPN | Merge; it is a copy, whole, and restoring it replaces |

The cloud copy is written through GitHub's Contents API with nothing in
between: `data/state.json` is the latest plan, `data/history/YYYY-MM-DD.json`
that day's last copy, so a history accumulates one file a day and can be
opened on GitHub. Every write sends the file's current `sha`, the API's own
optimistic lock; a conflict (another device wrote in between) is answered by
reading the new sha and writing once more. It pushes after the evening
close, on the first open of a new day (fixing yesterday in its final state),
and on a button, spaced by ten minutes for the automatic two, never for the
button. The repo name and the fine-grained token (Contents read and write on
that one repo) live under `dienius:cloud-backup` on this device only - not
in `AppData`, so in no export, no sync payload and no snapshot, and a test
holds each absence. Restore reads the copy, describes it beside what is here
("340 tasks across 41 days, newest 4 Sept" against "empty"), and replaces
only on an armed second press.

### Sync

Optional, off by default, and deliberately not a dependency. Everything in
this app works with no server, no account and no connection; sync is a layer
that copies changes between two devices that both already work on their own.
If the server is down, unreachable, or was never set up, nothing degrades -
the app simply does not sync.

### The shape

One dumb server, owned by the person using it (a PC on a home network, reached
from a phone over Tailscale). It stores state and hands it back. It does not
merge, does not validate the plan, and has no idea what a task is.

```
  PC browser ─┐                         ┌─ GET  /state    read what is there
              ├──> sync-server.mjs <────┤
  phone PWA ──┘      state.json         └─ POST /state    write the merge back
```

A client's sync is one round trip: read the server's state, merge it into the
local one per entity, write the result back. Pull and push are the same
operation.

Sending only the entities that changed since the last sync would be less
traffic, and it was the first design. It was dropped because it needs each
client to remember what the server has already seen, and that bookkeeping is a
second kind of state that can go wrong - one missed acknowledgement and an
entity silently never travels. The whole state is a few hundred kilobytes on a
home network, and a client that sends everything every time cannot get out of
step. The merge is idempotent, so re-sending what the server already has costs
nothing but bytes.

### Why per-entity last-write-wins

The naive version - last write wins over the *whole state* - is unusable for
exactly the case this exists for. Tick three things off on the phone at
breakfast, edit a template on the PC that evening, and whichever saved second
erases the other's morning. Every entity therefore carries its own
`updatedAt`, and a merge takes the newer side **per entity**:

| Entity | Key | Why at this grain |
|---|---|---|
| Task | `task:<id>` | The thing that actually changes all day |
| Day meta | `day:<date>` | Template, day type, skips - changes rarely |
| Template | `template:<id>` | Blocks change together; splitting them buys nothing |
| Library list | `list:<id>` | Name and unit |
| Library item | `item:<id>` | Progress advances independently of the list |
| Goal | `goal:<id>` | |
| If-then | `ifthen:<id>` | |
| Inbox item | `inbox:<id>` | |
| Backlog item | `backlog:<id>` | |
| Scratch note | `scratch:<id>` | |
| Category | `category:<id>` | Renaming Health on the laptop and recolouring Meals on the phone are two edits to two things. This is exactly why the list is in `AppData` rather than in `Settings`: at a settings field's grain one of those two would simply vanish |
| Settings field | `setting:<field>` | So a theme on the PC and a sleep schedule on the phone do not fight |

One person, two devices, rarely at the same second: real conflicts are almost
nonexistent, and where they happen "the later edit wins" is both correct and
what anybody would expect. Nothing more elaborate is earned.

### Timestamps are written by diffing, not by hand

Sixty actions across `store/` all change something. Asking each of them to stamp
the right entity is sixty chances to forget, and the sixty-first action added
next year forgets by default.

Instead `commit()` - the one function every action ends in - diffs the state
going out against the state coming in, and stamps whatever actually changed.
It is O(entities) on a store of a few hundred, it cannot be forgotten, and it
is right for actions that do not exist yet. See `syncEntities.ts`.

### Deletion needs a tombstone

Without one, deleting a task on the phone and syncing means the PC - which
still has it - looks like the device with the newer information, and hands it
straight back. So a delete writes `tombstones[key] = timestamp`, which merges
by the same last-write-wins rule as anything else. Tombstones older than
`TOMBSTONE_TTL_DAYS` are pruned; a device offline for longer than that would
resurrect things, which is the honest trade for not growing the file forever.

The same `commit()` diff writes tombstones: an entity present before and
absent after is a deletion, whoever caused it.

### What does not sync

- **Snapshots** (`snapshots.ts`). They are a local safety net against a local
  mistake. Copying them between devices would make one device's bad afternoon
  restorable on the other, which is not what they are for.
- **The timer and stopwatch** (`clockTools.ts`), for the reason they are not
  in a backup either: a countdown is not state worth moving.
- **The sync settings themselves** - URL, token, enabled. Syncing the address
  of the sync server is circular, and a token is a device's own credential.
  They live under `dienius:sync` in `localStorage`.

The North card's dismissal *does* sync - `settings.northDismissedOn` -
because "I have read this today" is a fact about the person, not the device.
The field existed and was in `SYNCED_SETTINGS` from v1.4, and the card kept
reading a local key anyway until v1.11, when the docs audit noticed that
nothing wrote it.

Note the interaction with a **snapshot restore**. Restoring goes through
`actions.restoreState`, which commits, so the restore is stamped now and what
it removes is tombstoned. Left with the snapshot's own old timestamps it would
lose the next merge to whichever device still held the newer version, and would
silently undo itself seconds later. A restore is a decision about what the plan
should be, not an old copy arriving late.

### Two devices at once

There is no locking and there is not going to be. Two overlapping round trips
can end with the second write landing on a state that never saw the first, and
that is allowed, because nothing is ever lost *locally*: the device whose
change was overwritten still has it and puts it back on its next sync. The
worst case is a change that takes two syncs to arrive, not one that disappears.

### Conservatism

A server response that does not validate is ignored entirely and reported as
an error. Nothing local is ever deleted because the server disagreed - the
worst outcome of a broken server must be "no sync", never "no data".

New settings are a build error rather than a silent omission: `SYNCED_SETTINGS`
is checked for exhaustiveness against `keyof Settings` at compile time, so a
field added to settings either travels or is explicitly named as local.

## 8. Styling

**One stylesheet**, `src/styles.css`, about ten and a half thousand lines,
organised by area with a comment block per section. No CSS modules, no
CSS-in-JS, no utility classes. Everything is built from tokens declared once
on `:root`, two of them derived at runtime in `applyResolvedTheme`, and
density and text size are two attributes on `<html>` that redefine the
scales at source. The token list, the derived pair, the three theme presets
and the pre-paint script in `index.html` - and the rule that a theme token
changes in two places - are in [CONVENTIONS section 5](CONVENTIONS.md#5-design-tokens),
which is where the rule is kept so it is written once.

One selected-swatch rule, shared by all four round colour swatches - the
accent row in Appearance, the six categories, a template's own colour, a
library list's dot. Each sets `--pick` to its own colour and the shared rule
draws the ring: the fill, a two-pixel gap in `--surface`, a two-pixel ring in
`--pick`, as a box-shadow so choosing one never moves the row. It was four
different treatments until v2.0.1 - see DECISIONS, "One ring, for every
colour that can be chosen".

Two containment boundaries, and they are the only ones: `contain: layout
style` on `.quick-add-block` and on `.timeline-grid`. Typing changes
quick-add's subtree on every keystroke, and without a boundary that
invalidation walks out into the task list and the grid beside it - thousands
of boxes on a genuinely full day, measured at 66.7ms for the 95th percentile
frame under an 8x CPU throttle against 33.4ms with them. Never `paint`: the
time and duration panels are absolutely positioned and hang outside their
box on purpose, and paint containment would clip them. The grid layer is
already inert (aria-hidden, `pointer-events: none`), so nothing inside it
ever needed to influence anything outside it.

---

## 9. Tests

Vitest + Testing Library + jsdom. 1846 tests in 105 files, no worker limits, no skips; plus 23 Playwright tests in ten files against the production build (section 4's `e2e/`), and `npm run sweep` measuring every screen in a real browser (CONVENTIONS section 9).

Two kinds, deliberately:

- **Pure modules tested directly.** `capacity`, `timelineLayout`, `repeats`,
  `review`, `search`, `score`, `sort`, `parse`, `library`, `contrast`,
  `storage`. These are where the arithmetic lives and where a bug is cheapest
  to find.
- **Views tested through user-facing interaction** - roles and labels, not
  class names or internals. A test that reaches for `.task-title` breaks on a
  rename that changed nothing.

Test names are sentences about behaviour, and comments in test files explain
*why a rule exists*, not what the code does.

```bash
npm test          # watch
npx vitest run    # once
npx tsc --noEmit  # typecheck
npm run build     # typecheck, build, generate the service worker
```

---

## 10. Offline and updates

- `public/sw.js` is hand-written; `scripts/generate-sw.mjs` runs after the
  build, hashes every output file, and writes the cache name and precache list
  into it. A cache is therefore named after its own contents: any change means
  a new cache, and an installed copy can never be stuck on stale files.
- A new worker taking over fires `controllerchange`, which surfaces as the
  quiet "Reload" notice - never an automatic reload.
- Everything works with no connection, because there is nothing to connect to.

---

## 11. The week, and external calendars

### The week view

`views/week/` - a third mode in the Calendar tab rather than a seventh tab,
because the tab bar is already six items and already scrolls sideways at 390px.

| File | Job |
|---|---|
| `weekLayout.ts` | All the arithmetic: one shared axis, blocks as percentages, side-by-side lanes for overlaps |
| `WeekView.tsx` | The grid, the drag between days, stamping, the phone's three-day window |
| `WeekColumn.tsx` | One day: header, track, footer |

Two things are worth knowing before touching it:

- **Everything is a percentage of a grid row that takes the height it is
  given.** There is no pixel budget and no density fitting, which is why it
  fits 1920x1080, 1366x768 and 390x844 for the same reason. Do not introduce a
  measured height here.
- **A column is `display: contents`**, so its head, track and foot land in the
  grid's three rows directly - that is what aligns the hour axis with the
  tracks exactly. Each column states its `--week-col` index, because auto
  placement puts the first part in the axis's own column and shifts the whole
  week one day right.

Dragging a block to another day calls `actions.moveTaskToDay`, which is
deliberately **not** a push: `pushCount` is not incremented and `core` is not
cleared. Those describe a task that keeps failing to happen; moving an
appointment to the day it is actually on does not.

### External calendars

| File | Job |
|---|---|
| `ics.ts` | A small iCalendar reader. No library, and none wanted |
| `calendars.ts` | The local cache, what counts as busy, and fetching through the sync server |
| `views/CalendarSettings.tsx` | Subscribing, importing, refreshing, removing |

Events are a **layer, never entries**. There is nothing to tick off, nothing to
push, and no version of a meeting that counts towards a day's score. They draw
as a dashed outline in a strip down the right of the timeline - over the day's
own blocks rather than under them, because under hid the one case that matters,
a meeting clashing with something you planned.

Free time counts them: `computeCapacity` takes a `busy` argument and folds
those intervals into the same merged blocks the anchors make. They are reported
separately (`externalMinutes`) because "Timed tasks: 6h" would be a lie about a
day spent in somebody else's calendar. An all-day event is deliberately *not*
counted as busy.

Fetching goes through the sync server's `/ics` proxy, because a browser cannot
read a Google or Outlook feed itself - those hosts send no CORS headers. The
proxy refuses anything that is not http or https, and anything resolving to
localhost, a private range or the tailnet. Without sync there is no
subscribing, and Settings says so up front; file import is the way in.

The parser reads DTSTART, DTEND, DURATION, SUMMARY and RRULE: daily, weekly,
the plain monthly (the same day each month, one BYMONTHDAY or DTSTART's own
day, a month without that day having no occurrence) and the plain yearly
(the same date each year). Every other shape a rule can take - BYSETPOS, an
ordinal BYDAY, a negative day - is **named in `ignored` rather than
approximated**: a meeting shown on the wrong day is worse than one not shown
at all. A `TZID` is resolved through `Intl.DateTimeFormat`, which ships the
IANA tables, so a nine o'clock in New York lands where it falls on the
viewer's clock; a repeating event is expanded in its own zone and each
occurrence converted on its own day, so daylight-saving weeks come out right
on both sides. A zone name the browser does not know - Outlook's own "FLE
Standard Time" - is read as local and reported. Nothing in it throws.

---

## 12. Scratch, the tour, and replan

Three things added after the sync work, each small, each with the same shape:
a pure module that decides, and a component that only asks and shows.

### Scratch - `lib/scratch.ts`, `views/scratch/`

The layer under everything else, for text that has to be down in the next
second. The inbox is for a task with no day; this is for a line with nothing
attached at all - a number said once, a bug noticed while doing something
else.

`ScratchNote` is text, an instant, a date key and an optional `pinned`. It is
a sync entity at the same grain as an inbox line. Everything else is derived
from the text: a `#word` is a filter rather than a folder, so a note is never
moved by being tagged, and `bugExport` turns the `#bug` ones into a markdown
list for a bugfix prompt.

**The constraint is the feature, and it is in CONVENTIONS.md section 11.**
One stream, no folders, no rich text. A note that needs structure has stopped
being scratch: it becomes a task (through quick-add's own parser, so a time
and a size come out right), an inbox line, or nothing. Adding a field to
`ScratchNote` to hold structure is the wrong move; adding a way out is the
right one.

Capture is never gated: the `S` key (or the backtick) from anywhere, a
draggable button on a phone, or the palette. The overlay writes on the first
keystroke and rewrites on every one after, so there is no Save and leaving
loses nothing.

### The tour - `lib/tour.ts`, `views/tour/Tour.tsx`

The engine knows nothing about what it teaches. It walks a step array, points
at whatever selector the step names, and asks that step's predicate - over the
store - whether it has happened yet. Nine steps, each ending on a real action
rather than a Next button; the two ends are the exception, because a welcome
has nothing to do yet and an ending has nothing left.

The steps are data, in two arrays: desktop and mobile, the same nine in
different words. The whole thing is under 120 words and a test holds the
budget. **The tour is a mirror of the app and goes stale silently - see
CONVENTIONS.md section 13, which makes checking it part of every wave.**

Two ways to run it, and the difference is where it writes:

- **A new person** takes it on their real, empty plan. While it runs,
  `commit()` flags whatever appears with `tourCreated` - by the same diff that
  writes sync timestamps, so no action has to know the tour exists - and the
  last card offers *Keep what I built* or *Start clean*, which removes exactly
  the flagged entities.
- **A replay from Settings** runs in a sandbox: `dienius:tour`, an empty app
  wearing the person's theme, no sync, no snapshots, deleted on the way out.
  The same isolation demo mode uses, for the same reason.

The spotlight is four solid shades around the hole, positioned by transform
(`shadesAround` in `Tour.tsx`; it was one SVG path with an even-odd hole
until v1.11, which repainted the window on every move), and a ring that
glides; none of it catches a pointer event, so the app underneath stays
usable and the person operates the real control rather than a copy of it.

### Replan - `widgets/day-plan/replan.ts`, `ReplanSheet.tsx`

For the moment a plan breaks. The failure it guards against is not the broken
piece but what the brain does next - "the whole day is gone" - so the tone
rules in CONVENTIONS.md section 12 are as much of the contract as the
arithmetic.

Four pure functions produce one plan shape, and `applyPlan` is the only
writer:

| Function | Question |
|---|---|
| `findConflicts` | What does this new block land on |
| `planInterrupt` | Into the gaps after it, to tomorrow, or gone - per task |
| `planShift` | Everything from now, later, with the sleep boundary named |
| `planRescue` | Back after a while: what still fits, key tasks first |

`applyPlan` is idempotent, because sync can hand the same intention over from
two devices: a task already at its new time is unchanged, a task tomorrow
already has by identity is not added twice (the same `dayHas` check every
move between days uses), and the interruption is not re-added if its title
already sits at its time. One commit, one undo.

`DayPlan.away` is the pause. It lives on the day so it travels with it - two
devices cannot disagree about whether the day is paused - and while it is set
the task reminder does not fire.

## 13. Conventions worth knowing before editing

- **Absent is a state.** Optional fields mean something specific; check the doc
  comment before treating one as a default.
- **A dangling id is not an error.** Resolve it to nothing and carry on.
- **Comments explain the decision, not the mechanism.** If a line is surprising,
  the comment says what the obvious alternative was and why it lost.
- **No em dashes anywhere** - plain hyphens, in code, comments and copy.
- **Nothing is created until asked for.** The app ships empty; starter
  templates and starter library lists are *offers*.
- **Nothing is measured that would become a target.** No streak on the day
  view, no counter on an if-then rule. See `RESEARCH-ADHD.md`.

- **The tour is a mirror of the app.** It points at real controls with real
  selectors and goes stale silently. Every wave that changes the UI checks
  it, and a broken one is a P0 bug - CONVENTIONS.md section 13.
- **Scratch stays one stream** and **a partial plan beats a dropped day** are
  the two other standing rules added with those features - sections 11 and 12.

The full set - zero-scroll rules, design tokens, the button system, the test
policy, how a critique pass is run - is in
[`CONVENTIONS.md`](CONVENTIONS.md).
