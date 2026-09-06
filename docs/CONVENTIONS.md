# How work is done here

Rules this project actually follows, written for somebody arriving cold. They
are not style preferences; each one exists because breaking it caused a bug
that shipped.

[`STATE.md`](STATE.md) says where the project is.
[`ARCHITECTURE.md`](ARCHITECTURE.md) says where the code is. This says how to
add to it.

---

## 1. Writing

**Never an em-dash or an en-dash. Always a plain hyphen.** In code comments,
commit messages, UI copy, documentation, everywhere. This is the owner's
standing instruction and it is not negotiable.

Everything is public - the code, the comments, the commit history - and none of
it may read as machine-generated. Concretely that means:

- **Comments say why, not what.** `// A non-empty value that does not parse is
  left untouched rather than clearing a size that was already there - a stray
  keystroke should not silently erase a real estimate.` A comment restating the
  line below it is noise; a comment holding the reasoning is the only place
  that reasoning exists.
- **Doc comments on every non-obvious module and exported function**, in the
  same voice: what it is for, what was rejected, what breaks if you change it.
- **UI copy is a sentence somebody would say.** "Cannot reach the server. Is
  the PC awake, and Tailscale connected?" - not "Error: network request
  failed". An error that names a status code and nothing else is a wrong
  answer with a number in it.

---

## 2. Commits

One commit per coherent piece of work, with a message that reads like a note to
a colleague:

- **Subject line**: what changed, in plain words. `Week: seven columns of one
  timeline, and the height the app was missing` - not `feat(week): add week
  view`. No conventional-commits prefixes.
- **Body**: what it is, the decisions that were not obvious, and what was
  rejected. Long is fine. This is where the reasoning lives that will not fit
  in a comment.
- **Bugs found on the way get named**, including ones that were already
  shipped. If a wave uncovers a defect from three versions ago, the commit
  message says so.
- **Every commit ends with:**
  ```
  Co-Authored-By: Claude <model> <noreply@anthropic.com>
  ```
  with the model that did the work named - `Claude Opus 5` up to v1.9,
  `Claude Fable 5.1` from v1.10.
- PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Commit and push after each part of a wave, not at the end. A wave that dies
half way should leave finished work on `main`.

---

## 3. Tests

**A new feature gets its tests in the same commit.** Not the next one.

- **Test names are sentences about behaviour**, not about functions:
  `'a reply that is not a plan changes nothing here, and says so'`. Somebody
  reading only the test names should learn what the feature promises.
- **A doc comment above a group of tests explains the rule they defend.** These
  are read more often than the code.
- **Test the contract, not the implementation.** Query by role and accessible
  name (`getByRole('button', { name: /Dentist/ })`), not by class. Class-based
  selectors are allowed only for measuring layout, where there is no role.
- **Pure functions are tested directly.** Anything that is arithmetic - layout
  geometry, capacity, parsing, merging - is a plain function outside React,
  because jsdom has no layout and cannot test geometry through a component.

### Changing an existing test

Allowed only when the test asserts structure that genuinely changed, or when it
was wrong. **Every such change is called out in the commit message**, with the
reason. Two examples from the history, both legitimate:

- Two tests asserted that push-then-stamp produced two copies of a task. That
  was the bug, not the contract; they were rewritten and the commit said so.
- A performance test measured a fixed millisecond budget, which measured CI's
  scheduler as much as the code. It became a ratio against an empty store.

Never delete a failing test to make a suite green.

### Timing tests

Do not assert absolute milliseconds. The suite runs a hundred-odd files in parallel on
whatever machine CI hands out. Assert a *ratio* against a baseline measured the
same way, take the fastest of several rounds, and alternate the two sides so a
machine that gets busier partway through slows both equally.

The machinery is [`src/test/stress.ts`](../src/test/stress.ts), and there is no
millisecond assertion left in the suite. Two shapes:

- `measureSlowdown(baseline, load, operation)` for anything that reads the
  store. The baseline is a parameter rather than always-empty, because the
  honest baseline differs per test: for a year strip it is an empty store,
  since the same 366 cells are drawn either way and only the lookups change;
  for a list of two hundred rows it is a *small* list, because two hundred rows
  genuinely do cost more than none, and the question worth asking is whether
  they cost proportionally more or quadratically more.
