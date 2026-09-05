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

---

## 5. Design tokens

**No hard-coded values.** Everything comes from a token declared once on
`:root`:

- Spacing `--s0`..`--s8`, radius `--r-chip/-control/-card/-pill/-round`
- Type `--t-xs/sm/md/lg`, plus `--t-input` (16px, the iOS zoom floor - never
  lower it)
- Elevation `--e1/e2/e3`, motion `--dur-fast`, `--dur`, `--ease`
- Palette `--bg`, `--surface`, `--text`, `--muted`, `--faint`, `--accent`,
  `--border`, `--danger`

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

---

## 7. Data

- **`AppData` is one object, in one key, behind `storage.ts`.** Nothing else
  touches `localStorage` for it.
- **Content the person authors is a top-level list, never a settings field.**
  A settings field is one sync entity, so two devices editing two different
  things in it fight over one key and one of the edits vanishes. `library`,
  `goals` and `categories` are all lists for that reason; a preference about
  how the app behaves is a settings field, and that is the whole of the
  distinction.
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

The desktop is clean. `--phone` reports the two debts STATE.md names as the
phone wave's first jobs, and nothing else.

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

- **One stream.** No folders, no notebooks, no colours, no rich text, no
  attachments. A `#word` in the text is a filter, not a folder: the note is
  still in the stream, it just also answers to a name.
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

---

## 12. A partial plan beats a dropped day

Replan (`widgets/day-plan/replan.ts`, `ReplanSheet.tsx`) exists for the
moment a plan breaks: a call, a change, an afternoon away. The failure it
guards against is not the broken piece but what the brain does next - "the
whole day is gone" - so the rules are about tone as much as arithmetic:

- **Never count what was missed.** A summary says what still fits and what
  moves. "Still winnable: 2 of 3 key" is allowed; "you missed 4 tasks" is
  not, in any wording, in any colour.
- **Nothing disappears silently.** A task that no longer fits before sleep is
  named and offered to tomorrow. A plan that would drop something says so
  before Accept, never after.
- **Ten seconds and one press.** Every replan screen is one question, shows
  its answer before it is accepted, and applies in one commit with one undo.
  If a change adds a second question to the path, it is wrong.
- **Away is a pause, not a verdict.** While `DayPlan.away` is set nothing
  nudges; "I'm back" offers one rescue and clears it. A day that was paused
  is scored like any other, because the score is a fact and the pause was a
  choice.

---

## 13. The tour is a mirror of the app

`lib/tour.ts` describes nine steps by pointing at real controls with real
selectors and waiting for real events. That makes it the one piece of this
codebase that goes stale silently: rename a class, move a control behind a
menu, change what a button does, and the tour still compiles, still renders,
and still points at nothing.

**Every wave that changes the UI or adds a feature checks the tour.** Not the
tests alone - walk it, both platforms, all nine steps, in the browser. A
broken or out-of-date tour is a P0 bug, on the same footing as data loss:
it is the first thing a new person sees, and a first impression that points
at an empty rectangle is worse than no tour at all.

What checking it means, concretely:

- **Every `data-tour` target still exists**, and is still reachable the way
  the step's text says it is. The selectors are in `lib/tour.ts`; grep for
  `data-tour` to find the other half of each pair.
- **Every step still ends.** The predicates in `TOUR_EVENTS` watch the store,
  so a feature that stops writing what it used to write leaves a step that
  can never be finished and a person who cannot get past it.
- **The words are still true.** "Nine blocks, one click" is a promise about
  a starter template; change the template and the sentence is a lie.
- **A new feature worth teaching gets a step, and the budget is still 120
  words.** Adding a tenth step means earning it by cutting somewhere else.
  The lines a target carries ("Click Details", "Now press Enter") and the
  captions are bounded separately, per line, in `tour.test.ts`.

### The three standing rules about the thing being pointed at

Each one is the fix for something the owner watched go wrong on a walk
through, and the engine applies them to every step without being asked:

1. **It is visible.** The lit target carries `is-tour-target`, which
   outranks every hover reveal in the stylesheet. The dots on a task card
   are opacity zero on a mouse until the pointer crosses the card; the ring
   was drawn around a button nobody could see.
