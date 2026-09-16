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
   same row.
5. **Motion answers, it never performs.** A press answers in 120ms, a layer
   arrives in 180ms, easing out. Nothing bounces, nothing scales on a press,
   nothing is staggered. With reduced motion nothing moves at all; colour and
   opacity still change.

And the rules the app already lives by, unchanged: nothing red as a verdict,
no score, no streak; a colour is never the only way something is said; every
string reads at 4.5:1 and every mark at 3:1; every control is a 44px target
on a finger.

---

## Type

One family, the system sans (`--font-body`), and six sizes.

| Token | Size | Role |
|---|---|---|
| `--t-xs` | 11px | Captions: labels over fields, meta under a title, counts, hour marks |
| `--t-sm` | 13px | Interface: buttons, chips, rows, secondary text, most of what is on a screen |
| `--t-md` | 15px | Body and titles in a list: a task's title, a field on a desktop, a sheet's lines |
| `--t-read` | 17px | Reading and writing: North's text, a note being read, the journal's page; every field on a phone |
| `--t-lg` | 20px | A page's title, a sheet's title, the clock |
| `--t-xl` | 34px | Display numerals: the timer's reading |

The Focus screen's two fluid sizes are the one place type fills the window,
and `--t-glyph` sizes a glyph drawn as text (a menu's dots); neither is text
somebody reads at size. `--t-2xs` (10px) and `--t-input` (16px) are retired:
10px is below a size worth reading, and a field is `--t-md` on a mouse and
`--t-read` on a finger, which is also the 16px floor iOS needs before it
stops zooming a field.

**Weights: three.** `--w-regular` 400 for reading and body; `--w-medium` 500
for a row's title and a label; `--w-strong` 600 for a page's title, a button,
a selected choice, and a key task. Nothing is 650 or 700.

**Line heights: three.** `--lh-tight` 1.25 for titles, numerals and a
control's single line; `--lh-ui` 1.4 for rows, labels and interface text
that wraps; `--lh-read` 1.6 for anything read as prose.

**Labels are sentence case.** A label is `--t-xs`, `--w-medium`, `--muted`,
with no tracking - "How long", not "HOW LONG". Capitals appear only where a
person typed them: North's headings are the owner's own capitals and stay
so. A figure that changes or lines up with another uses tabular numerals.

**At most four sizes on one screen.** Today is 11, 13, 15 and 20; North is
13, 17 and 20.

## Spacing

One scale, in steps of four, named by multiples of four.

| Token | Size | Between |
|---|---|---|
| `--s1` | 4px | An icon and its word; a label and its field |
| `--s2` | 8px | Things in one row: chips, buttons, a title and its meta |
| `--s3` | 12px | Rows in a list or a form; a control's inner edge |
| `--s4` | 16px | A surface's inner edge; groups inside one surface |
| `--s6` | 24px | Sections of a page; a page title and what is under it |
| `--s8` | 32px | Regions of a screen side by side |
| `--s12` | 48px | The top of a page's content, and the space before a page ends |

`--s0` (2px) is a hairline's offset and not a gap, and `1px`, `3px` and `6px`
stay the half-steps inside the smallest boxes the app draws (a week block, a
timeline block). `--s5` (20px) and `--s7` (28px) are retired: nobody could
choose between them and their neighbours, and each use becomes 16, 24 or 32
as its screen is rebuilt.

Density redefines the scale at the source; the steps keep their ratios.

## Corners

Two radii and one shape.

| Token | Value | For |
|---|---|---|
| `--r-mark` | 6px | Anything under about 24px: a check box, a calendar cell, a bar, a segment inside a segmented control |
| `--r-control`, `--r-card` | 10px | Everything pressed or typed in, and every surface: a card, a sheet, a popover, a menu |
| `--r-pill`, `--r-round` | full | A chip, a count, a dot, a swatch |

`--r-control` and `--r-card` are the preset's own `--radius` and `--edge`,
both 10px since v2.25 - a card no longer rounds more than the button inside
it.

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
| Accent ground | `--accent-dim` | A selected chip or segment |
| Line | `--border` | A divider, a scale, nothing else |
| Fill | `--fill` | The ground of a control at rest: a field, a secondary button, a chip, a segmented control |
| Strong fill | `--fill-strong` | The same ground under the pointer or pressed |
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

**The accent is spent once per view.** One filled primary button at most; a
selected chip or segment takes `--accent-dim` and keeps the text's ink.
**Danger is an ink, not a verdict**: it marks the control that deletes, and
nothing else in the app is red.

## Lines

A border is drawn only for:

- a divider between the groups of a long list (Settings),
- a scale the eye reads positions against (the timeline's hours, the month's
  weeks),
- the focus halo.

Not around a card on the page, a control, a chip, a cell, or a list's rows:
those are grounds and room. Where a control needs its size held while its
edge changes, the edge is `1px solid transparent`.

## Elevation and shadows

Three steps of ground carry depth - page, surface, raised surface - and
shadows belong to layers only:

| Token | For |
|---|---|
| `--e2` | A popover, a menu, a bubble, something in the hand while it is dragged |
| `--e3` | A modal and a sheet |

Nothing resting on the page casts a shadow. `--e1`, the resting card's
shadow, is retired and goes when the last card leaves it.

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
- **A chip** is a choice: `--fill`, `--r-pill`, `--control-h`; chosen, the
  accent ground.
- **A segmented control** is one `--fill` ground with its options inside at
  `--r-mark`; the chosen one takes the accent ground.
- Disabled: the same shape, `--faint` ink, no ground change on hover.

### Where actions stand

- **A page's action** stands at the right end of the page's title row.
- **A form, a sheet or a modal** ends in one row: a destructive action at
  the left, then the rest at the right with the primary last. Cancel is
  quiet, beside the primary.
- **A row's actions** stand at its right end, quiet, and appear in full
  under the pointer or on focus only where the row would otherwise be
  crowded.

## Empty states

One quiet line and at most one action, where the content would have begun:
the line in `--t-sm` and `--muted`, the action a secondary button `--s3`
under it. No card around it, no illustration, no second offer. A first run
that has more to say says it once, in that shape, and lets the first action
lead to the rest.

## The page

- **The frame.** Every page's title is `--t-lg` at `--w-strong` and
  `--lh-tight`, at the same distance under the app's header on every page,
  with the page's action at the right of the same row and the content
  `--s6` under it.
- **Two widths.** `--page-w` (840px) for the pages that are lists and forms -
  Templates, Library, Review, Settings - and `--read-w` (640px) for reading
  and writing - North, the journal's page. Today, the week and the month
  use the whole width for their own grids.
- **On a phone** the columns become the screen with a 16px gutter, the same
  title row stands at the top, and the rail is the bar at the bottom.

---

## Retired, and counted down

Each of these exists today and each stage of the pass removes some;
`design.test.ts` holds every count to at most what is left, so a number only
goes down, and it is lowered in the commit that earns it.

- `--s5`, `--s7`, `--t-2xs`, `--t-input` and `--e1` in use
- font weights and line heights written as numbers
- tracked capitals
- borders drawn around things that are not dividers or scales
- scrims and layer shadows written as literals
- a press that scales
- control heights written as pixel literals
