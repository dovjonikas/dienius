# Design audit: what is uneven before the design pass

Written 2026-09-16 at `03c2408`, the close of v2.24, as the first stage of
the design pass. It says what makes Dienius look put together a screen at a
time rather than as one thing, with the places in the code, and it changes
nothing. The pass's last stage added what is left undone, in section 14.

**How it was measured.** Two ways, and each checks the other.

- **What is written.** `node scripts/design-inventory.mjs` reads
  `src/styles.css` (16,798 lines, 2,100 rules) and the components, and
  counts every type size, line height, weight, letter spacing, spacing value
  off the scale, corner, drawn border, shadow, duration, colour literal and
  button kind, with its line. Numbers below are its output at `03c2408`;
  line numbers drift as the file changes, so a line is a place to start
  looking, not an address.
- **What is seen.** Every screen the sweep opens, plus search, the whole
  journal and eight empty states on a fresh install - 45 screens at
  1366x768 and on an iPhone 13 (390x844), in the dark and the light theme,
  on the sample seed or an empty plan. Demo content only. One sheet per
  screen, desktop and phone, dark over light, in
  [`docs/screenshots/design/before/`](screenshots/design/before/). Positions
  and heights quoted below were measured in the browser, not read off a
  picture.

---

## The short version

1. **Every screen places its own title.** The seven views' titles start at
   seven heights between 63 and 93px from the top and at six left edges,
   over columns 640, 828, 860 and 1080px wide, at two weights. Nothing says
   where a page begins.
2. **No control height.** Pressable things are 22, 26, 28, 30, 32, 34, 36,
   38 or 40px tall across the app. The task sheet alone has controls 34, 35,
   37, 38, 39, 44 and 45px tall; a template's block row puts 44px toggles
   beside a 28px select whose text is 11px.
3. **Everything has an edge.** 183 drawn borders. A card holds a card that
   holds a boxed field (the library); every month cell, every mini calendar
   cell, every chip, every field and nearly every button is outlined.
   Separation is done with lines almost everywhere and with ground and space
   almost nowhere.
4. **Fields look like a form.** One base rule gives every field a 1px border
   on the page's darkest ground and, on focus, an accent border and a 2px
   accent ring - the loudest thing on any form.
5. **Three button variants and 180 buttons outside them.** `btn-primary`,
   `btn-secondary` and `btn-danger` are used 130 times; 180 buttons carry a
   class of their own - chips built eight ways, pill toggles, text buttons,
   underlined links, round and square icon buttons. The main action is on
   the left in some forms and on the right in others.
6. **Labels speak in two voices.** Tracked capitals (`UP NEXT`, `WHAT`,
   `TIME`, `DO`) in 23 rules at six letter spacings, beside sentence-case
   labels in the same forms (`Category`, `Library list`, `What`).
7. **Empty states are pages.** A fresh Today offers the tour, a sample week,
   a sentence and three starter cards with a button each: five actions. The
   library offers three buttons in a card. Only North is one line and one
   button.
8. **Found on the way:** the Notes popover starts 37px left of the screen on
   a phone, and two measuring passes cannot see it - section 12.

---

## 1. Type

**Sizes.** The scale is `--t-2xs` 10, `--t-xs` 11, `--t-sm` 13, `--t-md`
15, `--t-lg` 20 and `--t-xl` 34, with `--t-input` 16 for fields, `--t-glyph`
18 for drawn glyphs and two fluid sizes on Focus - ten sizes in all
(`src/styles.css` 176-192). No size is written as a literal anywhere, which
is the one part of the type already held. Uses: 193 x 13px, 126 x 11px, 63 x
15px, 27 x 20px, 12 x the glyph size, 10 x 10px, 9 x 16px, one each of the
rest.

- 10px (`--t-2xs`) is below a comfortable reading size and used ten times.
- A field's 16px stands beside 13px buttons in every form row, so a row
  reads in two sizes before anything is typed.