2. **It is not behind a sheet.** A modal the previous step led into
   (`data-tour-modal`) that does not hold this step's control gets its close
   button lit and the card says "Close this panel first." Every sheet and
   panel a step can open carries the attribute and marks its close button
   with `data-tour-modal-close`.
3. **It says what to do now.** A target carries its own line, and a box
   carries a second one for once something is typed into it. "Type Walk in
   the box" becomes "Now press Enter." on the first keystroke - somebody had
   typed it and waited, because nothing told them the field wanted Enter.

And a fourth, about what happens after: **every step names its outcome.**
One line, what happened and why it matters, held long enough to read, with
Next beside it. A step that ended on a tick and a jump read, to the person
watching the control rather than the card, as the tour skipping by itself.

### The three guards, and why they exist

A tour whose every step waits for a real action is a tour of the app rather
than a slideshow about it, and it is also the one design that can trap
somebody. Three things stop that, and none of them may be removed without
replacing it with something that does the same job:

1. **The hole follows its target.** Scrolled into view before it is measured,
   re-measured on resize, on scroll, on any DOM mutation outside the overlay,
   and on a slow poll besides. The poll is not redundant - a CSS transition
   moves an element without mutating anything. Everything that asks for a
   re-measure is coalesced into one measure per animation frame, because
   measuring writes: the first version of that watcher heard its own output
   and locked the renderer solid inside a second.
2. **A target that is nowhere in the document is said so.** After a grace
   period the card says the control is not on this screen - or why, when the
   step knows: Focus only exists on the card running this minute - and
   offers the way through. It never moves on by itself: that used to happen
   after twelve seconds with a line in the console, and to the person it was
   the tour skipping a step at random. Present-but-unreachable is a
   different failure and is covered by the next one.
3. **Twenty seconds of nothing offers a way through** - do it for me, or skip
   this step. `lib/tourAssist.ts` does the real thing through the real store
   actions, never a fake tick, because the next step needs the state the
   previous one was supposed to leave behind.

### Pacing, and the three steps that wait

Every real step ends on a tick and a caption, held for 3.2 seconds before
the next step: a beat for the tick, which lands somewhere else on the page
from where the eye was, and two seconds for a line of twelve words. Next is
there throughout for anybody faster. Three steps wait for Next instead of
moving on at all - stamping a day, starting Focus, writing a goal - because
what appeared deserves a proper look; the goal step also moves the shell
back to the day and points at the North line, so the person sees where the
goal went rather than being told. The `outcome` lines sit outside the
120-word budget and are bounded separately, because a caption for something
that has already happened is read with the eye free rather than standing
between somebody and a control.

### Three doors in

The tour used to have one: an offer on a day with nothing on it, which is a
screen somebody sees once. It is now also in the shortcut card behind `?` and
in the command palette, both of which are where a person goes when they are
already looking for help. Settings still replays it in a sandbox.

### Before calling a tour change done

Walk it end to end **five times in a row with no code changes between the
runs**: desktop dark, desktop light, 390x844, 768x1024, and once slowly and
awkwardly - stray taps beside the target, Escape, a resize in the middle of a
step. Then once more naively, doing only and exactly what each card says.
Any break resets the count. Escape always leaves the tour, after whatever
is sitting over it - which means every sheet stops the key it handles, or
one press closes the sheet and the tour together.

The walks are driven from the browser pane, and two things about the pane
will mislead you if you do not know them. A hidden pane throttles timers to
once a second and runs no animation frames, so a script that chains several
`await sleep()` calls can take minutes and every later call queues behind
it - it looks exactly like a locked renderer. Put the waits between tool
calls, not inside the page. And `computer` key presses do not always reach
the page; dispatch the key on the element when the press has to land.

---

## 14. The four shelves, and what each is for

Something that is not on a day can be in one of four places, and the whole
value of having four is that each one asks a different amount of you at the
moment of writing. Adding a fifth means proving it is not one of these.

| Shelf | What it holds | What it asks |
|---|---|---|
| **Scratch** | Text, and nothing attached | Nothing at all |
| **Inbox** | A line nobody has decided about | Nothing at all |
| **Backlog** | A decided task with no day | A title, and whatever else you feel like |
| **A float** | A task on a day, with no time | It is already on a day |

