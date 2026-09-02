# Architecture

A map of Dienius for somebody - or some session - arriving cold. It answers
four questions: what the data is, where it lives, how a change flows through,
and which file to open for a given job.

For *why* the harder calls were made, see [`DECISIONS.md`](DECISIONS.md). This
file only describes what is there.

---

## 1. The shape of it in one paragraph

React 19 and TypeScript, built with Vite. No UI framework, no router, no state
library, no backend. The entire application state is **one object** in memory,
persisted as **one JSON string** in `localStorage`. Components read it through
`useSyncExternalStore`. Everything that is not a component - parsing, sorting,
scoring, stamping, capacity arithmetic, repeat generation, search, statistics -
is a plain function in `src/lib` or beside its widget, tested directly.

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
│       │                        repeatSkips?, autoApplied?
│       └── tasks: Task[]        the one type most of the app is about
├── library: LibraryList[]       name + unit + items
│   └── items: LibraryItem[]     title, total?, progress?, finished?
├── ifThens: IfThenEntry[]       trigger + action, never measured
├── inbox: InboxItem[]           one line of text, no date
└── settings: Settings           theme, sleepProfiles, weekdayTemplates,
                                 reminders, density, textScale, ...
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
| `category` | One of six; drives the colour everywhere it appears. |
| `core` | Counted on a non-full day. Set by a template, never by quick-add. |
| `unbounded` | Exempt from the two-push bound. |
| `pushCount` | How many days it has been carried. |
| `note`, `subtasks`, `highlight`, `repeat` | The task detail sheet (v1.1). |
| `libraryRef` | Which library item this is a session of. |
| `repeatOf` | The series source this was generated from (v1.3). |

**Dangling ids degrade, never crash.** A `templateId`, `libraryRef`,
`sleepProfileId` or `repeatOf` that resolves to nothing is treated exactly as
if it were absent. This contract is kept by every reader and is tested.

### What is *not* in `AppData`

Three things live under their own storage keys, on purpose, and none of them
is in a backup:

- **`dienius:clock-tools`** - the timer, stopwatch and focus session
  ([`clockTools.ts`](../src/lib/clockTools.ts)). A timer with ninety seconds
  left is not a plan worth restoring from last Tuesday.
- **`dienius:yesterday-dismissed`** - one date key. "I have seen this morning's
  banner" is a fact about this device today.
- **IndexedDB `dienius-snapshots`** - a week of daily full-state copies
  ([`snapshots.ts`](../src/lib/snapshots.ts)). A backup sharing a quota with the
  thing it backs up disappears exactly when the data grows enough to need it.

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
  Nothing else touches it. `validate()` is a deep, hand-written type guard: a
  payload that fails it is discarded whole rather than partly trusted, because
  this is also the import path for a file a person may have edited.
  `normalizeLoaded()` backfills every field added since, which is what makes an
  old backup still load.
- [`store.ts`](../src/lib/store.ts) is a flat list of actions over that object.
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
  main.tsx             mount, service worker, install prompt

  lib/                 no React except where a hook is the API
    types.ts           AppData and everything in it - start here
    storage.ts         localStorage boundary, validate, export/import
    store.ts           the actions
    stamping.ts        template + dates -> day plans
    repeats.ts         which days a series owes, and what an instance carries
    review.ts          week/month statistics, all derived, nothing recorded
    search.ts          the palette's linear scan and its date parsing
    snapshots.ts       the IndexedDB daily copies
    undo.ts            one app-wide undo offer, five seconds
    shortcuts.ts       the keyboard layer and its two safety rules
    install.ts         holds the one beforeinstallprompt event
    library.ts         units, progress, the typed-line parser
    dates.ts           date-key helpers, month grid
    categories.ts      the six categories; colours live in styles.css
    themes.ts          the three presets
    theme.ts           preset + overrides -> real CSS values
    contrast.ts        WCAG maths, used by the theme tests and --on-accent
    pushRules.ts       the two-push bound
    clockTools.ts      timer, stopwatch, focus session
    viewport.ts        the 1024px wide breakpoint

  views/               a tab, or a control shared between tabs
    CalendarView, TemplatesView, LibraryView, ReviewView, SettingsView
    CommandPalette, ShortcutsOverlay
    TimePicker         the one time control in the app
    MinuteStepInput    the one duration control
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
```

### The day view

`widgets/day-plan/` is the largest area, and `DayView.tsx` is its shell. What
it delegates:

| File | Job |
|---|---|
| `capacity.ts` | Waking windows, gaps, free time, the capacity sentence |
| `timelineLayout.ts` | Turning tasks into a drawable grid; density fitting |
| `TimelineGrid.tsx` | Drawing it, and the drag/resize gestures |
| `sort.ts` | The one order a day's tasks are shown in |
| `score.ts` | Done over planned, and how a non-full day is counted |
| `parse.ts` | Quick-add: "14:00 Call mum" -> a task |
| `gapPlacement.ts` | Which floats fit which gap |
| `dragDrop.ts` | Where a dropped block lands |
| `TaskRow.tsx` | One card |
| `TaskDetail.tsx` | Everything the card deliberately does not show |
| `TaskActionsSheet`, `TaskContextMenu` | The two menus |
| `YesterdayBanner.tsx` | What yesterday left |

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

## 6. Styling

**One stylesheet**, `src/styles.css`, ~6000 lines, organised by area with a
comment block per section. No CSS modules, no CSS-in-JS, no utility classes.

Everything is built from tokens declared once on `:root`:

- spacing `--s0`..`--s8`, radius `--r-chip/-control/-card/-pill/-round`
- four type sizes `--t-xs/sm/md/lg`, plus `--t-input` (the iOS zoom floor)
- three elevations `--e1/e2/e3`, motion `--dur-fast`, `--dur`, `--ease`
- the theme's own palette: `--bg`, `--surface`, `--text`, `--muted`, `--faint`,
  `--accent`, `--border`, ...

Two of those are *derived at runtime* rather than declared, in
`applyResolvedTheme`: `--safe-ink` (readable on `--surface`) and `--on-accent`
(readable on whatever accent is in force). Anything filled with `--accent` uses
`--on-accent` for its text; hard-coding white there failed AA badly.

Density and text size are two attributes on `<html>` (`data-density`,
`data-text-scale`) that redefine those scales at source - which is the entire
feature, and why nothing else has to know they exist.

### The pre-paint script

`index.html` carries an inline script that resolves and applies the theme
*before* React mounts, so a dark install never flashes light. It necessarily
duplicates the preset data and the resolution algorithm from `themes.ts` and
`theme.ts`. [`src/preTheme.test.ts`](../src/preTheme.test.ts) runs that exact
script text against the real functions for every preset and mode and fails on
any difference. **If you change a theme token, change it in both places** - the
test will tell you if you forget.

---

## 7. Tests

Vitest + Testing Library + jsdom. ~1170 tests, no worker limits, no skips.

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

## 8. Offline and updates

- `public/sw.js` is hand-written; `scripts/generate-sw.mjs` runs after the
  build, hashes every output file, and writes the cache name and precache list
  into it. A cache is therefore named after its own contents: any change means
  a new cache, and an installed copy can never be stuck on stale files.
- A new worker taking over fires `controllerchange`, which surfaces as the
  quiet "Reload" notice - never an automatic reload.
- Everything works with no connection, because there is nothing to connect to.

---

## 9. Conventions worth knowing before editing

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
