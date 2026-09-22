# Design audit

Two audits, the newer first: **one look, seven rules** (2026-09-22), which the
owner's UI brief asked for across the whole app, and the design pass's audit
(2026-09-16, v2.24), kept below as it was written.

---

## One look, seven rules - 2026-09-22

The owner, after v2.31: the elements share no grid - in the template editor
the day type, the kind of day and the sleep rows start at three distances
from the left edge, the name field is stretched across the whole width with
its colour dot left outside it, and the add row breaks onto two lines - and
it is like that everywhere. The rules, for every screen, checked for every
screen:

1. **One grid.** Every gap is a step of the scale - 4, 8, 12, 16, 24, 32, 48 -
   written as its token, and no number written straight into the stylesheet.
2. **One left line in a card.** In a card or a form every label, field and
   row starts at the same x.
3. **One control height.** The fields, selects, buttons and chips in a row are
   one height on one centre line. One corner for everything; no more than five
   type sizes in the whole app.
4. **Nothing stretched.** A field is as wide as what goes in it, with a
   max-width; an accessory like a colour dot stands in the field's row.
5. **One row stays one row.** A row of controls that does not fit is made
   again - smaller, a menu for a row of chips, or a second row with its own
   label - and never wraps a button onto a line of its own.
6. **It fits.** At 1920x1080 no screen scrolls the page; what scrolls is a
   container with a clear edge. On a 375x812 phone the page scrolls only where
   the content is long by nature, and nothing ever scrolls sideways.
7. **One frame.** The title, the page's width, a card's edge and the main
   button stand in the same place on every screen.

**How it is measured.** `node scripts/sweep.mjs --unify` walks every screen
and dialog the sweep walks - 51 of them, the journal's page and the agenda
added for this - at 1920x1080 and on a 375x812 phone, and `scripts/unify.js`
reads each rule off the page: every margin, padding and gap; the first word
or control of every row of a surface; the heights in every row of controls;
every corner and every type size drawn; the width of every field; every
wrapped row of controls; the page's scroll both ways; and where the title,
the main button and the first surface stand. `scripts/unify-report.mjs`
writes what follows from it. A value off the four-pixel grid counts for rule
1 at runtime; a raw number in a spacing declaration is held by
`design.test.ts`, which reads the stylesheet. The pictures, one per screen and
size, are in [`screenshots/unify/before/`](screenshots/unify/before/), the
sample day's demo content only.

**App-wide, before.** Of 1,255 spacing declarations in the stylesheet, 59
write raw pixels (1px 29 times, 3px 15, 6px 13); `--s0` (2px) is a token off
the brief's scale and is the most drawn value off it. The app draws six type
sizes (11, 13, 15, 17, 18 and 20px, and 34 on the timer) and two corners (6px
and 10px). The title stands in eight places on a desktop and nine on a phone.

**After stage 2 - one grid, five sizes, one corner.** The shared tokens went
first, since every screen is drawn from them. Spacing is the seven steps and
nothing else: `--s0` is gone, the 1px and 2px that were lines are
`--hairline` and `--stroke`, the half-steps 3px and 6px became the next step,
compact density is one step tighter on the same grid, and the browser's own
padding on a button and a field is gone. Type is five sizes - body and
reading, 15 and 17, are one at 16, and the timer's 34 is 40 - and every corner
is 8px. What looks like room and is not a gap is written down in
[DESIGN.md](DESIGN.md), "One look, seven rules". Measured again on every
screen at both sizes: rule 1 finds nothing, one corner is drawn, and the app
draws 11, 13, 16 and 20 (40 on the timer). Of the 1,088 findings, 608 are
left, and 12 screens measure nothing. The frame, the scrolling, the rows that
wrap, the left lines, the stretched fields and the rows' heights are the
stages after this one.

### The count

