<h1 align="center">Dienius</h1>

<p align="center">A day planner for a brain that needs the plan to be visible or it stops existing. No account, no server, no streaks.</p>

<p align="center"><a href="https://quicasha.github.io/dienius/"><strong>Open the app</strong></a></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="React 19 + TypeScript" src="https://img.shields.io/badge/React_19-TypeScript-61dafb.svg">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-offline--first-5a0fc8.svg">
</p>

<p align="center"><sub>Screenshots are being re-taken after the v1.0 interface rebuild - the live app above is the current one.</sub></p>

---

## Install

- **iPhone / iPad** - open the link in Safari → **Share** → **Add to Home Screen**
- **Android** - open it in Chrome → **⋮** → **Install app**, or use **Install on this device** in the app's own Settings
- **Desktop** - Chrome and Edge show an install icon in the address bar; **Install on this device** in Settings does the same thing

Takes half a minute. After that it runs full-screen with no browser around it,
works with no connection at all, and keeps its data on that device. Settings
says which of the three cases you are in rather than showing a button that
might do nothing - iOS has no programmatic install, so there it tells you
where the Share button is instead.

A new version installs itself in the background and says so with a quiet
"Reload" notice rather than swapping the page out from under you. Nothing is
cached across versions: every build's cache is named after a hash of its own
contents, so an installed copy can never get stuck on stale files.

## What it does

- Reusable day templates - a named, colored set of time blocks stamped onto calendar dates by clicking or dragging; nothing commits until you save
- A template per weekday, so a new day opens already set up - a stamp by hand always wins, and deleting what arrived leaves it deleted
- Repeating tasks that actually repeat - daily, weekdays or weekly, generated onto each day as real tasks you can tick, move and edit, with "just this day" and "every day it repeats" as a standing choice rather than a dialog
- What yesterday left, said once: one row, one tap to move it forward. Never moved on its own overnight
- North - the few things the days are for. Up to four, each with what it is, why it matters and who it makes you. They have no progress, no deadline and nothing to tick, on purpose: showing how far along you are is what makes people ease off, and there is nothing here to ease off from. One appears under the day's title, quietly, rotating; after a day that got away, or on a Monday, one comes forward with its reason in full and never a word about how yesterday went
- A review of the week or the month - done per day, deep work per day, key tasks set against key tasks finished, what you read or watched, and a streak. Every figure computed from the days themselves, so there is nothing recorded that can drift from the plan it describes
- A capacity line - one sentence saying whether today fits: what's anchored, how much free time is left across how many gaps, what the floats still need
- A day timeline - anchored tasks at their real time and size, free gaps drawn as labeled regions, a line marking right now; collapsed until you open it
- Push twice, then decide - an unfinished task can move to tomorrow twice; after that it's finish it, delete it, or mark it ongoing
- A score with nothing riding on it - done over planned for today, nothing else; no percentage, no streak, no score on a day with no plan
- Day types and core tasks, so a twelve-hour shift isn't scored like an ordinary Tuesday
- Six task categories, one colour each - the same colour on the timeline block and on the card, so the eye pairs them without reading either; finished work drains to grey, so the day visibly goes quiet as it is worked through
- One screen, no scrolling - at the wide breakpoint the whole day fits the window, the grid drawing at whatever density that takes rather than overflowing
- What is happening now, in three places at once - a line across the timeline, a ring on the running block and its card, and the clock, the task and what is left of it in the header
- Focus - one task, its own planned time, a ring and a way out. Not a pomodoro: there is no length to choose and no timer to start, so closing it loses nothing
- A timer and a stopwatch that survive a refresh - stored as an instant and a length rather than a countdown, running as a floating widget on every tab, and able to tell you a timer finished eight minutes ago. It keeps time in a tab nobody is looking at, and puts the countdown in the tab title
- Task detail - one place for everything a card deliberately does not show: the exact minute with five-minute nudges, a note, sub-steps, a simple repeat, and the three-a-day "key task" mark. A panel on a wide screen, a bottom sheet you can swipe away on a phone, and a real right-click menu for the things done often
- A library - lists of things worked through a unit at a time, and the unit is the list's own word: chapters, episodes, lessons, sessions. A session on one goes onto a day in two taps, and ticking it off advances the book. A template block can bind to a list, so Tuesday's reading hour arrives already naming the actual book
- Sleep as a named schedule, not an assumption - one by default, and as many as somebody genuinely lives; a day or a template points at one, and the app never says the word until there are two to choose between
- An inbox - a mode on the same field, for catching a thought without deciding what day it belongs on
- A keyboard layer - single keys for the things done most often, and a card behind `?` that lists them. None of them fire while you are typing in a box, except Escape, which is usually how you leave the box
- Ctrl-K / Cmd-K - one box for running a command and for finding a thing: tasks, notes and library items, or a date typed in words. No search index, because a linear scan over the whole store costs less than the keystroke that triggered it
- A calendar that fits without scrolling, where every past day says how it went - the ratio, a thin bar, what was carried on, a dot when every key task was kept. No red at any threshold: a past day is not on trial, and a day nobody planned stays blank rather than reading as a zero
- A year strip - one cell per day, shaded by how full it was, colored by template where there is one
- Three themes - Dark, Light and Midnight, each built to the same principles, with an accent colour, a density and a text size that work on all three. Every piece of text on every surface is measured against WCAG AA, not eyeballed

