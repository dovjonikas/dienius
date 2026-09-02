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

- **iPhone** - open the link in Safari → **Share** → **Add to Home Screen**
- **Android** - open it in Chrome → **⋮** → **Install app**

Takes half a minute. After that it runs full-screen and works fully offline.

## What it does

- Reusable day templates - a named, colored set of time blocks stamped onto calendar dates by clicking or dragging; nothing commits until you save
- A capacity line - one sentence saying whether today fits: what's anchored, how much free time is left across how many gaps, what the floats still need
- A day timeline - anchored tasks at their real time and size, free gaps drawn as labeled regions, a line marking right now; collapsed until you open it
- Push twice, then decide - an unfinished task can move to tomorrow twice; after that it's finish it, delete it, or mark it ongoing
- A score with nothing riding on it - done over planned for today, nothing else; no percentage, no streak, no score on a day with no plan
- Day types and core tasks, so a twelve-hour shift isn't scored like an ordinary Tuesday
- Six task categories, one colour each - the same colour on the timeline block and on the card, so the eye pairs them without reading either; finished work drains to grey, so the day visibly goes quiet as it is worked through
- One screen, no scrolling - at the wide breakpoint the whole day fits the window, the grid drawing at whatever density that takes rather than overflowing
- What is happening now, in three places at once - a line across the timeline, a ring on the running block and its card, and the clock, the task and what is left of it in the header
- Focus - one task, its own planned time, a ring and a way out. Not a pomodoro: there is no length to choose and no timer to start, so closing it loses nothing
- A timer and a stopwatch that survive a refresh - stored as an instant and a length rather than a countdown, running as a floating widget on every tab, and able to tell you a timer finished eight minutes ago
- An inbox - a mode on the same field, for catching a thought without deciding what day it belongs on
- A year strip - one cell per day, colored by template, a thin ring when everything planned got done
- Three themes - Dark, Light and Midnight, each built to the same principles, with an accent colour, a density and a text size that work on all three. Every piece of text on every surface is measured against WCAG AA, not eyeballed

## Your data

Everything is written straight to `localStorage`. There's no account and no server to lose access to.

- **Export / Import** - Settings has a plain JSON backup, both ways. It is a deliberate manual step, not an automatic one - a backup only exists when you actually made it. A backup written by any earlier version still imports; every field added since is filled in with its default rather than rejected
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
    theme.ts         resolves a preset plus its overrides into real CSS values
    theme-color.ts   keeps <meta name="theme-color"> in sync with the active theme
    contrast.ts      the WCAG contrast gate the theme tests run
    pushRules.ts     the two-push bound and the ongoing exemption
  views/          Calendar, Templates, Settings, ThemeGallery, AppearanceControls
  widgets/
    day-plan/     the day view: quick-add, sort order, capacity, the timeline grid, drag and drop, the score
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