The two rules that keep the backlog from becoming the thing this app exists
to take away:

- **Nothing records how old an item is, so nothing can show it.** `BacklogItem`
  has no `createdAt`, deliberately. A list that says "you have been meaning to
  do this for six weeks" is a list that accuses you every time you open it -
  the same reasoning as the scratch count in section 11 and the day score's
  refusal to grow red. `updatedAt` exists for sync and is a fact about a
  device, never rendered.
- **It never comes looking for you.** Collapsed behind a plain count in
  `--faint`, below the inbox, on the day view only. No badge, no colour, no
  offer inside a gap, no nudge, no mention anywhere else. A backlog with two
  hundred things in it has to be able to sit there saying nothing.

What it *is* allowed to be is easy to pull from: one press puts an item on the
day at the next free slot that holds it - the same `widgets/day-plan/autoSlot.ts` arithmetic
quick-add's own time control uses - and it leaves the backlog in the same
commit, because a thing that is on today and still in the backlog is the same
thing written down twice.

Order is priority and is the array's own order. There is no star, no urgency,
no due date, and no sort: a drag or an arrow key is the entire ranking model.

---

## 15. The evening close never appraises

`lib/eveningClose.ts` and `widgets/day-plan/EveningClose.tsx` exist because a
day needs an ending and midnight is not one. The arithmetic is four lines. The
rest of it is tone, and the tone is the feature.

**The day is being closed, not judged.** If a line reads like a report to a
manager, it is wrong, whatever the numbers say. That is the whole rule; the
rest is what it means in practice.

- **What was not done is not mentioned.** Not counted, not named, not implied.
  It is still in the list underneath, where somebody can look at it if they
  want to. The card does not point at it.
- **"Enough" is reachable every day.** Half the day's tasks, or every key one.
  That threshold is the 40% doctrine in
  [`RESEARCH-ADHD.md`](RESEARCH-ADHD.md) written as a sentence: a day that got
  half of a real plan done is a day that went well, and an app that only says
  so at ten out of ten says so four times a year.
- **A day that did not reach it is not failed either.** "The day gave what it
  gave" is the whole of what is said. There is no third, sadder tier below
  that, and adding one would be inventing a way to lose.
- **No colour means anything on that card.** No accent bar, no tick, no ring,
  no red, no percentage, no comparison with yesterday. The only filled control
  is the button that ends it, because that is the only action on it.
- **The one question is optional and asked once.** "Best moment today?" is a
  plain empty field. Nothing measures whether days have one, nothing prompts
  for it during the day, and a day that already carries a line shows the line
  rather than asking again.
- **The offer to push is an offer.** It names a number, because that is a fact
  about a button, and gives no reason, because leaving three things unfinished
  is not a problem this card exists to solve.

The words this app does not use, anywhere near a day's outcome: missed,
failed, behind, only, should, incomplete, overdue. A test in
`eveningClose.test.ts` checks the generated line against that list, on every
shape of day.

---

## 16. Capture answers before it asks

`widgets/day-plan/QuickAdd.tsx` is the one field every shelf in section 14 is
reached through, and the rule it follows is the reason the whole thing exists:
**the ordinary path types a title and presses Enter.** Everything else the task
needs - a time, a length, a colour - is already answered when that happens.

The rule is the app's, not quick-add's: **where a person can choose instead
of type, they choose. Typing is for what the app cannot know - a name.
Every control opens already holding an answer.** A length is a chip, not a
number to work out; a unit is a word to tap; a repeat is four buttons, not
a dropdown; a page count is a number with arrows and a "+25". The controls
are shared so the answer is asked for one way everywhere: `DurationControl`
(the button and its chips, in quick-add, the template editor and the
library's add-to-template form), `DurationChips` (the same chips in a row,
in the task detail sheet), `MinuteStepInput`, `CountStepInput`, `TimePicker`.
A bare `<input type="number">` or a native `<select>` over a fixed set of
answers is a control that has not been built yet. The library's add line
(`LibraryAddLine.tsx`) is quick-add's shape applied to a book: the words,
a unit control, a count control, and the same one-truth rule between them.

