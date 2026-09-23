# Design: the system every screen is built from

Written for v2.25, the design pass, after [`DESIGN-AUDIT.md`](DESIGN-AUDIT.md)
measured what made the app look assembled one screen at a time. The owner's
direction was calm, clean, a lot of air - Things 3, Linear, Bear, iA Writer -
and precision rather than decoration.

This file is the system. The tokens it names live on `:root` in
`src/styles.css` and in the presets in `src/lib/themes.ts`; `design.test.ts`
holds the values to what is written here, and holds what is being retired to
a number that only goes down. [`CONVENTIONS.md`](CONVENTIONS.md) section 5 is
the short form of it for somebody writing a rule.

---

## Five principles

1. **Separate with ground and space, not lines.** A card is a surface on the
   page, a control is a quiet fill on its surface, a group is the room
   around it. A line is kept only where it carries information: a scale
   (the timeline's hours), a divider in a long list, a focus halo.
2. **A thing's role decides its size.** Every size, gap, corner, height and
   weight below is picked by what the thing is - a caption, a control, a
   page - and never tuned by eye for one screen.
3. **Quiet until touched.** At rest a control is a fill and a word. Under
   the pointer its ground deepens; chosen, it takes the accent's quiet
   ground; focused from a keyboard, a halo. Nothing moves.
4. **One frame for every page.** A title stands in the same place on every
   page, over one of two column widths, with its actions at the right of the
   same row - one look, rule 7.
5. **Motion answers, it never performs.** A press answers in 120ms, a layer
   arrives in 180ms, easing out. Nothing bounces, nothing scales on a press,
   nothing is staggered. With reduced motion nothing moves at all; colour and
   opacity still change.

And the rules the app already lives by, unchanged: nothing red as a verdict,
no score, no streak; a colour is never the only way something is said; every
string reads at 4.5:1 and every mark at 3:1; every control is a 44px target
on a finger.

---

## One look, seven rules

The owner's brief of 2026-09-22: the whole app held to seven rules, on
every screen and every modal, at 1920x1080 and on a 375x812 phone. Moving
from Templates to Kitchen to the day, nothing may jump.

1. **One grid.** Every margin, padding and gap is a step of the scale under
   Spacing, by its token. No spacing in `styles.css` is written as a number.
2. **One left line.** In a card or a form, every row starts on one edge.
3. **One height in a row, one corner, five sizes.** The controls in a row
   are one height and stand on one centre line; everything that has a
   corner has the one corner; the app has five type sizes.
4. **Nothing stretched.** A field is as wide as what goes in it, up to a
   limit, and what belongs to a field stands in the field's row.
5. **A row stays a row.** A row that does not fit is redesigned - made
   smaller, its chips made a menu, or given a second row with its own
   label - and never left to wrap. Since stage 5 every such row is one of
   three shapes, named in the stylesheet's last section: a strip of chips
   that scrolls sideways inside its own box; a second row by design, a
   grid with a row for each part; or one line whose long part ends in an
   ellipsis. A grid, a column and a nowrap row are what the measure
   passes, so a row that passes is one of the three and says so.
6. **It fits.** On a desktop no page scrolls: a list that is long scrolls
   inside its own box. On a phone the page scrolls only where the content
   is long by nature - a day, a week's agenda, a list of templates, books
   or recipes, a text, the settings, and the month with its roster's rows
   under it; the month alone and the week's grid fit. Nothing ever scrolls
   sideways. Since stage 4 the shell is the window's height on every view
   at 1024px and up, `main` is a column, and every page is its head and a
   `.page-body` that scrolls under it, its scrollbar at the body's own edge
   when there is anything to scroll.
7. **One frame.** The title, the page's width, the first card's edge and
   the primary button stand in the same place on every screen.

`scripts/unify.js` measures the seven on the screen in front of it;
`node scripts/sweep.mjs --unify` walks every screen and modal the sweep
knows at both sizes, and `scripts/unify-report.mjs` writes what it found
into [`DESIGN-AUDIT.md`](DESIGN-AUDIT.md). A screen is closed when it
measures nothing. Rules 1 and 3 are held in the source as well:
`design.test.ts` fails on a pixel in a margin, a padding or a gap, on a font
size that is not a token, and on a corner that is not `--r`.

Five things look like room and are not gaps, and the audit knows each by
what it measures rather than by a name:

- **A line.** `--hairline` (1px) where two grounds meet, `--stroke` (2px)
  down an edge.
- **An indent onto an edge.** The meta line under its title, a sentence on
  the answers' edge after a form's label column, a list's words where the
  next list's words start: rule 2's left line, as wide as the mark or the
  label it steps past, and written as that width's token and a step.
- **A line on a control's centre line.** Half of what a control's height
  leaves round one line of the type scale, written from those two tokens.
- **An edge taken back.** A negative margin that takes a field's own inner
  edge and hairline back out, so its words stand on the row's edge; or one
  that keeps a mark's 44px target without its line growing taller.
- **The frame's room.** The mount node keeps the rail's width and the
  phone bar's height free: those bars' own sizes.

---

## Type

One family, the system sans (`--font-body`), and five sizes - one look,
rule 3.

| Token | Size | Role |
|---|---|---|
| `--t-xs` | 11px | Captions: labels over fields, meta under a title, counts, hour marks |
| `--t-sm` | 13px | Interface: buttons, chips, rows, secondary text, most of what is on a screen |
| `--t-md` | 16px | Body, reading and writing: a task's title, every field, North's text, a note, the journal's page |
| `--t-lg` | 20px | A page's title, a sheet's title, the clock |
| `--t-xl` | 40px | Display numerals: the timer's reading, the time on the Focus screen |

Body and reading were two sizes, 15 and 17, and are one: 16, which is also
the floor a field on a finger needs before iOS stops zooming into it.
`--t-read` is written `max(16px, var(--t-md))` for that floor, and at the
default text size it is `--t-md` itself; at text size s, where the body is
15px, the fields and the pages read at length keep 16px - the one setting
with a sixth size, and for that reason only. The Focus screen's time and
task, `--t-focus` and `--t-focus-title`, are `--t-xl` and `--t-lg`, and
`--t-glyph`, a glyph drawn as text (a menu's dots), is `--t-lg`. The text
size setting scales the five together: s is 10, 12, 15, 18 and 36, l is 12,
14.5, 18, 23 and 44. There is no 10px at the default size, which is below a
size worth reading.

**Weights: three.** `--w-regular` 400 for reading and body; `--w-medium` 500
for a row's title and a label; `--w-strong` 600 for a page's title, a button,
a selected choice, and a key task. Nothing is 650 or 700.

**Line heights: three.** `--lh-tight` 1.25 for titles, numerals and a
control's single line; `--lh-ui` 1.4 for rows, labels and interface text
that wraps; `--lh-read` 1.6 for anything read as prose. North's page and
its field are the one place prose is set a tenth looser, at 1.7, which the
owner's brief for writing there asked for - written as `--lh-read` plus 0.1
where it is used, so the step stays tied to the scale. The smallest boxes
the app draws - a week's block, a month cell's lines, a squeezed block on
the timeline - set their one line at 1.1 to 1.2, written as numbers beside
the boxes they fit.

**Labels are sentence case.** A label is `--t-xs`, `--w-medium`, `--muted`,
with no tracking - "How long", not "HOW LONG". Capitals appear only where a
person typed them: North's headings are the owner's own capitals and stay
so. A figure that changes or lines up with another uses tabular numerals.

**At most four sizes on one screen, and five in the app.** Today is 11, 13,
16 and 20; North is 13, 16 and 20 - the picture, the headings and the
signature at 20, the lines under the headings at 16. Measured on every
screen at both sizes on 2026-09-22: the app draws 11, 13, 16 and 20, and 40
only on the timer.

## Spacing

One scale, seven steps - one look, rule 1. Every margin, padding and gap is
one of them, by its token: `design.test.ts` fails on a spacing declaration
that writes a number of pixels, even inside a `calc()`, and
`scripts/unify.js` on a computed one that is not a step.

| Token | Size | Between |
|---|---|---|
| `--s1` | 4px | An icon and its word; a label and its field |
| `--s2` | 8px | Things in one row: chips, buttons, a title and its meta |
| `--s3` | 12px | Rows in a list or a form; a control's inner edge |
| `--s4` | 16px | A surface's inner edge; groups inside one surface |
| `--s6` | 24px | Sections of a page; a page title and what is under it |
| `--s8` | 32px | Regions of a screen side by side |
| `--s12` | 48px | The top of a page's content, and the space before a page ends |

A line is not a gap. `--hairline` (1px) is where two grounds meet - the
parts of a joined line like quick-add's, the rows of a list that touch -
and `--stroke` (2px) is an edge drawn down a card or a block. A card draws
its stroke inside its own room, so its words stand where every other card's
do; a block on the week or the timeline draws its edge as a border and its
words stand a step after it. The half-steps the smallest boxes had, 2, 3 and
6, are gone, and there is no 20 and no 28: nobody could choose between them
and their neighbours.

Compact density is one step tighter on the same grid - 4, 4, 8, 12, 16, 24
and 32 - never off it.

A dialog stands `--s12` under the top of the window at every size: the
command palette, the scratch pad and the journal open at one height.

The five kinds of room that are not gaps - a line, an indent onto another
line's edge, a line on a control's centre line, an edge taken back, the
frame's room for the rail and the bar - are under "One look, seven rules".

## Corners

One corner - one look, rule 3.

| Token | Value | For |
|---|---|---|
| `--r` | 8px | Everything with a corner: a check box, a cell, a chip, a control, a card, a sheet, a menu |
| `--r-round` | 50% | The circle: a dot, a swatch, a ring |

`--r-mark`, `--r-control`, `--r-card` and `--r-pill` are all `var(--r)`,
kept as names so a rule still says what it rounds. `--r-control` and
`--r-card` are the preset's own `--radius` and `--edge`, 8px in every
preset. There were two radii, 6 and 10, and a pill: three shapes where the
eye reads one thing. A chip is a control, and has a control's corner.

## Colour

The roles, and the tokens that carry them. A preset (Dark, Light, Midnight)
gives the values; a screen only ever names the role.

| Role | Token | Use |
|---|---|---|
| Ground | `--bg` | The page |
| Surface | `--surface` | A card, a pane, the day's column - one step off the page |
| Raised surface | `--surface-raised` | What covers a surface: a popover, a menu, a sheet, a modal |
| Text | `--text` | What is read |
| Secondary text | `--muted` | Meta, descriptions, labels, a quiet button's word |
| Quiet text | `--faint` | A placeholder, an hour mark, a disabled control |
| Accent | `--accent` | The one primary action, the current selection's mark, focus |
| Accent ground | `--accent-dim` | A chosen chip, a chosen option in a menu |
| Line | `--border` | A divider, a scale, nothing else |
| Fill | `--fill` | The ground of a control at rest: a field, a secondary button, a chip, a segmented control |
| Strong fill | `--fill-strong` | The same ground under the pointer or pressed |
| Thumb | `--thumb` | The chosen segment inside a segmented control: the strong fill in a dark mode, the card's white in the light one |
| Scrim | `--scrim` | Under every modal and sheet, one strength per mode |
| Focus | `--ring` | The halo around a focused field or control, the accent at 40% |
| Mark, danger, good | `--mark`, `--danger`, `--good` | Now and a key task; a destructive action's ink; a finished thing |

**The fills are derived, not chosen.** `--fill` and `--fill-strong` are the
text colour mixed into a ground with `color-mix`, so every preset and every
override has them without a value of its own: 5% and 10% of `--text` over
`--surface` in a dark mode, 4% and 8% over `--bg` in the light one, where a
white card and an off-white page both need to see the same field. The mixes
are written once in `FILLS` in `src/lib/themes.ts`, and the contrast test
mixes exactly those: text and secondary text read at 4.5:1 on both fills in
every preset, the accent at 3:1. Light's secondary ink is `#60656a` since
v2.25, a step darker, so that it does.

**On a layer a dark mode mixes the fills over the layer's ground.** Over
`--surface`, 5% of the text came out the colour of `--surface-raised`
itself, so in the dark themes every field, chip, row and secondary button
in a sheet, a popover or a menu had no shape - the light theme's, mixed over
the page, always had. Every element that stands on the raised ground
re-mixes the same two steps over it (`FILLS.darkLayer`); the contrast test
holds those too, and fails if something new is painted on the raised ground
without being one of the layers that does.

**The accent is spent once per view.** One filled primary button at most; a
chosen chip takes `--accent-dim` and keeps the text's ink, and a chosen
segment takes the thumb.

**Quiet text never stands on a fill.** `--faint` is for the page and a card;
anything written on a fill - a row in a sheet, a chip, a field's value -
uses `--muted` or `--text`, which the contrast test holds on both fills. The
first sheet rebuilt on the fill put a quiet time on a raised row at 4.46:1.
**Danger is an ink, not a verdict**: it marks the control that deletes, and
nothing else in the app is red.

## Lines

A border is drawn only for:

- a divider between the groups of a long list (Settings), or between a
  panel's part and the next (the timer's sound, a pane's foot),
- a scale the eye reads positions against (the timeline's hours, the month's
  weeks),
- the focus halo,
- a mark that says what a thing is: a category's or a calendar's edge down
  a block's left side, the mark's edge beside the one fact a restore asks to
  be weighed, the ring on a day that has writing, the quotation rule beside
  a day's journal,
- a small drawing made of edges - a tick, a chevron, a caret, a bubble's
  point - and a check box's own outline,
- a thing that has no place yet, dashed: a Later chip, a set-aside item, a
  block with no length, a photo on another device,
- something being moved or shown: the drop line and the ghost while a block
  is dragged, the gap that is open, the tour's ring.

Not around a card on the page, a control, a chip, a cell, a layer, or a
list's rows: those are grounds and room. Where a control needs its size held
while its edge changes, the edge is `1px solid transparent`.

## Elevation and shadows

Three steps of ground carry depth - page, surface, raised surface - and
shadows belong to layers only:

| Token | For |
|---|---|
| `--e2` | A popover, a menu, a bubble, something in the hand while it is dragged |
| `--e3` | A modal and a sheet |

Every layer stands on `--surface-raised` with no border. Each lift carries a
hairline of its own - a one-pixel ring at 6% drawn as part of the shadow -
because a raised ground over a dark page is only a few percent lighter, and
a layer needs an edge that can be found without a line around everything
under it. The light theme's lifts are softer. Under every modal and sheet is
the one `--scrim`; the photo viewer, which shows a picture rather than a
layer, is the one darker ground.

Nothing resting on the page casts a shadow - except two sets of cards, each
asked for: North's (the picture's plate, the heading cards and the field) and
Kitchen's recipe cards since v2.30. They carry `--e2`, and in a dark theme a
few percent of light at their top edge; Kitchen's also take the Meals
category's colour down their left edge and a breath of it in their ground, the
mark a meal block has on the day. See DECISIONS "North is one text, goals
retired" and "Kitchen, as it was meant".

## Motion

| Token | Value | For |
|---|---|---|
| `--dur-fast` | 120ms | A control answering: a ground under the pointer, a toggle, a check |
| `--dur` | 180ms | A layer arriving or leaving, a disclosure opening |
| `--ease` | `cubic-bezier(0.2, 0, 0, 1)` | Everything: out quickly, settle |

No transform on a press, no overshoot, no sequence of things arriving one
after another. `--dur-sweep` is not interface motion: it is the second a
countdown's ring takes to reach its number. Under `prefers-reduced-motion`
anything that translates, scales or clips is still; colour and opacity keep
their durations.

## Controls

**One height.** `--control-h` is 36px on a mouse, 32px at compact density,
and 44px on a finger. A button, a field, a select, a chip, a segmented
control and a stepper are all that tall, so a row of them is one line.
Things that are not controls - a check box, a swatch, a count - keep their
own size and grow to 44px on a finger through an overlay, as they do today.

### Fields

- Ground `--fill`, no visible edge, `--r-control`, `--control-h` tall,
  `--s3` inside.
- Text `--t-md` on a mouse and `--t-read` on a finger; placeholder `--faint`.
- Under the pointer `--fill-strong`.
- Focused: the ground stays, and a halo of `--ring` stands around the field -
  the one accent on a form besides its primary button.
- A label sits above a field, `--s1` away, in the label style.
- **A form of several questions hangs its answers off one edge.** Either
  every label stands in one column at the left, or every label stands over
  its answer - one way for the whole form - and every answer starts where
  every other one starts: the dots, a list, the day switches, a field. A sentence's field takes the row to the form's right edge, where
  its last button ends; a field for four letters or a number is as wide as
  they are. On a phone every answer goes under its label, all of them, so
  the form keeps one edge there too. Where a set of dots is an answer, the
  colours stand on the edge and the chosen one's ring stands outside it, the
  way a focus ring does - except at a scroller's edge, which would cut the
  ring. `npm run precision` measures it.
- A multi-line field grows with its text; a writing surface (North) has no
  ground at all and reads at `--t-read` and `--lh-read`.
- A select is a field with a chevron; a stepper is a field with quiet minus
  and plus inside its own ground.

### Buttons

Three kinds, all `--control-h` tall, `--s4` inside, `--r-control`, `--t-sm` at
`--w-strong`:

| Kind | At rest | Under the pointer | For |
|---|---|---|---|
| Primary | `--accent` ground, `--on-accent` ink | the accent a little lighter | The one action a view or a sheet is for |
| Secondary | `--fill` ground, `--text` ink | `--fill-strong` | Every other action with weight |
| Quiet | no ground, `--muted` ink | `--fill` ground, `--text` ink | Cancel, Dismiss, Edit, Copy, and every link that does a button's job |

- **Destructive** is the secondary or quiet kind with `--danger` ink; its
  second press, armed, fills with `--danger` and `--on-danger` ink.
- **An icon button** is the quiet kind, square.
- **A quiet button at either end of a row stands its word on the row's
  edge.** It has no ground, so to the eye it is its word: the padding goes
  outside the edge and the ground under the pointer reaches past it. Edit at
  the end of a card's head, Delete at the start of a form's last row, Back at
  the start of a page. A mark in a square - a cross, an arrow - is the square.
  `npm run precision` measures it.
- **A chip** is a choice: `--fill`, `--r-pill`, `--control-h`; chosen, the
  accent ground. A template's chip, chosen, takes the template's own colour
  at 22% instead, since the chip is that template.
- **A segmented control** is one `--fill` ground with its options inside it,
  two pixels in, at `--r-mark`; the chosen one takes `--thumb`. On a finger
  the options meet the ground's edge, so each is the full 44px.
- **A menu's options**, and the options in a picker's panel, are rows: no
  ground at rest, `--fill` under the pointer, the accent ground for the one
  that is chosen, `--r-mark`.
- **A stepper** is a field: the number and its two arrows inside one fill,
  with the field's halo when it has the caret.
- **A check box** is a box with a 2px edge - 24px, or 18px where a list is
  dense - and its tick is one path in the text's ink, centred by the box at
  either size. Ticked, the edge takes the secondary ink; never an accent
  fill. On a task the tick is drawn from left to right; elsewhere a box is a
  switch and is simply on.
- Disabled: the same shape, `--faint` ink, no ground change on hover.

### Where actions stand

- **A row is two groups on two edges.** Whatever stands in a row - a title
  and its buttons, a status and its toggle - stands in a group anchored to
  the left edge of its column or in one anchored to the right, and the one
  space that changes is between the two. Nothing floats in the middle with
  room on both sides; the only middle thing allowed is words between two
  arrows. Every item in a row shares the row's centre line, whichever box
  holds it. `npm run precision` measures both.
- **Nothing moves when a word changes.** A period's arrows stand at the
  right end of its title row, last, so a longer day or week name moves
  nothing; the controls that come and go with the period grow to their left.
- **The day's masthead lies on the columns under it.** On a wide screen its
  right half starts on the task column's left edge and ends on its right
  edge: what the day came from and its doors in the first row, the day's
  progress and the view toggle in the second. Its left half is the day's
  name, its date and the time on one line, and the goal's line under them.
  It has no day arrows where the month is beside it.
- **Controls that fill in one thing stand as one line.** The quick add's
  time, words and length touch - one ground, a hairline of the column's
  ground between them, the outer corners rounded - with one halo round all
  three while any has the focus.
- **A page's action** stands at the right end of the page's title row.
- **A form, a sheet or a modal** ends in one row: a destructive action at
  the left, then the rest at the right with the primary last. Cancel is
  quiet, beside the primary, and comes first in the document too, so Tab
  reads the row in the order it is seen.
- **A line that says what the press will do stands on the press's row.** A
  count, a colour's name, the days staged: at the row's left edge, with
  Cancel and the action at its right, rather than a line with a row of
  buttons under it and a gap beside each. Where the row is too short for
  both, the buttons wrap under the line and stay at the right. A sentence of
  more than a line - Replan's plan, a restore's warning - keeps its own band
  over the row, because squeezing it beside two buttons makes it longer.
- **A header's panel** hangs from its button on a desktop, and on a phone
  from the right edge of the header's tools, where it cannot start past the
  left of the screen.
- **A row's actions** stand at its right end, quiet, and appear in full
  under the pointer or on focus only where the row would otherwise be
  crowded.

## Empty states

One quiet line and at most one action, where the content would have begun:
the line in `--t-sm` and `--muted` at the reading width, the action a
secondary button `--s3` under it. No card around it, no illustration, no
second offer. A first run that has more to say says it once, in that shape,
and lets the first action lead to the rest.

An empty page is framed exactly as it will be once something is in it: the
same title, the page's own action at the right of it - New template, New
list, New recipe, Write - and the same column, so nothing moves when the
first thing arrives. The line under the title is the page's empty state;
starters, where a page has them, are offers under the line, never a second
door to the page's action. `npm run precision` measures the frame across
the pages, empty and full.

## The page

One frame for every page - one look, rule 7: going from Templates to Kitchen
to the day, nothing moves.

- **The frame.** Every page takes the shell's whole width. Its title stands
  at the frame's left edge and its action at the frame's right, on one row
  one control tall, at the same height on every page - the day's name
  included, whose masthead's first row runs across the rail's column so the
  rail begins under it. The title is `--t-lg` at `--w-strong` and
  `--lh-tight`; North's is the one drawn quieter, asked for - `--t-sm` in
  the secondary ink, and only over its words. `npm run precision` holds the
  titles to one left, one height and one look, and the actions to one right,
  at 1366, 1920 and a 375px phone.
- **What is inside keeps its own measure, from the same left edge.** A form
  and Settings' rows are `--page-w` (840px) wide; what is read is
  `--read-w` (640px). A page of two things stands them two abreast on a wide
  screen - the templates and the routines, the Library's lists, the Review's
  readings - so each keeps a page's measure and the page is half as long. The
  day, the week and the month use the whole frame for their own grids, and
  Kitchen's and North's cards lie in grids across it.
- **On a phone** the columns become the screen with a 16px gutter, every
  title stands at its left edge, the day's and the month's arrows stand
  together at the right of the title's row, and the rail is the bar at the
  bottom.

---

## Retired, and counted down

What the pass retired, and what is left of it at its end. `design.test.ts`
holds every count to what is written there, so a number only goes down, and
it is lowered in the commit that earns it; docs/DESIGN-AUDIT.md says, thing
by thing, why the ones that are not nought are kept.

- `--s0`, `--s5`, `--s7`, `--t-2xs`, `--t-input` and `--e1`: none, not
  even declared
- a font weight written as a number, a tracked capital, a press that scales:
  none
- a line height written as a number: the smallest boxes' lines, above
- a border: the kinds under Lines, and nothing round a card, a control or a
  layer
- black written as a literal: the tokens that define the scrim and the
  lifts, the photo viewer's ground, a photo's own button, and the dark ink
  on a template's pastel block
- a height written in pixels: the week grid's smallest boxes, the reserved
  line under a task and under the quick add, a short laptop's denser task
  column, the rail's square, the time picker's grid of quarter hours, and
  the sizes of things that are not controls - a field's two lines, a theme's
  preview card, the week editor's grid
