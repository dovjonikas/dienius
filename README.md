<h1 align="center">Dienius</h1>

<p align="center"><img src="docs/screenshots/hero.png" width="920" alt="A Wednesday afternoon in Dienius: the month and the templates in the rail, the timeline down the middle with the running block ringed, the task list on the right, the focus bar under the header"></p>

<p align="center"><strong>A day planner for a brain that needs the plan to be visible, or it stops existing.</strong></p>

<p align="center">
  <a href="https://quicasha.github.io/dienius/?demo=1"><strong>Try the demo</strong></a>
  &nbsp;·&nbsp;
  <a href="https://quicasha.github.io/dienius/">Open the app</a>
  &nbsp;·&nbsp;
  <a href="docs/DAILY.md">Set it up</a>
  &nbsp;·&nbsp;
  <a href="docs/ARCHITECTURE.md">How it is built</a>
  &nbsp;·&nbsp;
  <a href="docs/STATE.md">Where it stands</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="React 19 + TypeScript" src="https://img.shields.io/badge/React_19-TypeScript-61dafb.svg">
  <img alt="PWA, offline first" src="https://img.shields.io/badge/PWA-offline--first-5a0fc8.svg">
  <img alt="3,800+ tests" src="https://img.shields.io/badge/tests-3800%2B-brightgreen.svg">
  <img alt="Lighthouse accessibility 100 on a phone" src="https://img.shields.io/badge/Lighthouse-a11y_100-brightgreen.svg">
  <img alt="Accessibility: WCAG AA, keyboard throughout" src="https://img.shields.io/badge/a11y-AA_%2B_keyboard-4c1.svg">
  <img alt="No dependencies at runtime but React" src="https://img.shields.io/badge/runtime_deps-react_only-lightgrey.svg">
</p>

<p align="center"><sub>The demo fills a sample fortnight under its own storage key and throws it away when you leave. It never touches a real plan.</sub></p>

## Why it exists

One person uses this every day, on a computer at a desk and on a phone away
from it, through a rota of day shifts, nights and the days after them. The
plan has to be on the screen the moment the app opens, the morning after a
night has to show the night's own hours, and nothing may turn a bad day into
a verdict: no points, no streaks, no red. Every rule in the app comes from a
week that was actually lived, and the harder calls are written down with
what each one costs ([`docs/DECISIONS.md`](docs/DECISIONS.md)).

It is also a public portfolio piece, so it is built the way a professional
codebase is: typed end to end, tested at every layer, measured in a real
browser at both sizes before anything ships, and documented for whoever
picks it up next.

## What it does

- Stamps a **template** onto a day, so the morning does not start from a blank list
- Knows a **rota**: kinds of day - a day shift, a night, the night after a night, the day after nights - laid on dates with a roster that says what it will do before it does it; routines land on each kind at that kind's own time; a night's hours after midnight go on the morning after, and the evening close follows the kind
- Draws the day as a **timeline**, with free time labelled, sleep greyed out and a line at now
- Adds a task from one line: the time and the length are already filled in, you type the title
- **Replans** a broken day in one press: something came up - on today or any day this week, with one line saying when you are still free - shift the rest, or away and back
- Has a **low day** for when you do not feel like it: the key tasks stay at 40% of their length, the routine stays, the rest waits for tomorrow, and the day is scored on the key tasks alone
- Keeps a **Kitchen** of recipes by meal with their kcal and protein; a meal on the day names its recipe, or chooses one in two presses, and a whole text of recipes pastes in at once
- Keeps a **week view**, a **library** of books and series worked through a sitting at a time - a reading block on the day names the book you are on - and a **review** of how the weeks went, with one reading of where the plan and the week disagreed
- Takes a **note** in one line from any screen, holds **pictures** in it, and turns any note into a task; keeps a **journal** that asks nothing and counts nothing
- Takes the **templates, routines and roster as JSON** from wherever you write them, with a preview before anything changes; pasted again, today and the dates ahead follow the file and the past stays as it was lived
- Never scores a bad day against you: no points, no badges, no red, no streak on the day view

