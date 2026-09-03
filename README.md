<h1 align="center">Dienius</h1>

<p align="center">A day planner for a brain that needs the plan to be visible or it stops existing. No account, no server, no streaks.</p>

<p align="center">
  <a href="https://quicasha.github.io/dienius/?demo=1"><strong>Try the live demo</strong></a>
  &nbsp;·&nbsp;
  <a href="https://quicasha.github.io/dienius/">Open the app</a>
  &nbsp;·&nbsp;
  <a href="docs/ARCHITECTURE.md">How it is built</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="React 19 + TypeScript" src="https://img.shields.io/badge/React_19-TypeScript-61dafb.svg">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-offline--first-5a0fc8.svg">
  <img alt="1400+ tests" src="https://img.shields.io/badge/tests-1400%2B-brightgreen.svg">
  <img alt="No dependencies at runtime" src="https://img.shields.io/badge/runtime_deps-react_only-lightgrey.svg">
</p>

<p align="center"><sub>The demo link fills a sample fortnight - a real-looking history, a half-read book, two goals - under its own storage key, thrown away when you leave. It never touches a real plan.</sub></p>

---

## In one paragraph

Dienius plans a day from **templates** you stamp onto dates instead of retyping
every morning, draws it as a **timeline** so the shape of the day is visible
rather than remembered, and keeps a **week view** for the question a day view
cannot answer. It is local-first: one JSON object in `localStorage`, no
account, no backend, works with no connection. Optional **sync** between your
own devices runs through a 200-line server you host yourself. Optional
**calendar subscriptions** lay your work meetings over the plan as a read-only
layer that free time actually counts.

