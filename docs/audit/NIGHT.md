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

## What was taken out

One element per screen, per the brief. Listed with what happened after.

_(Stage 8 - filled in as it runs.)_

## What was left alone, and why

- **The day's progress bar keeps the accent.** It is a measure rather than an
  action, which by the rule above should make it neutral. Its own comment
  argues the other way and cites RESEARCH-ADHD section 7: it is the one thing
  on the screen that says "this is going fine" without any reading. A written
  decision with research behind it is not something to overturn at three in
  the morning with nobody to ask.
- **Negative `outline-offset`s stay.** They are geometry, not style: a ring
  on a control clipped by its parent has to be drawn inside it.
