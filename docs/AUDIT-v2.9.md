# Audit: Dienius at v2.9

For somebody who has not seen the app and has no time to read the repo.

Facts only. Every screen and what each control does; screenshots of all of
them at 1920x1080 in both themes on a real day; what is known to be
imperfect; what would be decided differently; the two pieces of work that are
owed. **No recommendations anywhere in this file.** The decisions are the
owner's.

Written 2026-09-08 against `main` at v2.9. Nothing in this wave changed code:
this file and its screenshots are the whole of it.

---

## 1. Every screen, and where you press

The app is one page. A rail down the left changes what fills the rest.

### The rail, on every screen

| Control | What it does |
|---|---|
| Today, Calendar, Templates, Library, Review, North | Change the view. Keys 1 to 6 |
| Settings | The same, at the bottom. Key `,` |
| Keep the sidebar open | Pins the rail wide. Otherwise it opens on intent - a pointer that comes in, moves, and is still there - and closes again |
| Notes | A panel of the note stream, from any screen. Key `S` or backtick |
| Journal | A panel of today's journal. The whole journal is behind it |
| Timer and stopwatch | One timer for the app, survives a refresh, keeps time in a background tab |

Two more work anywhere: `Ctrl-K` / `Cmd-K` opens the command palette, `?`
opens the shortcut card.

### Today

The default. Left: a month, Up next, the day's four figures. Middle: the
timeline. Right: the task list.

| Control | What it does |
|---|---|
| Previous day, Next day | Move a day. Arrow keys do the same; `T` returns to today. The pair sits at the row's left edge, inside the month below it |
| The date, and Today | Says which day. Not a control |
| The template chip | Which template the day came from. Read, not pressed |
| The template list, in the rail | Stamps one onto the day. The same template again says the day already has it; a different one asks before replacing, and blocks added by hand stay |
| Replan | Three doors for a day that broke: something came up, shift the rest, away and back |
| Low day | The key tasks at 40% of their length, the routine kept, everything else to tomorrow. One press, one undo |
| Both / Calendar / Tasks | Which panes show |
| The month, in the rail | Any day opens it. Previous month, Next month either side of a fixed-width name |
| Up next | The next timed thing, its category, how far away. Carries the link if the task or its library item has one |
| Timed, Free, Deep work, Calendar | The day's four figures. Free counts other people's calendar events |
| The timeline | Every timed task at its real time and length. Drag to move, pull the bottom edge to resize, drop on the list to un-anchor. Free gaps are labelled and tappable - "45 min free, 11:45 to 12:30. Tap to fill this time." |
| Task / Later | Whether the line being typed goes on the day or on no day |
| The time control | The next free slot by default. Arrows move a quarter hour; pressing it opens two columns of hours and fives; "No time" makes a float |
| Add a task | The line itself. Enter adds it |
| The duration control | How long, holding the last length used |
| Six category dots | Which category the new task takes |
| A task card | The checkbox ticks it. The title selects it. The size chip changes its length. "More actions" opens the menu, whose Details opens the sheet |
| Focus | On the running card only. One task, its own time, a ring |
| The link icon | On a card whose task, or whose bound library item, has an address. Opens a new tab. Never changes what pressing the card does |
| Done *n* | The folded list of what is finished |
| Later *n* | The folded list of things on no day. One press puts one on the day at the next free slot |
| Push *n* to tomorrow | Yesterday's unfinished work, moved forward by hand, never automatically |

Screenshots: `01-today-both`, `02-today-calendar`, `03-today-tasks`.

### Calendar - month

| Control | What it does |
|---|---|
| Month / Week | Which calendar |
| Previous month, Next month | Move a month. The name between them sits in a fixed box, so neither arrow moves |
| A day cell | Opens a card anchored to that cell |
| The template list, in the rail | Picking one turns the pointer into a brush: pressing a cell stamps it |
| A cell's corner marks | Filled for a journal entry, open for a note. No count |

The day card carries: the day and its template, its tasks each tickable
where they stand, Open day, Notes, Journal, Something came up, and Clear this
day. Clearing asks once with the count and the day, offers Undo for five
seconds, and stays cleared.