What it deliberately does not have: streaks, points, badges, a score that
punishes a bad week, or any number that goes down when life happens. The
reasoning for each of those is written out in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

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
- Quick-add that asks for nothing - three parts on one line: a time control, the words, a length. Both controls open already holding an answer, so "Call mom" and Enter is a task at a real clock time for a real length, with no digits typed by hand. Type the time and the length inside the sentence if you would rather - "14:00 Call mom 45min" still parses - and the controls redraw to show what was understood, so the words and the controls are never two different plans
- A backlog - the fourth shelf, for something you have decided to do that is not for this week. It sits folded under the inbox with a plain count and nothing else: no age, no badge, no nudge, and nothing anywhere that could ever say how long something has been in it, because nothing records it. One press puts an item on the day at the next free slot that holds it, carrying its size and its colour, and takes it out of the backlog in the same press. Order is priority, and dragging is the whole of it
- An evening that ends - a quiet card at a time you set, or the moment the last thing on the list is ticked off. One sentence about the day, and "enough" is reachable every day: half of a real plan, or every key task. It never mentions what was not done, in any wording, in any colour. There is an optional line for the best moment of the day, asked once, kept with the day and shown on the calendar afterwards
- What yesterday left, said once: one row, one tap to move it forward. Never moved on its own overnight
- North - the few things the days are for. Up to four, each with what it is, why it matters and who it makes you. They have no progress, no deadline and nothing to tick, on purpose: showing how far along you are is what makes people ease off, and there is nothing here to ease off from. One appears under the day's title, quietly, rotating; after a day that got away, or on a Monday, one comes forward with its reason in full and never a word about how yesterday went
- A review of the week or the month - done per day, deep work per day, key tasks set against key tasks finished, what you read or watched, and a streak. Every figure computed from the days themselves, so there is nothing recorded that can drift from the plan it describes
- A capacity line - one sentence saying whether today fits: what's anchored, how much free time is left across how many gaps, what the floats still need
- A day timeline - anchored tasks at their real time and size, free gaps drawn as labeled regions, a line marking right now; collapsed until you open it
- Push twice, then decide - an unfinished task can move to tomorrow twice; after that it's finish it, delete it, or mark it ongoing
- Replan, for when the plan breaks - a call, a change, an afternoon gone. Say what came up and the app shows what it hits and where each of those goes: into the gaps after it, to tomorrow, or away. Or move everything from now on later by the same amount, with whatever no longer fits before sleep named rather than quietly lost. Or press Away, and the day pauses - nothing nudges you while you are gone, and one press when you are back fits what still fits into the time left, key tasks first. It never counts what was missed; a partial plan beats a dropped day
- A score with nothing riding on it - done over planned for today, nothing else; no percentage, no streak, no score on a day with no plan
- Day types and core tasks, so a twelve-hour shift isn't scored like an ordinary Tuesday
- Six task categories, one colour each - the same colour on the timeline block and on the card, so the eye pairs them without reading either; finished work drains to grey, so the day visibly goes quiet as it is worked through
- One screen, no scrolling - at the wide breakpoint the whole day fits the window, the grid drawing at whatever density that takes rather than overflowing
- What is happening now, in three places at once - a line across the timeline, a ring on the running block and its card, and the clock, the task and what is left of it in the header
- Focus - one task, its own planned time, a ring and a way out. Not a pomodoro: there is no length to choose and no timer to start, so closing it loses nothing
- A timer and a stopwatch that survive a refresh - stored as an instant and a length rather than a countdown, running as a floating widget on every tab, and able to tell you a timer finished eight minutes ago. It keeps time in a tab nobody is looking at, and puts the countdown in the tab title
- Task detail - one place for everything a card deliberately does not show: the exact minute with five-minute nudges, a note, sub-steps, a simple repeat, and the three-a-day "key task" mark. A panel on a wide screen, a bottom sheet you can swipe away on a phone, and a real right-click menu for the things done often
- A library - lists of things worked through a unit at a time, and the unit is the list's own word: chapters, episodes, lessons, sessions. Lists fold away and a chip row jumps between them; inside each, the thing you are actually on gets a card with its progress and its own pace note while everything behind it is one quiet line, because thirteen books drawn identically is a screen nobody can read. An item can be counted in the list's unit, in pages (typed, not stepped - nobody presses + fifty-four times), as a film with no numbers at all, or as seasons and episodes. A session goes onto a day in two taps and ticking it off advances the book; a recurring one goes onto a template in a single flow
- Sleep as a named schedule, not an assumption - one by default, and as many as somebody genuinely lives; a day or a template points at one, and the app never says the word until there are two to choose between
- An inbox - a mode on the same field, for catching a thought without deciding what day it belongs on
- Scratch - one key, or one floating button on a phone, and you are typing. For the phone number said once and the bug noticed while doing something else: nothing is asked at the moment of writing, every keystroke is already saved, and Escape loses nothing. Later, a note can become a task (through the same parser quick-add uses, so "14:00 Call the bank 20 min" lands timed and sized), an inbox line, or nothing. A line starting with "!" goes straight to the inbox as something to do instead, with a marker beside the box saying which it will be before you press Enter. A #word is a filter rather than a folder, and #bug notes export as a markdown list in one press
- A keyboard layer - single keys for the things done most often, and a card behind `?` that lists them. None of them fire while you are typing in a box, except Escape, which is usually how you leave the box
- Ctrl-K / Cmd-K - one box for running a command and for finding a thing: tasks, notes and library items, or a date typed in words. No search index, because a linear scan over the whole store costs less than the keystroke that triggered it
- A week view - seven columns of one shared timeline, so the question a day view cannot answer becomes a shape rather than a number. Drag a block onto another day, tap one to open it, tap an empty space to put something there, or lay your whole weekday plan over the week in one press. Three days at a time on a phone, because seven columns at 390px is a stripe rather than a block
- A calendar that fits without scrolling, where every past day says how it went - the ratio, a thin bar, what was carried on, a dot when every key task was kept. No red at any threshold: a past day is not on trial, and a day nobody planned stays blank rather than reading as a zero
- A year strip - one cell per day, shaded by how full it was, colored by template where there is one
- External calendars - subscribe to a work or family iCal feed, or import a .ics file. They appear on Today and on the week as a read-only layer, outlined rather than filled, with nothing to tick off and nothing to push: a meeting is not a task. Free time counts them, because a morning with three meetings in it is not a free morning
- A tour that leads you through the app rather than describing it - nine steps, each ending when you actually do the thing: stamp a day, add a task, mark it key, focus on it, tick it off, start a list, write a goal. Under two minutes, and what you make during it is yours to keep or throw away at the end. Reachable from the shortcut card, the command palette, or Settings, where it runs in a sandbox that never touches your plan. No step can trap you: one whose control is not on this screen moves on by itself, and one that has waited twenty seconds offers to do itself
- Three themes - Dark, Light and Midnight, each built to the same principles, with an accent colour, a density and a text size that work on all three. Every piece of text on every surface is measured against WCAG AA, not eyeballed

## Your data

Everything is written straight to `localStorage`. There's no account and no server to lose access to.

- **Export / Import** - Settings has a plain JSON backup, both ways. It is a deliberate manual step, not an automatic one - a backup only exists when you actually made it. A backup written by any earlier version still imports; every field added since is filled in with its default rather than rejected
- **Daily snapshots** - a full copy is kept once a day in IndexedDB, the last seven held, restorable from Settings. This covers the case a manual backup structurally cannot: the mistake you did not see coming. Erasing all data takes them with it
- **Undo** - deleting a task, removing a library item and stamping a template are all reversible for five seconds
- A running timer is the one thing deliberately kept out of the backup - it lives under its own key, because a timer with ninety seconds left is not a plan worth restoring from last Tuesday
- **Sync** is optional and off until you set it up - see below. Without it, each device keeps its own plan, and clearing site data on one loses that copy unless you exported first
- Updates install themselves the next time you open the app

---

## Sync between devices

Optional. The app is local-first and stays that way: sync is a layer on top, and everything works with the server off, unreachable, or never set up.

There is no hosted service and no account. You run a small server on a machine you own, and your devices copy changes through it. It is about 200 lines, has no dependencies, and never gets any.