- Reading text has no size or line height of its own: North's paragraphs
  are 15px at 1.7, North on the day 1.55 (10498), a note's lines 1.55
  (9204), the goal card 1.6 (10740).

**Line heights.** Fifteen values: 26 x 1.5, 23 x 1, 14 x 1.4, 8 x 1.35, 6 x
1.6, 5 x 1.25, 4 x 1.45, 3 x 1.2, 3 x 1.1, 3 x 1.3, 3 x 1.7, 2 x 1.55, one
1.15 and one `18px` (`.done-badge`, 6616). Titles of the same kind differ:
`.task-title` 1.35 (4147) and 1.3 in the task pane (7742), `.up-next-title`
1.3 (7824), `.focus-task` 1.25 (5676), `.north-card-title` 1.25 (10732).

**Weights.** Five: 400, 500, 600, 650 and 700. 650 exists only for key tasks
(9421, 9433, 9435). 500 is used five times - a task's title (4146), the
running task's name (1606), the replan button (1495) and two labels (10406,
10462). 700 is in 16 rules, from the brand (562) to the tracked labels.

**Capitals.** 23 rules set `text-transform: uppercase`, at six letter
spacings: 0.04em (`.clock-label` 6273, `.digest-figures dt` 7879,
`.set-aside-label` 16255), 0.06em (`.day-when` 1576, `.task-core` 4251,
`.week-col-weekday` 12066, `.replan-label` 13478), 0.08em (`.rail-heading`
7783, `.task-detail-label` 9030, `.palette-group` 10257,
`.north-editor-rule` 11233 and six more), 0.1em (`.north-card-lead` 10722,
`.agenda-date-button` 15255), 0.12em (`.north-line-title` on a phone,
10854) and 0.16em (`.north-line-title` 10407, `.journal-line-label` 10463).
North's headings on the day, capitals by content, are a seventh at 0.14em
(10511).

**Two voices in one form.** The week template editor labels `WHAT` and
`WHERE` in tracked capitals and `Category`, `Library list` and `Add to` in
sentence case, in one column. The task sheet: every label in 11px capitals.
The replan sheet: `WHEN` and `WHAT IS GONE` in capitals, `What` in sentence
case. North's editor rule is a whole sentence in capitals (11233).

**A font written by hand.** `.note-line.is-fixed` names its own monospace
stack (9339) where `--font-mono` exists.

## 2. Spacing

**The scale.** `--s0` 2, `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5`
20, `--s6` 24, `--s7` 28, `--s8` 32 (`src/styles.css` 125-138), with larger
gaps composed as `calc()`. 1,170 spacing declarations; 35 are off the scale:

- **3px, sixteen times:** `.theme-card-mark` 1381, `.timeline-anchor-compact`
  2068, `.library-item-main` 8463, `.library-item-schedule` 8536,
  `.library-schedule button` 8562, `.capacity-sleep` 9470,
  `.library-schedule-note` 9540, `.review-chart` 10064, `.cell-stats` 11782,
  `.cell-written` 11842, `.week-block` 12274, `.week-col-foot` 12354,
  `.scratch-note-action` 13296, `.cell-point` 14950, `.wt-block-body` 15595,
  `.week-preview` 15917.
- **6px, thirteen times:** `.theme-card-row` 1350, `.timeline-anchor` 2056,
  `.task-size` 4266 and 4267, `.cell` 5185, 11918 and 11938,
  `.focus-close-hint` 5663, `.day-layout-focus button` 7446, `.task-pane
  .task-size` 7747 (twice), `.shortcuts kbd` 9685, `.timeline-external`
  12435.
- **The rest:** `0.15em` in the two steppers' units (3469, 3478), `-0.75px`
  on the clock button's hands (6020, 6021), a safe-area `max(12px, ...)` on
  `.scratch-scrim` (13318) and a computed offset on `.task-link` (16661).

**What the scale lacks.** 20 and 28 are steps nobody chooses between 16, 24
and 32, and there is no 48: the large gaps are `calc()` sums written at the
point of use.

