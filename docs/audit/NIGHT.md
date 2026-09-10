# The night pass, v2.20

> The owner went to bed and left a brief: make the app look like a thing
> somebody designed rather than a thing that grew, ask nothing, and where a
> question comes up take the simpler answer and write it down.
>
> The counts are generated beside this, in
> [`NIGHT-COUNTS.md`](NIGHT-COUNTS.md) - `npm run inventory -- --md`. This
> file is the account: what changed, what was taken out, and every decision
> made on the owner's behalf.
>
> Before and after of every screen, both themes, are in
> [`docs/screenshots/night/`](../screenshots/night).

## The numbers

| | before | after |
| --- | --- | --- |
| font-size declarations | 435 | 435 |
| of which literals | 0 | 0 |
| distinct spacing values | 17 | 17 |
| distinct border-radius values | 14 | 12 |
| border-radius literals | 10 | **0** |
| distinct durations | 11 | **3** |
| keyframes | 20 | **19** |
| lines reading the accent | 217 | 210 |

Type was already clean and stayed clean: `scale.test.ts` has been holding it,
and there is not one literal font-size in the file. Spacing was already close
to its scale - nine tokens, the hairline, the two half-steps, and four
literals that all sit inside a `calc()` beside a token, which is the one
position the scale test allows and the one position where a number is
geometry rather than a gap.

## What each screen's accent is for

The rule the brief set: the accent marks the one thing the system holds most
important on that screen, and if three things are blue then none of them is.
Writing the sentence for each screen is the test - a screen the sentence
cannot be written for has no hierarchy, and that is a finding.

The app turned out to have **two** signal colours already, which is what made
the sentences writable:

- **`--accent` is what you can act on.** A primary action; a selection, in a
  weaker form than an action.
- **`--mark` is what is happening now, or what is key.** The now line, the
  running task, a key task, a finished timer.

| screen | the one thing |
| --- | --- |
| Today | **now** - the line across the timeline, and the task running on it. `--mark`. |
| Calendar month and week | **today**, and on the week the now line. |
| Templates | **the template being edited**, and inside it the primary Save. |
| Library | **New list**, and inside a list the item being read. |
| Review | **the period chosen**, which is the only choice on the screen. |
| North | **Compose**, the one control on a page that is otherwise read. |
| Settings | **the switch being changed**; there is no primary action. |

## What changed

### Corners

Fourteen distinct radius values, ten of them bare literals - `1px` on five
bars, `3px` on four blocks. A literal corner is one a theme cannot reach:
`--r-control` and `--r-card` are the preset's own `--radius` and `--edge`, so
a preset shipping the hand-drawn edge from THEMES section 5 would have
rounded every card and left those nine square. Zero literals now, and
`scale.test.ts` fails on the next one.

The smallest step was called `--r-chip` and twelve of its users are not
chips. It is `--r-mark`, and the stylesheet says what each step is for.

**Decision made for the owner:** the brief asked for two radii, one for
controls and one for areas. There are three. A checkbox is 18px and a button
is 38px, and at the button's corner the checkbox is a circle - so the corner
goes by the size of the thing rather than by its role. DECISIONS carries it.

### Movement

Eleven durations: two tokens and nine numbers written at the point of use,
from 220ms to 1.6s, no two alike. Seven were movement and are `--dur` now.

**Decision made for the owner:** `--dur-sweep` is a third value and
deliberately not one of the two the brief asked for. It is how long a ring
takes to reach the number under it, and that number changes once a second;
without it a countdown ring steps rather than sweeps. It is a property of the
clock rather than of the interface. The two rings using it were on 1s and
500ms, and the floating clock's was missing the reduced-motion guard the
focus ring has had since it was drawn.

### The accent

- The week's now line was `--accent` and the day's was `--mark`: one fact in
  two colours on two screens showing the same day. Both are `--mark`.
- A ticked checkbox was filled with the accent, which put the loudest colour
  in the app on every finished task - seventeen of them down a full day,
  against one primary action and one now line that are meant to be what the
  eye finds. The box keeps its outline and the tick is drawn in the text
  colour.