- `measureScaling(small, large)` for a pure function, which has no store to
  reset between measurements.

Set the bound where a change in *shape* shows up - a lookup that became a scan,
a memo that stopped holding - not where a few percent does. Those land an order
of magnitude out; noise does not.

A test that asserts a loop *terminates* is not a timing test and must not be
written as one. Assert the bounded output, and let the runner's own timeout be
the failure - see the endless-rule test in `ics.test.ts`.

---

## 4. Layout

### Zero scroll, and its exceptions

Three screens must fit their viewport with no scrolling at **1920x1080**,
**1366x768** and **390x844**. This is the rule most likely to be broken by
something that has nothing to do with it - a card above the grid growing,
a row added to a bar, a padding changed for another view - so **measure it
after any change to a height on those screens**, not only when working on
them. The month was 74px past the fold at 390x844 for some time before
v2.0, and nothing said so.

- **Calendar → Month.** If something must give, reduce the detail in a cell.
  **Never raise cell height.**
- **Calendar → Week.** Structurally guaranteed rather than tuned - see below.
- **The day view at the wide breakpoint** (≥1024px), where the whole day fits
  the window and the grid draws at whatever density that takes - *within the
  floors*. A sized anchor draws at least 32px, because that is what its box
  needs to hold a title. A gap and an unsized anchor draw at least 44px on a
  finger and 28px and 32px on a mouse (`usePointerCoarse`), because the
  44px is a touch target and on a desktop it was only height: a nine-block
  day spent 350px on gaps nobody could miss. A day with more blocks than
  the room has floors for still cannot fit at any density; `fitPxPerMinute`
  says so by returning the base density, and then **the grid's own column
  scrolls, opened at now, and the page does not.** `e2e/demo.e2e.ts` holds
  that at 1366x768 and 1920x1080 on the sample fortnight.

Everything else scrolls vertically and that is fine. **Nothing scrolls
horizontally, ever.** Check with
`document.documentElement.scrollWidth > clientWidth`.

### A block shows its times when it is an hour or longer

One rule for every grid that draws a task as a block. **An hour or longer,
the block carries its start and its end under its title; shorter, the
title alone.** An hour is where the start and the end stop being something
the block's own height already says: a fifteen-minute block reads as a
moment and its minutes are one glance away on the card, a two-hour block is
a stretch of the day and which two hours matters.

- **On Today** the rule is exact. A sized block an hour or longer has a
  two-line floor (`TWO_LINES_PX` in `TimelineGrid.tsx`, 48px, the padded
  title and time line measured rather than guessed), so however dense the
  day is drawn the second line has its room. It used to go by drawn height
  alone, which showed the times on whatever happened to be tall at today's
  density and not on the same block tomorrow - and at 41px it showed half
  a line.
- **On the week** a block's height is its duration and nothing may floor
  it, so the same rule has one clause: the times are there on an hour or
  longer, and hidden by a container query while the block is under two
  lines tall. A week at 1366x768 is mostly titles; at 1920x1080 the long
  blocks say their hours.

Never a time on a block that has not got the room for it. Half a line of
digits under a title is text cut off, which is a defect anywhere in the
app.

### Text is never clipped, and a control is never shorter than its label

Anywhere. Not a button whose word ends in "wee", not a chip whose count
wraps under it, not a block whose title runs past its edge. Every control
is as wide as its longest word in both the languages the app speaks, or
its text is shortened on purpose - "Week default" rather than "Same as the
week" - or the word goes and a tooltip carries it. The sweep's "text cut
off" shape holds this on every screen it opens; the owner's screenshots
hold it on the ones it does not.

### One notice above the day

Three things can appear between the day's header and the day: the evening
close, what yesterday left, and the North card. Only the first of them shows
at a time, in that order, and the next appears when the one above it is
dismissed - the stylesheet hides every child of `.day-notices` after the
first, and each card unmounts itself on dismiss, so the order in
`DayView.tsx` is the queue. The rule exists because the demo's first
screen once carried all three above a day the visitor had not seen yet, and
the day itself was below the fold. The demo line at the very top is not one
of the three: it is chrome, one 30px row, and never goes away while the
sample is open.

