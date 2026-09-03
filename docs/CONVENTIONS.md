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
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
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

Do not assert absolute milliseconds. The suite runs eighty files in parallel on
whatever machine CI hands out. Assert a *ratio* against a baseline measured the
same way, take the fastest of several rounds, and alternate the two sides so a
machine that gets busier partway through slows both equally.

---

## 4. Layout

### Zero scroll, and its exceptions

Three screens must fit their viewport with no scrolling at **1920x1080**,
**1366x768** and **390x844**:

- **Calendar → Month.** If something must give, reduce the detail in a cell.
  **Never raise cell height.**
- **Calendar → Week.** Structurally guaranteed rather than tuned - see below.
- **The day view at the wide breakpoint** (≥1024px), where the whole day fits
  the window and the grid draws at whatever density that takes.

Everything else scrolls vertically and that is fine. **Nothing scrolls
horizontally, ever.** Check with
`document.documentElement.scrollWidth > clientWidth`.

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
**Anything filled with `--accent` uses `--on-accent` for its text.** Hard-coding
white there measured 2.42:1 on the app's loudest button.

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
- **Every field added since v1.0 is optional**, so data written before it
  existed still loads. `validate()` is a hand-written deep type guard; a payload
  that fails it is discarded whole rather than partly trusted, because it is
  also the import path for a file a person may have edited.
- **A dangling id degrades, never crashes.** A `templateId`, `libraryRef`,
  `sleepProfileId` or `repeatOf` that resolves to nothing is treated exactly as
  if it were absent.
- **Three things live under their own keys and are not in a backup**: the clock
  tools, the yesterday dismissal, the calendar cache. Plus snapshots in
  IndexedDB. Each has a reason written where it lives.
- **Timestamps are never written by an action.** `commit()` diffs what is going
  out against what was there and stamps whatever moved. Sixty actions each
  remembering to stamp is sixty chances to forget.

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

- **Measure with `javascript_tool`**, not with screenshots:
  `getBoundingClientRect()`, `getComputedStyle()`, overflow checks. A screenshot
  tells you something looks wrong; a measurement tells you what is wrong.
- **Screenshots are for confirming a finished thing**, and for showing the
  owner. The pane's screenshot occasionally crops - retry, or open a fresh tab.
- **There is no way to write image files from the agent environment.** README
  imagery has to come from the owner, or from the live demo link, which never
  goes stale.
- **Kill and restart the dev server when a phantom error appears.** Vite's
  module cache outlives edits: `rm -rf node_modules/.vite`.

---

## 10. Before calling a wave done

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

All three clean. Then the phone checklist in [`STATE.md`](STATE.md), then
commit, push, and tag if it is a release. CI runs the suite and only publishes
to Pages if the tests and the build both pass.

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