**Pages begin in different places.** Measured at 1366x768:

| View | Title top | Title left | Column |
|---|---|---|---|
| North | 63 | 386 | 640 |
| Settings | 71 | 166 | 1080 |
| Today | 72 | 336 | the day's own grid |
| Calendar | 73 | 124 | the month's own grid |
| Templates | 77 | 276 | 860 |
| Library | 89 | 292 | 828 |
| Review | 93 | 292 | 828 |

## 3. Corners

Five tokens - `--r-mark` 6, `--r-control` 10, `--r-card` 12, `--r-pill` and
`--r-round` - used 41, 84, 51, 52 and 37 times, plus 11 x `0`, nine composed
corners for sheets that meet the bottom of the screen, and a theme preview's
own. Three sizes of rounded rectangle are one more than the eye separates,
and the two shapes on top make five.

- **Chips are three shapes.** The replan sheet's chips are pills; the task
  sheet's duration chips are 10px rectangles; the week template's day
  toggles are near-squares; the calendar's stamp chips are pills again.
- **An undefined token.** `.scratch-note-menu button` asks for
  `var(--r-chip)` (13282), renamed to `--r-mark` in the night pass; with no
  fallback the declaration is invalid and the menu's buttons are square.

## 4. Colour

**Tokens.** `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`,
`--muted`, `--faint`, `--accent`, `--accent-dim`, `--mark`, `--danger`,
`--good`, six category colours per mode, and derived inks (`--on-accent`,
`--safe-ink`). The three steps of ground and three inks the brief asks for
already exist; they are not what the screens separate things with.

**Literals outside the tokens: 33.**

- **Four scrim strengths** behind layers that are the same kind of thing:
  0.35 (`.gap-picker-scrim` 2610, `.task-actions-scrim` 5338,
  `.task-gap-offers-scrim` 5464), 0.45 (`.shortcuts-scrim` 9630,
  `.palette-scrim` 10209, `.note-task-scrim` 16169), 0.62
  (`.task-detail-scrim` 8913, `.north-scrim` 10688, `.scratch-scrim` 13125,
  `.replan-scrim` 13383, `.journal-scrim` 16490) and 0.85 (`.photo-viewer`
  16063).
- **Three layer shadows written by hand** on top of `--e2`: `0 24px 60px
  -20px rgba(0,0,0,.6)` on seven layers, `0 12px 28px -8px rgba(0,0,0,.45)`
  on the two pickers, `0 16px 36px -12px rgba(0,0,0,.55)` on the context
  menu (9127).
- The photo viewer's whites (16082-16106), the category wheel's hard-coded
  hues (11575), and black inks at 0.65 and 0.7 on chips and coloured blocks
  (5148, 2209).

**Destructive actions in three looks.** An outlined red button (the task
sheet's Delete, the library's Delete list), plain grey text (the library
item's Delete), and a red text link (a goal rule's Delete). The ink is one
idea; the control is three.

## 5. Lines

327 border declarations, 183 of them drawn - 107 x `1px solid var(--border)`,
20 top rules, 12 dashed, the rest tinted mixes.

- **A box in a box in a box.** The library: a bordered list card, a bordered
  item card inside it, a boxed title field inside that. The template editor:
  a bordered card, rows with separators, pill toggles and a select with
  their own borders. The task sheet: a bordered modal, rules under its
  header and over its footer, bordered chips, fields and buttons.
- **Grids drawn cell by cell.** Every month cell and every mini calendar
  cell (1px, 6px corners, 33px tall) has its own border, and so does every
  week column, so September is 35 outlined boxes on the Calendar and 35
  more in Today's rail rather than a surface with days on it.
- **Twelve dashed borders** for at least three meanings - somewhere to add
  (3732, 8673, 8766), another calendar's event (12436, 12478), something not
  placed yet (14297, 15430, 15691, 15740, 15986, 16274) - and the drop line
  (2568).
- **Settings is ruled row by row**, and so are the gap offers sheet and the
  replan sheet's rows.

## 6. Shadows