- **A default is a real answer, not a placeholder.** The time control opens on
  the first free slot the day genuinely has (`widgets/day-plan/autoSlot.ts`), not on a
  blank or on a round number nobody chose. When there is no such slot it says
  "No time" and the task is a float, because a planner that answers a full day
  by booking 23:45 is one people stop believing.
- **The text and the controls are one truth, never two.** A line that carries
  its own time or duration wins, and the controls redraw to show what was
  understood. Push an arrow or tap a chip against such a line and the *words*
  are rewritten - see `replaceLeadingTime` and `replaceTrailingDuration`. A
  field saying one thing while a control beside it says another is the bug
  this rule exists to make impossible.
- **What is remembered is a habit, not a plan.** The last duration chosen
  persists, under its own key, outside the backup and outside sync. The
  category does not persist at all: it follows the sitting, because most tasks
  typed in one go belong together and carrying that to tomorrow would be a
  guess.
- **A suggestion is now, to the minute.** Not rounded up to the next quarter.
  Focus is only ever offered on the *running* card, so a task starting eight
  minutes from now would be quietly out of reach of the one feature for doing
  something immediately. The arrows snap to the quarter from there, which is
  where a round number belongs: in the answer somebody asked for.

---

## 17. A visible way in, on every platform

Every feature has at least one control somebody can see, on a phone and on
a desktop. A key is a shortcut, never the only road: a person who has not
read the `?` card does not know the key exists, and to them a feature with
no button is a feature the app does not have.

Scratch is the case that wrote this rule. On a phone it had the floating
button; on a desktop the floating button is not mounted, so `S` and the
backtick were the whole of the way in, and the owner watched somebody use
the app for a week without finding it. It has a pen in the header now,
beside the clock.

What "visible" means, concretely:

- **A control on screen, in the place the feature belongs**, not a line in
  the shortcut card or the palette. Those are the second and third ways in
  and every feature should be in both, but neither is the first.
- **Both platforms, checked separately.** The phone checklist in STATE.md
  and the wide layout are different screens with different chrome, and a
  control mounted for one is not automatically mounted for the other -
  `ScratchFab` is `!isWide` and the header pen is `isWide`.
- **The tooltip names the key.** `title="Scratch - S"`: the visible control
  is where somebody learns the shortcut, which is the order that works.

---

## 18. Every invented word is explained where it is used

This app invented, or bent, about twenty terms: Ongoing, Key, Push, Stamp,
Focus, day type and its four values, the difference between the inbox and
the backlog, what a unit is in the library, what North is for, what a sleep
schedule does, and how sync differs from a backup. Every one of them means
something precise here and something else, or nothing, everywhere else.

- **The copy lives in one file**, [`src/lib/explain.ts`](../src/lib/explain.ts),
  because copy is read as copy or it is not read at all. Twenty string
  literals across twenty components is a vocabulary nobody can see the whole
  of, and two entries can contradict each other for a year without anybody
  noticing.
- **One component renders it**, `views/Explain.tsx`, in two shapes: a small
  (i) that opens a bubble, and the same sentence printed in place for a term
  that *is* a choice somebody is making right now. A tooltip on a control
  somebody is deciding about is an explanation behind a second decision.
- **One or two sentences, and nothing to press inside.** The moment a bubble
  has a control in it, it has to be reachable, which makes it a popover,
  which makes it a thing somebody has to get out of.
- **Three ways in, always.** A mouse rests on it for 400ms, a finger taps it,
  a keyboard focuses it. A tooltip only a mouse can reach is an explanation
  half the people who need it cannot get to - section 17, one step down.
- **The list is the test's own data.** `Explain.test.tsx` walks every id in
  `EXPLAIN_IDS`, checks it has a sentence, checks the sentence is at most two
  sentences with no dash, and renders the screen it is supposed to live on to
  check it is actually there. Adding a term without copy fails; writing copy
  for a term nobody put on screen fails too, which is the more useful of the
  two.

**If a sentence here and the behaviour disagree, the sentence is the bug.**
Changing what Push does means changing what Push says, in the same commit.