| Screen | Size | 1 | 2 | 3 | 4 | 5 | 6 | Found |
|---|---|---|---|---|---|---|---|---|
| Day: Today | 1920x1080 | 6 |  | 4 |  | 1 |  | 11 |
| Day: Today (notice dismissed) | 1920x1080 | 6 |  | 4 |  | 1 |  | 11 |
| Day: Today (North open) | 1920x1080 | 6 |  | 4 |  | 1 |  | 11 |
| Day: Today (North after sleep) | 1920x1080 | 6 |  | 4 |  | 1 |  | 11 |
| Day: Gap offers | 1920x1080 | 6 |  | 4 |  | 1 |  | 11 |
| Day: Focus | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Day: Timer | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Day: Replan: something came up | 1920x1080 | 6 |  | 5 | 1 | 3 |  | 15 |
| Day: Replan: shift the rest | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Day: Replan: i was away | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Day: Low day | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Day: Today (after a night shift) | 1920x1080 | 6 |  | 4 |  | 1 |  | 11 |
| Day: Today | 375x812 | 4 |  | 4 |  | 2 |  | 10 |
| Day: Today (notice dismissed) | 375x812 | 4 |  | 4 |  | 2 |  | 10 |
| Day: Today (North open) | 375x812 | 4 |  | 4 |  | 2 |  | 10 |
| Day: Today (North after sleep) | 375x812 | 4 |  | 4 |  | 2 |  | 10 |
| Day: Gap offers | 375x812 | 4 |  | 4 |  | 2 |  | 10 |
| Day: Focus | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Day: Timer | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Day: Replan: something came up | 375x812 | 4 | 1 | 5 |  | 4 |  | 14 |
| Day: Replan: shift the rest | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Day: Replan: i was away | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Day: Low day | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Day: Today (after a night shift) | 375x812 | 4 |  | 4 |  | 2 |  | 10 |
| Week: Calendar week | 1920x1080 | 4 |  | 1 |  |  |  | 5 |
| Week: Calendar week (a focus running) | 1920x1080 | 4 |  | 2 |  |  |  | 6 |
| Week: Calendar agenda | 1920x1080 | 3 |  | 2 |  |  | 1 | 6 |
| Week: Calendar week (after a night shift) | 1920x1080 | 5 |  | 1 |  |  |  | 6 |
| Week: Calendar week | 375x812 | 4 |  | 4 |  | 1 |  | 9 |
| Week: Calendar week (a focus running) | 375x812 | 4 | 1 | 5 |  | 1 |  | 11 |
| Week: Calendar agenda | 375x812 | 3 | 1 | 2 |  | 1 |  | 7 |
| Week: Calendar week (after a night shift) | 375x812 | 5 |  | 4 |  | 1 |  | 10 |
| Month: Calendar month | 1920x1080 | 3 |  | 1 |  |  |  | 4 |
| Month: Calendar month (day peek) | 1920x1080 | 3 |  | 1 |  |  |  | 4 |
| Month: Calendar month | 375x812 | 3 |  | 1 |  | 2 |  | 6 |
| Templates and the editor: Templates | 1920x1080 | 1 |  | 1 |  |  |  | 2 |
| Templates and the editor: Templates (routines) | 1920x1080 | 1 |  | 1 |  |  |  | 2 |
| Templates and the editor: Templates (a routine) | 1920x1080 | 2 | 1 | 1 | 1 |  |  | 5 |
| Templates and the editor: Template editor | 1920x1080 | 6 | 1 | 2 | 2 | 2 | 1 | 14 |
| Templates and the editor: Template colour | 1920x1080 | 6 | 2 | 2 | 2 | 3 | 1 | 16 |
| Templates and the editor: Week template editor | 1920x1080 | 5 | 1 | 2 | 2 | 1 | 1 | 12 |
| Templates and the editor: Week template editor (block open) | 1920x1080 | 4 | 1 | 2 | 1 |  | 1 | 9 |
| Templates and the editor: Template editor (a meal's recipes) | 1920x1080 | 6 | 1 | 2 | 3 | 2 | 1 | 15 |
| Templates and the editor: Template editor (a night shift) | 1920x1080 | 6 | 1 | 2 | 2 | 1 | 1 | 13 |
| Templates and the editor: Templates | 375x812 |  | 2 | 1 |  | 2 |  | 5 |
| Templates and the editor: Templates (routines) | 375x812 |  | 2 | 1 |  | 2 |  | 5 |
| Templates and the editor: Templates (a routine) | 375x812 | 2 | 3 | 1 |  | 3 |  | 9 |
| Templates and the editor: Template editor | 375x812 | 5 | 3 | 3 |  | 12 |  | 23 |
| Templates and the editor: Template colour | 375x812 | 5 | 4 | 3 |  | 13 | 1 | 26 |
| Templates and the editor: Week template editor | 375x812 | 4 | 3 | 2 |  | 4 |  | 13 |
| Templates and the editor: Week template editor (block open) | 375x812 | 4 | 3 | 2 |  | 2 |  | 11 |
| Templates and the editor: Template editor (a meal's recipes) | 375x812 | 5 | 3 | 3 |  | 13 |  | 24 |
| Templates and the editor: Template editor (a night shift) | 375x812 | 5 | 3 | 3 |  | 7 |  | 18 |
| Roster: Calendar (the roster) | 1920x1080 | 3 |  | 1 |  |  |  | 4 |
| Roster: Calendar (what Apply will do) | 1920x1080 | 3 | 1 | 1 |  |  |  | 5 |
| Roster: Calendar (a cycle) | 1920x1080 | 3 |  | 1 |  |  |  | 4 |
| Roster: Calendar (the roster) | 375x812 | 3 |  | 1 |  | 2 |  | 6 |
| Roster: Calendar (what Apply will do) | 375x812 | 3 | 1 | 1 |  | 2 | 1 | 8 |
| Roster: Calendar (a cycle) | 375x812 | 3 |  | 1 |  | 3 | 1 | 8 |
| Kitchen and a recipe: Kitchen | 1920x1080 | 2 |  |  | 1 |  | 1 | 4 |
| Kitchen and a recipe: Kitchen (a meal chosen) | 1920x1080 | 2 |  |  | 1 |  |  | 3 |
| Kitchen and a recipe: Kitchen (a recipe) | 1920x1080 | 2 |  |  |  |  |  | 2 |
| Kitchen and a recipe: Kitchen (writing) | 1920x1080 | 1 | 1 |  | 1 |  |  | 3 |
| Kitchen and a recipe: Kitchen (to a template) | 1920x1080 | 3 | 1 |  |  |  |  | 4 |
| Kitchen and a recipe: Kitchen | 375x812 | 1 |  |  |  | 1 |  | 2 |
| Kitchen and a recipe: Kitchen (a meal chosen) | 375x812 | 1 |  |  |  | 1 |  | 2 |
| Kitchen and a recipe: Kitchen (a recipe) | 375x812 | 1 |  |  |  |  |  | 1 |
| Kitchen and a recipe: Kitchen (writing) | 375x812 |  | 1 |  |  | 1 |  | 2 |
| Kitchen and a recipe: Kitchen (to a template) | 375x812 | 2 | 1 |  |  |  |  | 3 |
| Books: Library | 1920x1080 | 4 | 1 | 17 | 2 |  | 1 | 25 |
| Books: Library (item panel) | 1920x1080 | 4 | 1 | 19 | 4 | 1 | 1 | 30 |
| Books: Library (a new list) | 1920x1080 | 4 | 2 | 17 | 4 |  | 1 | 28 |
| Books: Library (list settings) | 1920x1080 | 4 | 1 | 17 | 2 |  | 1 | 25 |
| Books: Library | 375x812 | 3 | 2 | 15 |  | 2 |  | 22 |
| Books: Library (item panel) | 375x812 | 3 | 2 | 17 |  | 5 |  | 27 |
| Books: Library (a new list) | 375x812 | 3 | 3 | 15 |  | 4 |  | 25 |
| Books: Library (list settings) | 375x812 | 3 | 2 | 15 |  | 3 |  | 23 |
| Picture: North | 1920x1080 | 1 |  |  |  |  |  | 1 |
| Picture: North (writing) | 1920x1080 | 1 | 1 |  |  |  |  | 2 |
| Picture: North | 375x812 |  |  |  |  |  |  | 0 |
| Picture: North (writing) | 375x812 |  | 1 |  |  |  |  | 1 |
| Review: Review week | 1920x1080 | 2 |  | 1 |  |  | 1 | 4 |
| Review: Review month | 1920x1080 | 2 |  | 1 |  |  | 1 | 4 |
| Review: Review week | 375x812 | 2 | 1 | 1 |  | 1 |  | 5 |
| Review: Review month | 375x812 | 2 | 1 | 1 |  | 1 |  | 5 |
| Search: Command palette | 1920x1080 | 6 |  | 5 | 1 | 1 |  | 13 |
| Search: Command palette | 375x812 | 5 | 1 | 5 |  | 2 |  | 13 |
| Notes: Header: notes | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Notes: Scratch | 1920x1080 | 7 |  | 6 |  | 1 |  | 14 |
| Notes: Header: notes | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Notes: Scratch | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Journal: Header: journal | 1920x1080 | 6 |  | 5 |  | 1 |  | 12 |
| Journal: Journal (open full) | 1920x1080 | 7 |  | 5 | 1 | 1 |  | 14 |
| Journal: Header: journal | 375x812 | 4 | 1 | 5 |  | 2 |  | 12 |
| Journal: Journal (open full) | 375x812 | 5 | 1 | 5 |  | 4 |  | 15 |
| Settings: Settings | 1920x1080 | 4 |  | 1 |  |  | 1 | 6 |
| Settings: Settings | 375x812 | 4 |  | 1 |  | 2 |  | 7 |
| Dialogs: Task detail (a meal's recipe) | 1920x1080 | 8 |  | 5 | 2 | 1 |  | 16 |
| Dialogs: Task detail | 1920x1080 | 8 |  | 5 | 1 | 1 |  | 15 |
| Dialogs: Shortcut card | 1920x1080 | 6 | 1 | 5 |  | 1 |  | 13 |
| Dialogs: Task detail (a meal's recipe) | 375x812 | 6 |  | 5 |  | 4 |  | 15 |
| Dialogs: Task detail | 375x812 | 6 |  | 6 |  | 3 |  | 15 |
| Dialogs: Shortcut card | 375x812 | 4 | 2 | 5 |  | 2 |  | 13 |

**1088 found**, and rule 7 below, which is one finding for the app.

### Rule 7, the frame

- **1920x1080**: the page title stands at 8 places - 463,69 (Today); 323,68 (Calendar month); 323,69 (Calendar week); 563,69 (Templates, Template editor, Template colour, Week template editor, Library, Review week, Review month); 403,73 (North); 403,69 (Kitchen); 563,63 (Settings); 323,133 (Calendar agenda).
- **375x812**: the page title stands at 9 places - 111,80 (Today); 68,88 (Calendar month); 68,89 (Calendar week); 16,89 (Templates, Library, Review week, Review month, Kitchen); 16,51 (Template editor, Template colour); 16,-603 (Week template editor); 16,93 (North); 16,-946 (Settings); 68,199 (Calendar agenda).

### Screen by screen

#### Day

**Today**

Before: [1920x1080](screenshots/unify/before/1920-today.jpg) | [375x812](screenshots/unify/before/375-today.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 1 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Today (notice dismissed)**

Before: [1920x1080](screenshots/unify/before/1920-today-notice-dismissed.jpg) | [375x812](screenshots/unify/before/375-today-notice-dismissed.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 1 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Today (North open)**

Before: [1920x1080](screenshots/unify/before/1920-today-north-open.jpg) | [375x812](screenshots/unify/before/375-today-north-open.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 1 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (button.north-day-heading)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Today (North after sleep)**

Before: [1920x1080](screenshots/unify/before/1920-today-north-after-sleep.jpg) | [375x812](screenshots/unify/before/375-today-north-after-sleep.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 1 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Gap offers**

Before: [1920x1080](screenshots/unify/before/1920-gap-offers.jpg) | [375x812](screenshots/unify/before/375-gap-offers.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 6 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 1 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta, button.task-gap-offers-row
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Focus**

Before: [1920x1080](screenshots/unify/before/1920-focus.jpg) | [375x812](screenshots/unify/before/375-focus.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Timer**

Before: [1920x1080](screenshots/unify/before/1920-timer.jpg) | [375x812](screenshots/unify/before/375-timer.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.clock-tabs, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading and 6 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (button.clock-button.active), 6px (button.active)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 2px in div.segmented.clock-tabs, button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.clock-button.active), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Replan: something came up**

Before: [1920x1080](screenshots/unify/before/1920-replan-something-came-up.jpg) | [375x812](screenshots/unify/before/375-replan-something-came-up.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 4: input "Something came up" is 528px wide
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 1920x1080, rule 5: div.replan-chips "TodayTomorrowFri 18Sat 19Sun 2" wraps onto 2 lines
- 1920x1080, rule 5: div.replan-chips "Morning goneAfternoon goneEven" wraps onto 2 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines
- 375x812, rule 5: div.replan-chips "TodayTomorrowFri 18Sat 19Sun 2" wraps onto 2 lines
- 375x812, rule 5: div.replan-chips "Morning goneAfternoon goneEven" wraps onto 2 lines

**Replan: shift the rest**

Before: [1920x1080](screenshots/unify/before/1920-replan-shift-the-rest.jpg) | [375x812](screenshots/unify/before/375-replan-shift-the-rest.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Replan: i was away**

Before: [1920x1080](screenshots/unify/before/1920-replan-i-was-away.jpg) | [375x812](screenshots/unify/before/375-replan-i-was-away.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 6 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta, button.replan-choice
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Low day**

Before: [1920x1080](screenshots/unify/before/1920-low-day.jpg) | [375x812](screenshots/unify/before/375-low-day.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Today (after a night shift)**

Before: [1920x1080](screenshots/unify/before/1920-today-after-a-night-shift.jpg) | [375x812](screenshots/unify/before/375-today-after-a-night-shift.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 1 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-menu-button, button.task-note-mark and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

#### Week

**Calendar week**

Before: [1920x1080](screenshots/unify/before/1920-calendar-week.jpg) | [375x812](screenshots/unify/before/375-calendar-week.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.segmented-quiet, div.segmented, div.week-col-head
- 1920x1080, rule 1: 1px in button, button.week-col-template, button.week-block.is-done, button.week-block, button.week-block.is-key, button.week-col-template.is-offer
- 1920x1080, rule 1: 6px in button
- 1920x1080, rule 1: 3px in button.week-block.is-done, button.week-block, div.week-col-foot, button.week-block.is-key
- 1920x1080, rule 3: 2 corners: 10px (button.btn-secondary.calendar-today), 6px (button.active)
- 375x812, rule 1: 1px in button, button.week-col-template, button.week-block.is-done, button.week-block, button.week-block.is-key
- 375x812, rule 1: 6px in button
- 375x812, rule 1: 2px in div.segmented.segmented-quiet, div.segmented
- 375x812, rule 1: 3px in button.week-block.is-done, button.week-block, div.week-col-foot, button.week-block.is-key
- 375x812, rule 3: div.week-col-head: Tue15 17 / Working day 22
- 375x812, rule 3: div.week-col-head: Wed16 17 / Working day 22
- 375x812, rule 3: div.week-col-head: Thu17 17 / Working day 22
- 375x812, rule 3: 2 corners: 10px (button.btn-secondary.calendar-today), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←15 - 17 Sep 2026→TodaySomethi" wraps onto 3 lines

**Calendar week (a focus running)**

Before: [1920x1080](screenshots/unify/before/1920-calendar-week-a-focus-running.jpg) | [375x812](screenshots/unify/before/375-calendar-week-a-focus-running.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.segmented-quiet, div.segmented, div.week-col-head
- 1920x1080, rule 1: 1px in span.focus-bar-left, button, button.week-col-template, button.week-block.is-done, button.week-block, button.week-block.is-key and 1 more
- 1920x1080, rule 1: 6px in button
- 1920x1080, rule 1: 3px in button.week-block.is-done, button.week-block, div.week-col-foot, button.week-block.is-key
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.week-col-template, button.week-block.is-done, button.week-block, button.week-block.is-key
- 375x812, rule 1: 6px in button
- 375x812, rule 1: 2px in div.segmented.segmented-quiet, div.segmented
- 375x812, rule 1: 3px in button.week-block.is-done, button.week-block, div.week-col-foot, button.week-block.is-key
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.week-col-head: Tue15 17 / Working day 22
- 375x812, rule 3: div.week-col-head: Wed16 17 / Working day 22
- 375x812, rule 3: div.week-col-head: Thu17 17 / Working day 22
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←15 - 17 Sep 2026→TodaySomethi" wraps onto 3 lines

**Calendar agenda**

Before: [1920x1080](screenshots/unify/before/1920-calendar-agenda.jpg) | [375x812](screenshots/unify/before/375-calendar-agenda.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.segmented-quiet, div.segmented, button.agenda-date-button
- 1920x1080, rule 1: 1px in span.focus-bar-left, button, ul.agenda-list
- 1920x1080, rule 1: 6px in button
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 1920x1080, rule 6: the page scrolls 445px
- 375x812, rule 1: 1px in span.focus-bar-left, button, ul.agenda-list
- 375x812, rule 1: 6px in button
- 375x812, rule 1: 2px in div.segmented.segmented-quiet, div.segmented, button.agenda-date-button
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←15 - 17 Sep 2026→TodaySomethi" wraps onto 3 lines

**Calendar week (after a night shift)**

Before: [1920x1080](screenshots/unify/before/1920-calendar-week-after-a-night-shift.jpg) | [375x812](screenshots/unify/before/375-calendar-week-after-a-night-shift.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.segmented-quiet, div.segmented, div.week-col-head
- 1920x1080, rule 1: 1px in button, button.week-col-template, button.week-block.is-done, button.week-block, div.week-carried, button.week-block.is-key and 1 more
- 1920x1080, rule 1: 6px in button
- 1920x1080, rule 1: 3px in button.week-block.is-done, button.week-block, div.week-col-foot, div.week-carried, button.week-block.is-key
- 1920x1080, rule 1: 5px in div.week-carried
- 1920x1080, rule 3: 2 corners: 10px (button.btn-secondary.calendar-today), 6px (button.active)
- 375x812, rule 1: 1px in button, button.week-col-template, button.week-block.is-done, button.week-block, div.week-carried, button.week-block.is-key
- 375x812, rule 1: 6px in button
- 375x812, rule 1: 2px in div.segmented.segmented-quiet, div.segmented
- 375x812, rule 1: 3px in button.week-block.is-done, button.week-block, div.week-col-foot, div.week-carried, button.week-block.is-key
- 375x812, rule 1: 5px in div.week-carried
- 375x812, rule 3: div.week-col-head: Tue15 17 / NNight shift 22
- 375x812, rule 3: div.week-col-head: Wed16 17 / Working day 22
- 375x812, rule 3: div.week-col-head: Thu17 17 / Working day 22
- 375x812, rule 3: 2 corners: 10px (button.btn-secondary.calendar-today), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←15 - 17 Sep 2026→TodaySomethi" wraps onto 3 lines

#### Month

**Calendar month**

Before: [1920x1080](screenshots/unify/before/1920-calendar-month.jpg) | [375x812](screenshots/unify/before/375-calendar-month.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 1px in button, button.cell.outside, button.cell.cell-has-template, button.cell, button.cell.today
- 1920x1080, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-template, button.cell, button.cell.today
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 1: 1px in button
- 375x812, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-template, button.cell, button.cell.today
- 375x812, rule 1: 2px in div.segmented, button.cell.outside, button.cell.cell-has-template, button.cell, button.cell.today
- 375x812, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←September 2026September 2026→" wraps onto 2 lines
- 375x812, rule 5: div.stamp-bar "StampCopies a template onto a " wraps onto 2 lines

**Calendar month (day peek)**

Before: [1920x1080](screenshots/unify/before/1920-calendar-month-day-peek.jpg) | [375x812](screenshots/unify/before/375-calendar-month-day-peek.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 1px in button, button.cell.outside, button.cell.cell-has-template, button.cell, button.cell.today
- 1920x1080, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-template, button.cell, button.cell.today
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)

#### Templates and the editor

**Templates**

Before: [1920x1080](screenshots/unify/before/1920-templates.jpg) | [375x812](screenshots/unify/before/375-templates.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 3: 2 corners: 10px (button.primary), 6px (span.kind-mark)
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: 2 corners: 10px (button.primary), 6px (span.kind-mark)
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

**Templates (routines)**

Before: [1920x1080](screenshots/unify/before/1920-templates-routines.jpg) | [375x812](screenshots/unify/before/375-templates-routines.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 3: 2 corners: 10px (button.primary), 6px (span.kind-mark)
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: 2 corners: 10px (button.primary), 6px (span.kind-mark)
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

**Templates (a routine)**

Before: [1920x1080](screenshots/unify/before/1920-templates-a-routine.jpg) | [375x812](screenshots/unify/before/375-templates-a-routine.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, span.duration-unit, input.time-input
- 1920x1080, rule 1: 1px in input.time-input
- 1920x1080, rule 2: div.routines-form "NameFor30minOn these daysMonTu" rows start at 16, 636px in
- 1920x1080, rule 3: 2 corners: 10px (button.primary), 6px (span.kind-mark)
- 1920x1080, rule 4: input "What you do" is 740px wide
- 375x812, rule 1: 2px in span.duration-unit, input.time-input
- 375x812, rule 1: 1px in input.time-input
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 2: div.routines-form "NameFor30minOn these daysMonTu" rows start at 16, 139px in
- 375x812, rule 3: 2 corners: 10px (button.primary), 6px (span.kind-mark)
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines
- 375x812, rule 5: div.duration-chips.routines-days "MonTueWedThuFriSatSun" wraps onto 2 lines

**Template editor**

Before: [1920x1080](screenshots/unify/before/1920-template-editor.jpg) | [375x812](screenshots/unify/before/375-template-editor.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, input.time-input, span.duration-unit
- 1920x1080, rule 1: 1px in input.time-input, button.timeline-gap, div.block-add-line.joined-line
- 1920x1080, rule 1: 6px in button.timeline-gap, span.task-size
- 1920x1080, rule 1: -6px in span.task-size
- 1920x1080, rule 1: 30px in select.block-library, select.block-library.is-set
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 2: div.template-editor "Full daychangeA kind of dayA d" rows start at 0, 16, 28px in
- 1920x1080, rule 3: div.library-binding: NothingFrom BooksFrom Watching 36 / + 20
- 1920x1080, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 1920x1080, rule 4: input "Template name" is 778px wide
- 1920x1080, rule 4: input.has-return "What happens" is 636px wide
- 1920x1080, rule 5: li "12:30Lunch45 minKeyOngoingNext" wraps onto 2 lines
- 1920x1080, rule 5: li "21:00Reading30 minKeyOngoingNe" wraps onto 2 lines
- 1920x1080, rule 6: the page scrolls 686px
- 375x812, rule 1: 1px in input.time-input, button.timeline-gap, div.block-add-line.joined-line
- 375x812, rule 1: 2px in input.time-input, span.duration-unit
- 375x812, rule 1: 6px in button.timeline-gap, span.task-size
- 375x812, rule 1: -6px in span.task-size
- 375x812, rule 1: 30px in select.block-library, select.block-library.is-set
- 375x812, rule 2: div.template-editor "Full daychangeA kind of dayA d" rows start at 0, 16, 28px in
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.library-binding: NothingFrom BooksFrom Watching 44 / + 20
- 375x812, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 375x812, rule 5: div.template-sleep "SleeptoAlso used by Twelve-hou" wraps onto 2 lines
- 375x812, rule 5: li "07:00Get up, shower, coffee45 " wraps onto 3 lines
- 375x812, rule 5: li "08:00Plan the day15 minKeyOngo" wraps onto 3 lines
- 375x812, rule 5: li "09:00Deep work block2hKeyOngoi" wraps onto 3 lines
- 375x812, rule 5: li "12:30Lunch45 minKeyOngoingNext" wraps onto 4 lines
- 375x812, rule 5: li "13:30Email and admin45 minKeyO" wraps onto 3 lines
- 375x812, rule 5: li "17:30Walk40 minKeyOngoingNext " wraps onto 3 lines
- 375x812, rule 5: li "21:00Reading30 minKeyOngoingNe" wraps onto 4 lines
- 375x812, rule 5: div.block-add-marks "+OngoingA block that is simply" wraps onto 4 lines
- 375x812, rule 5: div.template-editor-actions "Delete templateCancelSave temp" wraps onto 2 lines
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

**Template colour**

Before: [1920x1080](screenshots/unify/before/1920-template-colour.jpg) | [375x812](screenshots/unify/before/375-template-colour.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, input.time-input, span.duration-unit
- 1920x1080, rule 1: 1px in input.time-input, button.timeline-gap, div.block-add-line.joined-line
- 1920x1080, rule 1: 6px in button.timeline-gap, span.task-size
- 1920x1080, rule 1: -6px in span.task-size
- 1920x1080, rule 1: 30px in select.block-library, select.block-library.is-set
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 2: div.template-editor "Full daychangeA kind of dayA d" rows start at 0, 16, 28px in
- 1920x1080, rule 2: div.swatch-picker-panel.color-palette "Template colour" rows start at 8, 60, 112, 164, 216px in
- 1920x1080, rule 3: div.library-binding: NothingFrom BooksFrom Watching 36 / + 20
- 1920x1080, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 1920x1080, rule 4: input "Template name" is 778px wide
- 1920x1080, rule 4: input.has-return "What happens" is 636px wide
- 1920x1080, rule 5: div.swatch-picker-panel.color-palette "Template colour" wraps onto 2 lines
- 1920x1080, rule 5: li "12:30Lunch45 minKeyOngoingNext" wraps onto 2 lines
- 1920x1080, rule 5: li "21:00Reading30 minKeyOngoingNe" wraps onto 2 lines
- 1920x1080, rule 6: the page scrolls 686px
- 375x812, rule 1: 1px in input.time-input, button.timeline-gap, div.block-add-line.joined-line
- 375x812, rule 1: 2px in input.time-input, span.duration-unit
- 375x812, rule 1: 6px in button.timeline-gap, span.task-size
- 375x812, rule 1: -6px in span.task-size
- 375x812, rule 1: 30px in select.block-library, select.block-library.is-set
- 375x812, rule 2: div.template-editor "Full daychangeA kind of dayA d" rows start at 0, 16, 28px in
- 375x812, rule 2: div.swatch-picker-panel.color-palette "Template colour" rows start at 8, 60, 112, 164, 216px in
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.library-binding: NothingFrom BooksFrom Watching 44 / + 20
- 375x812, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 375x812, rule 5: div.swatch-picker-panel.color-palette "Template colour" wraps onto 2 lines
- 375x812, rule 5: div.template-sleep "SleeptoAlso used by Twelve-hou" wraps onto 2 lines
- 375x812, rule 5: li "07:00Get up, shower, coffee45 " wraps onto 3 lines
- 375x812, rule 5: li "08:00Plan the day15 minKeyOngo" wraps onto 3 lines
- 375x812, rule 5: li "09:00Deep work block2hKeyOngoi" wraps onto 3 lines
- 375x812, rule 5: li "12:30Lunch45 minKeyOngoingNext" wraps onto 4 lines
- 375x812, rule 5: li "13:30Email and admin45 minKeyO" wraps onto 3 lines
- 375x812, rule 5: li "17:30Walk40 minKeyOngoingNext " wraps onto 3 lines
- 375x812, rule 5: li "21:00Reading30 minKeyOngoingNe" wraps onto 4 lines
- 375x812, rule 5: div.block-add-marks "+OngoingA block that is simply" wraps onto 4 lines
- 375x812, rule 5: div.template-editor-actions "Delete templateCancelSave temp" wraps onto 2 lines
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines
- 375x812, rule 6: the page scrolls 2237px

**Week template editor**

Before: [1920x1080](screenshots/unify/before/1920-week-template-editor.jpg) | [375x812](screenshots/unify/before/375-week-template-editor.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.segmented-quiet, div.week-col-head, div.week-col-foot.wt-col-foot, input.time-input and 1 more
- 1920x1080, rule 1: 3px in div.week-col-foot.wt-col-foot
- 1920x1080, rule 1: 1px in div.wt-untimed, button.wt-untimed-block, div.block-add-line.joined-line, input.time-input
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 1: 30px in select.block-library
- 1920x1080, rule 2: div.template-editor.week-template-editor "Every day it is onJust this da" rows start at 16, 64, 626px in
- 1920x1080, rule 3: div.library-binding: NothingFrom BooksFrom Watching 36 / + 20
- 1920x1080, rule 3: 2 corners: 10px (div.template-editor.week-template-editor), 6px (button.active)
- 1920x1080, rule 4: input "Week name" is 778px wide
- 1920x1080, rule 4: input.has-return "What happens" is 636px wide
- 1920x1080, rule 5: div.wt-add-to "Add toWhich days one press put" wraps onto 2 lines
- 1920x1080, rule 6: the page scrolls 461px
- 375x812, rule 1: 2px in div.segmented.segmented-quiet, div.week-col-foot.wt-col-foot, input.time-input, span.duration-unit
- 375x812, rule 1: 3px in div.week-col-foot.wt-col-foot
- 375x812, rule 1: 1px in div.wt-untimed, button.wt-untimed-block, div.block-add-line.joined-line, input.time-input
- 375x812, rule 1: 30px in select.block-library
- 375x812, rule 2: div.template-editor.week-template-editor "Every day it is onJust this da" rows start at 16, 56, 129px in
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: 2 corners: 10px (div.template-editor.week-template-editor), 6px (button.active)
- 375x812, rule 5: div.wt-add-to "Add toWhich days one press put" wraps onto 3 lines
- 375x812, rule 5: div.wt-presets "Just one dayWeekdaysWeekendAll" wraps onto 2 lines
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

**Week template editor (block open)**

Before: [1920x1080](screenshots/unify/before/1920-week-template-editor-block-open.jpg) | [375x812](screenshots/unify/before/375-week-template-editor-block-open.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented.segmented-quiet, div.week-col-head, div.week-col-foot.wt-col-foot
- 1920x1080, rule 1: 3px in div.week-col-foot.wt-col-foot
- 1920x1080, rule 1: 1px in div.wt-untimed, button.wt-untimed-block.is-open, button.wt-untimed-block
- 1920x1080, rule 1: 30px in select.block-library
- 1920x1080, rule 2: div.template-editor.week-template-editor "Every day it is onJust this da" rows start at 16, 64, 626px in
- 1920x1080, rule 3: div.library-binding: NothingFrom BooksFrom Watching 36 / + 20
- 1920x1080, rule 3: 2 corners: 10px (div.template-editor.week-template-editor), 6px (button.active)
- 1920x1080, rule 4: input "Week name" is 778px wide
- 1920x1080, rule 6: the page scrolls 618px
- 375x812, rule 1: 2px in div.segmented.segmented-quiet, div.week-col-foot.wt-col-foot
- 375x812, rule 1: 3px in div.week-col-foot.wt-col-foot
- 375x812, rule 1: 1px in div.wt-untimed, button.wt-untimed-block.is-open, button.wt-untimed-block
- 375x812, rule 1: 30px in select.block-library
- 375x812, rule 2: div.template-editor.week-template-editor "Every day it is onJust this da" rows start at 16, 56, 129px in
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: div.library-binding: NothingFrom BooksFrom Watching 44 / + 20
- 375x812, rule 3: 2 corners: 10px (div.template-editor.week-template-editor), 6px (button.active)
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

**Template editor (a meal's recipes)**

Before: [1920x1080](screenshots/unify/before/1920-template-editor-a-meal-s-recipes.jpg) | [375x812](screenshots/unify/before/375-template-editor-a-meal-s-recipes.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, input.time-input, span.duration-unit
- 1920x1080, rule 1: 1px in input.time-input, button.timeline-gap, div.block-add-line.joined-line
- 1920x1080, rule 1: 6px in button.timeline-gap, span.task-size
- 1920x1080, rule 1: -6px in span.task-size
- 1920x1080, rule 1: 30px in select.block-library, select.block-library.is-set
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 2: div.template-editor "Full daychangeA kind of dayA d" rows start at 0, 16, 28px in
- 1920x1080, rule 3: div.library-binding: NothingFrom BooksFrom Watching 36 / + 20
- 1920x1080, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 1920x1080, rule 4: input "Template name" is 778px wide
- 1920x1080, rule 4: input.recipes-field-search "Find a recipe" is 796px wide
- 1920x1080, rule 4: input.has-return "What happens" is 636px wide
- 1920x1080, rule 5: li "12:30Lunch45 minKeyOngoingNext" wraps onto 2 lines
- 1920x1080, rule 5: li "21:00Reading30 minKeyOngoingNe" wraps onto 2 lines
- 1920x1080, rule 6: the page scrolls 1076px
- 375x812, rule 1: 1px in input.time-input, button.timeline-gap, div.block-add-line.joined-line
- 375x812, rule 1: 2px in input.time-input, span.duration-unit
- 375x812, rule 1: 6px in button.timeline-gap, span.task-size
- 375x812, rule 1: -6px in span.task-size
- 375x812, rule 1: 30px in select.block-library, select.block-library.is-set
- 375x812, rule 2: div.template-editor "Full daychangeA kind of dayA d" rows start at 0, 16, 28px in
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.library-binding: NothingFrom BooksFrom Watching 44 / + 20
- 375x812, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 375x812, rule 5: div.template-sleep "SleeptoAlso used by Twelve-hou" wraps onto 2 lines
- 375x812, rule 5: li "07:00Get up, shower, coffee45 " wraps onto 3 lines
- 375x812, rule 5: li "08:00Plan the day15 minKeyOngo" wraps onto 3 lines
- 375x812, rule 5: li "09:00Deep work block2hKeyOngoi" wraps onto 3 lines
- 375x812, rule 5: li "12:30Lunch45 minKeyOngoingNext" wraps onto 4 lines
- 375x812, rule 5: div.duration-chips.recipes-field-options "BreakfastLunchDinnerPre-gymPos" wraps onto 2 lines
- 375x812, rule 5: li "13:30Email and admin45 minKeyO" wraps onto 3 lines
- 375x812, rule 5: li "17:30Walk40 minKeyOngoingNext " wraps onto 3 lines
- 375x812, rule 5: li "21:00Reading30 minKeyOngoingNe" wraps onto 4 lines
- 375x812, rule 5: div.block-add-marks "+OngoingA block that is simply" wraps onto 4 lines
- 375x812, rule 5: div.template-editor-actions "Delete templateCancelSave temp" wraps onto 2 lines
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

**Template editor (a night shift)**

Before: [1920x1080](screenshots/unify/before/1920-template-editor-a-night-shift.jpg) | [375x812](screenshots/unify/before/375-template-editor-a-night-shift.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, input.time-input, span.duration-unit
- 1920x1080, rule 1: 1px in input.time-input, div.block-add-line.joined-line
- 1920x1080, rule 1: -6px in span.task-size
- 1920x1080, rule 1: 6px in span.task-size
- 1920x1080, rule 1: 30px in select.block-library
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 2: div.template-editor "OvernightchangeA kind of dayA " rows start at 0, 16, 28px in
- 1920x1080, rule 3: div.library-binding: NothingFrom BooksFrom Watching 36 / + 20
- 1920x1080, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 1920x1080, rule 4: input "Template name" is 778px wide
- 1920x1080, rule 4: input.has-return "What happens" is 636px wide
- 1920x1080, rule 5: li "01:00Night meal30 minCoreKeyOn" wraps onto 2 lines
- 1920x1080, rule 6: the page scrolls 549px
- 375x812, rule 1: 1px in input.time-input, div.block-add-line.joined-line
- 375x812, rule 1: 2px in input.time-input, span.duration-unit
- 375x812, rule 1: -6px in span.task-size
- 375x812, rule 1: 6px in span.task-size
- 375x812, rule 1: 30px in select.block-library
- 375x812, rule 2: div.template-editor "OvernightchangeA kind of dayA " rows start at 0, 16, 28px in
- 375x812, rule 2: li.routines-row "TrainingMon, Wed, Fri · 60 min" rows start at 16, 181, 246px in
- 375x812, rule 2: li.routines-row "Language practiceMon, Tue, Wed" rows start at 16, 181, 246px in
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.library-binding: NothingFrom BooksFrom Watching 44 / + 20
- 375x812, rule 3: 2 corners: 10px (div.template-editor), 6px (span.kind-mark)
- 375x812, rule 5: div.template-sleep "SleeptoAlso used by Working da" wraps onto 2 lines
- 375x812, rule 5: li "22:00Night shift8hCoreKeyOngoi" wraps onto 3 lines
- 375x812, rule 5: li "01:00Night meal30 minCoreKeyOn" wraps onto 4 lines
- 375x812, rule 5: div.block-add-marks "+CoreOngoingA block that is si" wraps onto 4 lines
- 375x812, rule 5: div.template-editor-actions "Delete templateCancelSave temp" wraps onto 2 lines
- 375x812, rule 5: li.routines-row "TrainingMon, Wed, Fri · 60 min" wraps onto 3 lines
- 375x812, rule 5: li.routines-row "Language practiceMon, Tue, Wed" wraps onto 3 lines

#### Roster

**Calendar (the roster)**

Before: [1920x1080](screenshots/unify/before/1920-calendar-the-roster.jpg) | [375x812](screenshots/unify/before/375-calendar-the-roster.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 1px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today
- 1920x1080, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 1: 1px in button
- 375x812, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today
- 375x812, rule 1: 2px in div.segmented, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today
- 375x812, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←September 2026September 2026→" wraps onto 2 lines
- 375x812, rule 5: div.roster-bar-row "RosterDTwelve-hour shiftRSlow " wraps onto 2 lines

**Calendar (what Apply will do)**

Before: [1920x1080](screenshots/unify/before/1920-calendar-what-apply-will-do.jpg) | [375x812](screenshots/unify/before/375-calendar-what-apply-will-do.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 1px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 1920x1080, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 1920x1080, rule 2: div.roster-preview "21 - 27 Sep 20266 run into som" rows start at 16, 1101px in
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 1: 1px in button
- 375x812, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 375x812, rule 1: 2px in div.segmented, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 375x812, rule 2: div.roster-preview "21 - 27 Sep 20266 run into som" rows start at 16, 124px in
- 375x812, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←September 2026September 2026→" wraps onto 2 lines
- 375x812, rule 5: div.roster-bar-row "RosterDTwelve-hour shiftRSlow " wraps onto 2 lines
- 375x812, rule 6: the page scrolls 282px

**Calendar (a cycle)**

Before: [1920x1080](screenshots/unify/before/1920-calendar-a-cycle.jpg) | [375x812](screenshots/unify/before/375-calendar-a-cycle.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 1px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 1920x1080, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 1: 1px in button
- 375x812, rule 1: 6px in button, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 375x812, rule 1: 2px in div.segmented, button.cell.outside, button.cell.cell-has-tasks, button.cell.cell-has-template, button.cell, button.cell.today and 1 more
- 375x812, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 5: div.calendar-bar "←September 2026September 2026→" wraps onto 2 lines
- 375x812, rule 5: div.roster-bar-row "RosterDTwelve-hour shiftRSlow " wraps onto 2 lines
- 375x812, rule 5: div.roster-cycle-row "Starting onFill to the end of " wraps onto 2 lines
- 375x812, rule 6: the page scrolls 265px

#### Kitchen and a recipe

**Kitchen**

Before: [1920x1080](screenshots/unify/before/1920-kitchen.jpg) | [375x812](screenshots/unify/before/375-kitchen.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 1: 19px in button.kitchen-card
- 1920x1080, rule 4: input.kitchen-search "Search recipes" is 1160px wide
- 1920x1080, rule 6: the page scrolls 261px
- 375x812, rule 1: 19px in button.kitchen-card
- 375x812, rule 5: div.library-chips.kitchen-chips "AllBreakfastLunchDinnerPre-gym" wraps onto 2 lines

**Kitchen (a meal chosen)**

Before: [1920x1080](screenshots/unify/before/1920-kitchen-a-meal-chosen.jpg) | [375x812](screenshots/unify/before/375-kitchen-a-meal-chosen.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 1: 19px in button.kitchen-card
- 1920x1080, rule 4: input.kitchen-search "Search recipes" is 1160px wide
- 375x812, rule 1: 19px in button.kitchen-card
- 375x812, rule 5: div.library-chips.kitchen-chips "AllBreakfastLunchDinnerPre-gym" wraps onto 2 lines

**Kitchen (a recipe)**

Before: [1920x1080](screenshots/unify/before/1920-kitchen-a-recipe.jpg) | [375x812](screenshots/unify/before/375-kitchen-a-recipe.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 1: 28.2px in li
- 375x812, rule 1: 28.2px in li

**Kitchen (writing)**

Before: [1920x1080](screenshots/unify/before/1920-kitchen-writing.jpg) | [375x812](screenshots/unify/before/375-kitchen-writing.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 2: form.library-list.kitchen-form "NameRecipeMade the night befor" rows start at 0, 16px in
- 1920x1080, rule 4: input "" is 808px wide
- 375x812, rule 2: form.library-list.kitchen-form "NameRecipeMade the night befor" rows start at 0, 16px in
- 375x812, rule 5: div.duration-chips.kitchen-meal-chips "BreakfastLunchDinnerPre-gymPos" wraps onto 2 lines

**Kitchen (to a template)**

Before: [1920x1080](screenshots/unify/before/1920-kitchen-to-a-template.jpg) | [375x812](screenshots/unify/before/375-kitchen-to-a-template.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 1: 30px in select
- 1920x1080, rule 1: 28.2px in li
- 1920x1080, rule 2: div.library-list.kitchen-template-form "TemplateWorking dayTwelve-hour" rows start at 16, 685px in
- 375x812, rule 1: 30px in select
- 375x812, rule 1: 28.2px in li
- 375x812, rule 2: div.library-list.kitchen-template-form "TemplateWorking dayTwelve-hour" rows start at 16, 188px in

#### Books

**Library**

Before: [1920x1080](screenshots/unify/before/1920-library.jpg) | [375x812](screenshots/unify/before/375-library.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, span.library-item-move
- 1920x1080, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 1: 3px in span.library-item-main
- 1920x1080, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 16, 48px in
- 1920x1080, rule 3: div.library-list-head: Books8 going, counted in chapt 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 36 / Deep Workone chapter an evenin 69
- 1920x1080, rule 3: li.library-item: Reorder Atomic Habits, positio 36 / Atomic Habitsp. 0/306 20
- 1920x1080, rule 3: li.library-item: Reorder The Body Keeps the Sco 36 / The Body Keeps the Scorech 0/2 20
- 1920x1080, rule 3: li.library-item: Reorder Thinking, Fast and Slo 36 / Thinking, Fast and Slowch 0/38 20
- 1920x1080, rule 3: li.library-item: Reorder Range, position 5 36 / Rangech 0/15 20
- 1920x1080, rule 3: li.library-item: Reorder Four Thousand Weeks, p 36 / Four Thousand Weeksch 0/14 20
- 1920x1080, rule 3: li.library-item: Reorder Why We Sleep, position 36 / Why We Sleepch 0/16 20
- 1920x1080, rule 3: li.library-item: Reorder The Creative Act, posi 36 / The Creative Actch 0/78 20
- 1920x1080, rule 3: div.library-list-head: Watching7 going, counted in ep 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Severance, position 1 36 / SeveranceS1 E2/10 33
- 1920x1080, rule 3: li.library-item: Reorder Andor, position 2 36 / AndorS1 E2/12 20
- 1920x1080, rule 3: li.library-item: Reorder The Bear, position 3 36 / The BearS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Shogun, position 4 36 / ShogunS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Slow Horses, position  36 / Slow HorsesS1 E2/6 20
- 1920x1080, rule 3: li.library-item: Reorder Dune: Part Two, positi 36 / Dune: Part Twonot yet 20
- 1920x1080, rule 3: li.library-item: Reorder Arrival, position 7 36 / Arrivalnot yet 20
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 chapters"" is 587px wide
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 episodes"" is 585px wide
- 1920x1080, rule 6: the page scrolls 515px
- 375x812, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 375x812, rule 1: 3px in span.library-item-main
- 375x812, rule 1: 2px in span.library-item-move
- 375x812, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 16, 24, 48px in
- 375x812, rule 2: div.library-list.is-open "Watching7 going, counted in ep" rows start at 16, 24px in
- 375x812, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 44 / Deep Workone chapter an evenin 98
- 375x812, rule 3: li.library-item: Reorder Atomic Habits, positio 44 / Atomic Habitsp. 0/306 49
- 375x812, rule 3: li.library-item: Reorder The Body Keeps the Sco 44 / The Body Keeps the Scorech 0/2 49
- 375x812, rule 3: li.library-item: Reorder Thinking, Fast and Slo 44 / Thinking, Fast and Slowch 0/38 49
- 375x812, rule 3: li.library-item: Reorder Range, position 5 44 / Rangech 0/15 49
- 375x812, rule 3: li.library-item: Reorder Four Thousand Weeks, p 44 / Four Thousand Weeksch 0/14 49
- 375x812, rule 3: li.library-item: Reorder Why We Sleep, position 44 / Why We Sleepch 0/16 49
- 375x812, rule 3: li.library-item: Reorder The Creative Act, posi 44 / The Creative Actch 0/78 49
- 375x812, rule 3: li.library-item.is-active: Reorder Severance, position 1 44 / SeveranceS1 E2/10 62
- 375x812, rule 3: li.library-item: Reorder Andor, position 2 44 / AndorS1 E2/12 49
- 375x812, rule 3: li.library-item: Reorder The Bear, position 3 44 / The BearS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Shogun, position 4 44 / ShogunS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Slow Horses, position  44 / Slow HorsesS1 E2/6 49
- 375x812, rule 3: li.library-item: Reorder Dune: Part Two, positi 44 / Dune: Part Twonot yet 49
- 375x812, rule 3: li.library-item: Reorder Arrival, position 7 44 / Arrivalnot yet 49
- 375x812, rule 5: div.library-add.joined-line "ReturnchaptersWhat one sitting" wraps onto 2 lines
- 375x812, rule 5: div.library-add.joined-line "ReturnepisodesWhat one sitting" wraps onto 2 lines

**Library (item panel)**

Before: [1920x1080](screenshots/unify/before/1920-library-item-panel.jpg) | [375x812](screenshots/unify/before/375-library-item-panel.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, span.library-item-move, div.segmented
- 1920x1080, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 1: 3px in span.library-item-main
- 1920x1080, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 0, 16, 48px in
- 1920x1080, rule 3: div.library-list-head: Books8 going, counted in chapt 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 36 / Deep Workone chapter an evenin 69
- 1920x1080, rule 3: div.library-item-progress: − 24 / How far through Deep Work 36 / + 24
- 1920x1080, rule 3: li.library-item: Reorder Atomic Habits, positio 36 / Atomic Habitsp. 0/306 20
- 1920x1080, rule 3: li.library-item: Reorder The Body Keeps the Sco 36 / The Body Keeps the Scorech 0/2 20
- 1920x1080, rule 3: li.library-item: Reorder Thinking, Fast and Slo 36 / Thinking, Fast and Slowch 0/38 20
- 1920x1080, rule 3: li.library-item: Reorder Range, position 5 36 / Rangech 0/15 20
- 1920x1080, rule 3: li.library-item: Reorder Four Thousand Weeks, p 36 / Four Thousand Weeksch 0/14 20
- 1920x1080, rule 3: li.library-item: Reorder Why We Sleep, position 36 / Why We Sleepch 0/16 20
- 1920x1080, rule 3: li.library-item: Reorder The Creative Act, posi 36 / The Creative Actch 0/78 20
- 1920x1080, rule 3: div.library-list-head: Watching7 going, counted in ep 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Severance, position 1 36 / SeveranceS1 E2/10 33
- 1920x1080, rule 3: li.library-item: Reorder Andor, position 2 36 / AndorS1 E2/12 20
- 1920x1080, rule 3: li.library-item: Reorder The Bear, position 3 36 / The BearS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Shogun, position 4 36 / ShogunS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Slow Horses, position  36 / Slow HorsesS1 E2/6 20
- 1920x1080, rule 3: li.library-item: Reorder Dune: Part Two, positi 36 / Dune: Part Twonot yet 20
- 1920x1080, rule 3: li.library-item: Reorder Arrival, position 7 36 / Arrivalnot yet 20
- 1920x1080, rule 3: 2 corners: 10px (button.btn-primary), 6px (button.active)
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 chapters"" is 587px wide
- 1920x1080, rule 4: input "one chapter a day" is 704px wide
- 1920x1080, rule 4: input "www.example.com/spanish" is 704px wide
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 episodes"" is 585px wide
- 1920x1080, rule 5: li.library-item.is-active "Deep Workone chapter an evenin" wraps onto 2 lines
- 1920x1080, rule 6: the page scrolls 851px
- 375x812, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 375x812, rule 1: 3px in span.library-item-main
- 375x812, rule 1: 2px in span.library-item-move, div.segmented
- 375x812, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 0, 16, 24, 48px in
- 375x812, rule 2: div.library-list.is-open "Watching7 going, counted in ep" rows start at 16, 24px in
- 375x812, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 44 / Deep Workone chapter an evenin 98
- 375x812, rule 3: div.library-item-progress: − 24 / How far through Deep Work 44 / + 24
- 375x812, rule 3: li.library-item: Reorder Atomic Habits, positio 44 / Atomic Habitsp. 0/306 49
- 375x812, rule 3: li.library-item: Reorder The Body Keeps the Sco 44 / The Body Keeps the Scorech 0/2 49
- 375x812, rule 3: li.library-item: Reorder Thinking, Fast and Slo 44 / Thinking, Fast and Slowch 0/38 49
- 375x812, rule 3: li.library-item: Reorder Range, position 5 44 / Rangech 0/15 49
- 375x812, rule 3: li.library-item: Reorder Four Thousand Weeks, p 44 / Four Thousand Weeksch 0/14 49
- 375x812, rule 3: li.library-item: Reorder Why We Sleep, position 44 / Why We Sleepch 0/16 49
- 375x812, rule 3: li.library-item: Reorder The Creative Act, posi 44 / The Creative Actch 0/78 49
- 375x812, rule 3: li.library-item.is-active: Reorder Severance, position 1 44 / SeveranceS1 E2/10 62
- 375x812, rule 3: li.library-item: Reorder Andor, position 2 44 / AndorS1 E2/12 49
- 375x812, rule 3: li.library-item: Reorder The Bear, position 3 44 / The BearS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Shogun, position 4 44 / ShogunS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Slow Horses, position  44 / Slow HorsesS1 E2/6 49
- 375x812, rule 3: li.library-item: Reorder Dune: Part Two, positi 44 / Dune: Part Twonot yet 49
- 375x812, rule 3: li.library-item: Reorder Arrival, position 7 44 / Arrivalnot yet 49
- 375x812, rule 3: 2 corners: 10px (button.btn-primary), 6px (button.active)
- 375x812, rule 5: div.library-add.joined-line "ReturnchaptersWhat one sitting" wraps onto 2 lines
- 375x812, rule 5: li.library-item.is-active "Deep Workone chapter an evenin" wraps onto 2 lines
- 375x812, rule 5: div.segmented "chapterspage numbersseasons an" wraps onto 2 lines
- 375x812, rule 5: div.library-detail-actions "DeleteOnto todayOnto tomorrowA" wraps onto 2 lines
- 375x812, rule 5: div.library-add.joined-line "ReturnepisodesWhat one sitting" wraps onto 2 lines

**Library (a new list)**

Before: [1920x1080](screenshots/unify/before/1920-library-a-new-list.jpg) | [375x812](screenshots/unify/before/375-library-a-new-list.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, span.library-item-move
- 1920x1080, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 1: 3px in span.library-item-main
- 1920x1080, rule 2: div.library-new "Quick startCourseslessonsGuita" rows start at 16, 682px in
- 1920x1080, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 16, 48px in
- 1920x1080, rule 3: div.library-list-head: Books8 going, counted in chapt 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 36 / Deep Workone chapter an evenin 69
- 1920x1080, rule 3: li.library-item: Reorder Atomic Habits, positio 36 / Atomic Habitsp. 0/306 20
- 1920x1080, rule 3: li.library-item: Reorder The Body Keeps the Sco 36 / The Body Keeps the Scorech 0/2 20
- 1920x1080, rule 3: li.library-item: Reorder Thinking, Fast and Slo 36 / Thinking, Fast and Slowch 0/38 20
- 1920x1080, rule 3: li.library-item: Reorder Range, position 5 36 / Rangech 0/15 20
- 1920x1080, rule 3: li.library-item: Reorder Four Thousand Weeks, p 36 / Four Thousand Weeksch 0/14 20
- 1920x1080, rule 3: li.library-item: Reorder Why We Sleep, position 36 / Why We Sleepch 0/16 20
- 1920x1080, rule 3: li.library-item: Reorder The Creative Act, posi 36 / The Creative Actch 0/78 20
- 1920x1080, rule 3: div.library-list-head: Watching7 going, counted in ep 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Severance, position 1 36 / SeveranceS1 E2/10 33
- 1920x1080, rule 3: li.library-item: Reorder Andor, position 2 36 / AndorS1 E2/12 20
- 1920x1080, rule 3: li.library-item: Reorder The Bear, position 3 36 / The BearS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Shogun, position 4 36 / ShogunS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Slow Horses, position  36 / Slow HorsesS1 E2/6 20
- 1920x1080, rule 3: li.library-item: Reorder Dune: Part Two, positi 36 / Dune: Part Twonot yet 20
- 1920x1080, rule 3: li.library-item: Reorder Arrival, position 7 36 / Arrivalnot yet 20
- 1920x1080, rule 4: input "Courses" is 712px wide
- 1920x1080, rule 4: input "or type one" is 712px wide
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 chapters"" is 587px wide
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 episodes"" is 585px wide
- 1920x1080, rule 6: the page scrolls 843px
- 375x812, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 375x812, rule 1: 3px in span.library-item-main
- 375x812, rule 1: 2px in span.library-item-move
- 375x812, rule 2: div.library-new "Quick startCourseslessonsGuita" rows start at 16, 185px in
- 375x812, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 16, 24, 48px in
- 375x812, rule 2: div.library-list.is-open "Watching7 going, counted in ep" rows start at 16, 24px in
- 375x812, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 44 / Deep Workone chapter an evenin 98
- 375x812, rule 3: li.library-item: Reorder Atomic Habits, positio 44 / Atomic Habitsp. 0/306 49
- 375x812, rule 3: li.library-item: Reorder The Body Keeps the Sco 44 / The Body Keeps the Scorech 0/2 49
- 375x812, rule 3: li.library-item: Reorder Thinking, Fast and Slo 44 / Thinking, Fast and Slowch 0/38 49
- 375x812, rule 3: li.library-item: Reorder Range, position 5 44 / Rangech 0/15 49
- 375x812, rule 3: li.library-item: Reorder Four Thousand Weeks, p 44 / Four Thousand Weeksch 0/14 49
- 375x812, rule 3: li.library-item: Reorder Why We Sleep, position 44 / Why We Sleepch 0/16 49
- 375x812, rule 3: li.library-item: Reorder The Creative Act, posi 44 / The Creative Actch 0/78 49
- 375x812, rule 3: li.library-item.is-active: Reorder Severance, position 1 44 / SeveranceS1 E2/10 62
- 375x812, rule 3: li.library-item: Reorder Andor, position 2 44 / AndorS1 E2/12 49
- 375x812, rule 3: li.library-item: Reorder The Bear, position 3 44 / The BearS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Shogun, position 4 44 / ShogunS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Slow Horses, position  44 / Slow HorsesS1 E2/6 49
- 375x812, rule 3: li.library-item: Reorder Dune: Part Two, positi 44 / Dune: Part Twonot yet 49
- 375x812, rule 3: li.library-item: Reorder Arrival, position 7 44 / Arrivalnot yet 49
- 375x812, rule 5: div.library-presets "CourseslessonsGuitarsongsRecip" wraps onto 2 lines
- 375x812, rule 5: div.duration-chips.library-unit-chips "lessonsongepisodesessiontrycha" wraps onto 2 lines
- 375x812, rule 5: div.library-add.joined-line "ReturnchaptersWhat one sitting" wraps onto 2 lines
- 375x812, rule 5: div.library-add.joined-line "ReturnepisodesWhat one sitting" wraps onto 2 lines

**Library (list settings)**

Before: [1920x1080](screenshots/unify/before/1920-library-list-settings.jpg) | [375x812](screenshots/unify/before/375-library-list-settings.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, span.library-item-move
- 1920x1080, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 1920x1080, rule 1: 53.4px in input.has-return
- 1920x1080, rule 1: 3px in span.library-item-main
- 1920x1080, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 16, 48px in
- 1920x1080, rule 3: div.library-list-head: Books8 going, counted in chapt 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 36 / Deep Workone chapter an evenin 69
- 1920x1080, rule 3: li.library-item: Reorder Atomic Habits, positio 36 / Atomic Habitsp. 0/306 20
- 1920x1080, rule 3: li.library-item: Reorder The Body Keeps the Sco 36 / The Body Keeps the Scorech 0/2 20
- 1920x1080, rule 3: li.library-item: Reorder Thinking, Fast and Slo 36 / Thinking, Fast and Slowch 0/38 20
- 1920x1080, rule 3: li.library-item: Reorder Range, position 5 36 / Rangech 0/15 20
- 1920x1080, rule 3: li.library-item: Reorder Four Thousand Weeks, p 36 / Four Thousand Weeksch 0/14 20
- 1920x1080, rule 3: li.library-item: Reorder Why We Sleep, position 36 / Why We Sleepch 0/16 20
- 1920x1080, rule 3: li.library-item: Reorder The Creative Act, posi 36 / The Creative Actch 0/78 20
- 1920x1080, rule 3: div.library-list-head: Watching7 going, counted in ep 20 / Edit 36
- 1920x1080, rule 3: li.library-item.is-active: Reorder Severance, position 1 36 / SeveranceS1 E2/10 33
- 1920x1080, rule 3: li.library-item: Reorder Andor, position 2 36 / AndorS1 E2/12 20
- 1920x1080, rule 3: li.library-item: Reorder The Bear, position 3 36 / The BearS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Shogun, position 4 36 / ShogunS1 E2/10 20
- 1920x1080, rule 3: li.library-item: Reorder Slow Horses, position  36 / Slow HorsesS1 E2/6 20
- 1920x1080, rule 3: li.library-item: Reorder Dune: Part Two, positi 36 / Dune: Part Twonot yet 20
- 1920x1080, rule 3: li.library-item: Reorder Arrival, position 7 36 / Arrivalnot yet 20
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 chapters"" is 587px wide
- 1920x1080, rule 4: input.has-return "Add - try "Something good, 12 episodes"" is 585px wide
- 1920x1080, rule 6: the page scrolls 691px
- 375x812, rule 1: 1px in div.library-add.joined-line, div.library-add-controls
- 375x812, rule 1: 3px in span.library-item-main
- 375x812, rule 1: 2px in span.library-item-move
- 375x812, rule 2: div.library-list.is-open "Books8 going, counted in chapt" rows start at 16, 24, 48px in
- 375x812, rule 2: div.library-list.is-open "Watching7 going, counted in ep" rows start at 16, 24px in
- 375x812, rule 3: li.library-item.is-active: Reorder Deep Work, position 1 44 / Deep Workone chapter an evenin 98
- 375x812, rule 3: li.library-item: Reorder Atomic Habits, positio 44 / Atomic Habitsp. 0/306 49
- 375x812, rule 3: li.library-item: Reorder The Body Keeps the Sco 44 / The Body Keeps the Scorech 0/2 49
- 375x812, rule 3: li.library-item: Reorder Thinking, Fast and Slo 44 / Thinking, Fast and Slowch 0/38 49
- 375x812, rule 3: li.library-item: Reorder Range, position 5 44 / Rangech 0/15 49
- 375x812, rule 3: li.library-item: Reorder Four Thousand Weeks, p 44 / Four Thousand Weeksch 0/14 49
- 375x812, rule 3: li.library-item: Reorder Why We Sleep, position 44 / Why We Sleepch 0/16 49
- 375x812, rule 3: li.library-item: Reorder The Creative Act, posi 44 / The Creative Actch 0/78 49
- 375x812, rule 3: li.library-item.is-active: Reorder Severance, position 1 44 / SeveranceS1 E2/10 62
- 375x812, rule 3: li.library-item: Reorder Andor, position 2 44 / AndorS1 E2/12 49
- 375x812, rule 3: li.library-item: Reorder The Bear, position 3 44 / The BearS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Shogun, position 4 44 / ShogunS1 E2/10 49
- 375x812, rule 3: li.library-item: Reorder Slow Horses, position  44 / Slow HorsesS1 E2/6 49
- 375x812, rule 3: li.library-item: Reorder Dune: Part Two, positi 44 / Dune: Part Twonot yet 49
- 375x812, rule 3: li.library-item: Reorder Arrival, position 7 44 / Arrivalnot yet 49
- 375x812, rule 5: div.library-colors "Colour for Books" wraps onto 2 lines
- 375x812, rule 5: div.library-add.joined-line "ReturnchaptersWhat one sitting" wraps onto 2 lines
- 375x812, rule 5: div.library-add.joined-line "ReturnepisodesWhat one sitting" wraps onto 2 lines

#### Picture

**North**

Before: [1920x1080](screenshots/unify/before/1920-north.jpg) | [375x812](screenshots/unify/before/375-north.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot

**North (writing)**

Before: [1920x1080](screenshots/unify/before/1920-north-writing.jpg) | [375x812](screenshots/unify/before/375-north-writing.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot
- 1920x1080, rule 2: div.north-editor "I wake before the house does, " rows start at 32, 666px in
- 375x812, rule 2: div.north-editor "I wake before the house does, " rows start at 24, 177px in

#### Review

**Review week**

Before: [1920x1080](screenshots/unify/before/1920-review-week.jpg) | [375x812](screenshots/unify/before/375-review-week.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 3px in div.review-chart
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 1920x1080, rule 6: the page scrolls 368px
- 375x812, rule 1: 2px in div.segmented
- 375x812, rule 1: 3px in div.review-chart
- 375x812, rule 2: dl.review-figures "Done8 of 23Deep work3hKey task" rows start at 16, 180px in
- 375x812, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 5: div.review-nav "14 - 20 September 2026Copy wee" wraps onto 2 lines

**Review month**

Before: [1920x1080](screenshots/unify/before/1920-review-month.jpg) | [375x812](screenshots/unify/before/375-review-month.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.segmented
- 1920x1080, rule 1: 3px in div.review-chart
- 1920x1080, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 1920x1080, rule 6: the page scrolls 89px
- 375x812, rule 1: 2px in div.segmented
- 375x812, rule 1: 3px in div.review-chart
- 375x812, rule 2: dl.review-figures "Done57 of 101Deep work21hKey t" rows start at 16, 180px in
- 375x812, rule 3: 2 corners: 10px (div.segmented), 6px (button.active)
- 375x812, rule 5: div.review-nav "September 2026Copy month journ" wraps onto 2 lines

#### Search

**Command palette**

Before: [1920x1080](screenshots/unify/before/1920-command-palette.jpg) | [375x812](screenshots/unify/before/375-command-palette.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (button.header-tool.active), 6px (button.mini-cell.outside)
- 1920x1080, rule 4: input.palette-input "Search tasks and lists, or type a command" is 560px wide
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 1: 48.7px in div.palette-scrim
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.header-tool.active), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

#### Notes

**Header: notes**

Before: [1920x1080](screenshots/unify/before/1920-header-notes.jpg) | [375x812](screenshots/unify/before/375-header-notes.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (button.header-tool.active), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.header-tool.active), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Scratch**

Before: [1920x1080](screenshots/unify/before/1920-scratch.jpg) | [375x812](screenshots/unify/before/375-scratch.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 1: 86.4px in div.scratch-scrim
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: div.scratch-field: Note 62 / Note 36 / + 36 / × 36
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

#### Journal

**Header: journal**

Before: [1920x1080](screenshots/unify/before/1920-header-journal.jpg) | [375x812](screenshots/unify/before/375-header-journal.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (button.header-tool.active), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (button.header-tool.active), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines

**Journal (open full)**

Before: [1920x1080](screenshots/unify/before/1920-journal-open-full.jpg) | [375x812](screenshots/unify/before/375-journal-open-full.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 5 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 1: 86.4px in div.journal-scrim
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 4: input.journal-search "Search" is 488px wide
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta, div.mini-calendar-grid and 1 more
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 1: 65px in div.journal-scrim
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines
- 375x812, rule 5: div.journal-view-head "JournalCopy this dayCopy this " wraps onto 2 lines
- 375x812, rule 5: div.journal-view-body "←September 2026→MTWTFSS3112345" wraps onto 2 lines

#### Settings

**Settings**

Before: [1920x1080](screenshots/unify/before/1920-settings.jpg) | [375x812](screenshots/unify/before/375-settings.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, nav.settings-nav, input.time-input, div.segmented.sync-via, div.segmented
- 1920x1080, rule 1: 1px in input.time-input
- 1920x1080, rule 1: 30px in select
- 1920x1080, rule 1: 13px in p.setting-desc
- 1920x1080, rule 3: 2 corners: 10px (button.settings-nav-item.active), 6px (button.active)
- 1920x1080, rule 6: the page scrolls 3037px
- 375x812, rule 1: 1px in input.time-input
- 375x812, rule 1: 2px in input.time-input, div.segmented.sync-via, div.segmented
- 375x812, rule 1: 30px in select
- 375x812, rule 1: 13px in p.setting-desc
- 375x812, rule 3: 2 corners: 10px (button.primary), 6px (button.active)
- 375x812, rule 5: div.sync-fields "RepoToken" wraps onto 2 lines
- 375x812, rule 5: div.sync-fields "Server addressToken" wraps onto 2 lines

#### Dialogs

**Task detail (a meal's recipe)**

Before: [1920x1080](screenshots/unify/before/1920-task-detail-a-meal-s-recipe.jpg) | [375x812](screenshots/unify/before/375-task-detail-a-meal-s-recipe.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 7 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 1: -9px in input.task-detail-title
- 1920x1080, rule 1: 30px in select
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: div.task-detail-head: Task title 46 / × 36
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 4: input.recipes-field-search "Find a recipe" is 428px wide
- 1920x1080, rule 4: input.task-detail-link "www.example.com/spanish" is 428px wide
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 3 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta, input.time-input and 1 more
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 1: -9px in input.task-detail-title
- 375x812, rule 1: 30px in select
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: div.task-detail-head: Task title 46 / × 44
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines
- 375x812, rule 5: div.duration-chips.recipes-field-options "BreakfastLunchDinnerPre-gymPos" wraps onto 2 lines
- 375x812, rule 5: div.segmented "OnceEvery dayWeekdaysEvery wee" wraps onto 2 lines

**Task detail**

Before: [1920x1080](screenshots/unify/before/1920-task-detail.jpg) | [375x812](screenshots/unify/before/375-task-detail.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 7 more
- 1920x1080, rule 1: 1px in span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button, button.task-recipe and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 1: -9px in input.task-detail-title
- 1920x1080, rule 1: 30px in select
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: div.task-detail-head: Task title 46 / × 36
- 1920x1080, rule 3: 2 corners: 6px (button.mini-cell.outside), 10px (div.up-next)
- 1920x1080, rule 4: input.task-detail-link "www.example.com/spanish" is 428px wide
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in button, span.day-now-left, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 3 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta, input.time-input and 1 more
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 1: -9px in input.task-detail-title
- 375x812, rule 1: 30px in select
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: div.task-detail-head: Task title 46 / × 44
- 375x812, rule 3: 2 corners: 10px (button.day-replan-button), 6px (button.active)
- 375x812, rule 3: 6 type sizes: 11px (button.task-note-mark "note"), 13px (button.header-tool "Search"), 15px (span.day-now-task "Review the quart"), 17px (textarea.note-editor-text "The pricing page"), 18px (button "←"), 20px (span.brand "Dienius")
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines
- 375x812, rule 5: div.segmented "OnceEvery dayWeekdaysEvery wee" wraps onto 2 lines

**Shortcut card**

Before: [1920x1080](screenshots/unify/before/1920-shortcut-card.jpg) | [375x812](screenshots/unify/before/375-shortcut-card.jpg)

- 1920x1080, rule 1: 2px in ul.nav-rail-list, ul.nav-rail-list.nav-rail-foot, div.mini-calendar-grid, span.mini-weekday, button.north-day-heading, div.up-next and 6 more
- 1920x1080, rule 1: 1px in span.focus-bar-left, span.up-next-time, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 1920x1080, rule 1: 7.5px in div.north-line
- 1920x1080, rule 1: 6px in button.timeline-gap, button.task-size, button.task-menu-button, kbd
- 1920x1080, rule 1: 53.4px in input.quick-add.has-return
- 1920x1080, rule 1: -6px in button.task-size
- 1920x1080, rule 2: div.shortcuts "Keyboard×NAdd a task - jumps t" rows start at 16, 22px in
- 1920x1080, rule 3: div.focus-bar-actions: Expand 36 / Done 36 / × 30
- 1920x1080, rule 3: div.task-meta: note 19 / 2h 25
- 1920x1080, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 1920x1080, rule 3: div.task-meta: ch 5/12 17 / 30 min 25
- 1920x1080, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.mini-cell.outside)
- 1920x1080, rule 5: div.template-rail-chips "Working dayTwelve-hour shiftSl" wraps onto 3 lines
- 375x812, rule 1: 1px in span.focus-bar-left, button, button.timeline-gap, div.quick-add-row.joined-line, button.task-note-mark, button.task-menu-button and 2 more
- 375x812, rule 1: 6px in button, button.timeline-gap, button.task-size, button.task-menu-button, kbd
- 375x812, rule 1: 2px in button.north-line-text, button.north-day-heading, div.capture-mode.segmented, span.duration-unit, div.task-meta, kbd
- 375x812, rule 1: -6px in button.task-size
- 375x812, rule 2: div.focus-bar "FocusReview the quarter number" rows start at 54, 94, 142, 287px in
- 375x812, rule 2: div.shortcuts "Keyboard×NAdd a task - jumps t" rows start at 16, 22px in
- 375x812, rule 3: div.focus-bar-actions: Expand 44 / Done 44 / × 30
- 375x812, rule 3: div.category-picker: Deep work 20 / Routine 20 / Health 20 / Meals 20 / Commute 20 / Personal 20 / Edit Deep work 28 / + 28
- 375x812, rule 3: div.task-meta: note 19 / 2h 25
- 375x812, rule 3: div.task-meta: Lentil soup 17 / 40 min 25
- 375x812, rule 3: 2 corners: 10px (div.focus-bar), 6px (button.active)
- 375x812, rule 5: div.quick-add-row.joined-line "16:00Return30min" wraps onto 2 lines
- 375x812, rule 5: div.task-meta "21:00Personalch 5/12one chapte" wraps onto 2 lines


---

## The design pass - what was uneven before it (2026-09-16)

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

### The short version

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

### 1. Type

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

### 2. Spacing

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

### 3. Corners

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

### 4. Colour

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

### 5. Lines

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

### 6. Shadows

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

### 7. Motion

`--dur-fast` 150ms, `--dur` 200ms, `--dur-sweep` 1s (the clock's ring, not
interface motion), one curve, `cubic-bezier(0.2, 0, 0, 1)`: 117 uses of the
curve, 5 `linear`, 2 `ease`, no literal durations, and 40 lines naming
`prefers-reduced-motion`.

- 200ms is past the 120 to 180ms the brief sets.
- Every shared button shrinks to 97% while pressed (6859): a small jump on
  every press, in dense rows too.
- Two keyword easings where the token exists.

### 8. Fields

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

### 9. Buttons

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

### 10. Empty states

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

### 11. Screen by screen

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

### 12. Found on the way

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

### 13. What the pass does with this

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

### 14. What is left, at the end of the pass

Written 2026-09-17 at the pass's last stage, after `e758285`. The inventory
again and the 45 screens again, at 1366x768 and on an iPhone 13, dark and
light - one sheet per screen in
[`docs/screenshots/design/after/`](screenshots/design/after/), beside the
ones in `before/`. Every count below is held by `design.test.ts`, or named
as not held.

#### The counts, then and now

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

#### Found at the end, and fixed in the stage

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

#### What is kept, and why

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

#### Not measured

The sweep measures four widths and the phone, the precision pass 1366 and
1920 in the dark and 1366 in the light, and the text-size pass every screen
at the three sizes. Compact density was not looked at screen by screen. A
theme override - an accent somebody picks - is held to contrast by the
preset tests, not by a screen.