### Run it

```bash
node server/sync-server.mjs
```

On first run it writes `data/token.txt`, prints the token, and listens on port 8787. Options: `--port`, `--data <dir>`, and `--origin <url>` to allow an origin beyond the built-in list (localhost dev/preview and `https://quicasha.github.io`).

Then on each device: **Settings → Sync**, paste the server URL and that token, and turn it on. It pulls when you open the app, pushes a couple of seconds after each change, and retries on its own when the connection comes back.

### Autostart on Windows

Run it at logon, no window:

```bash
schtasks /create /tn "Dienius sync" /tr "node \"C:\path\to\dienius\server\sync-server.mjs\"" /sc onlogon /rl highest
```

Check it with `schtasks /query /tn "Dienius sync"`, stop it with `/end`, remove it with `/delete /f`.

### Reaching it from the phone

Do not open the port to the internet. Install [Tailscale](https://tailscale.com) on the PC and the phone and sign both into the same account: the two machines can then reach each other from anywhere, over an encrypted link, with nothing exposed publicly.

The address has to be **https**, not the plain `http://100.x.y.z:8787` one. The app is served from GitHub Pages over HTTPS, and a page on HTTPS is not allowed to call an HTTP endpoint - the browser blocks the request before it leaves, with nothing in the network log to explain it. Tailscale hands out a real certificate for this, so put it in front of the server:

```bash
tailscale serve --bg 8787
```

That prints an address like `https://your-pc.your-tailnet.ts.net`, and that is what goes in the server field. It needs MagicDNS and HTTPS certificates switched on in the Tailscale admin console, both of which are one toggle each.

The plain `http://100.x.y.z:8787` form still works when the app itself is being served over HTTP - a local `npm run dev`, or a copy you host yourself without TLS.

When the PC is asleep the phone simply says so and catches up later.

### What syncs, and what does not

Tasks, day plans, templates, library, goals, if-then entries, the inbox and your settings all sync. Snapshots do not - they are this device's backup of its own history, and a backup that follows the same wire as the data it protects is not a backup. A running timer does not either.

Merging is per entity, so a morning on the phone and an evening on the PC both survive; only the same task edited on both loses one version, and the later edit wins. Deletes stick rather than coming back from the other device. If the server ever answers with something that is not a plan, nothing local is touched and Settings says so.

---

## Under the hood

React 19 and TypeScript, built with Vite. No UI framework, no state management library - app state is one object behind a `useSyncExternalStore` store, persisted straight to `localStorage`. The only server anywhere is the optional sync box above, which stores a file and has no idea what a task is.

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
    syncEntities.ts  splits state into addressable entities, stamps what changed
    syncMerge.ts     the per-entity merge, and what counts as a state at all
    syncClient.ts    pull, merge, push - debounced, retrying, never blocking
    ics.ts           a small iCalendar reader; no library, and none wanted
    calendars.ts     external feeds: the local cache, and what counts as busy
    demo.ts          the sample fortnight, built from one date
    demoMode.ts      whether this tab is on sample data, and which key it uses
    scratch.ts       the scratch stream: tags, filtering, the #bug export
    tour.ts          the tour as data - the steps, and what ends each one
    tourState.ts     whether a tour is running, and where it got to
    tourMode.ts      the replay sandbox, and which key it uses
    replanState.ts   the one line between the palette and the replan sheet
  views/          Calendar, Templates, Library, Review, Settings, CommandPalette,
                  TimePicker, TimeColumns, ShortcutsOverlay
    scratch/      the scratch overlay and the floating button that opens it
    tour/         the tour engine: a spotlight, a card, and a predicate
    week/         the week view: seven columns of one shared timeline, and the
                  percentage geometry that makes it fit any screen
  widgets/
    day-plan/     the day view: quick-add, sort order, capacity, the timeline grid, drag and drop, the score, the task detail sheet, and replan.ts - the arithmetic of a day that broke
    if-then/      the if-then board and its day-type/time-of-day rotation
    year-strip/   the year-at-a-glance strip and the module that colors it
    clock/        the timer popover, the floating widget and the focus-work nudge
    registry.ts   which widgets are enabled on the day view
  App.tsx         tab navigation and the current view/date
server/
  sync-server.mjs   the optional sync server: no dependencies, one JSON file,
                    atomic writes, a token and an origin allowlist
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

## Demo mode

`?demo=1` on any Dienius URL, or **Try it with a sample week** on the first-run
screen, fills the app with a plausible fortnight: a real-looking history where
one day went badly, a half-read book, two goals, a carried task, an inbox with
something in it.

It writes to `dienius:demo`, never to `dienius:data`. That is the whole
isolation and it is deliberately structural rather than a flag: a bug while
somebody is poking at the sample week cannot touch a real plan, because the
real plan is not the file that is open. Sync is skipped and no daily snapshot
is written while it is on. **Leave demo** throws the sample data away.

## License

[MIT](LICENSE).