The week view is the model for how to do this: every block is a percentage of a
grid row that takes whatever height it is given, so there is no pixel budget to
blow. Prefer that to fitting a number to a screen.

### Grid, not offsets

Where two things must line up - the hour axis and the day columns - put them in
the same grid and let it align them. An offset computed from "how tall the
header probably is" works until a chip makes one header taller. That is a real
bug this project shipped and fixed.

### A containment boundary places itself

`contain: layout` makes a stacking context, whatever it was added for, and a
stacking context with no `z-index` paints in DOM order. Quick-add got
`contain: layout style` in v2.0 to stop typing from re-laying-out the day,
with a note that `paint` was avoided because it would clip the two panels
that hang out of the box - the right worry about the wrong effect. From that
commit to v2.1 the time and duration panels painted behind the first task
card on every viewport, and nothing saw it: jsdom has no paint order and the
measuring pass never opens those panels. **Every rule that contains also
declares its z-index**, and `stacking.test.ts` reads the stylesheet to hold
that.

---

## 5. Design tokens

**No hard-coded values.** Everything comes from a token declared once on
`:root`:

- Spacing `--s0`..`--s8`, radius `--r-chip/-control/-card/-pill/-round`
- Type `--t-2xs`..`--t-xl`, plus `--t-input` (16px, the iOS zoom floor - never
  lower it), `--t-glyph`, and the two fluid sizes on the Focus screen
- Elevation `--e1/e2/e3`, motion `--dur-fast`, `--dur`, `--ease`
- Palette `--bg`, `--surface`, `--text`, `--muted`, `--faint`, `--accent`,
  `--border`, `--danger`; and `--ground`, what is painted under the element
  at hand - the page by default, and a surface sets it to itself - for the
  one thing that has to match it exactly, the gap in a chosen swatch's ring
- Geometry the scales have no step for, named once: `--rail-w`,
  `--rail-open-w`, `--timeline-gutter`, and `--touch`, the 44px a control
  grows to under a finger

### The two scales

Written down in v2.4, after the owner's screenshots kept finding a 14px
here and a 9px there. These are the only sizes there are; `scale.test.ts`
reads the stylesheet and fails on any other.

| Type | Size | Where |
|---|---|---|
| `--t-2xs` | 10px | The month cell's lines and the week preview's letters, where the box is the constraint |
| `--t-xs` | 11px | Labels, meta, chips, hour marks |
| `--t-sm` | 13px | Body: cards, fields, buttons, the capacity line |
| `--t-md` | 15px | The running task, a row's title |
| `--t-lg` | 20px | The day's name, the clock, a view's heading |
| `--t-xl` | 34px | The timer's reading |
| `--t-input` | 16px | Every field on a phone - the iOS zoom floor |
| `--t-focus`, `--t-focus-title` | fluid | The Focus screen, the one place type fills the window |

**At most four of them on one screen**, not counting the input floor and
the glyph size: a screen with five sizes is a screen with no hierarchy.
Today is 11, 13, 15 and 20; the month is 10, 11, 13 and 20. The body
carries `--t-sm` and a button inherits, so nothing falls to the browser's
16px - which is not on the scale, and was the fifth size on four screens
until the v2.4 critique measured them: every button without a size of
its own, a template card's name, a step's title, a pace line.

| Spacing | Size | Spacing | Size |
|---|---|---|---|
| `--s0` | 2px | `--s5` | 20px |
| `--s1` | 4px | `--s6` | 24px |
| `--s2` | 8px | `--s7` | 28px |
| `--s3` | 12px | `--s8` | 32px |
| `--s4` | 16px | | |