46 shadows, and 16 rings drawn as shadows (selection, focus, the tour),
which are rings and stay rings. The brief allows shadows on layers; 14 sit
on things that are not:

- **Resting cards:** `.task` (3555), `.task-active` (3612), `.up-next`
  (7802), `.digest-stats` (7850), `.library-list` (8228) - each on top of a
  border.
- **Active controls:** `.header-tool.active` (5952), `.clock-button.active`
  (5996), `.switch-thumb` (1075).
- **Under the pointer:** `.timeline-anchor-draggable:hover` (2361),
  `.theme-card:hover` (5849), the open rail (610), and a theme preview's own
  row (1349).
- **While dragging:** `.later-strip-item.is-dragging` (15448) and
  `.wt-block.is-dragging .wt-block-body` (15608) - a lift doing a job, and
  the one kind off a layer this pass keeps.

## 7. Motion

`--dur-fast` 150ms, `--dur` 200ms, `--dur-sweep` 1s (the clock's ring, not
interface motion), one curve, `cubic-bezier(0.2, 0, 0, 1)`: 117 uses of the
curve, 5 `linear`, 2 `ease`, no literal durations, and 40 lines naming
`prefers-reduced-motion`.

- 200ms is past the 120 to 180ms the brief sets.
- Every shared button shrinks to 97% while pressed (6859): a small jump on
  every press, in dense rows too.
- Two keyword easings where the token exists.

## 8. Fields

The base rule (`src/styles.css` 2938-2946): `1px solid var(--border)`, the
page's darkest ground `var(--bg)`, `var(--r-control)` corners; on hover a
stronger border; on focus a 2px accent outline, an accent border and a
change of ground (3034-3040). A select repeats it with a drawn caret (3369).

- **The ground is the page's, wherever the field is.** On a card the field
  is a sunken well - near black in the dark theme, grey in the light one -
  and on the page it is a box the page's own colour. The same rule reads as
  two different controls depending on what it stands on.
- **The focus is the loudest thing on a form.** An accent border and a 2px
  accent ring together, on a screen where the one primary button is the only
  other accent.
- **Other looks beside the base:** the notes overlay's input is an underline
  alone; the command palette's field has no box; North's writing field is
  its own surface.
- **Three steppers.** The quick add's time (a field with two stacked arrow
  boxes), the task sheet's length (a field with arrows inside it), the
  library's count (round minus and plus buttons either side of a box).
- **Field and control sizes in one row.** In a template's block row the
  Key and Ongoing toggles are 44px with 13px text, the library select
  (`.block-library` 8845) is 28px with 11px text, and Note is 44px with
  15px text.

## 9. Buttons

`btn-primary` (28 uses), `btn-secondary` (81) and `btn-danger` (21), 38px
tall with `var(--s2) var(--s4)` padding (6764-6860). Then 180 buttons with
classes of their own, in these families:

- **Chips, eight implementations:** `.duration-control-chips` and
  `.duration-chips` (34px, 13797 and 13847), `.replan-chip` (36px, 13568),
  `.clock-preset` (38px, 6088), `.library-chip` and `.library-preset` (34px,
  14152 and 14219), `.template-chip` (36px, 9488) and the calendar's stamp
  `.chip` (5148), with `.wt-copy-panel .chip` smaller again (15655).
- **Segmented controls** share `.segmented` (1118) in 17 places, at
  different heights: 28px in the quick add's mode (6598), 34px in the day
  header (7446), 40px in replan (13547), 44px in the task sheet.
- **Text buttons:** Dismiss, Note, Edit, Show 4 more, To task, More, Open
  full, Copy week journal - at 11, 13 and 15px, some muted and some in ink.
- **Underlined links doing a button's job:** change, Copy to, Pick a file on
  this computer, Try a sample week, Copy.
- **Icon buttons in four shapes:** round and bordered (+ and x in Notes, the
  library's minus and plus), square and bordered (the day arrows on a
  phone), bare (the day and calendar arrows on a desktop), and pill (Key and
  Ongoing in the template editor).