- A selected segment was a solid accent fill, which is the same weight as the
  one primary action on the screen. It is a tint now, with ordinary ink.
- A pressed title toggle drew an outline as well as a tint, and an outline is
  what this app uses for keyboard focus and nothing else. The tint alone.

**Reverted during the wave:** the tinted segment was first drawn with accent
ink on the accent tint, which came out at 3.9:1 on Light against a floor of
4.5. The sweep caught it before the commit. Ordinary ink on the tint.

### Numbers in columns

Six places drew a figure with another figure directly above or beside it and
let the browser use proportional digits, so the column leaned: the calendar
grid's forty-two dates, the done-over-planned on each of those cells, the
pushed count beside it, the mini calendar's thirty-five, the figure at the
foot of each week column, and the note column in the day's digest. All
tabular now, which brings the file to 67 uses of `tabular-nums` and no number
in a column without one.

**Not done, and worth saying:** the brief also asked for optical centring in
buttons and for the first and last line of a text block not to carry
half-leading. The first needs a fixed box per control rather than padding,
which is a change to every button in the app and not a night's work done
safely; the second wants `text-box-trim`, which Chromium has and Safari does
not, on an app that is iPhone-first. Both are left, and left written down.

## What was taken out

One element per screen, per the brief.

| screen | what went | what happened |
| --- | --- | --- |
| Today | the word **Sleep** on the sleep band | The band is the quietest ground on the grid, it is always the first and last thing on a day, and the hour axis beside it says which hours those are. A screen reader never had the word - the whole decorative layer is `aria-hidden` and the boundary has its own sentence. |
| Calendar month | the month's **summary line** | It counted the days with a plan on them, which is the one fact the grid under it draws forty-two times. |
| Calendar month, week and Review | the **box around every period arrow** | The app drew period arrows three ways: a bordered 44px square on the calendar and a bordered 38px one on Review, against a bare glyph in both places on Today. One job, one look. Review's were also the only period arrows in the app under 44px, and they are 44 now. |
| Templates | the **block count** on a card | The preview line above it names the first four blocks and ends in "+5 more", which is the same number arrived at by reading rather than by being told. What stays is what the preview cannot say: that it is a week, what kind of day it makes, which sleep schedule it carries. |
| Library | the **"N going" count** on a jump chip | The chip's job is to jump to a list, and the header it jumps to says "3 going, counted in chapters" thirty pixels below it. |
| Settings | the **section heading inside the panel** | The list beside it names the same section and highlights it: one word, twice, forty pixels apart. A heading is what a screen reader navigates a settings page by, so it stays in the document and only the second copy on the screen went. |
| North | **nothing** | v2.19 already took this page to three sentences per goal with everything else folded away, and counted the words on it the owner did not write: three, all of them inside a sentence. There is no element left whose removal would not remove content. |

**Decision made for the owner, and the easiest one to undo:** the *Sleep*
label had a test whose name argued for it - "so it reads as sleep rather than
padding" - but no report behind it, and the brief asks for that band to carry
no text it does not need. It is one line in `TimelineGrid.tsx` if the morning
disagrees.

**Caught by the sweep during this stage:** taking the box off Review's arrows
turned their glyph from `--text` to `--muted`, and `--muted` under the global
disabled fade is 2.08:1 against a floor of 3. Fixed with the pattern the
repo had already written for exactly this, forty lines away in the library:
the ink goes to `--faint` and the opacity back to 1.

## What was left alone, and why

- **The day's progress bar keeps the accent.** It is a measure rather than an
  action, which by the rule above should make it neutral. Its own comment
  argues the other way and cites RESEARCH-ADHD section 7: it is the one thing
  on the screen that says "this is going fine" without any reading. A written
  decision with research behind it is not something to overturn at three in
  the morning with nobody to ask.
- **Negative `outline-offset`s stay.** They are geometry, not style: a ring
  on a control clipped by its parent has to be drawn inside it.