<table align="center">
  <tr>
    <td align="center"><img src="docs/screenshots/today-light.png" width="280" alt="Today, light theme"><br><sub><b>Today, light</b></sub></td>
    <td align="center"><img src="docs/screenshots/calendar-month.png" width="280" alt="Calendar, month"><br><sub><b>Month</b></sub></td>
    <td align="center"><img src="docs/screenshots/calendar-week.png" width="280" alt="Calendar, week"><br><sub><b>Week</b></sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/kitchen.png" width="280" alt="Kitchen"><br><sub><b>Kitchen</b></sub></td>
    <td align="center"><img src="docs/screenshots/library.png" width="280" alt="Library"><br><sub><b>Library</b></sub></td>
    <td align="center"><img src="docs/screenshots/review.png" width="280" alt="Review"><br><sub><b>Review</b></sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/north.png" width="280" alt="North"><br><sub><b>North</b></sub></td>
    <td align="center"><img src="docs/screenshots/today-dark.png" width="280" alt="Today, dark theme"><br><sub><b>Today, dark</b></sub></td>
    <td align="center"><img src="docs/screenshots/phone-today.png" width="140" alt="Today on a phone"><br><sub><b>On a phone</b></sub></td>
  </tr>
</table>

<p align="center"><sub>Every image is made by <code>npm run shots</code> from the sample fortnight, with the clock pinned to the same Wednesday afternoon. Running it twice gives the same files.</sub></p>

<details>
<summary><strong>The longer list</strong></summary>

- A template per weekday, so a new day opens already set up. A stamp by hand always wins
- A day template can be a kind of day: a letter for the roster, a sleep schedule of its own, and the kind it becomes on a date after a night. A ticked task is never lost to a change of kind
- Repeating tasks: daily, weekdays or weekly, made into real tasks you can tick and move
- Quick-add: a time control, the words, a length. "14:00 Call mom 45min" parses too, and the controls redraw to match
- Three shelves for what is not on the day: notes (one key, nothing asked), Later - a list with no dates and no ages, in the order you would pull from it - and a float on a day with no time
- Push twice, then decide: an unfinished task moves to tomorrow twice, after that you finish it, drop it, or mark it ongoing
- Blocks that end by themselves: a shift, a commute, anything ongoing is done once its end has passed, unless you say it did not happen
- What yesterday left, said once in a banner, moved forward in one tap, never on its own
- An evening close: one sentence about the day, half an hour before the sleep that ends it - a night the morning after, on the morning's page - or when the last thing is ticked, and never while a shift runs. It never mentions what was not done
- North: your own text, read every morning - an introduction on a plate, every heading on a card with its lines, a signature - with one line of it under the day's title and a window over the day after a night's sleep. Nothing measured, ever
- Focus: the running task, its own planned time, a ring, a way out. Not a pomodoro
- A timer and a stopwatch that survive a refresh and run on every tab; Time this on a task offers to record what it actually took
- Task detail: the exact minute, the length, the category, the key mark, the repeat, the list a reading block draws from or a meal's recipes, a link, the note
- Six categories to start, then your own: renamed, recoloured, reordered, the same colour on the card and on the timeline block
- Day types and core tasks, so a twelve-hour shift is not scored like an ordinary Tuesday
- Sleep as a named schedule, greyed on the grid and counted out of free time
- A month calendar that fits without scrolling, and a week of one shared timeline
- External calendars as a read-only layer that free time counts: an .ics file needs nothing, a live feed needs the sync server to fetch it
- A keyboard layer with a card behind `?`, and Ctrl-K for commands and search
- A tour of nine steps, each ending when you actually do the thing
- Three themes - Dark, Light, Midnight - with every text token gated against every ground it sits on at WCAG AA, by a test
- A screen that cannot draw says so in its own place, and the rest of the app goes on; a plan that cannot be read is kept aside, never written over
- Installs as a PWA, works offline, and the next open after a deploy is the new version