Screenshots: `05-calendar-month`, `06-calendar-day-card`.

### Calendar - week

| Control | What it does |
|---|---|
| Previous week, Next week | Move a week |
| Grid / Agenda | Seven columns, or a reading list |
| Stamp week | Fills the mapped days from the day it is pressed on forward. Never backwards |
| Open *day* | Goes to that day |
| *Template* on *day*. Choose a different template | Per-column stamping |
| A block | Opens the task. Dragging one moves it to another day |
| Empty space in a column | Adds a task at that time |
| Something came up | The replan sheet, for any day of the week |

Screenshot: `07-calendar-week`.

### Templates

| Control | What it does |
|---|---|
| New template | Asks first whether it is a day or a week |
| Edit *name* | Opens the editor |
| Delete *name* | Removes it. Days already stamped keep what they got |

Screenshot: `08-templates`.

### Templates - the day editor

| Control | What it does |
|---|---|
| Template name | The name |
| Template colour | Eight swatches behind one press |
| Day type: *value*. Change | One line. Pressing it opens Full day, Shift, Overnight, Rest, with one sentence saying what changes: everything on the list counts, or only the blocks marked Core |
| Sleep schedule | Only when there is more than one |
| The timeline | The day this template makes, live, with its sleep and its clashes. Read-only |
| A block row | Reorder by its grip, Ongoing, what it draws from, Remove. Core appears on every block once the day type is not Full |
| Block time, and its picker | Two columns of hours and fives. The column opens where the day is, not at midnight. An hour with something on it carries a grey rule; what is being chosen is drawn on the timeline above as a dashed block at its real place and length |
| What happens | The block's words |
| The duration control, the category dots, Ongoing | The block's length, colour and kind |
| Add a block | Adds it to the list |
| Save template, Cancel | Nothing commits until Save |

Screenshots: `09-template-day-editor`, `10-template-time-column`.

### Templates - the week editor

Same fields, then seven columns.

| Control | What it does |
|---|---|
| A weekday tab | Which column the add row writes to |
| One day / Weekdays / Weekend / All days | How many columns one press writes to |
| A column's blocks | Reorder, remove, copy to another day |
| Day type for *day* | One quiet word - "Week default" until it is set - that opens the four values |
| Sleep schedule for *day* | Only when there is more than one |
| Each column's own small timeline | The day that column makes |

Screenshot: `11-template-week-editor`.

### Library

| Control | What it does |
|---|---|
| New list | A list and the word for one unit of it |
| The chip row | Jumps between lists |
| *List*, counted in *unit* | Folds the list |
| Settings for *list* | Name, unit, colour, delete |
| An item row | Opens its panel. The one you are on carries a bar and its pace note; the rest are one line each |
| One more *unit* of *item* | Advances it by one |
| Reorder, Delete | Position and removal |
| The link icon | At the row's end when the item has an address. Opens a new tab |
| Add to *list* | The words, the unit control and a count control, all holding an answer |

The item's panel adds: progress by hand in both directions, how it is
counted (list unit, pages, film, seasons and episodes), Pace or note, Link
(optional), Onto today, Onto tomorrow, Add to template, and Finished.

Screenshots: `12-library`.

### Review

| Control | What it does |
|---|---|
| Week / Month | Which span |
| The week before, The week after | Move it |
| The bars | Done over planned per day, and deep work per day. Each is a button naming its own day and figures |
| Copy week journal | The week's journal as markdown |
| Where the plan and the week disagreed | One line of facts per template block, sorted by how far the week went from the plan. Facts only - no percentages, no colours, no streak |
| Copy | That reading, as text |

Screenshot: `14-review`, which carries the reading as well.

### North

| Control | What it does |
|---|---|
| Compose | Opens the whole page for editing in place: the picture, the goals, what you do to deserve each, the if-then rules |
| Edit *rule*, Delete *rule* | A rule under the goal it protects |
| Add another, Write one down | New rules |

Nothing here is measured, counted or scored, ever.

Screenshot: `13-north`.

### Notes

One stream. A line is typed and kept exactly as written. A note holds
pictures - paste, drag or camera. A leading `!` sends the line to Later
instead. Any note turns into a task with its editor already open.