## Your data

Everything is written straight to `localStorage`. There's no account and no server to lose access to.

- **Export / Import** - Settings has a plain JSON backup, both ways. It is a deliberate manual step, not an automatic one - a backup only exists when you actually made it. A backup written by any earlier version still imports; every field added since is filled in with its default rather than rejected
- **Daily snapshots** - a full copy is kept once a day in IndexedDB, the last seven held, restorable from Settings. This covers the case a manual backup structurally cannot: the mistake you did not see coming. Erasing all data takes them with it
- **Undo** - deleting a task, removing a library item and stamping a template are all reversible for five seconds
- A running timer is the one thing deliberately kept out of the backup - it lives under its own key, because a timer with ninety seconds left is not a plan worth restoring from last Tuesday
- No sync between devices - clear site data on this one and it's gone unless you exported first
- Updates install themselves the next time you open the app

---

## Under the hood

React 19 and TypeScript, built with Vite. No UI framework, no state management library - app state is one object behind a `useSyncExternalStore` store, persisted straight to `localStorage`. No backend of any kind.

```
src/
  lib/
    types.ts         AppData, Template, Task, DayPlan, Settings, IfThenEntry
    storage.ts       load/save/validate against localStorage, export/import JSON
    store.ts         the actions - addTask, stamp, rolloverUnfinished - and the push bound
    stamping.ts      turns a template plus a set of picked dates into day plans
    dates.ts         date-key helpers and the calendar month grid
    colors.ts        the one color palette, shared by templates and if-then tags
    themes.ts        the three themes and the principles all of them are built to
    categories.ts    the six task categories; the colours themselves live in styles.css
    clockTools.ts    the timer and the stopwatch, under their own storage key
    library.ts       the library's own arithmetic - units, progress, the typed line
    shortcuts.ts     the keyboard layer, and the two rules that make bare keys safe
    install.ts       holds the one install prompt a browser will hand over
    repeats.ts       which days a series owes, and what an instance carries
    review.ts        the week and month statistics, all derived, nothing stored
    search.ts        the palette's linear scan, and typing a date in words
    snapshots.ts     the daily IndexedDB copies
    undo.ts          one app-wide undo offer, five seconds
    theme.ts         resolves a preset plus its overrides into real CSS values
    theme-color.ts   keeps <meta name="theme-color"> in sync with the active theme
    contrast.ts      the WCAG contrast gate the theme tests run
    pushRules.ts     the two-push bound and the ongoing exemption
  views/          Calendar, Templates, Library, Review, Settings, CommandPalette,
                  TimePicker, ShortcutsOverlay
  widgets/
    day-plan/     the day view: quick-add, sort order, capacity, the timeline grid, drag and drop, the score, the task detail sheet
    if-then/      the if-then board and its day-type/time-of-day rotation
    year-strip/   the year-at-a-glance strip and the module that colors it
    clock/        the timer popover, the floating widget and the focus-work nudge
    registry.ts   which widgets are enabled on the day view
  App.tsx         tab navigation and the current view/date
scripts/
  generate-sw.mjs   runs after the production build; hashes the output and writes the
                    versioned cache name and precache list into public/sw.js
public/
  manifest.webmanifest   PWA manifest
  icons/                 app icons, including the maskable one
  sw.js                  hand-rolled; generate-sw.mjs writes its cache name and precache list
```

Logic that doesn't need a component - parsing, sorting, scoring, stamping, capacity, date math - is written as plain, independently tested functions rather than folded into the components that call them. A large, growing suite, run with Vitest and Testing Library, covers the pure modules directly and the views through user-facing interaction - `npm test` reports the current count rather than a number here going stale with the next feature commit.

The service worker in `public/sw.js` is hand-written rather than generated, and `scripts/generate-sw.mjs` versions its cache from a hash of the build output on every deploy, so an installed copy never gets stuck on stale files.

A map of the whole thing - the data model, how state flows, which file to open for which job - is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

The reasoning behind the harder calls - why templates instead of recurring tasks, why the push bound stops at two, why there's no streak anywhere - is written out, including what each one costs, in [`docs/DECISIONS.md`](docs/DECISIONS.md). The evidence behind the if-then board and the push rule, and what the research says not to build, is in [`docs/RESEARCH-ADHD.md`](docs/RESEARCH-ADHD.md).

## Run locally

```bash
npm install
npm run dev       # dev server at localhost:5173
npm test          # vitest, watch mode
npx tsc --noEmit  # typecheck
npm run build     # typecheck, build, then generate the service worker
```

Requires Node 22 or newer (see `.nvmrc`).

**Deploy** - push to `main`. GitHub Actions runs the full test suite, then builds - which typechecks before it bundles - and only publishes to GitHub Pages if both steps succeed. Workflow in `.github/workflows/deploy.yml`.

## License

[MIT](LICENSE).