</details>

## Your data

The plan lives in `localStorage` on the device, as one JSON object; a few device-local preferences sit beside it under their own keys, and the daily snapshots in IndexedDB. Five ways it does not get lost:

- **Export and import** - Settings has a plain JSON backup, both ways. A backup from any earlier version still imports, held by a test for every format since v2.20
- **Daily snapshots** - a full copy once a day in IndexedDB, the last seven kept, restorable from Settings
- **A copy on GitHub** - Settings → Backup takes a private repo and a fine-grained token, and writes the whole plan there as JSON after the day closes and on the first open of a new day. The token stays on the device. Each copy is merged into the one before it, so no device's backup is older than another's; Restore from cloud first brings back what is missing and touches nothing newer
- **An archive of every lived day** - in the same repo, a file per day with its kind, its blocks, what was ticked and when, the meals with their numbers and the notes, and the whole plan once a week, never written over - [docs/ARCHIVE-FORMAT.md](docs/ARCHIVE-FORMAT.md)
- **Sync between your devices** - optional, through the same GitHub repo or a small server you host. A phone joining takes the computer's plan, or asks which to keep; nothing older is ever written over something newer - [docs/SYNC.md](docs/SYNC.md)

Deleting a task or a note, removing a library item, stamping a template, moving a block to another day and a replan can each be undone for five seconds.

<details>
<summary><strong>Sync between your devices</strong></summary>

There is no hosted service and no account.

**Through your GitHub repo** there is nothing to run. With the backup's repo and token on both devices: Settings → Sync → Your GitHub repo → Turn on, on the computer first. A phone with nothing of its own takes the computer's plan; one with a plan of its own asks which to keep before anything is written. Each change goes up a few seconds after it is made, and every open, return and minute on screen reads what the other device left. Settings → Sync shows when this device last pulled and pushed, what waits to go, and says so when it is behind. Two tabs of the app on one device take in what the other saved. How it works, and what to do when a device shows an older copy: [docs/SYNC.md](docs/SYNC.md).

**Or a server of your own**, of under three hundred lines, on a machine you own.

```bash
node server/sync-server.mjs
```

On first run it writes `data/token.txt`, prints the token, and listens on port 8787. Options: `--port`, `--data <dir>`, and `--origin <url>` to allow an origin beyond localhost and `https://quicasha.github.io`.

On each device: Settings → Sync, paste the server address and that token, turn it on. It pulls when you open the app, pushes a couple of seconds after each change, and retries on its own when the connection comes back.