**Control heights.** 78 `min-height` and 34 `height` literals give
pressable things nine heights: 22 (`.week-col-template` 12400), 26
(`.north-rule-actions button` 11427, `.library-step` 8517), 28
(`.capture-mode button` 6598, `.block-library` 8845, `.later-item-plan`
14033), 30 (`.time-picker-option` 3217, `.task-focus-button` 3624,
`.floating-clock-actions button` 6516), 32 (`.undo-toast-button` 5795,
`.day-card-actions button` 15184, `.week-col-ask-actions button` 12216), 34
(the chips, the context menu 9136), 36 (`.header-tool` 5937, `.day-low`
1654, `.settings-nav-item` 851, `.done-toggle` 4376), 38 (the shared
buttons, `.task-detail-nudge` 9044, `.yesterday-dismiss` 9905) and 40
(`.nav-rail-pin` 640, `.block-add-line > *` 4750). On a finger every one
grows to 44px through an overlay, which is right and stays.

**Where the actions stand.**

- Primary on the left: Save template and Cancel, North's Save and Cancel,
  Replan's Accept and Cancel, the goal editor's Save and Cancel.
- Primary on the right: the task sheet's Done, with Delete on the left; New
  template and New list at the top right; Settings' Export backup at the
  row's right.
- The template editor puts Add a block on the right and Save template on the
  left, one above the other.

## 10. Empty states

Sixteen places draw an empty state, each with its own class and its own
type and spacing - `empty-state` in the task pane, `library-empty`,
`library-list-empty`, `review-empty`, `scratch-empty`, `palette-empty`,
`agenda-empty`, `day-card-empty`, `wt-col-empty`, `up-next-empty`,
`gap-picker-empty`, `task-actions-empty`, `stamp-bar-empty`,
`photo-viewer-empty`, `week-col-template is-empty`, and the templates'
plain `empty`.

| Screen | What an empty one shows |
|---|---|
| Today | The quick add, Take the tour with a sentence, Try a sample week with a sentence, a sentence about templates, three starter cards each with Use this template - five actions |
| Templates | New template, a sentence, the same three starter cards - four actions |
| Library | A bordered card: a sentence, and Start a Books list, Start a Watching list, Something else - three actions |
| Review | One sentence, with Copy week journal still offered above it |
| North | One line and Write - the shape the brief asks for |
| Notes | A field, Nothing written down yet., Open notes |

## 11. Screen by screen

- **Today.** The header row mixes a pill with a dot (the day's template),
  two bordered buttons and bare arrows; the status row adds a segmented
  control. The rail's mini calendar is 35 outlined cells; its headings are a
  sentence-case `Templates` and tracked-capital `UP NEXT` and `THE WEEK`.
  The yesterday banner is a bordered card with a coloured bar, an outlined
  button and a text button. Task cards have a border, a coloured bar and a
  shadow. `Done 2` wears a count pill, `Later 7` a plain number.
- **Calendar, month.** 35 bordered cells, a coloured top edge on stamped
  days, a progress bar in each; the stamp chips are pills; Month and Week
  are a segmented control at the right.
- **Calendar, week.** Seven controls in the header row in three styles (two
  bare arrows, three bordered buttons, two segmented controls in two places);
  every column bordered; the template chip over a day is filled on a stamped
  day and outlined with a plus on an empty one.
- **Templates.** Bordered cards with a bordered Edit each; the page's
  primary at the top right.
- **Template editor.** A boxed name field with a dot beside it, an
  underlined `change`, then block rows each holding a pill Key, a pill
  Ongoing, a small select, a text Note and a cross - five control shapes and
  three text sizes in one row.
- **Week template editor.** Tracked-capital and sentence-case labels mixed,
  filled day squares, grey preset pills, a sunken field beside a bordered
  one, underlined `Copy to` under each column.
- **Library.** Pills for lists; a bordered list card; the first item as a
  bordered card with a progress bar, the rest as plain rows with arrow
  buttons; an open item as a form with a segmented control, round steppers,
  sunken fields, three outlined buttons and a grey `Delete`.
- **Review.** The most even screen: bordered cards with one heading style.
  Figures use tracked capitals, charts sentence case; `Copy` is an accent
  link where `Copy week journal` is a grey text button.
- **North.** Already one column at 640px with no frame on the page; the goal
  editor is six bordered fields in a column under small 13px labels; the
  editor's rule is a sentence in capitals.
- **Notes.** A popover from the header (a field, a list, a link) and an
  overlay (an underlined field, a bordered `Note`, a round `+` and a round
  `x`).
- **Journal.** An overlay with a boxed search, two outlined buttons, a
  bordered mini calendar and a bordered page.
- **Search.** The command palette, the calmest surface in the app. On a
  phone a command's name is cut to give its description room (`Low...`,
  `Load my read...`, `Take the ...`).