Screenshots: `16-notes`, `17-notes-full`.

### Journal

Three lines a day, none required: one in the morning under the day's title,
and two on the evening card. Never counted, never streaked. Read under a day
in the week's agenda; copied as markdown for a week or a month.

Screenshot: `18-journal`.

### Settings

Nine sections on one page: General, Sleep, Week, Categories, Nudges,
Calendars, Backup, Sync, Appearance.

| Section | What is in it |
|---|---|
| General | Show shortcuts, Take the tour (in a sandbox), Erase all data |
| Sleep | Bedtime and wake time, and more than one schedule if you want |
| Week | A template per weekday. A stamp by hand always wins |
| Categories | Six by default: reorder, rename, recolour, delete (which moves what it would orphan) |
| Nudges | Exactly three: closing the day, when the evening starts, bringing a goal forward |
| Calendars | Subscribe to a .ics URL, or import a file. Read-only, and free time counts them |
| Backup | Export, Import, Restore from a snapshot (one a day, seven kept), and the private GitHub repo copy |
| Sync | Optional, off by default, through a server you host |
| Appearance | Dark, Light, Midnight; accent, density, text size |

Screenshot: `19-settings`.

### The overlays

| Overlay | How it opens |
|---|---|
| Task sheet | More actions, then Details. Everything the card does not show: exact minute, note, link, sub-steps, repeat, key mark |
| Focus | The Focus button on the running card. One task, a ring, a way out |
| Replan | Replan on the header, the week's bar, a day card, the palette, or `R` |
| Low day | Beside Replan, on today |
| Command palette | `Ctrl-K` / `Cmd-K` |
| Shortcut card | `?` |
| Evening close | At a set time, or the moment the last task is ticked |
| The tour | Nine steps, each ending on a real action. From the first-run offer, the `?` card, or the palette |

---

## 2. Screenshots

`docs/screenshots/audit/`, 1920x1080, dark and light, on a real ordinary
Friday with forty days of history behind it. Not the demo, not an empty app.

| File | Screen |
|---|---|
| `01-today-both-{dark,light}.png` | Today, both panes |
| `02-today-calendar-{dark,light}.png` | Today, timeline only |
| `03-today-tasks-{dark,light}.png` | Today, tasks only |
| `05-calendar-month-{dark,light}.png` | Month |
| `06-calendar-day-card-{dark,light}.png` | A day card open on the month |
| `07-calendar-week-{dark,light}.png` | Week |
| `08-templates-{dark,light}.png` | Templates |
| `09-template-day-editor-{dark,light}.png` | The day editor |
| `10-template-time-column-{dark,light}.png` | The time picker, with the candidate drawn on the timeline |
| `11-template-week-editor-{dark,light}.png` | The week editor |
| `12-library-{dark,light}.png` | Library |
| `13-north-{dark,light}.png` | North, filled |
| `14-review-{dark,light}.png` | Review, including the week's reading |
| `16-notes-{dark,light}.png` | The notes panel |
| `17-notes-full-{dark,light}.png` | Notes, with a photograph |
| `18-journal-{dark,light}.png` | Journal |
| `19-settings-{dark,light}.png` | Settings |

---

## 3. What is known to be imperfect

Not bugs. Deliberate compromises, rules not carried all the way, and code
that works and is not pretty.

**The link on a library row is at the end of the row, not beside the title.**
The row's title and count are inside one button, and an anchor inside a
button is a control inside a control. It sits after the button instead. On a
task card it is beside the title, as asked.

**Three of the four day types do the same thing.** Shift, Overnight and Rest
all score on the blocks marked Core; only the name differs. They are kept
apart because they read differently on a calendar, not because the app does
anything different with them.

**The hour column tells a screen reader more than it shows.** The marks say
only "something is here"; the words still say "09, 55 min taken by Deep
work". Levelling that down would leave somebody who cannot see the screen
with less than the screen holds, so it was left uneven.