Every padding, margin and gap is one of these, as a token - which is
also what lets density redefine all of them at once. Three bare pixel
values are allowed beside them and nothing else: `1px` for a hairline,
`3px` and `6px` for the half-steps inside the smallest boxes the app
draws, a week block and a timeline block. A pixel amount may also stand
inside a `calc()` beside a token when it names a size the scale has no
step for - the 32px close button the sheet's title keeps clear of, the
24px check box the task's meta line starts after. A bare `14px` is a
defect: it means somebody tuned one screen by eye, and the next screen
will not match it.

Two are derived at runtime rather than declared: `--safe-ink` (readable on
`--surface`) and `--on-accent` (readable on whatever accent is in force).
**Anything filled with `--accent` uses `--on-accent` for its ink.** Hard-coding
white there measured 2.42:1 on the app's loudest button - and again, two
versions later, on the tick of a done task and the thumb of a switched-on
switch, which is the most-looked-at mark in the app and the one nobody
thought to check because it is not text. **Ink means anything drawn on top:
a border, a mask, an icon's stroke, not only a `color`.** The check is four
lines - every rule that fills with `var(--accent)`, and what it draws on
top - and it is worth running after any wave that touches the stylesheet.

**A duration is a token or it explains itself.** `--dur-fast`, `--dur`, and
one bespoke 0.35s on the day progress bar with its reason written beside it.
A literal that happens to equal a token - `0.15s` beside `var(--dur-fast)` in
the same declaration, which shipped three times - means the token no longer
controls what it claims to, and a reader cannot tell which was meant.

**A custom property that does not exist invalidates the whole declaration.**
`--s5` and `--s7` were referenced before they were defined, and three
components rendered with zero padding - one button came out 18px wide. If you
add a token reference, add the token.

Density and text size are two attributes on `<html>` that redefine the scales at
source. That is the entire feature, and it is why nothing else has to know they
exist.

### Themes

Three presets, each in light and/or dark. A preset that fails a contrast check
is not mergeable: `theme-contrast.test.ts` checks `--text`, `--accent`,
`--muted` and `--danger` against both `--surface` and `--bg`, for every preset
in every mode. Body and secondary text need 4.5:1; the accent needs 3:1.

`index.html` carries a pre-paint script that resolves the theme before React
mounts, so a dark install never flashes light. It necessarily duplicates the
preset data. `preTheme.test.ts` runs that exact script text against the real
functions and fails on any difference. **Change a theme token in both places.**

---

## 6. Buttons and touch targets

Three variants and nothing else: `.btn-primary` (the one action a screen is
for), `.btn-secondary` (the several it also offers), `.btn-danger` (the one that
destroys something, outlined until armed, filled only on the confirming second
tap).

**Every control is 44px on a coarse pointer.** Two ways to get there:

1. **Height**, for anything with room. The plain `button` rule gives 44px; the
   three variants sit at 38px on a mouse and are raised to 44px under
   `@media (pointer: coarse)`.
2. **A `::after` hit-area overlay**, for an inline control where growing the box
   would grow its row:
   ```css
   .thing::after {
     content: '';
     position: absolute;
     top: 50%; left: 50%;
     width: max(100%, 44px);
     height: max(100%, 44px);
     transform: translate(-50%, -50%);
   }
   ```
   The list of controls using this is in the `@media (pointer: coarse)` block.