- **Settings.** A list on the left and a column ruled row by row, each row's
  action at its right edge - even within itself, on a page 1080px wide where
  every other page is narrower.
- **Modals and sheets.** Four scrim strengths; three header shapes (a title
  and a cross; a back arrow, a title and a cross; a field in place of a
  title); the gap offers sheet spans the whole window on a desktop.

## 12. Found on the way

1. **The Notes popover leaves the screen on a phone.** It is 300px wide and
   anchored to the right edge of the launcher around its button
   (`.clock-popover` 6039, `right: 0`), and on a 390px phone that edge is at
   x = 263, so the popover starts at x = -37 and cuts its first characters.
   The Journal popover is anchored the same way and fits, from x = 34, only
   because its button stands further right.
2. **The measuring pass cannot see it.** `scripts/audit.js` reports a thing
   past the left edge only when all of it is past (600-617); a layer partly
   off the screen is neither past the left edge nor text cut off. The right
   edge is checked for any overflow.
3. **The sweep never measures North at rest on a desktop.** `tab()` in
   `scripts/sweep.mjs` parks the pointer at the centre of the window, which
   at 1366x768 is North's first heading, so the North screen measures the
   heading's preview with the signature and Edit faded under it - the same
   thing North (heading open) measures on purpose. The picture in this
   audit was retaken with the pointer at the corner.
4. **`--faded` is written three times** in `:root`, with its comment each
   time (240, 257, 274).
5. **`--r-chip`** is used and not defined (13282, section 3).

## 13. What the pass does with this

- **Stage 2, the system.** One type scale with a reading size and a 1.6
  reading line height; spacing 4, 8, 12, 16, 24, 32, 48; two rounded
  corners and the pill; ground, surface, raised surface, three inks, accent
  and line as the colour roles; one scrim; shadows for layers; 120 to 180ms
  out; one field; three buttons at one height; one empty state. Written in
  `docs/DESIGN.md` and built on `lib/theme.ts`, `lib/themes.ts` and the
  stylesheet's own scales, not beside them.