**Nine full-screen overlays sit five pixels left of the window's centre.**
`scrollbar-gutter: stable` makes every fixed element ten pixels narrower than
the window. Only the focus screen was corrected, because it is the one
surface that is a single block on a bare ground; the other nine are cards
with their own visible edges, which is what an eye lines a card up by.

**Two targets are under the 44px rule, on purpose.** The month's cells are
33px, and a task's title is a 29px target. Both are written down in DECISIONS
with the honest fix for each, should real hardware say otherwise.

**`src/styles.css` is one file of 14,145 lines.** Every rule in the app is in
it, in rough screen order, heavily commented. Nothing is scoped by tooling;
the discipline is the naming and the comments.

**The whole store is one JSON blob, rewritten on every change.** A day with
ten tasks and a library with fifteen books re-serialise together every time a
checkbox moves. It has never been slow enough to measure as a problem, and
the shape is the reason there is no server.

**The template editor's timeline is a picture.** Blocks are moved in the list
under it. See the first debt below.

**The timeline grows while a time is being chosen.** If the candidate falls
outside the drawn day, the window widens to hold it and the day rescales
under the pointer. The alternative was pinning the candidate to the edge and
claiming a place it does not have.

**Some rules can only be checked as text.** jsdom has no layout, so several
tests read `styles.css` and assert that a declaration exists rather than that
it renders. What renders is checked by the browser sweep and by
thirty-something Playwright tests at two viewports.

**Sync is last-write-wins per entity.** Two devices editing the same task
inside the same minute keep one of the two edits. Tombstones stop a deleted
thing coming back.

**The browser sweep crashed once, at the end of a long run.** The pass walks
about thirty screens at three window sizes in two themes. On one run the last
three screens reported "page crashed" on reload, while two other browsers
were being driven on the same machine; it has not reproduced on a machine
doing nothing else, and nothing was changed to chase it. Written down rather
than argued away, the same as the one unexplained test flake in STATE.

---

## 4. What would be decided differently

**One stylesheet.** Fourteen thousand lines in one file was chosen so that
every rule is greppable and nothing is generated. It works, and the cost is
that the only thing stopping two rules from fighting is that a person read
both. A stylesheet per view, with the tokens shared, would have cost almost
nothing at the start.

**A hand-written deep type guard for the whole data shape.** `validate.ts` is
a table per entity and a few hundred lines of checks, written to keep a
corrupt or hand-edited backup from crashing the app. It has caught real
things. It is also a second copy of the type definitions that has to be
edited in step with the first, and a schema tool would have kept them one.

**Four day types where three behave identically.** The distinction is about
how a person names their own day, not about what the app does. A single
"count only what is marked" switch plus a free-text name would have said the
same thing with one value instead of four.

**The tour as its own engine.** Nine steps, a spotlight, forced visibility,
per-step outcomes - about six hundred lines that exist to teach an app that
is otherwise meant to explain itself. It earns its place for a first day and
is dead weight on every day after.

**The explanations as a parallel glossary.** `explain.ts` holds a term and a
sentence for every invented word, checked by a test that each one is on
screen somewhere. It is a good idea that puts the words a long way from the
control they explain, and keeping the two in step is manual.

---

## 5. Two open debts

**Dragging a block inside the template editor's timeline.** The picture
arrived in v2.5 and is read-only: it draws the day a template makes, with its
sleep and its clashes, live, and the blocks are moved in the list under it.
Making it editable means reusing the day view's own drag machinery - pointer
capture, the grid's geometry, the snap, the drop - rather than writing a
second copy of it, plus a template-side commit path, plus the tests for
both. Roughly a day of work, most of it in making one set of drag code serve
two surfaces. Without it, building a template is done by typing times, and
the picture is only ever a check on what was typed.

**A reminder that can arrive while the app is closed.** Two nudges were
removed in v2.5 because neither could do what its name promised: with no push
subscription and no server holding it, both could only speak from a page
already open in front of somebody. A real one needs a service worker
registration for push, a subscription stored somewhere that outlives the tab,
a small server to hold it and send it, and a permission prompt asked at a
moment that makes sense rather than on first open. Two to three days, and it
is the first thing in this app that would need infrastructure to keep
running. Without it, every nudge in the app is a nudge you have to be looking
at the app to receive.