**Audit by measuring, not by reading the stylesheet.** A 28px segmented control
shipped for four versions because it looked fine in the CSS. The snippet is in
[`STATE.md`](STATE.md#5-phone-checklist).

The one documented exception is a week-view block, whose height is its duration.

**A stacked stepper is not a touch target.** Two half-height chevrons in one
44px column are 22px each, and the overlay cannot save them: two overlays on
top of each other steal each other's taps. On a coarse pointer every
`.time-stepper` lays its pair side by side, 44px each, and the control gets
wider for it. That was the phone wave's first job and the shape the
measuring pass had been reporting as 82 findings.

**A sheet hands focus back.** Every surface that takes focus when it opens -
a sheet, a panel, a popover, the palette - calls `useRestoreFocus()` at the
top of its component, before the effect that takes focus, so that closing
it puts focus back on the control that opened it. Until v2.1 none of the ten
did, and Escape on the task menu left a keyboard at the top of the document.
A grid of days is one tab stop and the arrow keys - `lib/gridKeys.ts` - for
the same reason: forty-two cells were forty-two Tabs between the calendar
bar and everything under it.

---

## 7. Data

- **`AppData` is one object, in one key, behind `storage.ts`.** Nothing else
  touches `localStorage` for it.
- **Content the person authors is a top-level list, never a settings field.**
  A settings field is one sync entity, so two devices editing two different
  things in it fight over one key and one of the edits vanishes. `library`,
  `goals` and `categories` are all lists for that reason; a preference about
  how the app behaves is a settings field, and that is the whole of the
  distinction. The picture is the singleton case of the same rule: one
  authored text, so one entity of its own at `picture:north` - top-level like
  the lists, and never in settings, where a blank string would sync as a body
  rather than as a deletion and an erase would come back.
- **Every field added since v1.0 is optional**, so data written before it
  existed still loads. `validate()` in `validate.ts` is a deep type guard
  written as tables - one per entity, a field and what a value in it may be;
  a payload that fails it is discarded whole rather than partly trusted,
  because it is also the import path for a file a person may have edited. A
  new field goes into its entity's table with its check, and into
  `normalizeLoaded` if absent has to become something.
- **A dangling id degrades, never crashes.** A `templateId`, `libraryRef`,
  `sleepProfileId` or `repeatOf` that resolves to nothing is treated exactly as
  if it were absent.
- **Some things live under their own keys and are not in a backup** - the
  clock tools, the sync and backup credentials, the calendar cache, a few
  device-local dismissals and preferences, and the snapshots in IndexedDB.
  The list, with each one's reason, is ARCHITECTURE section 2; add to it
  there rather than here.
- **Timestamps are never written by an action.** `commit()` stamps whatever
  moved - ARCHITECTURE section 7 has the why.

---

## 8. The critique habit

Every wave ends with at least one deliberate pass over what was just built,
looking for what is wrong rather than confirming it works. It has found, among
others: a restore that never reached storage, a North line a finger could not
open, a settings field that had been silently dropped on load for two versions,
and a meeting hidden under the task it clashed with.

What a critique pass actually does:

1. **Re-read the diff as a stranger.** What would you not understand?
2. **Ask what happens when the input is wrong.** A server answering with a
   login page. A file that is not a calendar. A day with no tasks.
3. **Open it in a browser at 390x844 and at 1366x768, in both themes.**
   Measure, do not eyeball.
4. **Check the seams between the new thing and the old.** Almost every real bug
   found this way lived at a boundary: demo mode and the store's import order,
   calendars and `normalizeLoaded`, the week grid and the axis.

Fix what you find in the same wave, and say so in the commit.

---

## 9. Verification in the browser

There is a browser pane. Use it - the test suite cannot see layout.

### `npm run sweep` first

Before opening anything by hand, run the measuring pass. It opens every
screen at 1920x1080, 1600x900 and 1366x768 in both themes on a realistic
full day, and reports what a person would actually hit: text that does not
fit its box, a control with something on top of it, two pieces of text
painted over each other, anything past the right edge, a screen that must
fit and does not, and every visible string's contrast against whatever is
actually painted under it. `--phone` adds 390x844 and the 44px audit;
`--heavy` uses a twenty-task day; `--only=<name>` narrows it while working.

```bash
npm run build && npm run preview   # in one shell
npm run sweep                      # in another
npm run sweep -- --self-check      # prove it can still see a defect
```

**Zero findings is the expected state.** It found fourteen the first time it
ran, including a task list squeezed to zero pixels with seven tasks in it and
a month grid drawing a whole extra week of the next month, so a clean report
is worth having and a dirty one is a wave's work.

`--self-check` plants a defect of each shape on a real screen and reports
whether the pass still sees it. Run that before trusting a clean report you
were not expecting - a measuring tool that has quietly stopped measuring
reads exactly like a codebase with nothing wrong in it.

Both are clean: the desktop since v2.0, the phone since v2.1. A dirty
report is a wave's work, and "it is only the phone" was the sentence that
kept two controls under 44px for two versions.

### And then by hand

- **Measure with `javascript_tool`**, not with screenshots:
  `getBoundingClientRect()`, `getComputedStyle()`, overflow checks. A screenshot
  tells you something looks wrong; a measurement tells you what is wrong.
- **Screenshots are for confirming a finished thing**, and for showing the
  owner. The pane's screenshot occasionally crops - retry, or open a fresh tab.
- **README screenshots are generated, never taken.** `npm run shots` runs
  `scripts/shots.mjs`: the dev server, the sample fortnight under a clock
  pinned to a Wednesday at 15:00, eight PNGs into `docs/screenshots/`.
  Running it twice gives the same files. A screenshot that depends on the
  day somebody ran it is one nobody can regenerate, and a README image
  nobody can regenerate is a README image that goes stale. Rerun it after
  any change to the day view, the demo seed or a theme.
- **Kill and restart the dev server when a phantom error appears.** Vite's
  module cache outlives edits: `rm -rf node_modules/.vite`.

---

## 10. Before calling a wave done

```bash
npx tsc --noEmit
npx vitest run
npm run build
npm run e2e
npm run sweep          # against `npm run preview` of that build
```

All five clean. Then the phone checklist in [`STATE.md`](STATE.md), then
commit, push, and tag if it is a release. CI runs the suite and only publishes
to Pages if the tests and the build both pass; the browser tests run in
their own job beside that and never hold a release. The same workflow runs
on every pull request, and only a push to `main` deploys - a PR from a fork
must never be able to publish.

`npm run e2e` is Playwright driving a real Chromium against `vite preview`
of the production build - the files under `e2e/`, one browser per test,
storage wiped between them. It needs the browser once:
`npx playwright install chromium`. The tour test is the naive walk from
section 13 written down, on a desktop and on a phone; a change to the
tour's words has to be made there too, because it finds every control by
the words the card uses for it.

A browser test that depends on the hour pins the clock before the page
loads - `openFreshAt(page, wednesdayAt(10))` in `e2e/app.ts` - and moves
it by reloading (`reopenAt`), which is what opening the app later is.
Pinned rather than installed: `setFixedTime` leaves the page's timers
running for real, so debounces, animations and the undo toast behave as
they do for a person, and only `Date` answers differently. A test that
reads "the next free slot" or "what still fits before sleep" from a real
clock passes at ten and fails at four.

---

## 11. Scratch stays one stream

Scratch (`lib/scratch.ts`, `views/scratch/`) exists for the thing that has to
be written down in the next second - a number said once, a bug noticed while
doing something else. Its value is that nothing is asked at the moment of
writing, and every addition that asks something takes that value away. So:

- **One stream.** No folders, no notebooks, no colours, no rich text. A
  photograph is the one attachment, because a screenshot is a note somebody
  took with a camera instead of a keyboard - see section 19.
- **The text is the text.** Nothing in a note is parsed. A `#word` was a
  filter for four versions and the row of chips above the stream was the
  price of it; both are gone since v2.5, and a `#` typed before then is
  still a `#`. If a future idea wants to read the words for meaning, it is
  a question asked at the moment of writing, which is the thing this layer
  exists to avoid.
- **A note that needs structure is not scratch any more.** It becomes a task,
  an inbox line, or a document somewhere else. Do not add fields to
  `ScratchNote` to hold structure; add a way out instead.
- **An old note is not an accusation.** The count is shown in `--faint`, with
  no badge and no accent colour, and nothing ever says "unprocessed". Same
  rule as the day view's score: a number that grows in red is a report card.
- **The way out costs one character.** A leading `!`, or the toggle beside
  the field, sends the line to the inbox as something to do instead of into
  the stream. It is never written as a note first and moved afterwards -
  changing your mind mid-sentence would leave one behind every time - and
  the marker says which it is going to be before Enter, not after. This is
  the same rule as the one above it, read the other way: a note that needs
  structure gets a way out, not a field.
- **Capture is never gated.** The key (`S` or the backtick), the floating
  button, the palette command: each opens the box with the cursor in it and
  every keystroke already saved. If a change makes any of those take a second
  step, it is wrong.
