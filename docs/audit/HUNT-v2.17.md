# The hunt before the week - v2.17

The owner starts living in this app tomorrow: a real week, real mornings at
07:00, on a phone and on a desk. Every wave until now has ended on "done", and
then one more bug has crawled out. This wave adds nothing at all. It looks for
what is already here, before he does.

Priority throughout: **what would spoil a real morning** beats **what looks
untidy**.

Severity, three levels:

| | |
|---|---|
| **A** | Would spoil a real day - data lost, a control that cannot be pressed, a wrong time, a day's plan gone |
| **B** | Would grate every day - too many presses, no way to tell where to press |
| **C** | Cosmetic |

A verdict is **CONFIRMED** when it has been reproduced and **SUSPECTED** when
it has not - and a suspected one stays on the list under that mark rather than
being fixed on a hunch.

---

## Stage 1 - everything the machine can say

Numbers, not impressions. Run on `f734760`, Windows 11, Node 22.

| Gate | Result |
|---|---|
| `npm run build` (`tsc --noEmit` then Vite) | clean, 419ms, 216 modules |
| `npx vitest run` | **2629 passed**, 160 files, 61.0s, 0 failed |
| `npx playwright test` | **62 passed**, 7 skipped by project, 1.1m, 0 failed |
| `npm run privacy` | clean |
| `gh run list` (last 10) | 10 of 10 `success` |
| `npm run sweep -- --phone` | **11 findings** - A-02 and B-01 |

Every gate green. The two warnings they print anyway are C-04 and C-05.

---

## A - would spoil a real day

### A-01 · The whole app · CONFIRMED · fixed `2040f22`

**What a person sees.** The app is left open overnight - a desk, or a PWA the
phone keeps warm. At 07:00 the header still says **"Today"** over yesterday's
date. Thirty seconds later, when the day view's own tick re-renders it, it
changes to "Wednesday / September 16 / **Past**" and stays there. The day on
screen is yesterday's, and **the first task typed that morning is written onto
yesterday**.

**How to repeat.** Open at 23:50 on a Wednesday, stamp a day. Move the clock to
07:00 Thursday **without reloading**. Type a task into quick-add. Press the back
arrow: it is on Wednesday.

**Why.** `todayKey()` is a reading, not a subscription, and every one of its
callers takes it once. Invisible while every session began with a page load -
a phone swaps the tab out overnight and the morning's first look is a fresh
mount. The owner is about to spend a week with this open on a desk.

**Also from the same cause**, both fixed with it: the daily snapshot promises
seven days and would have taken **one** on a tab open all week, and the cloud
backup's copy of the day that just ended never fired either. Both were keyed on
the mount.

