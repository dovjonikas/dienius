# Where this project actually is

You are picking this up cold. This file is the handover: what exists, how it
got here, and what is still owed. Read it, then
[`CONVENTIONS.md`](CONVENTIONS.md) for how work is done here, then
[`ARCHITECTURE.md`](ARCHITECTURE.md) for where the code lives. Those three
should leave you able to start without re-reading the repo.

**Last updated:** after the v1.6 work landed (unreleased - see *Open work*).

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
| Quick-add | One field; a leading time and a trailing duration are parsed out of ordinary prose, shown as chips before Enter |
| Capture mode | The same field writes to the day or to the inbox, chosen by a toggle |
| Categories | Six, one colour each, picked before typing; the same colour on the card and on the timeline block |
| Timeline grid | Anchored tasks at their real time and size, free gaps as labelled regions, a line at now; collapsed behind a disclosure on a phone, always open at the wide breakpoint |
| Drag and resize | Move a block in time or pull its bottom edge; drop it back on the task list to un-anchor it |
| Capacity line | One sentence: what is anchored, how much free time across how many gaps, what the untimed still need |
| Score | Done over planned for today. No percentage, no streak, nothing on a day with no plan |
| Day types and core tasks | A twelve-hour shift is not scored like an ordinary Tuesday |
| Push twice, then decide | An unfinished task moves to tomorrow twice; after that, finish it, delete it, or mark it ongoing |
| Yesterday banner | What yesterday left, stated once, moved forward in one tap - never automatically |
| Task detail | Everything the card does not show: exact minute, note, sub-steps, repeat, the three-a-day key mark. Panel on desktop, bottom sheet on a phone, right-click menu for the common ones |
| Focus | One task, its own planned time, a ring, a way out. Not a pomodoro |
| Timer and stopwatch | Survive a refresh, run on every tab, keep time in a background tab, put the countdown in the tab title |
| Day digest | In the wide rail: what is next, and how the day is going |
| North line | One goal under the day's title, rotating daily, expanding on hover/tap/focus |
| North card | After a slow day or on a Monday, one goal comes forward with its reason. Never a word about how yesterday went |

### The other tabs

| Tab | What it is |
|---|---|
| **Calendar → Month** | A month that fits without scrolling; every past day shows its ratio, a thin bar, what was carried on, a dot when every key task was kept. No red at any threshold |
| **Calendar → Week** | Seven columns of one shared timeline. Drag a block between days, tap to open, tap empty space to add, stamp per column or the whole week. Three days at a time on a phone |
| **Calendar → Year** | One cell per day, shaded by fullness, coloured by template |
| **Templates** | Named, coloured sets of blocks; stamped onto dates by clicking or dragging, nothing commits until Save |
| **Library** | Lists worked through a unit at a time (chapters, episodes, sessions). A session goes onto a day in two taps; ticking it off advances the book |
| **Review** | Week and month statistics, all derived from the days themselves |
| **Settings** | General, North, Sleep, Week, Nudges, Rules, Calendars, Sync, Appearance |

### Across the app

| Feature | What it is |
|---|---|
| Weekday templates | A template per weekday, so a new day opens already set up. A stamp by hand always wins |
| Repeating tasks | Daily, weekdays or weekly, materialised as real tasks. "Just this day" vs "every day it repeats" is a standing choice |
| If-then rules | Trigger plus action, surfaced by day type and time of day. Never measured |
| Inbox | Catch a thought without deciding what day it belongs on |
| Keyboard layer | Single keys for common actions; a card behind `?`. Never fires while typing in a box, except Escape |
| Command palette | Ctrl-K / Cmd-K: run a command or find a thing. Linear scan, no index |
| Undo | One app-wide offer, five seconds, on the expensive mistakes |
| Snapshots | A full copy once a day in IndexedDB, seven kept, restorable from Settings |
| Export / import | Plain JSON, both ways, deliberately manual |
| Sync | Optional, off by default, through a server you host. Per-entity last-write-wins with tombstones |
| External calendars | ICS subscriptions or file import, as a read-only layer. Free time counts them |
| Demo mode | `?demo=1` fills a sample fortnight under its own storage key |
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
| **v1.6** | *(unreleased)* Week view, external calendars, demo mode, the 44px touch pass, README rework |

Tags exist for v1.0 through v1.5. **v1.6 is not tagged** - see below.

---

## 4. Open work

### v1.6 is unfinished

Parts A, B and C are committed and pushed. What is left:

- **Two critique cycles**, specifically: the week view in dark and light at
  1920x1080, 1366x768 and 390x844; the calendar overlay in both themes; demo
  mode end to end.
- **A full regression + tag `v1.6`.** The suite is green (1418) and the build
  is clean as of the last commit, but the release pass has not been done.
- **Screenshots.** The brief asked for a fresh set from demo mode. I could not
  write image files from this environment, so the README leads with the live
  demo link instead. If you can produce PNGs, `docs/screenshots/` and a hero
  image in the README are still wanted.

### v1.7 was briefed and not started

An **interactive tutorial** - "press and it leads you". The full brief is in the
conversation, and the short version is: a spotlight overlay, one real action
per step, the step ends when the *event* happens rather than on a Next button,
8-10 steps, under 120 words of tour text total, separate desktop and mobile
step arrays, sandbox mode for a replay from Settings, and keep/clean at the
end. Nothing has been written for it.

### Known debts, oldest first

| Debt | Detail |
|---|---|
| **Week blocks are small targets** | A 20-minute block at a week's scale is ~20px tall. Sized by duration, so it cannot be 44px. `min-height: 20px` on coarse pointers is the compromise |
| **`store.ts` is 1200 lines** | It is a flat list of actions, so it reads fine, but it is the largest file left. Splitting it by area (tasks / library / settings / calendars) is the obvious move if it grows again |
| **`storage.ts` is ~830 lines** | Almost all of it is `validate()`, a hand-written deep type guard. Deliberate - it is the import path for a file a person may have edited - but it is long |
| **`timelineLayout.ts` at ~810 lines** | Dense geometry. Well tested, but the next person to touch it will need a while |
| **No end-to-end tests** | Everything is unit or jsdom-level. The two-device sync test and the week drag were verified by hand in a real browser, not by CI |
| **Screenshot tooling** | There is no way to produce image files from the agent environment. Any visual regression checking is by measurement (`getBoundingClientRect`, computed styles) rather than by pixels |
| **Sync has no conflict UI** | Last-write-wins per entity, silently. Correct for one person with two devices; it would not be for two people |
| **ICS: monthly and yearly rules are skipped** | Named in the parse result rather than approximated. A meeting on the wrong day is worse than one not shown |
| **ICS: named time zones are read as local** | Doing it properly needs the IANA database. Reported in `ignored`, so it is not silent |
| **Imported .ics calendars are device-local** | They have no address to refresh from, so they do not sync. Stated in the UI |
| **`--week-days` custom property is unused** | The narrow case is handled by a media query instead. Harmless, but it is a loose end in `styles.css` |

### Resolved debts, so you do not chase them

- ~~The 400-day repeat lookback~~ - removed in v1.5. It was an expiry date
  pretending to be an optimisation.
- ~~`DayView.tsx` at 1238 lines~~ - split six ways in v1.5; it is 397 now.
- ~~The 38px button debt~~ - closed in v1.6. Every control on Today and the
  calendar meets 44px on a coarse pointer.
- ~~`normalizeLoaded` dropping optional settings~~ - fixed in v1.6. It had
  silently eaten `northDismissedOn` since v1.4.
- ~~Snapshot restore never reaching storage~~ - fixed in v1.5.

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