**From a phone**, do not open the port to the internet. Install [Tailscale](https://tailscale.com) on the PC and the phone, sign both into the same account, and put a certificate in front of the server:

```bash
tailscale serve --bg 8787
```

That prints an `https://your-pc.your-tailnet.ts.net` address, which is what goes in the server field. The address has to be https: the app is served over HTTPS, and a page on HTTPS is not allowed to call an HTTP endpoint.

**To run it at logon on Windows**, no window:

```bash
schtasks /create /tn "Dienius sync" /tr "node \"C:\path\to\dienius\server\sync-server.mjs\"" /sc onlogon /rl highest
```

Merging is per entity, so a morning on the phone and an evening on the PC both survive; the same task edited on both keeps the later edit. Deletes stick. If the server ever answers with something that is not a plan, nothing local is touched and Settings says so. Snapshots and the timer do not sync.

</details>

## Under the hood

React 19 and TypeScript, built with Vite. No UI framework, no router, no state library. The whole state is one object behind `useSyncExternalStore`, saved straight to `localStorage`. Everything that is not a component - parsing, sorting, scoring, stamping, capacity, the timeline's geometry, iCalendar - is a plain function in `src/lib` or beside its widget, tested directly.

- `src/lib` holds the data model (`types.ts`), the store (`store.ts`, twelve area modules under `store/`), the storage boundary and its validator, sync, the backup and the archive, the calendar reader, the tour as data
- `src/widgets/day-plan` is the day view: quick-add, the timeline grid, capacity, replan, the task detail sheet
- `src/views` is every other tab, the week view, the tour engine, the shared controls
- `server/sync-server.mjs` is the optional sync server; `scripts/` builds the service worker's cache list and the README's screenshots, and holds the measuring passes and the sample day they run on

The map of the whole thing is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and the rules work is done by are [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md): one spacing scale, five text sizes, every colour held to its contrast by a test, nothing that moves on hover, every invented word explained where it is used.

## How it is checked

Nothing ships on a feeling. Every change goes through the same gates, one after another, and a push to `main` deploys only when the tests and the build pass.

| What | How |
|---|---|
| **Unit tests** | 3,681 in 248 files, Vitest and Testing Library: the pure modules, the store, every view. A rule that must hold for every date and every clock change is also a property test |
| **Browser walks** | 181 in Playwright against the production build, on a desktop and a 375px phone: the tour, the phone call answered in three presses, two tabs of the app, a phone with no network, a deploy taking over, the owner's own week lived day by day |
| **Measuring passes** | Every screen at four desktop sizes and on the phone, in both themes, on a realistic full day: text that does not fit, a control with something over it, text painted over text, anything past an edge, every string's contrast against what is really painted under it, every control 44px on a finger; every screen on a keyboard alone; centring, rhythm and edges; three text sizes. Each plants its own defects on request to prove it can still see them |
| **Lighthouse** | Phone 95 performance, 100 accessibility, 100 best practices; desktop 100, 93, 100 - with what holds each score where it is written down in [`docs/SPEED.md`](docs/SPEED.md) |
| **Data** | A backup written by every version since v2.20 opens, loses nothing, and is a fixed point after one import |
| **Privacy** | A guard that fails the build on anything personal in a tracked file |

## Run locally

```bash
npm install
npm run dev       # dev server at localhost:5173
npm test          # vitest, watch mode
npm run e2e       # playwright against the production build (npx playwright install chromium, once)
npm run shots     # the README's screenshots, from the demo under a pinned clock
npm run sweep     # every screen measured at four desktop sizes in both themes (after npm run build)
npx tsc --noEmit  # typecheck
npm run build     # typecheck, build, then generate the service worker
```

Requires Node 22 or newer.

## Docs

- [`docs/DAILY.md`](docs/DAILY.md) - for using it rather than building it: setting it up once, and what to do if something looks wrong
- [`docs/STATE.md`](docs/STATE.md) - where the project is: the freeze, every feature in a line, what is owed, what will bite you
- [`docs/FREEZE.md`](docs/FREEZE.md) - the freeze on one page: what is allowed, how a bug is reported, where things wait
- [`docs/HISTORY.md`](docs/HISTORY.md) - how it got here, version by version
- [`docs/BACKLOG.md`](docs/BACKLOG.md) - what was asked for: parked, done, and no longer relevant
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - where the code is: the data model, the state flow, which file for which job
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) - how work is done here, and why each rule exists
- [`docs/DECISIONS.md`](docs/DECISIONS.md) - the harder calls, with what each one costs
- [`docs/RESEARCH-ADHD.md`](docs/RESEARCH-ADHD.md) - the evidence behind the push rule and the score, and what not to build
- [`docs/TEMPLATE-JSON.md`](docs/TEMPLATE-JSON.md) - the templates, routines and roster as a file

## License

**[MIT](LICENSE)**.

In one sentence: take it, change it, ship it, sell it. No permission needed
and nothing owed. Keep the copyright line and the license text with any copy
you pass on, and take it as it is - there is no warranty of any kind.

Code and documentation are both covered. So are the screenshots: every one
of them is of the demo's own sample fortnight under a pinned clock, so there
is nothing personal in them and they travel with the rest.

If you build something out of this, a link back is welcome and not required.