**Fix.** `src/lib/useToday.ts` - one timeout aimed at the next local midnight,
re-arming unconditionally, plus `visibilitychange` and `focus` for the laptop
that was asleep. The shell follows it **only when the day on screen was
today**: somebody who walked forward to Friday is looking at Friday on purpose.
Held by 7 unit tests on the arithmetic (both daylight-saving switches, month
end, new year's eve) and 4 in `e2e/overnight.e2e.ts`, which install the clock
rather than pinning it - a pinned clock never fires the timeout under test.

### A-02 · The tab bar, below 1024px · CONFIRMED · fixed `6a419d4`

**What a person sees.** A new build is deployed while the app is open. The
"An update is ready" notice arrives at the bottom of the phone and **covers the
navigation bar completely**. All seven tabs are unpressable. The notice is
deliberately ignorable - "ignoring it is a valid outcome" - so somebody who
ignores it cannot change tabs at all until they reload the page. Every deploy
raises it.

**How to repeat.** 390x844, notice on the page: `elementFromPoint` at the centre
of each tab returns the notice or its children. 8 of 8 blocked, 53px of overlap.
At 768 it moves to the left corner and covers Today and Calendar instead.

**Found by** the first sweep, which happened to be running while a build landed
and reported seven covered controls that had never appeared before.

**Fix.** `--rail-bar-h` names how tall the rail is when it is a bar; the rail
states that height rather than letting its content decide, and both
bottom-anchored surfaces sit above it. 7 tests in `e2e/bottom-bar.e2e.ts`, all
7 red without the fix.

---

## B - would grate every day

### B-01 · Clock panel, phone · CONFIRMED · fixed `0ec6354`

`.clock-sound-head` is the whole line that opens the sound fold, and its own
comment calls that "what makes it findable with a finger". It was **17px tall**
on a phone - the height of its text - against the 44px CONVENTIONS 6 requires.
Measured by the sweep at 390x844 on both clock panels.

### B-02 · Templates list · CONFIRMED · fixed `0ec6354`

Every template card's **Delete was drawn exactly like its Edit** - the same
muted ink, the same plain border. `.template-card button` is a class and an
element, so it out-specified `.btn-danger` wherever that sat in the file. The
comment above that button says the plain version "made the control that
destroys a template look exactly like the one beside it that opens it", and
describes the fix; **the fix had never taken effect**. Only `.is-armed`, at two
classes, got through, so the danger colour appeared for the first time on the
*confirming* press - after the decision it was there to inform.

Not A: the button arms on the first press and destroys on the second, so a
single misclick loses nothing.

### B-03 · The undo toast, below 1024px · CONFIRMED · fixed `6a419d4`

Covered Templates, Library, Review and North for the five seconds it is up -
which is exactly the five seconds somebody who has decided against undoing
wants to be somewhere else. Same cause and same fix as A-02.

### B-04 · Week template editor · CONFIRMED · fixed `0bf5d80`

**The owner's own find.** The library binding lived only on the add row, so a
list could be bound to a block being made and never to one already on the week.
Changing your mind meant removing the block and rebuilding it - with its time,
its category, its note and its days. The owner looked for it on an open block,
did not find it, and reasonably took the whole feature for missing.

The control is now in the block's own panel, above the note, going through the
same `editBlock` every other field there uses - so a block on seven days is
bound on seven at once. It carries a **visible label** where the add row's has
only an `aria-label`: on the add row it is one of a line of chips and reads as
part of the sentence being written; in the panel it is a field on a form, and
an unlabelled dropdown between a note and two buttons is a control nobody can
name, which is the other half of why it was not found.

Four unit tests and one end to end - the half no unit test can see is that a
bound block stamps the day with the **book's** title, through the real stamp on
a real date.

### B-05 · Scratch, phone · CONFIRMED · fixed `4aff6bd`

Three controls in one row - the "Note" toggle, the + for a picture, the x to
close - all written as 32px. Two reach the touch floor through a hit-area
overlay and keep their box; the third took `min-height: var(--touch)` and grew
to 44, standing twelve pixels taller than its neighbours. CONVENTIONS 6 names
the condition exactly: the overlay is "for an inline control where growing the
box would grow its row".

---

### B-06 · The task list, any size · CONFIRMED · fixed `e14e893`

**What a person sees.** A task whose title has no space in it - a URL pasted
into quick-add is the ordinary way to get one - paints over everything to its
right, is cut mid-character with no ellipsis, and gives the task list a
horizontal scrollbar. Measured: a 200-character title is **2014px wide in a
310px column**, and the list scrolls **1753px** sideways.

**How to repeat.** A day with a 200-character unbroken title on it. Read
`.task-list`'s `scrollWidth` against its `clientWidth`.

**Why nothing saw it.** CONVENTIONS 4 says nothing scrolls horizontally ever,
and the check written beside that sentence is `documentElement.scrollWidth >
clientWidth`. A scroller *inside* the page absorbs the overflow, so the
document stays exactly as wide as the window and `hScroll` read zero
throughout. The rule was unenforced everywhere it is most likely to break.
The first sweep of the wave measured every screen on a realistic day and said
nothing, because a realistic day has spaces in its titles.

**Fix.** `overflow-wrap: anywhere` on `.task-title`, which is already this
app's answer in the North picture and a scratch note and changes nothing for a
title that has somewhere else to break. Plus a third measuring pass - a
scroller whose content is wider than it is - so the next one is caught.

---

## C - cosmetic

### C-01 · Week template editor, block open · CONFIRMED · fixed `0ec6354`

**The owner's own find**, from a screenshot. **Close sat 11px above** the two
buttons beside it, and **Key was 44px against Remove's 38px**.

`.setting-quiet` carries `align-self: flex-start` with a two-pixel nudge, for
the column it was written for - and `align-self` on a child beats `align-items`
on its row. Key takes the plain button rule's 44px floor while Remove sits at
the variants' 38.

Nothing in the repo could see it: jsdom has no layout, and the sweep built the
seven-column grid but **never pressed anything on it**. The screen and both
measuring passes were added in `f3b922a`.

### C-02 · Settings → Categories · CONFIRMED · fixed `0ec6354`

Every category row's **Delete sat 8px above** the Edit beside it - six rows at
once. Same cause as C-01, found by the new pass.

### C-03 · Templates header · CONFIRMED · fixed `0ec6354`

The **"Templates" heading sat 4px above** the New template button. The `h2`
carried the view's own 8/16 margins, and a margin box centred in a row is a
heading above the thing beside it. Library, Review, North, the journal's head
and the calendar's bar all zero their `h2`; Templates was the one that never
did.

### C-06 · The calendar's day card · CONFIRMED · fixed `2962ea3`

"Nothing on this day **yet**." where the week's agenda says "Nothing on this
day." - one fact, two wordings, for no reason either of them could give. The
"yet" was wrong on top of that: the card opens on any date the calendar can
reach, and a Tuesday three weeks gone is not waiting for anything.

### C-04 · Build warning · CONFIRMED · left on purpose

`vite build` warns on every run: 664 kB of JS, 196 kB gzipped, past its 500 kB
advice. One chunk on purpose - see the closing list.

### C-05 · Test output · CONFIRMED · left on purpose

45 React `act(...)` warnings across 22 components in the unit run. No test
fails and none is flaky. See the closing list.

---

## SUSPECTED, not reproduced

### S-01 · The sweep's own reload, once

One sweep run reported `Command palette: TimeoutError: page.waitForSelector`
at 1366x768 - the page did not come back from `reload()`, not the palette
failing to open. Almost certainly self-inflicted: `dist` was rebuilt twice
under that run, so the asset hashes changed beneath a service worker mid-flight.
It has not recurred on a clean run. **What to watch for:** an app that comes
back blank after a deploy. If it happens, the thing to look at first is
`public/sw.js`'s `cacheFirst`, whose `catch` returns `cached` - a variable that
is provably `undefined` at that point, so a failed fetch for an uncached asset
becomes a bare network error with no message rather than anything readable.

---

## Checked, and there was nothing there

Recorded so a later pass does not spend the time again.

- **The timer across midnight, and across both daylight-saving switches.** A run
  is an instant and a duration in epoch milliseconds and no date arithmetic
  touches it. Now held by `src/lib/clockTools.midnight.test.ts`, 6 tests, so a
  later change that introduces some fails there rather than on a Sunday.
- **A session or a stopwatch started before midnight** still names yesterday's
  task afterwards, which is right - the thing being timed at 00:10 is the thing
  that was started at 23:50.
- **The tour on a real day.** The palette and the shortcut card start it on the
  real plan rather than in Settings' sandbox, which reads like a defect and is
  deliberate and documented. It is safe: everything the tour creates is flagged
  `tourCreated` and "Start clean" removes exactly that and nothing else.
- **A day opened at 03:00** is the new day, which is correct - `todayKey()` is
  the wall clock and there is no configurable day boundary to disagree with.
- **The spacing scale.** 15 `14px` in the stylesheet: every one is an icon or a
  dot's size, or `--t-md` inside the small text-scale block, which is the scale
  being redefined at source. No magic padding.
- **Corrupt storage and half-formed backups.** 108 tests in `storage.test.ts`
  already, including a dangling category id, a task with no `pushCount`, and
  every payload shape that predates a field.
- **Em-dashes in the interface.** 696 UI strings pulled out and read as prose:
  none.
- **`0/9` beside `0 of 9 done`** on the day header reads as CONVENTIONS 23's
  double and is not one - the second is `visually-hidden`, for a screen reader.
- **Three accent things on one screen** (Stage 2's last question). Measured
  rather than eyed on the busiest screen in the app: exactly **two** elements
  carry the full-strength accent - the day's progress bar and the mini
  calendar's ring on today. Everything else that reads as tinted is a
  `color-mix` at reduced strength, which is the hierarchy doing its job.
- **The two daily paths** (Stage 4). An ordinary morning - stamp, tick three,
  run a timer, write a note - is **7 presses**, with nothing to hunt for and no
  wrong press. An evening - move what is left, write the journal line - is
  **3**, and the line is on the day by the time focus leaves the box. Building a
  whole week of the owner's own shape from nothing is 94 presses, which
  `week-rehearsal.e2e.ts` already measures and which is a once-ever cost.

---

## Left on purpose

- **One JavaScript chunk, 664 kB.** The app is a single screen that switches
  views and every view is one press from every other, so code-splitting would
  trade a warning for a spinner on the press that matters. It is 196 kB
  gzipped, cached by a service worker after the first visit, and the first
  visit is the only one that pays. Revisit if the owner meets it on mobile
  data.
- **45 `act(...)` warnings in the unit run.** Real, and worth clearing, but
  clearing them means touching 22 test files during the week the owner is
  living in this app - which is the wave for changing tests least. Written down
  rather than swept: a genuine one would be invisible in this noise. In
  BACKLOG.md.

---

## Stage 7 - the second pass, and what it found

Stage 1 to 4 run again from the top after the first round of fixes, which is
where the rest of these came from. Two more B-level findings, both from the
data shapes rather than from a screen:

- **B-06**, the hundred-task day with a two-hundred-character title. Worth
  saying plainly: the first pass measured every screen on a realistic day and
  reported nothing about it, because a realistic day has spaces in its titles.
- **B-05**, the scratch row's three heights, which the *new* two-heights pass
  reported on the second sweep and nothing had reported on the first.

And one shape that the new sideways pass got wrong on its first outing, which
is worth writing down because a check that cries wolf is worse than no check:
it reported the week editor's seven columns and Settings' section nav, both of
which scroll sideways on purpose. A strip is a row of things that each fit; a
defect is one child wider than the box it is in. With that clause the pass
reports nothing on a clean run and still catches the real one - proved from
the other side, by turning `overflow-wrap` off with a single override on a day
carrying the long title and watching the finding come straight back.

**A third pass over stages 1 to 4 found no new A or B.** The closing sweep -
every screen, four widths, both themes, all three new passes armed - reports
**0 findings**, and `--self-check` still reports 8/8.

---

## The closing gates

| Gate | Result |
|---|---|
| `npm run build` (`tsc --noEmit` then Vite) | clean |
| `npx vitest run` | **2647 passed**, 162 files, 0 failed |
| `npx playwright test` | **74 passed**, 7 skipped by project, 0 failed |
| `npm run privacy` | clean |
| `npm run sweep -- --phone` | **0 findings** |
| `npm run sweep -- --self-check` | 8/8 shapes still detected |
| CI | `build`, `e2e` and `deploy` all green - after the fix below |

### The gate that was red, and why it was not the app

CI's `e2e` job failed three runs in a row at `npx playwright install
--with-deps chromium`, before a single test ran:

```
E: Failed to fetch https://dl.google.com/linux/chrome-stable/deb/dists/stable/main/binary-amd64/Packages.gz  Hash Sum mismatch
```

Checked from outside CI rather than assumed: Google's `Packages.gz` is 1405
bytes and their own `Release` file declares a different hash for a file of
that size. Their repository metadata disagrees with itself. `--with-deps` runs
`apt-get update` across every repo on the runner, so an outage in a repository
this project never uses - Playwright ships its own chromium - failed a job
that did not need it.

The workflow now installs the browser first, from Playwright's own CDN and
touching no package manager, and asks for the OS libraries in a second step
marked `continue-on-error`. The runner image already ships those libraries, so
that step is a belt whose braces are the image itself; if it is ever genuinely
needed and genuinely fails, the test run below it says so in words somebody
can read rather than an apt error about a mirror.

**Green on the next push**, all three jobs, with Google's mirror still serving
the same bad index. The same 74 browser tests also pass locally, on the same
commit, against the same production build.

Worth keeping as a lesson rather than only as a fix: this was three red runs
that said nothing about the code, and the temptation with one of those is to
press re-run until it goes away. What made it cheap to settle was fetching the
file the error named and comparing it to the hash the error quoted - four
seconds of work that turned "flaky CI" into a fact with a cause.

---

## Counts

| | |
|---|---|
| Findings | 14 |
| **A** | **2** |
| **B** | **6** |
| **C** | **6** |
| Fixed | 12 |
| Left on purpose | 2 |
| Suspected, not reproduced | 1 |
| Raised by the owner | 2 (C-01, B-04) |
| Passes over stages 1-4 | 3 |
| New measuring passes the sweep gained | 3 |

Two of the fourteen were the owner's, from looking at one screen. That is the
finding about the findings, and the argument for the three measuring passes
this wave added rather than for anything else it did: the note header's Close
had been eleven pixels out at every size for six versions, and the only thing
in this project capable of noticing was a person's eye.