- **Stage 3, what every screen shares.** Buttons, chips, segmented controls,
  fields, steppers, modals and sheets, popovers (with the phone defect and
  the audit's blind side), menus, the rail and the header, and the frame
  every view's title stands in.
- **Stages 4 to 9, screen by screen.** Today and the timeline; the week and
  the calendar; the template editors; North's writing surface; the library
  (with its adding flow), Review, notes, the journal and search; Settings
  and the palette.
- **Stage 10.** The inventory again, every screen again, and what is left
  written at the end of this file.

---

## 14. What is left, at the end of the pass

Written 2026-09-17 at the pass's last stage, after `e758285`. The inventory
again and the 45 screens again, at 1366x768 and on an iPhone 13, dark and
light - one sheet per screen in
[`docs/screenshots/design/after/`](screenshots/design/after/), beside the
ones in `before/`. Every count below is held by `design.test.ts`, or named
as not held.

### The counts, then and now

| | At `03c2408` | Now |
|---|---|---|
| Type sizes | ten, `--t-2xs` used 10 times and `--t-input` 9 | six steps, the glyph size and Focus's two fluid sizes; no literal |
| Line heights | fifteen values | the three, `1` for a glyph's line, `--lh-read` plus 0.1 on North's page, and 5 numbers in the smallest boxes |
| Weights | 400, 500, 600, 650 and 700 | the three tokens; no number |
| Tracked capitals | 23 rules | none |
| Spacing off the scale | 35 of 1,170 | 29 of 1,172 |
| Corners | three rounded sizes and two shapes | 6px and 10px - a control and a card are both 10 in every preset - and the full round |
| Borders drawn | 183 | 51 |
| Shadows on something that is not a layer | 14 | 3 |
| Colour literals outside the tokens | 33 | 9 |
| Buttons with a class of their own | 180 | 166 |
| Heights written in pixels | - | 20 |

### Found at the end, and fixed in the stage

1. **In the dark themes a layer's controls had no shape.** The fills were
   5% and 10% of the text over the card's ground, and every sheet, popover
   and menu stands on the raised ground, where 5% came out the layer's own
   colour: 1.001:1. The task's sheet, Replan and Low day, a gap's offers,
   the timer's minutes and presets, the journal panel's box and quick
   notes' buttons were drawn in the light theme and blank in the dark one.
   Every layer now re-mixes both fills over its own ground, and the chosen
   segment's ground with them, and
   `design.test.ts` holds their contrast in both dark presets and fails on
   anything painted on the raised ground that is not in the list. The whole
   journal went back onto the raised ground with it.
2. **The month in the whole journal had no styles on a phone.** Every rule
   for the month sat inside the wide breakpoint, because the month was once
   only in the rail; the journal draws it at every width, and below 1024px
   its days were bare buttons in a heap. Present in the audit's own sheet at
   the start of the pass, and missed by every stage since.
3. **A finger's floor took the height of every writing box.** The floor that
   makes a field 44px on a phone is weighted so no class can undercut it,
   and so it undercut the four boxes that ask for more: the whole journal's
   page, a pasted list, a note being written and quick notes were one finger
   tall on a phone.
4. **Check boxes.** The tick was two borders of a rotated box, placed by
   numbers worked out for 24px and corrected by hand for the 18px boxes, and
   at 18px its stroke sat on the box's lower edge. It is one path through a
   mask now, centred by the box at every size. Under reduced motion a ticked
   task's box itself was set to 5 by 10 pixels; it is not any more. The
   swell as a box was ticked is gone with the other overshoots.
5. **A status and its actions stand on one row**, from the owner while the
   stage ran: a pasted list's count, a colour's name in a template's sheet
   and the calendar's staged days at the left edge, Cancel and the action at
   the right, where they were a line and a separate row of buttons under it,
   or a column centred under the month. Where the row is too short they go
   under the line, still at the right. Every Cancel that was a filled button
   or came after the action is quiet and first; the last underlined links -
   the sample week's offer, Replan's Move, Tomorrow and Skip, the tour's
   Skip, the rail's Cancel - are buttons.
6. **Three sheets were bottom sheets on a desktop.** A gap's offers, a
   task's actions and a gap's picker ran the width of a 1366px window with
   the cross a screen from its title; from 600px they are the centred card
   the task's own sheet is.
7. **A row's rule reached a sheet opened inside it.** The template editor's
   add row set its own button's left margin to auto through a descendant
   selector, which stood the Cancel of a colour's or a list's sheet at the
   far end of the row once the sheet lost its box.
8. **Rules that outranked the kinds.** The empty calendar's New template
   was a primary button drawn outlined, and the stamp bar's Cancel the same.
   A goal's rules stood sixteen pixels in from the edge every field of the
   goal stands on. A theme card rose on a shadow under the pointer.
9. **Today's masthead**, from the owner while the stage ran: no day arrows
   where the month is beside the day, the chip, the doors, the progress and
   the view toggle on the task column's two edges, the time on the day's own
   line, and the quick add's three controls as one line - DECISIONS.md,
   "The day's masthead lies on its columns".

### What is kept, and why

- **Five line heights written as numbers**, 1.1 to 1.2, in the smallest
  boxes the app draws: a squeezed block on the timeline, a month cell's
  template name and its figures, a week's block and a calendar event in the
  week. Each box is a line tall and the tokens' 1.25 does not fit it.
- **Twenty-nine spacings off the scale.** The half-steps inside the same
  boxes - `1px`, `3px` and `6px` in a week block, a month cell, a timeline
  block, a task's size chip and a key in the shortcut list; the `0.15em`
  thin space between a number and its unit; `-0.75px` in the clock button's
  drawing; and one `calc()` that centres a link's 44px target on its word.
- **Fifty-one borders**, every one of a kind DESIGN.md names under Lines:
  fourteen dividers, ten marks (a category's or a calendar's edge, the
  restore preview's one warning, the ring on a day with writing, the journal
  quote's rule), twelve drawings made of edges (chevrons, carets, bubbles'
  points, the empty day's tick, the clock's face), a check box's outline,
  four dashed outlines for things with no place yet, five for something
  being moved or shown (the drop line and its label, the ghost, the open
  gap, the tour's ring), the theme gallery's frame and its preview's own
  edge, a photo's edge and the photo viewer's buttons, and the page-number
  box that opens in a task row with the accent round it, the size of the
  mark it replaces.
- **Three shadows off a layer:** the navigation rail open over the page,
  which is a drawer; a theme's preview card, which draws that theme's own
  shadow; and a Later chip while it is in the hand.
- **Nine colour literals:** the dark ink on a template's pastel block, which
  does not change with the theme because the pastels do not; the category
  wheel's hues, which are what is being chosen; and the photo viewer's and a
  photo's whites and blacks, drawn over photographs, which have no theme.
  Black as `rgba()` is counted at seven in `design.test.ts` - these three and
  the four tokens that define the scrim and the shadows.
- **Twenty heights in pixels:** the week grid's smallest boxes (15, 20, 21,
  22 and 10px, and a 2px bar); the line reserved under a task's title and
  under the quick add, so neither jumps when the line fills; a short
  laptop's denser task column (1024px wide and up, 900px tall and under),
  which fits a nine-task day on 1366x768; the navigation rail's 40px square;
  the time picker's grid of quarter hours at 30px a cell; and the sizes of
  things that are not controls - quick notes' two-line field, Replan's two
  doors, a theme card, the week editor's grid and the whole journal's page.
- **Letter spacing in thirteen rules:** the large numerals tightened a
  little (the brand, the clock, the timer, Focus's count), small tabular
  times opened by 0.01em, and four North places - a heading on North's page,
  a goal's age, a rule's lead, and North's headings on the day at 0.14em,
  which the North brief queued after this pass redraws as written.
- **166 buttons with a class of their own.** Almost all are drawn in the
  kinds' terms now - the fill or no ground, `--r-control`, `--control-h` or a
  row's small `--s6`/`--s8` - but by their own rules, so a change to a kind
  does not reach them: the chips, segments, swatches, steppers' arrows, row
  actions and icon buttons. Each would be a component rather than a class,
  and that is a refactor, not an appearance.
- **Bottom sheets' composed corners.** Rounded at the top only where a sheet
  meets the bottom of a phone's screen - one shape, not another radius.
- **Two stacked Cancel and Save rows in a goal's editor** while one of its
  rules is being written: the rule's form is its own small form inside the
  goal's, and its buttons belong to it.
- **The starter templates on an empty Today and Templates** keep three cards
  with an action each. The empty-state rule is one line and one action; a
  first run is its one exception, and says what it has to say once.

### Not measured

The sweep measures four widths and the phone, the precision pass 1366 and
1920 in the dark and 1366 in the light, and the text-size pass every screen
at the three sizes. Compact density was not looked at screen by screen. A
theme override - an accent somebody picks - is held to contrast by the
preset tests, not by a screen.
