# Where this project actually is

You are picking this up cold. This file is the handover: what exists, how it
got here, and what is still owed. Read it, then
[`CONVENTIONS.md`](CONVENTIONS.md) for how work is done here, then
[`ARCHITECTURE.md`](ARCHITECTURE.md) for where the code lives. Those three
should leave you able to start without re-reading the repo.

**Last updated:** v2.12, the night before the owner builds their real week.

Four passes over a real day: every screen at three sizes in both themes, every
screen on a keyboard alone, ten data shapes nobody checks, and every action
that adds to a day pressed twice. **Two defects, both about focus** - the
Notes and Journal popovers and the task's detail sheet all left focus on the
document body when Escape closed them, so the next Tab started again from the
navigation rail. One cause, in `useRestoreFocus`, now held by two tests. One
hole closed in the suite rather than in the app: a replan syncing to the
second device had never been tested and does not double a block. And the
README's figures were made true again, with a license section that says what
MIT actually allows. Section 4 has the table, and what each pass measured.

**Before that: v2.9.** Four things the owner met while using the app, and a
document for somebody auditing it cold. The day's two arrows are a pair at the row's left
edge, both inside the month they stand over, because a bracket around the
longest day this app prints is 353px and the month under it is 240. The day
type is one quiet line saying its answer, with the four values one press
behind it and the mechanism untouched. The time picker's category colours
are gone - an hour is a box of sixty minutes and could only round - and what
is being chosen is drawn on the day's own timeline instead, at the minute,
with its overlaps marked. And a library item or a task can carry one
address, shown as a small door on the row, the card, Up next and the focus
screen, opening a new tab and touching the network nowhere else.

`docs/AUDIT-v2.9.md` is that wave's fifth stage and a document only: every
screen and every press, thirty-four screenshots in both themes, what is known
to be imperfect, what would be decided differently, and what the two open
debts would cost. **Nothing is owed**, and the done contract still stands:
what is asked for next waits in "Asked for, not yet built" until it has been
met in a week of use.

**Before that: v2.8**, closed and tagged at `1282b3d`. The first wave the
done contract produced: the calendar's day opens into a card that stays
instead of a peek nobody could reach; a day can be cleared and stays
cleared; a week template stamped mid-week fills that day and the ones after
it and never reaches back, and opening a past day no longer invents a plan
for it; a day with writing on it says so with two quiet marks; the month's
arrows stand still all year; the focus screen is centred on the window
rather than on the box the scrollbar's gutter leaves; and a time is chosen
against the day, with the column opening where the day is.

**Before that: v2.7, and the app was declared done there.** The
last wave, seven stages from one brief plus a fourth small thing the owner
added while it ran, on a third rule that now sits in CONVENTIONS section
25: a state has to earn its place. The header's chip and its toggles stand
on one line with the date's arrows back at 44px and the date in a box that
cannot move; every block on both grids says when it starts and ends; the
Inbox and the Backlog are one list called Later; the Year view and Review's
streak are gone, and the month line says how many days had a plan; Review
carries "Where the plan and the week disagreed", which is the reading the
next brief comes out of; the research the docs never leaned on is written
down as what they rest on instead; OPEN-QUESTIONS is empty; and every
string in the app was read as one document and brought to one word per
gesture. Section 4 has the table, stage by stage.

**What happens now is the done contract**, under "Asked for, not yet built"
in this section: the owner lives in the app for a week, on the phone it was
written for and on the desktop it was polished on, and the next brief comes
out of that week - out of Review's reading and out of what real use turns
up - rather than out of a session with time left over. The tag is
`b735de6` and this handoff sits one commit above it. **Nothing is owed.**

**Before that: v2.5**, twelve stages from three briefs in one sitting:
notes stop pretending to be a database, they hold pictures, and one press
turns a note into a task with its editor open; nothing an interruption
touches leaves the day; the library's add row is one row; the tour never
covers what it points at; a template is judged as a day; the evening's
three questions become a journal that asks nothing; and every setting is
walked against a rule that most of them fail.

The closing critique found what a wave of measuring had not: the sweep's
contrast pass could not see `opacity`, could not see what a field says, and
ran at whatever hour it happened to run. Fixing all three turned a clean
report into 858 findings from a stylesheet nine hand-tuned fades deep, and
the app now pushes something back once, never below 3:1, on one token. That
is DECISIONS "A tool that cannot see a thing will say it is fine" and
CONVENTIONS section 22, and it is the most useful thing in this wave.

**Three commits sit above the tag**, and section 4's "After the tag" table
names them: this handoff, a read of the four briefs back against the code,
and four things the owner saw on their own screen - a drag that was a guess,
the arrows beside the date, Notes and Journal sharing the clock's panel, and
Calendar stretching one pane across a screen and a half. All four of those
came from looking, not from a failing test, which is the same lesson the
closing critique had just written down.

**Before that: v2.4**, closed and tagged at `f544c55`. The polish wave, briefed by the
owner in one message and run end to end: the navigation rail opening by
itself whenever another window handed focus back (it opens on intent only
now - a pointer that comes in and moves and is still there 150ms later, a
Tab, the pin); a pixel audit of six screens from the owner's own
screenshots, each measured before and after, with both scales written into
CONVENTIONS section 5 and a test holding the stylesheet to them; two small
features for the days the plan was not written for, a low day at 40% and a
timer on a step; and a critique pass that found the fifth type size nobody
had declared and five strings under AA that the contrast audit could not
see. Section 4 has the table, commit by commit; the tag is `f544c55` and
this handoff sits one commit above it. **Nothing is owed**: the debts table
is unchanged and every entry in it is a trade with its reason, and the next
brief comes from the owner.

v2.0 itself was six stages - categories the owner names, North as a window
with every rule under the goal it protects, an explanation for each of the
twenty words this app invented, three reading lanes instead of one stalling
queue, a clean pass over sixteen places including a navigation rail and a
calendar that says what is on a day, and the closing. **What is owed next is
the phone wave**, section 4's last block.

---

## 1. What Dienius is

A day planner for a brain that needs the plan to be visible or it stops
existing. It is two things at once, and both matter to how decisions get made:

1. **A tool one person uses every day.** Every feature has to survive a real
   bad Tuesday, not a demo.
2. **A public portfolio piece.** github.com/Quicasha/dienius, deployed at
   quicasha.github.io/dienius. Everything is public: the code, the commit
   messages, the docs. It has to read as a professional codebase, and nothing
   anywhere may look machine-generated.

The whole philosophy - why no streaks, why the push bound stops at two, why
goals never show progress - is in [`DECISIONS.md`](DECISIONS.md) and
[`RESEARCH-ADHD.md`](RESEARCH-ADHD.md). Do not re-litigate those without
reading them.

---

## 2. Every feature, one line each

### The day (the Today tab)

| Feature | What it is |
|---|---|
| Quick-add | Three parts on one line: a time control, the field, a duration control. Both controls open holding an answer, so a title and Enter is a placed, sized task |
| Capture mode | The same field writes to the day or to Later, chosen by a toggle; Later asks for no time |
| Categories | Six, one colour each, picked before typing; the same colour on the card and on the timeline block |
| Timeline grid | Anchored tasks at their real time and size, free gaps as labelled regions, a line at now; collapsed behind a disclosure on a phone, always open at the wide breakpoint |
| Drag and resize | Move a block in time or pull its bottom edge; drop it back on the task list to un-anchor it |
| Capacity line | One sentence: what is anchored, how much free time across how many gaps, what the untimed still need |
| Score | Done over planned for today. No percentage, no streak, nothing on a day with no plan |
| Day types and core tasks | A twelve-hour shift is not scored like an ordinary Tuesday |
| Push twice, then decide | An unfinished task moves to tomorrow twice; after that, finish it, delete it, or mark it ongoing |
| Yesterday banner | What yesterday left, stated once, moved forward in one tap - never automatically |
| Replan | Three doors for a day that broke: something came up, shift the rest, away and back. The first works for any day of the week since v2.2 - a phone call answered in three presses, with one line saying when you are still free. See `widgets/day-plan/replan.ts` |
| Low day | Beside Replan, for a day that is not going to be a full one: the key tasks stay at 40% of their length, the routine stays, the rest goes to tomorrow, and the score counts the key tasks alone. One press, one undo, a quiet mark under the date |
| Scratch | One key (S or backtick), or **Notes** in the header and then Open notes, and you are typing. Its own stream, the text kept exactly as written, photographs in a note. A leading `!` or the Note/Task toggle sends the line to Later instead |
| Quick-add time | The control on the left: the next free slot by default, arrows for a quarter hour either way, the picker on a tap, and No time when you want a float |
| Task detail | Everything the card does not show: exact minute, note, sub-steps, repeat, the three-a-day key mark. The size is a stepper with six chips beside it; the repeat is four buttons. Panel on desktop, bottom sheet on a phone, right-click menu for the common ones |
| Step timer | A step with a length ("Meditation 10 min") carries the one timer: a tap on its minutes starts it for that step, and the bell ticks the step |
| Focus | One task, its own planned time, a ring, a way out. Not a pomodoro |
| Timer and stopwatch | Survive a refresh, run on every tab, keep time in a background tab, put the countdown in the tab title |
| Day digest | In the wide rail: what is next, and how the day is going |
| North line | One goal under the day's title, rotating daily, expanding on hover/tap/focus |
| North card | After a slow day or on a Monday, one goal comes forward with its reason - on a Monday with one line of what you do to deserve it, for the week. Never a word about how yesterday went |
| Evening close | A quiet card at a set time, or the moment the last task is ticked. One sentence about the day, an optional line about the best moment, the journal's two optional questions, and a way to end it. Never a word about what was not done - see CONVENTIONS section 15 |
| Journal | Three lines a day, none required: "Today: ..." under the North line, and the two questions at the close. Never counted, never streaked; read under the day in the week's agenda, copied as markdown for a week or a month. See `lib/journal.ts` |

### The other tabs

| Tab | What it is |
|---|---|
| **Calendar → Month** | A month that fits without scrolling; every past day shows its ratio, a thin bar, what was carried on, a dot when every key task was kept. No red at any threshold |
| **Calendar → Week** | Seven columns of one shared timeline. Drag a block between days, tap to open, tap empty space to add, stamp per column or the whole week. Three days at a time on a phone |
| **Templates** | Named, coloured sets of blocks; stamped onto dates by clicking or dragging, nothing commits until Save |
| **Library** | Lists worked through a unit at a time. The add line is the words plus a unit control and a count control that already hold an answer, remembering the unit per list; a typed "Dune, 20 chapters" still works and the controls redraw to show it. Lists fold and a chip row jumps between them; in each, the item you are on gets a card with its progress and its pace note while everything behind it is one quiet line. An item can be counted in the list unit, in pages, as a film, or as seasons and episodes. A session goes onto a day in two taps, or onto a template in one flow; ticking it off advances the book. When one ends, the list says what it moved on to and puts a sitting on today in one press - the block was already bound to the *list*, and until v2.0 nothing said so |
| **Review** | Week and month facts, all derived from the days themselves: done over planned, deep work, key tasks, two charts, the goals' ages, what was read. No streak since v2.7. On a week, "Where the plan and the week disagreed": one line of facts per template block, sorted by disagreement, with a Copy - the reading the next brief comes out of |
| **North** | One page, read from the top: the picture of who I am becoming, up to four goals with why and who it makes you, two to four deserve lines under each, and the if-then rules under each. Written in the window itself - one line of the picture to start, then everything behind one quiet Compose that saves in one press. Nothing measured, ever |
| **Settings** | General, Sleep, Week, Categories, Nudges, Calendars, Backup, Sync, Appearance. General also replays the tour, in a sandbox. Nudges is exactly three rows since v2.5 - closing the day, when the evening starts, bringing a goal forward - and every setting in the screen has been walked against CONVENTIONS section 21 |

### Across the app

| Feature | What it is |
|---|---|
| Weekday templates | A template per weekday, so a new day opens already set up. A stamp by hand always wins |
| Repeating tasks | Daily, weekdays or weekly, materialised as real tasks. "Just this day" vs "every day it repeats" is a standing choice |
| If-then rules | Trigger plus action, under the goal it protects, in North. Never measured, never surfaced onto the day; one appears under the why on the card after a slow day |
| Later | Something to do, on no day, in the order you would pull it: one list since v2.7, where an Inbox and a Backlog were. Collapsed behind a plain count, nothing ever says how old anything is; one press puts an item on the day at the next free slot |
| Links | One optional address on a library item and on a task, typed in either editor. A small door on the library row, the day's task card, Up next and the focus screen, always opening a new tab, always its own target so the card's own press is unchanged. One icon for a machine of your own and another for the internet, with the address in a bubble under it. Nothing about it goes to the network |
| Keyboard layer | Single keys for common actions; a card behind `?`. Never fires while typing in a box, except Escape |
| Command palette | Ctrl-K / Cmd-K: run a command or find a thing. Linear scan, no index |
| Undo | One app-wide offer, five seconds, on the expensive mistakes |
| Snapshots | A full copy once a day in IndexedDB, seven kept, restorable from Settings |
| Cloud backup | The third copy: the plan as JSON in a private GitHub repo, written after the evening close, on the first open of a new day, and on a button. Token on this device only. Restore describes both copies before an armed replace. See ARCHITECTURE section 7 |
| Export / import | Plain JSON, both ways, deliberately manual |
| Sync | Optional, off by default, through a server you host. Per-entity last-write-wins with tombstones |
| External calendars | ICS subscriptions or file import, as a read-only layer. Free time counts them |
| Demo mode | `?demo=1` fills a sample fortnight under its own storage key. Today is lived up to the clock (never earlier than one o'clock), yesterday is finished so no banner sits above the first screen, and the seed carries a bound book, a backlog, a scratch stream and a task with a note and sub-steps |
| The tour | Nine steps, each ending on a real action rather than a Next button. Reached from the first-run offer, the `?` card and the palette. Whatever a step points at is forced visible and never behind a sheet; the card's line follows the person ("Now press Enter"); every step ends on a caption saying what happened. A step that cannot end says so and offers to do itself - it never skips on its own. Data in `lib/tour.ts`, engine in `views/tour/Tour.tsx` |
| Themes | Dark, Light, Midnight; accent colour, density, text size. Every ink measured against WCAG AA by a test |
| PWA | Installs, works offline, versioned cache, background update with a quiet Reload notice |

---

## 3. Version history

| Version | What it added |
|---|---|
| **v1.0** | Templates, stamping, the day view, the timeline grid, categories, the capacity line, the push bound, themes |
| **v1.1** | Library, task detail sheet, sleep schedules |
| **v1.2** | PWA, touch hardening, the keyboard layer, timer background reliability, a real test suite |
| **v1.3** | Automation (repeat rollover, weekday→template, midnight banner, task reminders), the Review tab, the command palette, snapshots and undo, `ARCHITECTURE.md` |
| **v1.4** | North (goals with no progress), calendar compact + per-day stats, the year heatmap. Mid-wave: `Task.origin`, which is what stopped push and stamp doubling everything |
| **v1.5** | Sync between devices (entities, merge, tombstones, server, client), DayView split six ways, the repeat lookback removed |
| **v1.6** | Week view, external calendars, demo mode, the 44px touch pass, README rework. Closed with two critique cycles that moved the week's own bar into the calendar bar and gave the phone's grid back 82px |
| **v1.7** | The interactive tour: a spotlight, nine steps, each ending when the thing actually happens. Sandbox replay from Settings |
| **v1.8** | Replan (something came up / shift the rest / away and back), Scratch, the quick-add time picker, and a responsive pass over every view at seven viewports |
| **v1.9** | Quick-add as three controls that already hold an answer; the backlog; Library v2 (folding lists, one loud item each, pages/film/series tracks, pace notes, add-to-template, the reading plan seeded); the tour hardened with three ways in and three ways out of a stuck step; the evening close; every millisecond budget turned into a ratio |
| **v1.10** | The reading plan seeds only from the palette (the privacy fix); the tour engine's standing rules - the target is visible, never behind a sheet, the card says what to do now, every step names its outcome, nothing skips on its own - after the owner's walk found seven problems, plus the scroll-position feedback loop and the Escape-under-a-sheet bug the walks exposed; quick-add fitting its column and the column fitting a 1024px window; `store.ts` split into ten action areas plus `core.ts` with no import changed; Playwright end-to-end tests for a first day, the naive tour on two viewports, and two-device sync |
| **v2.11** | A template block carries a note and a list of steps onto every day it stamps. The note takes the day's own words where there are any and the block's where there are none, which needs `Task.templateNote` to tell those two apart; the steps arrive unticked with their timers and never travel between days. Written in one panel per block, closed unless asked, in both editors. And the card's "note" mark stopped being a label - one press opens the text under the row, plain lines with an indent drawn fixed-width |
| **v2.12** | The wave that came out of the owner building a real 74-block week. "Add to" became seven day switches with the named scopes as presets over them, because a rotation of Mon/Thu, Tue/Fri, Wed/Sat has no name and every block was going on twice. A block carries KEY the way it now carries a note and steps, with the three-per-day cap enforced in both editors per day and at stamp time. A category is made from the swatch row rather than four screens away. A privacy guard reads every tracked file and refuses the owner's own words, hashed so the guard is not itself the leak. A Playwright walk builds the whole week - ninety-seven presses - and a second one lives seven days on top of it. And `docs/MORNING.md`, the one page to open at 07:00 |
| **v1.11** | `npm run shots`: the README's screenshots generated from the demo under a pinned clock; the demo's first screen fitting 1366x768 with one notice at a time, a thin demo line, pointer-aware grid floors and a column that scrolls instead of the page; seven more Playwright files (replan's three doors, a bound book, the backlog and scratch, a night passing, a week drag, export-erase-import, a snapshot, an .ics file) and the three bugs they found; ICS time zones through Intl and the plain monthly and yearly rules; `validate()` as tables in `validate.ts`, a map at the top of `timelineLayout.ts`, the tour's scrim rebuilt so it stops repainting the window; a pen for Scratch in the header; the third copy of the plan in a private GitHub repo; every control opening on an answer - the library's add line, duration chips, a repeat as four buttons; the README rewritten to what a stranger needs in thirty seconds, and every doc read against the code |

| **v2.0** | The desktop closed as a product. The library's queue says it is a queue: what ended today, what the list moved on to, and one press that puts a sitting on it - plus the bound card on the day reading "finished - next is Deep Work" instead of "ch 12/12". Typing lag measured rather than assumed and found not to reproduce at 4x, then fixed where it does reproduce, with `contain: layout style` rather than a debounce. Fourteen defects from walking the app as its owner at 1920x1080, 1600x900 and 1366x768 in both themes on a realistic full day and a twenty-task one - the worst being a task list squeezed to zero pixels with seven tasks in it, and a month grid drawing a whole extra week of the next month. Every copy of the plan driven live in a browser: the GitHub chain in thirteen steps against a stand-in Contents API, two devices ticking, editing and deleting at each other, and a snapshot that really brings a day back. `DAILY.md`, walked step by step on an empty install rather than written and hoped for |

| **v2.1** | North as a page: the picture over the goals, what you do to deserve each under it, the rules under that, all written in the window behind one Compose; the phone measured to zero and walked; and a bug hunt at three sizes - the quick-add panels painted behind the list since v2.0, ten sheets dropping focus on close, two month grids that were forty tab stops each, a timer widget over the rollover line, and a dozen smaller things, each with a place and a viewport |

| **v2.2** | Replan v2: "Something came up" for any day of the week, as the phone call it is answered on. One sheet at the app root from six doors - the day header on today and any later day, the week's bar, the calendar's day preview, the palette, the R key. Today, tomorrow and the five days after as chips, then the morning, afternoon, evening or whole day gone against that day's own waking window, a time and a length, or don't know how long; a typed line in Lithuanian or English that the chips follow and that a pressed chip takes its word out of; the plan proposed with the template's blocks skipped and one-offs moved into the gaps after it, key tasks first; a day nobody opened made from its weekday template before the plan lands; the free-windows line above Accept; one undo; "replanned" on the week. `ensuredDay` as the pure half of `ensureDay`, `DayPlan.replannedOn`, and a phone-sized browser test measuring three presses with nothing scrolled |

| **v2.6** | The desktop wave, on two rules the owner wrote down: information appears once, and nothing moves on hover. Today's header as two zones with nothing under it but the North line; the rail's card as four figures with the gaps and the sleep note beside them, its ring gone; the North line's peek as a bubble under a fixed-height line; every native tooltip replaced by one drawn under its control; the Monday card as a sheet; a single pane filling its width with the header aligned; the task column's footer, fade and the app's own scrollbar; Scratch, the journal and the blocks each losing what read as unfinished; a health pass that took seven hovers that moved and two numbers said twice, held by `hoverStillness.test.ts` |
| **v2.4** | The polish wave. The rail opens on intent only, after four ways in were told apart from a window changing hands. Six screens measured against the owner's screenshots and rebuilt: Today's header as three groups, gap labels as dividers, a two-line floor for an hour or longer; the task sheet's footer; the month as a wash and a strip; the week's 15px floor; the template editors and the library. Two scales, in CONVENTIONS section 5, with `scale.test.ts` reading the stylesheet against them. A low day - one press, the key tasks at 40%, the routine kept, the rest to tomorrow, the score on the key tasks alone - and a step that carries a timer. Then the critique: the browser's 16px as an undeclared fifth size on four screens, five strings under AA behind a colour parser that could not read a `color-mix()`, `--touch` named once for a hundred and twenty five places, and a chosen swatch's ring given its room back and its gap drawn in the ground, which is what the owner saw first |
| **v2.3** | The journal: "Today: ..." under the North line in the morning, and two questions on the evening close card - what was real today, and what to tell yourself tomorrow - all optional, plain text, never counted or streaked, kept on the day entity with no migration. Read under the day in the week's agenda, the morning line under a day's name on the desktop grid, and copied as markdown for the week under the week or for the week or month in Review, to paste into another chat |

| **v2.0, second half** | Six stages that finish what the first half started, all of them about the app being *understood* rather than being complete. Categories became the owner's: a list in `AppData` rather than a literal in a module, twelve curated colours with a readability gate, and a delete that moves what it would orphan. North became a window with every if-then rule under the goal it protects - a rule with no goal is noise, under a goal it is armour - and the day view's old one-rule-at-a-time surfacing went with the three fields it needed. Twenty invented words got a sentence each, in one file, checked by a test whose data is the list itself. One reading queue of twenty books became three lanes that advance on their own. Then a clean pass over sixteen places: seven text tabs became a rail of icons, month cells started saying what is on a day rather than what the day was called, resting on one shows the whole day, the week gained a second reading and a place for the backlog beside it, and the template editor stopped opening with eight colour balls above the name |

Tags exist for v1.0 through v2.3, and `v2.0` covers both halves - it was moved
forward from the desktop close to here, as the plan written at the time said
it would be. Nothing was published between the two: the first half was tagged
on a Friday and this is the rest of the same release.

---

## 4. Open work

### Nothing is half-built

Still true, and checked rather than assumed. The suite is green - **2478
tests in 150 files, plus 39 Playwright tests across two viewports** - the
typecheck and the build are clean, and `npm run sweep` reports nothing on
the desktop at 15:00, 22:00 and 09:00 and nothing on the phone, with
`--self-check` at 8/8. The working tree is empty and pushed.

One thing about running that sweep, found in v2.9 and worth the next
session's time: **it hangs when it is started from a backgrounded shell**
and finishes in about nine minutes in the foreground. Twice it sat for
twenty minutes on five seconds of CPU, and the phone pass needs more than
ten minutes, which is longer than one foreground call gets - it was run in
groups with `--only` instead. Nothing about the app; something about how
the process is started.

The count is five lower than v2.6's and the app is larger, which is the
shape of this wave: the Year strip took forty-two tests with it and Review's
streak seven, and the twenty-six that came in - the fold into Later, the
next free slot, the week's disagreements, the keys, the chip that asks -
are about things that exist.

Read that sweep line as stronger than the same sentence in v2.4. The pass
now sees through a fade, reads what a field says, walks a pinned clock
rather than whatever hour it was run at, settles a page before reading it,
and checks that a chosen control is drawn differently from the ones beside
it. Every one of those five was a hole it had been reporting clean through,
and the last one is the shape the owner had reported twice by hand. See
DECISIONS "A tool that cannot see a thing will say it is fine".

**Where to start:** [`MORNING.md`](MORNING.md) if you are the owner and it is 07:00. Otherwise the v2.12 wave below, then the v2.11 wave - a template block can carry a
note and a list of steps, so a meal block arrives with the recipe on it and
a morning routine arrives with its four steps. Under it, the v2.10 wave, which added nothing and fixed two
things - both about where focus lands when a panel closes, both found by
crossing the app on a keyboard alone. Its table also says what each of the
four passes measured, so the next session can measure the same things
without inventing them again. The v2.9 table under it is closed, and so are
v2.8, v2.7, v2.6, v2.5, v2.4, v2.3 and v2.2, commit by commit. The debts
table further down has gained one line and lost none: `docs/AUDIT-v2.9.md`
names what the two old ones would cost.

### The v2.12 wave: the night before a real week

Everything here came out of the owner building a 74-block week by hand and
hitting the same wall three times: the template could hold the shape of a
day but not what was in it.

| # | Stage | Commit | What it is |
|---|---|---|---|
| 1 | Library, both forms | `7bf0e23` | The owner said the screen looked random. Every gap on it had a cause: two margins added to a parent's flex gap rather than replacing it, a wrapping row that stretched one field down a 62px column of nothing, and a row aligned to `flex-end` that put a 51px void above three text fields. Two dead CSS rules found on the way, both overridden by a later rule with the same specificity |
| 2 | A block carries a note and steps | `978f661` | See the v2.11 table below - tagged separately because it closed before this wave started |
| 3 | The privacy guard | `a4a3026` | A scratch file naming another of the owner's projects was swept into a commit by `git add -A`. `scripts/no-personal-data.mjs` reads every tracked file and refuses if anything on a private list is in one. The list is hashed, because a list of private words in a public repo publishes them |
| 4 | Seven day switches | `e13328a` | "Add to" was four named answers, and a rotation of Mon/Thu, Tue/Fri, Wed/Sat has no name - so every block went on twice. Seven switches say all thirty-one combinations; the names survive as presets over them. DECISIONS carries the old argument with the date real use overturned it |
| 5 | A block carries KEY | `7822f93` | Same gap as the note, same fix. Plus the three-per-day cap where it had never applied: both editors refuse a fourth and name the three in the way, the week editor counts per column, and stamping caps whatever reaches it by keeping the earliest three and dropping nothing |
| 6 | The rehearsal and `MORNING.md` | `8ac88e1` | A whole week built through the screen in the shape a real one has. **Ninety-seven presses**, against a budget of 120 - the first run measured 138, and all of the difference was the walk using the controls the long way. And one page, numbered, every button named exactly, written from the steps the walk actually took |
| 7 | A category made where it is needed | `5c421f9` | A "+" on the swatch row in both editors and in quick-add, and a pencil on whichever swatch is chosen. The curated palette and no colour wheel: every colour offered already passes the readability gate, so it is kept by construction rather than by a warning nobody in a hurry reads |
| 8 | The soak | `d982446` | Seven days of use on the built week, four checks after each. **It passed for four runs while doing almost nothing** - every gesture skips a control that is not there, which is also how a soak stops soaking. Five defects in the walk came out of making each gesture assert its own effect |

### The v2.11 wave: a block that says what to do

The owner's words: "kai ateina meal, matai pasirinkimus ir adhd ready
receptukus". A template could not do it. `TemplateBlock` held a title, a
time, a size, a category and a binding - nothing anybody writes in
sentences - so `applyStamps` read `note` off the matching prior task, which
on a fresh day is nothing. Text typed into a template reached no day, ever.

| # | Stage | Commit | What it is |
|---|---|---|---|
| 1 | The two fields, and two rules for them | `978f661` | `TemplateBlock.note` and `TemplateBlock.steps`. The note: a day that was written on keeps every word, a day that was not takes the block's - which needs `Task.templateNote`, what the block gave last time, because after one stamp the day's note **is** the block's text and `match?.note ?? b.note` alone can no longer tell them apart. The steps: `match?.subtasks ?? stepsFrom(b)` and no more, because a list is state a day works through rather than words it re-reads |
| 2 | In both editors | `978f661` | One quiet word at the end of a block's row, a panel behind it. Closed unless asked, solid when it carries something. In the week editor the panel is drawn under all seven columns - a column is a seventh of the editor - and it follows the standing "this day / every day it is on" scope exactly as removing a block does |
| 3 | On the day | `978f661` | The card's note mark was a span: it said "note" and could not be pressed, so the route to what it named was the actions menu and then Details. It is a button and opens the text under the row. Plain lines, no markdown engine; a line typed with an indent is drawn fixed-width so quantities line up |
| 4 | Two defects found on the way | `978f661` | `addTemplate` enumerates the block fields it copies and would have dropped both new ones - the comment above it already records this happening once with `category`. And `.block-list li` never wrapped, so a full-width child was laid out beside the row and overflowed the card |

Sixteen tests: the note reaching a fresh day, the day's own winning, a
template edit reaching the untouched days and not the written-on ones, steps
arriving unticked with their timers and never shared between two days, both
editors, the card's mark, sync, backup, and a walk on the phone.

### The v2.10 wave: a bug hunt, and nothing added

No feature in it, by the brief: **find and fix**. Four passes over a real
day, each one measuring something the suite had never asked about, and every
finding fixed where it was found rather than written down.

| # | Pass | Commit | What it found |
|---|---|---|---|
| 1 | Every screen, three sizes, both themes | none needed | Nothing. Sixteen screens at 1920x1080, 1600x900 and 1366x768 in dark and light, read for console errors, more than four type sizes, spacing off the scale, a figure printed twice inside one card (section 23), and anything that moved under a real pointer (section 24). The pass plants four defects of its own on request and sees all four, which is why its clean report is worth reading |
| 2 | Every screen, keyboard only | `f08dfb1` | **Two real defects, both about focus.** The Notes and Journal popovers left focus on the body when Escape closed them, and so did the task's detail sheet when it was opened from the actions menu. Both came from `useRestoreFocus` capturing the wrong opener; see DECISIONS. Otherwise clean: every tab stop shows a ring, nothing is reachable only with a pointer, the order does not climb the screen, and Escape closes every overlay |
| 3 | The shapes nobody checks | none needed | Nothing. Thirty tasks on a day, a title of two hundred characters, a template of twenty blocks, an empty day, a day with everything done, a week of empty days, a month with one entry, a library list of a hundred, a journal entry of five thousand characters, and photographs of 4.8MB and 7.3MB - each seeded, opened at two sizes, and read with the app's own audit pass |
| 4 | The same press, twice | `632013c` | Nothing doubled: the same template stamped twice, a week stamped twice, push-to-tomorrow twice, a low day twice, a day cleared twice. And one gap closed in the suite rather than in the app - **sync after a replan** had never been tested, so a day rewritten whole could have arrived twice without anything noticing. It does not, and a browser test now says so |
| 5 | The README and the license | `376aa1c` | The test badge said 1800 when the suite is past 2400, and three files said the store had ten area modules when it has eleven. The license was one word and a link; it says what MIT actually allows now, and what it covers |

#### What was measured, so the next session can measure it again

The four passes were throwaway tooling in a session scratchpad rather than
scripts in the repo, because the brief for this wave was to add nothing. What
each one did:

- **The visual pass** walks the sixteen screens listed in `sweep.mjs` plus
  the overlays, and for each reads: console errors and warnings; every
  `font-size` actually printing text, counted against the scale in
  CONVENTIONS section 5 and against the four-per-screen rule; every `gap` and
  `padding`, against the spacing steps and the values the stylesheet composes
  out of them (36, 48, 52 and 64 today, read from the stylesheet rather than
  allowed as a class - every sum of two steps would admit 7px); a figure
  printed twice inside one card; and, with a real pointer rather than a
  synthesised event, whether hovering a control moves anything that was
  already drawn. A synthesised `pointerover` fires every handler and no CSS,
  and the first version of the pass reported a planted `:hover { padding }`
  as clean.
- **The keyboard pass** tabs through every screen and asks whether each stop
  shows a ring, whether anything on the screen is reachable only with a
  pointer, whether the order climbs back up a column, and whether Escape
  closes each overlay and hands focus back. A grid with a roving tabindex and
  a checkbox drawn as a box beside a zero-width input both look like defects
  and are not.
- **The edge shapes** are seeded into the store directly and read with
  `scripts/audit.js`, the same pass the sweep uses, so a clipped line is
  reported in the same words.
- **The doubles** press each action twice and compare the store: how many
  tasks each day holds, and how many share a title.

### The v2.9 wave: an arrow, a question, and what a picker was pretending to know

Three briefs from the owner in one sitting, each one a thing met while using
the app rather than a plan. Two of them undo something an earlier wave built,
which is what a done contract is for: the wave that shipped it was not the
wave that lived with it.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 1 | The day's arrows come inside the month | `08bc202` | "That arrow after September 8 cannot leave the calendar below it." Measured: from about 1500px up, where the header stands over the rail, the left arrow sat on the month's left edge and the right one 113px past its right edge. A bracket around the longest day this app prints is 353px and the month under it is 240; the name cannot shrink without abbreviating a word and 44px arrows cannot shrink at all, so the name came out from between them. The two arrows are a pair at the row's left edge now, both inside the month, reading as one control, with the name after them. The phone keeps its bracket, where each arrow sits at a screen edge a thumb reaches |
| 2 | The day type shrinks to a line | `066a024` | The mechanism stays, the control shrinks. Four buttons opened the template editor for a question whose answer is Full day on all but a handful of templates; now one quiet line under the name says the value and offers "change", and the four are one press behind it. The week editor's seven columns do the same. Nothing was removed - shift and overnight still exist, still save, still decide what `dayScore` counts - and the four explanations were rewritten to say what changes rather than what a day is: everything on the list counts, or only the blocks marked Core |
| 3 | The colours leave the time column | `9b9c01e` | An hour is a box of sixty minutes, so painting it by category could only round: a block from 09:05 to 10:05 painted nine and ten alike, and the day's own timeline was already saying the same thing to the minute. The wash and the bar are gone; what is left is a 2px grey rule for "not empty". What a time being chosen would look like is drawn on the timeline instead - dashed, half there, in its category's colour, with its length, at the minute, on the day's own scale - and where it crosses a block both wear the border two overlapping blocks already wear. The window grows to hold a candidate outside the drawn day rather than pinning it to the edge, and a column that scrolls scrolls to it. Quick-add, the task sheet and both template editors all draw on the timeline that is theirs |
| 4 | A link to the thing itself | `3d380bf` | A library item and a task each carry one optional address, shown as a small door on the library row, the day's task card, Up next and the focus screen. Always a new tab with `noopener noreferrer` - "so that Dienius does not close" - and always its own 44px target, so pressing the card still means what it meant. Two icons: a machine of your own (localhost, a private address, a Tailscale name or its range) and the open internet. The address is in the bubble under the control. Nothing anywhere goes to the network: no reachability check, no favicon, no preview, and a string that is not an address is simply not saved, with nothing said about it |
| 5 | An audit for the owner | `595975b` | `docs/AUDIT-v2.9.md` and the screenshots under `docs/screenshots/audit/` |

#### After the tag

| Commit | What it is |
|---|---|
| `6aa72a1` | The header read again by the owner: "the date text should not leave the calendar's bounds, and Working day and Replan and all the rest are somehow at random gaps." Both were the same cause. The day's block is the month's own 240px now - its left edge and its right edge the calendar's - holding two rows: the arrows and the day's word, then the date across the whole block. The heading is "Today" or the weekday and the line under it is the rest, because the whole form is 250px in that type and the cell beside the arrows is 136. The measuring ghost is gone: the block is one width because the column is, which is what it was for, and what was left of it after a short day's name was the dead space being read as a gap. The chip after the block now starts where the timeline starts |
| `0f0cae1` | The audit's thirteen screenshots that show that header, retaken on it |

#### The brief, as understood

1. **"That arrow cannot leave the calendar below."** The day's forward arrow
   in the header, which stands over the month in the rail from about 1500px
   up. Both arrows inside the month's width, the 44px target kept, and
   nothing moving as the day's name changes length.
2. **The day type: the mechanism stays, the control shrinks.** Default Full
   day and no choice on the screen until it is asked for; one quiet line
   under the name; four options behind one press; each explanation saying
   what changes rather than what kind of day it is; the same in the week
   editor's columns; nothing removed from the code or the data; and the
   scoring untouched for every type.
3. **The colours out of the column, the candidate into the timeline.** The
   column back to one meaning, a live dashed block on the timeline as the
   hours and minutes are moved through, the overlap border on both sides of
   a clash, the timeline scrolling to it, one quiet grey mark left in the
   column, and the same in quick-add and the task sheet.
4. **A link to the thing itself.** "At the details you could put a link in
   ... where up next you can press and it throws you straight there, but so
   it throws you into a new tab so that Dienius does not close." One optional
   address on a library item and on a task, on the library row, the task
   card, Up next and the focus screen; a new tab every time; its own target,
   never changing what the card's own press does; one icon for a machine of
   your own and another for the internet, with the address in a bubble under
   the control. No list of links, no search, no favicons, nothing that goes
   to the network.
5. **An audit for the owner**, and a document only: every screen and every
   press, screenshots at 1920x1080 in both themes on a realistic day, what
   is known to be imperfect, what would be done differently, the two open
   debts, and no recommendations of any kind. The owner decides.

### The v2.8 wave: the calendar, the focus screen and choosing a time

Briefed by the owner in one message, in Lithuanian, eight stages, to be run
end to end. It is the first wave after the done contract, and it is what
that contract is for: every stage below is something the owner met while
living in the app rather than something a session thought of. Their words
are quoted in each stage, because the words are the specification.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 1, 2, 3, 4 | The calendar day opens, clears, and says what is written on it | `91cdb30` | The hover peek is gone with its delay, its timer and its two handlers - the pointer could never reach what it showed. A press opens a card anchored to its own cell, touching it, bounded by the grid, that stays until Escape, an outside press or its own Close, and hands focus back to the cell. On it: the day and its template, its tasks tickable where they stand, Open day, Notes, Journal, Something came up, and Clear this day. Clearing asks once with the count and the day, offers Undo, and stays cleared - `autoApplied` and a repeat skip per instance, so opening the day again does not refill it - and the week column offers the same. A week template stamped mid-week fills that day and the later ones and never reaches back; opening a past day the weekday map names no longer invents a plan for it, which was a real bug. A month cell with writing on it carries two 5px marks, filled for the journal and open for a note, counting nothing |
| 5, 6 | The arrows stand still, and the focus screen is centred | `8ef2448` | The month's name sits in a box the longest month fills, so the arrow after it stops walking sixty pixels between May and September - the owner's "one of them has flown out" was the word between them, not the arrow. And the focus screen: the guess in the brief was the navigation rail, but the rail is covered; what moved it was `scrollbar-gutter: stable`, which makes every fixed element ten pixels narrower than the window, so a screen that centres one big ring in that box sits five pixels left of where the eye measures from. The left padding carries `100vw - 100%` now, which is the gutter where there is one and zero where the scrollbar floats over the page |
| 7 | Choosing a time | `8ef2448` | The column opens at the day rather than at midnight - the value the field holds, else the end of the last block, else the waking time, with waking as a floor so one stray block at two in the morning cannot drag it back into the night - and an hour a block covers carries that block category colour, the same wash the timeline paints, with a bar along the bottom as wide as the share of the hour that is gone. Sideways because the column own axis runs down: a fill from the top would claim which half of the hour is taken, and two blocks in one hour make that claim unanswerable. Nothing is blocked and a screen reader hears the words. One component, three sources: the day blocks and its calendars, the template own blocks in both editors, and nothing at all where there is no day. Found on the way, both pre-existing: the day view clock panel was clipped to a 66px box and had never been visible at all, and in both template editors a rule for the block-add row outranked the picker so the chosen hour looked exactly like the thirty-five that were not |
| 8 | Closing and `v2.8` | `1282b3d` | Every gate: typecheck, 2424 unit tests in 148 files, the build, 35 browser tests across two viewports, and the sweeps. Two critique passes on the scenario the owner asked for - a real week built from nothing at 1920 dark and 1366 light: a week template with its times chosen from the new columns, the weekday map, Stamp week pressed on a Wednesday, then the month, a day card and a day cleared. Both passes end with the same two facts and no console error: the stamp filled Wednesday to Sunday and left Monday and Tuesday alone, and the cleared day stayed cleared with its template gone. The README's screenshots regenerated |

#### The brief, as understood

1. **The calendar day opens rather than shows.** "When we hover over a
   calendar day we see the whole list, but we cannot move the mouse down
   onto that list ... it would be logical that when you press a day the
   list shows and then you navigate from there." The hover model either
   becomes a quiet hint or goes; a press opens a card that stays. On the
   card: tick a task where it stands, Open day, that day's Notes or
   Journal, and clear the day. Reachable by mouse with no gap to cross, by
   keyboard, and by tap. No two mechanisms at once: the old preview logic
   is reworked or removed with its code.
2. **Clearing a day.** "There should be a delete button so you could easily
   clear any day, which helps especially if you put a week template in
   mid-week." One sentence with the count, then Undo. A cleared day stays
   cleared - the weekday template does not refill it - and the same action
   is on the week column's head.
3. **A week template does not climb onto the past.** "If you put it in
   mid-week, then the week template should start from the day you put it
   in, and not put anything on the days already past." The same rule for
   the weekday map: a day is materialised when it is opened, never
   backwards.
4. **Notes and the journal are visible in the calendar.** "If we write
   notes on a day, in the calendar we should also see a mark for a note or
   a journal and be able to press it and see what is written." A quiet mark
   in the corner, no count and no verdict, and the card opens that day's
   writing rather than the general view. At most two marks, and they do not
   compete with the template colour or the day's number.
5. **The arrows above the calendar.** "Those arrows above the calendar, one
   has randomly flown out, it needs to be tucked in more and not go outside
   the calendar's bounds." Symmetric, aligned to the grid's edges, inside
   the rail's column at 1920, 1600 and 1366 in both themes, the 44px target
   kept, and the month's name between them at a fixed width so a longer
   month does not push them.
6. **The focus screen is centred.** "You can see in the focus main window
   that it is not centred." Find the cause and fix it, at 1920, 1600, 1366
   and 390x844 in both themes, with a test that the centre of what is drawn
   and the centre of the visible area agree within two pixels.
7. **Choosing a time**, the most important stage of the wave. "It is very
   awkward to change the time by scrolling ... if we get up at 7, start
   from there, so there is nothing to scroll past; and once we have a block
   from 9 to 10, we should see what is free and it should scroll there by
   itself, so that when picking a time we actually see what is taken and
   what is not, by colour." The column opens at the day: the value it
   holds, else the first free stretch after the last block, else the waking
   time. An hour a block covers carries that block's category colour as a
   wash, a partly covered hour says so, and a free hour is clean. Nothing
   is blocked: an overlap is allowed and now visible before the choice
   rather than after it. One component, two sources - the template's own
   blocks in the editor, the day's blocks everywhere else. Typing and the
   keyboard do not change.
8. **Closing.** Every gate, two critique passes on the desktop with one
   scenario - building a real week from nothing, template, times, blocks
   and a week stamped mid-week - the README's screenshots, this table,
   CONVENTIONS if a rule was born, DECISIONS for each decision, the tag,
   the push and the handoff.

### The v2.7 wave: the last one before the app is lived in

Briefed by the owner in one message, in Lithuanian, seven stages, to be run
end to end without stopping. It is the closing wave: after it the app is
**done**, and a done contract comes into force - anything asked for from
here goes into "Asked for, not yet built" and waits until the owner has
lived in the app for a week. The next brief comes out of that week's data,
not out of a feeling.

One principle joins the wave to the two before it and goes into CONVENTIONS
as section 25: **a state has to earn its place**. The rule for settings
(section 21) applied to the places a thing can be: a state stays only if
the owner would actually tell it apart from the one beside it. Five places
for "not now" - Notes, Inbox, Backlog, a float on today, Set aside - is
more than a person whose whole aim was minimal decision energy can be asked
to choose between at the moment of writing.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 0 | Written down first | `29cc206` | The brief and the decisions it forced, in this file, before any code |
| 1 | Three small things from the owner's screenshots, and a fourth the owner added | `7bb7a6a` | The header's chip, Replan and the two toggles are one 36px box on one baseline, and the field's Task toggle takes the header toggle's tint; the arrows are back at every width at 44px, the title sits in a box sized by a hidden "Wednesday, September 30", and from 1500px the right zone never leaves the row (the running title ellipsises instead) while the single pane grows to the calendar's 1336px so the owner's own desktop holds one row in all three views; the rail's chip says "Already on this day" for the template already there, asks "Replace X with Y? Blocks you added by hand stay." for another, and stamps an empty day at once - a day still carrying a deleted template's blocks asks too. Found on the way: on an iPad in landscape the header's buttons were 36px under a finger; they are 44 with the chip now. Nine tests in `TemplateRail.test.tsx`, three rewritten in `DayView.wideLayout.test.tsx` and `dates.test.ts` |
| 1d | Every block says when | `bd090d0` | The owner's fourth point, from a screenshot with times on two blocks out of nine: every sized block carries its start and end - under the title where it has two lines of room, after the title on the same line where it has one - on Today, on the week and in the template editor's picture, and where a block is too narrow for a time - a crowded lane, the editor's week columns - the width has the last word and the block is its title; the floors did not move, so the page still does not scroll at 1366x768. An unsized block says its start and "no length". CONVENTIONS section 4's rule rewritten from "an hour or longer" to "a block carries its start and its end" |
| 2a | Inbox and Backlog become Later | `aec8872`, after `8cae590` | One list where two were: `LaterItem` is the old shape under the wire name `backlog`, `store/later.ts` its four actions, `Later.tsx` the fold with the Backlog's grip, order and "Onto this day" at the next free slot, `LaterStrip.tsx` under the week; the field's toggle is Task / Later and Later asks for no time; a note's `!` and "To Later" go there; Ctrl-K has "Add to Later". `lib/later.ts` folds an older payload's inbox into the top of Later once, with a tombstone per line, on load and after every merge. Found on the way: the week's drop landed an item with no time while its comment promised the next free slot, and `validate.ts` checked three Task fields on the wrong entity. Inbox.tsx and its tests gone; 2360 tests |
| 2b | The Year view, Review's streak and the month's percentage | `205180e` | `widgets/year-strip/` gone with its 42 tests, its stylesheet, its sweep screen and the calendar's third segment; Review's Streak figure gone with `highlightStreak` and its seven tests; the month line under the calendar bar says how many days had a plan and nothing else. CONVENTIONS section 25, "a state has to earn its place", written with the no-new-decisions rule under it |
| 3 | What is missing: where the plan and the week disagreed | `cc0f392` | `lib/planReading.ts`, pure: for every block of every template the week's finished days were stamped from, on how many days it happened at its time, how many times it moved and by how much on average, set aside, not done - defined from the fields that exist, no timestamp added; sorted with the largest disagreement first; `readingMarkdown` for the one Copy. Drawn in Review on a week, between the charts and North, only when a past day of the week had a template. Fifteen tests on the arithmetic and two on the screen |
| 4 | The docs told the truth | `3500c96` | Every living doc and the copy in `explain.ts` and `tour.ts` searched for "Zeigarnik", "decision fatigue", "ego depletion" and "evidence shows": the terms occur only in the research documents, where they are named to be refused, and in the push-bound entry, which refuses them - nothing had to come out. What the brief asked for is written once in DECISIONS "Three arguments the docs do not make" (what capture, the no-new-decisions rule and the grid rest on instead), the no-new-decisions rule is stated in CONVENTIONS section 25 with the abandonment literature as its reason, and "Relatedness is the motivator local-first cannot serve", which had said everything 4d asked for since 2026-09-01, takes the brief's name, "Relatedness is a known cost" |
| 5 | The open questions closed | `3500c96` | Both items moved to DECISIONS as accepted, with their reasons and the two honest fixes each named - "The mini calendar's cells stay at 33px", "A task's title is a 29px target, on purpose" - and OPEN-QUESTIONS is empty with the date. The standing touch-hardware note became the done contract's first line: the owner's week on the phone is the first touch test |
| 6 | One voice | `6782ff3` | The keyboard card behind `?` made true key by key: `1` opens today as the rail's button does, `F` starts Focus on today's running task whatever day is on screen, the arrow rows say they work on the day view, the backtick is on the card at last, and the card itself is two columns from 720px because nineteen rows in one ran 802px into a 640px box and hid the Ctrl-K row, the note and the way into the tour. Escape closes one layer per press: five popovers stopped the event as the actions sheet already did, and the clock joined the guard that keeps a bare key from reaching the shell under a dialog. The tour's one false sentence - "That bar along the bottom is Focus" - says "That strip under the header" and was walked on both platforms. Then every string in the app read as one document: one word per gesture (Delete for a whole thing, Remove for a part, Erase for everything, Close for a surface, Dismiss for a notice, Cancel for stepping back, Save for a form, "Add a" for a countable thing, Onto for a day, Push for a task that was not done), the armed second press as the verb and a question mark, no contractions, every empty state one sentence, "How long" for every length control, Notes for the stream on screen, and a tooltip that only repeated its own control removed. About a hundred and thirty strings, every test and browser test that named one, and DAILY read against the app |
| 7 | Closing and `v2.7` | `b735de6` | Every gate: typecheck, 2341 unit tests in 143 files, the build, 35 browser tests across two viewports including the tour walked step by step on a desktop and a phone, and the sweep at zero on the desktop at 15:00, 22:00 and 09:00 and on the phone, with the self-check at 8 of 8. The README's screenshots regenerated from the same pinned Wednesday. The one finding on the wave was the sweep's, at 22:00 and 1600x900: the float title's 29px hit area hung four pixels over the meta line under it and painted its bottom over the size chip, which it had done since the negative margin was written, and which this app's own DECISIONS entry had named as the thing to check - the room is all above the words now. This table, the tags table, CONVENTIONS 25, the DECISIONS entries, and the tag |

#### The brief, as understood

1. **Three small things from the owner's v2.6 desktop screenshots.**
   - *The chip and the tabs.* The "Working day" template chip in the header
     sits at its own height, and the segmented tabs on the right at theirs;
     both are a "what is in force here" control on the same row. One
     vertical axis: the chip's baseline is the tabs' baseline, the same
     height, the same distance from the top. Checked in all three views -
     Both, Calendar, Tasks.
   - *The arrows come back.* The arrows either side of the date came off
     the wide header after v2.5 because they overflowed. The rule is not to
     remove but to make overflow impossible: a fixed width for the date,
     measured against the longest day ("Wednesday, September 30"), 44px
     arrows, one row with no wrap from 1366px up. If 1366 cannot hold it,
     the day's name is shortened ("Wed, 30 Sep"), never the arrows dropped.
     The left and right arrow keys stay as they were.
   - *The template chip does not overwrite silently.* Every press on a chip
     in the rail stamps again today. From now: a day that already has this
     template - a second press does nothing and says so quietly, "Already
     on this day"; a day that has another template - one sentence,
     "Replace Working day with Rest day? Blocks you added by hand stay.",
     with Replace and Cancel; an empty day - stamped at once, as now.
     Rule 11 (twice is once) has to cover it: a double press never doubles
     a block. Tests for all three.
   - *Every block says when.* Added by the owner while stage 1 was being
     built, with a screenshot of Today: the start and the end showed on
     Deep work and on Meetings and on nothing else - Lunch, Standup,
     Commute and Dinner were titles alone. The rule since v2.4 was "an
     hour or longer"; the rule from now is every block, whatever its
     length, on every grid that draws one.
2. **Too many: the "not now" states.** The settings rule - a setting has to
   earn its place - applied to states: a state stays only if the owner
   would really tell it apart from the one next to it. A task that is not
   for today can live in five places: Notes (Q), Inbox ("!" from notes, or
   the tab), Backlog (the tab), today with no time (dragged onto the list),
   Set aside (after a replan). Each pair is weighed from the owner's side.
   Inbox against Backlog: if the answer is "Backlog has an order and Inbox
   has none", that is one list with an order, not two. Notes against Inbox:
   Notes already has "!" into the Inbox; if the Inbox goes, "!" goes to
   Later. Today-with-no-time against Backlog: the first is today, the
   second is not - a real difference, and it stays. The recommendation to
   test, not to follow blindly: Inbox and Backlog become one list, "Later",
   with an order (the Backlog's mechanics, the Inbox's cheap way in).
   Migration: Inbox entries at the top of Later, the Backlog after them,
   order kept. Tabs: Task | Later. Ctrl-K, the keys, DAILY.md and the tour
   updated. If the analysis finds the difference real, both stay and
   DECISIONS carries the one sentence that tells them apart from the
   owner's side; if that sentence cannot be written, they merge. Then the
   calendar's Year view: will the owner ever open it? If its only purpose
   is that it was easy to build, it goes with its code; if it shows
   something Month does not, it stays and the reason is written down. And
   Review, read against RESEARCH-ADHD section 8: percentages, "best week",
   any comparison with last week that reads as a verdict - out. Facts
   without a verdict stay.
3. **What is missing: one thing, and it is for the testing week.** "Where
   the plan and the week disagreed" - a reading, not a game. In Review (or
   under Calendar -> Week) after a week: for every template block, on how
   many days it happened at its time, how many times it was moved (and by
   how much on average), how many times it went to Set aside, how many
   times it was skipped. Facts only, in this form: "Deep work 09:00 -
   happened at its time 2 of 5 days, moved later 3 times (avg +1h10)". No
   percentages, no colours, no good or bad, no streak. Sorted with the
   largest disagreement on top. One Copy button - markdown to the
   clipboard. This is the one thing the next brief will come out of after
   the testing week: from the data, not from a feeling. The data already
   exists - push counts, set-aside, done times - nothing new is collected
   and nothing extra is stored. Tests: the computation from a fixture week,
   an empty week shows nothing, the copy format. And nothing else: no other
   feature in this wave. A new idea goes to "Asked for, not yet built".
4. **The docs tell the truth** - RESEARCH-ADHD section 14, all four of the
   owner's decisions accepted. Wherever capture or Notes rests on the
   Zeigarnik effect ("unfinished tasks occupy your mind"), the argument is
   replaced by what holds: writing a plan reduces intrusion - one study, no
   replication - and the maintenance burden. The feature stays, the reason
   changes. The no-new-decisions rule moves off decision fatigue and ego
   depletion (not replicated in 23 labs) onto maintenance burden and the
   planner-abandonment literature (RESEARCH-ADHD section 11). Wherever the
   docs say the proportional-height timeline is "evidence-backed", softened
   to "a reasoned design choice consistent with Barkley's point of
   performance; no direct study". A new DECISIONS entry, "Relatedness is a
   known cost": self-determination theory's three needs, and local-first
   without accounts gives up the third on purpose. A grep over every doc
   for "Zeigarnik", "decision fatigue", "ego depletion" and "evidence
   shows" - each hit fixed or justified.
5. **OPEN-QUESTIONS closed.** Both items - the mini calendar's 33px cells
   and the 29px task title - the owner accepts the recommendation to leave
   as built. They move to DECISIONS as accepted decisions with their
   reasons, and OPEN-QUESTIONS is left empty, with the date.
6. **The final coherence pass: one voice.** Every text in the app - buttons,
   empty states, tooltips, DAILY.md - read in a row as one document. One
   register: short, direct, no exclamations, no "Great!", no emoji. Where
   two things do the same, they carry the same word - not Remove, Delete
   and Clear for three things. Every empty state says one sentence: what
   will appear here and how. Not two. The key table behind `?` matches
   what really fires - every row checked. The tour walked from the first
   step to the last on the desktop after v2.5 to v2.7: every step points
   at something that exists and says something that is true.
7. **Closing.** Typecheck, unit, browser, the sweep on the desktop in both
   themes and on the phone at zero, the README's screenshots, STATE with
   the v2.7 table, CONVENTIONS ("a state has to earn its place"),
   DECISIONS (Later or not, Year or not, the four research corrections,
   the two open questions), the tag `v2.7`, the handoff. The last message
   to the owner: three sentences - what changed, where to find "Where the
   plan and the week disagreed", and that the app is finished from here.

**Decisions taken up front**, after reading the code against the brief,
so nobody re-argues them by accident:

- **Inbox and Backlog become one list, Later.** The test the brief set was
  one sentence, from the owner's side, that tells an Inbox line from a
  Backlog item. The honest sentence is "by which fold it is under": the
  rows look the same, both have the same two ways out (this day, or gone),
  and "decided" was never visible - a line sent on from the Inbox arrived
  in the Backlog with no size and no category while one typed in Backlog
  mode arrived with both, so the only thing the word tracked was which
  button had been pressed. That sentence fails the test, so the lists
  merge. Later keeps the Backlog's mechanics - an order that is the
  array's own, a grip, one press onto the day at the next free slot, no
  age - and the Inbox's cheap way in: Later mode on the field asks for no
  time, and a note that starts with `!` goes there. The storage field and
  the sync kind keep their wire name, `backlog`, so an older device's
  tombstones still match; everything a person reads says Later. On load
  and after every merge the inbox is folded into the top of Later in its
  own order, once, with a tombstone per line.
- **The Year view goes, with its code.** What it showed that Month does
  not is the shape of a year on one screen, which the owner would open at
  most once a year; what it had become was a fullness heatmap in three
  tones, which is the one thing DECISIONS "A year strip with no in-between"
  said the strip must never be, and nobody noticed for five versions
  because nobody opened it - its legend described a ring the stylesheet no
  longer drew, and one of its rules was dead. Nothing routed to it but the
  segment button: no key, no palette entry, no tour step, no screenshot,
  no browser test. That is a view whose purpose was that it was easy to
  build.
- **Review loses its streak, and the month its percentage.** "Streak: 3
  days with a key task done" was the one number in the app that resets to
  zero, and RESEARCH-ADHD section 8's argument reaches it wherever it is
  shown: a missed day does not damage a habit, so a counter that resets
  encodes a falsehood, described or not. The calendar's month line said
  "62% done - 14 active days - longest run 5", the same two figures on a
  second screen; it says how many days had a plan and nothing else.
- **The reading lives in Review, on the week.** Review is the one screen
  that already looks back at a finished Monday-to-Sunday week and already
  has a Copy control; the week view is built to fit its columns without a
  scroll and shows three days on a phone. It sits above North, only for
  the week range, and only when a past day of that week had a template.
- **"Happened at its time" is defined from what exists.** No timestamp of
  a tick is stored and none is added. A block happened at its time when
  its task is done and its time still equals the block's; it moved when
  its task is on the day at another time, done or not; it was set aside
  when the flag says so; otherwise it was not done - unticked at its time,
  or gone from the day. The block's time is the template's current time,
  so an edit to the template after the week changes what the reading
  says, and DECISIONS says so.
- **The arrows are 44px and the date does not move.** A hidden copy of
  "Wednesday, September 30" in the title's own type sizes the title box,
  so the right arrow stands at one x on every day of the year; the row
  cannot wrap because the arrows and the title are one flex item that
  does not. Measured at 1366 with the fullest header the app draws, the
  long name fits with room, so the shortened form the brief allowed was
  not needed and is not built.
- **Every block carries its start and end, and where it goes depends on
  the room.** Under the title where the block has two lines of room, as
  the long blocks always had it; after the title, on the same line, where
  it has one. The floors do not move: an hour or longer keeps its two-line
  floor, a shorter block keeps its one-line floor and carries the times
  beside its title, so a day of eight short blocks is not sixteen pixels
  taller per block and the day still fits 1366x768 without a scroll. On the
  week the same rule has the one clause it always had - a column is too
  narrow for a time beside a title, so the times are there on any block two
  lines tall and hidden by the container query under that, with the hour
  condition gone. The phone's title ellipsises before the time does.
- **The header is one row from 1500px, and two below it.** Measured with
  the fullest header Today draws - a running task, a key count, Replan,
  Low day, the arrows - the two zones need about 1530px. At 1366 the header
  is 1004px wide in the Both view and 1268 alone, so the right zone goes
  down whole there, as v2.6 decided. From 1500, where the masthead spans
  the rail, the zone is given a flex basis of zero so the row never breaks
  on its content width; what gives is the running task's title, which ends
  in an ellipsis. And the single pane grows from 1080 to 1336px, the width
  that with the rail makes the shell's own 1600, because at 1080 the toggle
  stood under the chip in the Calendar and Tasks views on the owner's own
  2000px desktop.
- **The chip's question is asked in the rail, not in a sheet.** One line
  under the chips with Replace and Cancel, in the place the press was
  made; a modal for a one-line question is a second surface for one
  decision. "Already on this day" is the same line without buttons, and
  it leaves on the next press or after a few seconds.
- **The docs never made the three arguments.** A grep of every living doc
  for Zeigarnik, decision fatigue, ego depletion and "evidence shows" found
  the terms only in the research documents, where they are named to be
  refused, and in the push-bound entry, which refuses them. What the brief
  asks for is therefore written down once in DECISIONS as what capture,
  the no-new-decisions rule and the grid rest on instead; and the
  relatedness entry, which already existed, takes the brief's name.
- **One word per gesture.** The armed second press says the verb and a
  question mark - Delete?, Erase?, Replace? - in place of seven wordings.
  Delete is for a thing that is gone, Remove for a part taken off a whole,
  Close for a surface, Dismiss for a notice, Cancel for stepping back.
  Notes is the word on screen for the stream; Scratch stays the module's
  name and the docs' name for the rule.

### The v2.6 wave: the desktop, so that it is a pleasure to use

Briefed by the owner in one message, in Lithuanian, ten stages, to be run
end to end without stopping. The phone is not this wave's concern - the
owner said so - and nothing here may break it, but nothing new is built for
it either. Two principles govern the whole wave and go into CONVENTIONS:

- **Information appears exactly once.** The same number in two places means
  one of them is not needed.
- **Nothing moves on hover.** A pointer resting on something may show
  something, but may not push anything that is already drawn. A layout
  shift under the mouse is a defect, not a style.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 0 | Written down first | `0154d79` | The brief and the decisions it forced, in this file, before any code |
| 1 | Today's header, and the figures said once | `15f9e96`, and `493d9de` for the Calendar row | The capacity sentence is not drawn at the wide breakpoint; "8 gaps" and "not counted" are notes beside the card's rows, and an external calendar's events are a Calendar row that only appears on a day that has them (the browser test that read them off the sentence reads the card now); the card's ring and Done row went, because the header already has the bar and the fraction; the card is Timed, Focus, Free, Sleep. The header is two zones with the row's slack between them, and "6/11 · 1 of 3 key" is one phrase |
| 2, 3, 4, 5, 6, 7, 8 | The line, the tooltips, the sheet, one pane, the footer, Scratch, the journal, the blocks | `7e76791` | The North line at one fixed height with its peek as a bubble under it; `title` gone from the app and `data-tip` drawn by one element under the control (`views/TipLayer.tsx`), six repeating tooltips removed; the Monday card as a sheet with the task sheet's backdrop; the rail and a single pane as one centred block that grows to 1080px; the task column's footer behind a hairline and a card's worth of fade; every scrollbar the app's own thin one at last (Chromium had been ignoring the rounded rules since v2.0); Scratch with one empty state and one control language on a darker backdrop; the journal with no resize grip and two copy buttons at one weight; the blocks flat, a finished block down to two signals, the gap rules at half strength |
| 9 | The health pass | `8151ef1`, `493d9de` | Every screen at 1920x1080 and 1366x768 in both themes by the two rules. Four type sizes on every screen held. The now line's clock chip and the running card's countdown went as doubles of the header; seven hover rules that lifted or grew a control lost their transform; the footer stopped being sticky when the sweep found it over the Backlog fold on the Focus screen; the two critique passes found the closing card repeating the header's sleep note, Review's count carrying its own percentage, and Review's week spelled from the machine's locale. Table below |
| 10 | Closing and `v2.6` | `493d9de` | Full gates, two critique passes on the desktop, the README's screenshots regenerated, CONVENTIONS 23 and 24, DECISIONS "Once and only once" and "Nothing moves on hover", `hoverStillness.test.ts`, the tag |

#### What the health pass found

Every screen at 1920x1080 and 1366x768, both themes, four questions each:
a number or text in two places, anything moving under the pointer, spacing
off the scale, more than four type sizes. Spacing is held by
`scale.test.ts` and was clean; the type count was four on every screen
with the input floor and the glyph exempt.

| Screen | Finding | What changed |
|---|---|---|
| Today | "15:00" four times: the header's clock, the hour label, the now line's chip, a card's time | The chip is gone; the line and its dot stay, and the hour label the line crosses is dropped instead of covered. The card's time and the scale's label are a coincidence, not a repeat |
| Today | "1h left" on the header and on the running card | The card keeps its ring and loses the countdown |
| Today | "17:30 Walk" on Up next, the list and the grid | Kept: Up next is a pointer, and the two panes are the product. Written into CONVENTIONS 23 so it is not removed by accident |
| Today | The now line's chip and the hour label under it | Covered by the row above |
| Every screen | Seven hover rules moving a control: the accent swatch scaled 1.12, the theme card rose 2px, chips, the day arrows, the timer presets, the rollover and every draggable block rose 1px | Transforms removed, colour or shadow kept, transitions no longer name transform; `hoverStillness.test.ts` holds it |
| Today (Focus, 1366x768) | The new sticky footer sat over the Backlog fold - the sweep's one finding on the wave | The footer sits on the column's floor without being sticky |
| Today (22:00) | "Sleep in 1h" in the header and " - sleep in 1h" on the closing card's lead, in the same hour | The card's lead is "That was today"; the header keeps the hour. The card's own sentence - "2 of 9 - the day gave what it gave" - stays beside the header's "2/9": it is the one place the day is said in words, not a second status |
| Today, during a focus session | The focus strip at the top of the app and the header's own line, stacked: "Draft the launch email 45 min left" twice, which the README's hero showed | While the session is on the running task the header keeps the clock alone and the strip carries the task, the countdown and the session's controls; the header says the task again the moment the session ends or is about some other task. `DayView.focus.test.tsx` |
| Review | "2 of 11" with "18%" beside it | The count alone; the percentage was the same number a second time, and the one form the app declines beside a score |
| Review | The week under the arrows read "07 - 09-13" | The range was spelled from the machine's locale, which on this desktop is Lithuanian. The week is named by `formatWeekTitle`, as the week view names it, and the month in the app's own locale like every other date it prints |
| Month, Week, Templates, Library, North, Settings | Nothing repeated but a scale beside a time and the same count on three series items; four sizes each | Nothing changed |

#### The brief, as understood

1. **Today's header and the doubles.** The two lines under the header -
   "Timed tasks: 8h55. Free: 7h05 across 8 gaps." and "Sleep 23:00-07:00
   (8h) is not counted as free." - go: every number in them is in the rail's
   card. What the card does not say - across how many gaps, and that sleep is
   not counted - moves into the card as a small grey note beside the row.
   The card stays four rows - a fifth, Calendar, only on a day with somebody else's events on it, where the sentence used to count them apart; under the header stays empty. The header row
   itself becomes two zones: the day on the left (its name, its chip, Replan,
   Low day), the status on the right (the clock, what is running, how far
   the day has come), one gap between them. "6/11" and "1/3 key" side by
   side with no explanation become one thing.
2. **The North line.** A fixed height that hover, focus and the length of
   the goal cannot change; a long goal on one line with an ellipsis and the
   whole of it in the tooltip; the tooltip never over the text it explains -
   above or below, with an arrow - and that rule for every tooltip in the
   app; the hover itself only a change of colour.
3. **The New week card.** It stood in the flow and pushed the whole day
   down, and after Ok everything jumped back. Either a sheet over the day
   with the same backdrop as every other sheet, or a thin fixed-height strip;
   one of them, chosen and argued in DECISIONS. The demo line and the card
   stacked on each other is the squeeze the owner sees.
4. **Calendar and Tasks alone.** Pressing either left a wide empty band on
   the left with the content drifted right. One pane centres in the whole
   width together with the rail, and at 1920, 1600 and 1366 no empty vertical
   band over 120px is left without a purpose.
5. **The bottom of the task column.** The list was cut through the middle
   of a card with the Push button hanging under it on its own. The list ends
   on a whole card or fades clearly; Push sits on a footer with a hairline
   above it; the list's scrollbar is the app's own thin one, not the
   browser's.
6. **Notes.** Two empty states at once - "Nothing yet" and "Nothing here
   yet" - become one; the field's blue underline, the Note and + controls in
   two styles and a cross with no obvious job become one language, on a
   surface that reads as raised rather than as a hole cut in the page.
7. **The journal.** No native resize handle on the box; a backdrop as dark
   as the other sheets'; the two copy buttons at one weight.
8. **The blocks.** The gradient that fades to the right, checked for the
   unfinished feeling it gives a long block - the recommendation is a solid
   dark wash with the coloured edge it already has; a finished block down
   from three signals to two; the gap labels the quietest thing on screen.
9. **The whole desktop, by the two principles.** Every screen at 1920x1080
   and 1366x768 in both themes: a number or a text in two places, anything
   moving under the pointer, spacing off the scale, more than four type
   sizes. Each fixed on the spot, and a table of screen, finding, change.
10. **Closing.** Unit, browser tests and the sweep at zero; two critique
    passes on the desktop with one question - does this look like a product
    somebody would pay for; the README's screenshots regenerated; the two
    principles in CONVENTIONS; DECISIONS "Nothing moves on hover" and "Once
    and only once"; this file; the tag; the handoff.

**Decisions taken on the way**, so nobody re-argues them by accident:

- **The rail's card is the only place the day's figures are said, and the
  header is the only place its progress is.** The capacity sentence is not
  drawn at the wide breakpoint at all; the phone keeps it, because the phone
  has no rail. The card's ring and its Done row went with the sentence: the
  header's bar and fraction already say how far the day has come, and a
  ring saying it again a hand's width away was the same number three times
  on one screen. The card's four rows are Timed, Focus, Free and Sleep;
  Free carries "8 gaps" and, when the untimed tasks do not fit, how far
  over; Sleep carries "not counted".
- **The North card is a sheet.** The owner offered the choice and named the
  sheet first. It is a moment - a Monday, or the morning after a day that
  got away - shown once, read once, dismissed with one press; that is what
  every other sheet in this app is for, and a card in the flow was the one
  notice that took a fifth of a 768px screen away from the day. The evening
  close stays in the flow: it arrives at a set time while somebody may be
  typing, and a modal that lands mid-sentence is worse than a card that
  pushes. Yesterday's banner is already the thin strip.
- **One pane fills the width it is given.** The single-pane layout stops
  centring a 1024px pair in a 1568px row: the rail and the pane are one
  centred block that grows to the width available, capped so that a block
  or a card is never absurdly wide, and the header, the notices and the
  caption span the same block. The v2.4 worry about a thousand-pixel block
  was about the two-pane layout, where the tasks were paying for it; alone
  on a screen, a timeline is allowed the width a calendar takes.
- **A tooltip is an attribute, and it sits under the thing.** Native
  `title` tooltips land wherever the browser puts them, which is on the
  text as often as not, so they go: `data-tip` draws the same words under
  the control with an arrow, 400ms after the pointer rests, on focus at
  once, and never over what it explains. One that only repeated the visible
  text is removed rather than converted.



Three briefs in one sitting, in Lithuanian, run end to end without
stopping. Twelve stages, six commits.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 1 | Notes are notes | `29a3c03` | The scratch tags and the `#bug` markdown export come out - code, tests, docs and the sample. A note is shown exactly as it was written, and a `#` somebody typed stays plain text. DECISIONS "Notes are notes" |
| 2 | Pictures in a note | `e064b02` | Paste, drag or the `+`, shrunk to 1600px and JPEG 0.8 on the way in, twenty per note, in IndexedDB and never in the sync payload or the backup. A full-screen viewer, Escape closes, deleting the note deletes its pictures. The other device says the picture stayed where it was taken |
| 3 | Notes at the clock | `0430786` | A fourth thing beside the timer, the focus tool and the stopwatch: one line, enter, and it is gone. The last three to recognise, and a way to the whole stream. `Q` from anywhere; fits 390x844 with nothing scrolled |
| 4, 6, 7 | A note becomes a task, and nothing leaves the day | `bfa529b` | **To task** opens the task's editor with the title filled in and the note kept, each linking to the other. What an interruption takes off the day waits on a quiet **Set aside** strip; one press offers the nearest free gap, a block that no longer fits comes back shorter and says so, and under a quarter hour or under half its length it offers tomorrow instead. The whole push-and-replan logic written down as eleven numbered rules, each with a test and a sentence in CONVENTIONS |
| 5 | The library's add row | `4a63ffe` | One amount, one button, and a stepper that is one box instead of two - the base input rule's five `:not()`s had outranked `.time-stepper .time-input` since v1.0, so every stepper in the app had been a box inside a box |
| 9 | The tour | `df99d14` | The card never covers what it points at - the scroll knows about the card, and the placement is checked again after it lands - and a step that changed the screen waits for Next instead of running on |
| 10 | A template is judged as a day | `c19d20a` | The template editor draws the day it makes, live: the same hour scale as Today, sleep first from the chosen profile, blocks as they are typed, overlaps with a warning edge, gap labels, one line of numbers. A week is seven narrow columns each with its own sleep; a phone is one day at a time |
| 11, 12 | A journal instead of a form, and a settings health check | `2f58d3b` | v2.3's three questions and the best moment beside them are gone, folded into one free text box per day, saving as you type, counting nothing - at the clock beside Notes then, on a button of its own since the follow-up below. Then every setting walked against one rule - the owner would change it **and** the app cannot decide itself - which four failed: two nudges that could only fire while the app was already open, a second switch for the Monday goal card, and a widget list nothing could ever change. DECISIONS "A journal, not a form" and "A setting has to earn its place" |
| 8 | Closing and `v2.5` | `57db593` | Full gates, two critique passes on the phone, and the three blindnesses in the measuring pass that those passes exposed: it could not see a fade, could not see what a field says, and ran at whatever hour it was run. 858 findings out of a report that had said zero for a week of commits, and nine hand-tuned opacities down to one `--faded` token. The docs read against the code, the README's screenshots regenerated, and the tag |

### After the tag

Two waves, both from the owner looking at the app rather than at the tests.
The tag stays on `57db593`: none of this is a stage of v2.5, and none of it
is big enough to be a version of its own.

| # | What | Commit | What it became |
|---|---|---|---|
| 1 | The briefs read back against the code | `f2c29ea` | Three gaps. The day copy the brief asked for and DECISIONS described as though it existed - the week and the month had buttons, the day had none. The journal's month washing every cell in its template colour, so the dots it exists to show were the quietest thing on it. And the shape the owner had reported twice by hand - a chosen control drawn exactly like the ones beside it - which nothing measured, because `aria-pressed` is a string a test can assert while nothing at all is drawn. The sweep compares a set control against an unset sibling on six properties now, and its self-check plants the owner's own bug. `JournalView` also had no unit test at all: nine now |
| 2 | Four things the owner saw | `2e62a4a` | Dragging a block was a guess - it dims and nothing else moves - so a drag says where it will land while it is still held, in the gutter, by the same arithmetic the release uses. The arrows either side of the date came off the wide header, where the month in the rail does the job better; they stay on a phone. Notes and Journal left the clock panel for buttons of their own, and the rail gave up its pen. And a single pane centres itself instead of stretching: Calendar had been growing the timeline 200px and then leaving 351px of nothing beside it |

### The v2.4 wave: the polish wave

Briefed by the owner in one message, in Lithuanian, four stages, to be run
end to end without stopping. The sentence it is built on is the owner's:
text that looks even slightly off - a gap too wide, a gap too narrow - is a
defect, not taste. The goal is an app that looks professional and is a
pleasure to use, on the screen it is used on most: a desktop at 2000x965
with the rail down the left.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 0 | Written down first | `95d65a9` | The brief and the decisions it forced, in this file, before any code |
| 1 | The rail opens on intent only | `622a883` | The cause: React's `onFocus` is `focusin`, and a browser re-fires focus on the item last pressed whenever another window gives this one back. Three ways in now - a mouse that comes in and moves and is still there 150ms later, a Tab, the pin - and the window changing hands is none of them. Six tests in `NavRail.test.tsx`, checked in the pane at 1920x1080 against the real event stream; DECISIONS "The rail opens on intent only" |
| 2 | The pixel audit | `536061b`, `57b36be`, `dc27a75`, `5b2bce8`, `afb1275`, `c2e7c04` | Six screens from the owner's screenshots, each measured before and after, one commit per screen: Today (the header as three groups, a masthead from 1500px, gap labels as dividers kept clear of the now line, every block its floor and a two-line floor for an hour or longer, the digest as one card, the day column at 760px); the task sheet (the cross in the corner, a footer with Delete and Done, the size said once); the month (a wash and a strip instead of a pastel, one rule for every day, everything left); the week grid (a 15px floor, a past day offering nothing at rest); the template editors and the library (WHAT and WHERE, "Week default", coloured swatches, a length held, rows of one height, a disabled button that reads as one). Then both scales written into CONVENTIONS section 5 with `scale.test.ts` holding the stylesheet to them, 71 on-scale literals made tokens and 30 off-scale ones moved, and the sweep at zero on the desktop and the phone |
| 3 | Low day, and a timer on a step | `b21f346`, `7c5d90a` | One press beside Replan: the key tasks at 40% of their length on the five-minute grid and never under fifteen minutes, the routine where it was, the rest to tomorrow as a proposal with Accept and one undo, a quiet mark under the date, and the score on the key tasks alone. A step's trailing length ("Meditation 10 min") starts the one timer for that step, and the bell ticks the step. `lowDay.test.ts` and `FloatingClock.test.tsx` new, `e2e/lowday.e2e.ts` new, ten test files touched; DAILY "When you do not feel like it" and "A ritual as one block"; DECISIONS "A low day is the 40% doctrine as one press" and "A step can carry a timer". Mid-stage, from the owner's screenshot: the chosen swatch's ring, cut by the task column's scroller and drawn in the card colour on the page - the inset back, `--ground` for the gap, and two new shapes in the sweep's audit with two more screens on its list |
| 4 | The critique and `v2.4` | `a11c048`, `f544c55` | Every screen at 1920x1080 and 1366x768 in both themes, by the same standard. The fifth type size nobody declared: the browser's own 16px, which every unsized button fell to, plus a template card's name, a step's title and a pace line - the body says `--t-sm` now and a button inherits, the arrows read at the glyph size, and every screen is four sizes with the input floor and the glyph exempt. Five strings under AA that the audit could not see, because Chrome hands a `color-mix()` back as `color(srgb ...)` and the parser read it as nothing. `--touch` for the 44px in a hundred and twenty five places. `scale.test.ts` reads whole lines, which found twenty literals inside one-line rules. Three screens added to the sweep. Both sweeps at zero, desktop and phone; DECISIONS "The pixel standard" |

#### The brief, as understood

**Stage 0 - where it stands.** The tree clean, everything pushed, `v2.3`
tagged. Checked before anything else: it was.

**Stage 1 - the rail opens by itself.** The owner sees it every day: the
rail unfolds into the sidebar with the names on it when Discord is opened
or closed on another screen, or when the window is returned to. Find the
cause among window focus and blur, `:focus-visible` after a focus is
restored, an enter with no real movement, and the Keep open state. The
rule: the rail opens only from real intent - a pointer that comes in and
moves in it for at least 150ms, a press, or Keep open. Never from the
window's focus or blur, never from a keyboard focus being restored, never
under a pointer that is standing still. A test that simulates blur then
focus with the pointer over the rail's edge and without it, and the rail
stays closed. DECISIONS gets "The rail opens on intent only".

**Stage 2 - the pixel audit, screen by screen.** Every place below is from
the owner's screenshots at 2000x965. For each: fix it, a screenshot before
and after, then the whole screen walked by one rule - equal gaps, one
typography (at most four sizes on a screen), everything on the grid,
nothing clipped, nothing overlapping.

- *Today.* The header row - two big arrows, Replan as bare text, a void,
  the clock, the 0/9 bar, another void, Both / Calendar / Tasks - becomes
  one hierarchy: the navigation as one group on the left, the status (the
  clock and the progress) beside it, the view toggle on the right, equal
  gaps, Replan a real button in the arrows' row. The now line never
  crosses a gap's label: the label moves or hides when the line is within
  12px. A gap's label never reads as part of the block above it - its own
  register and clear air from the block. A block shorter than its label
  needs (Standup, 15 min) gets a floor for the label or the label beside
  it, never clipped and never outside the block. The times show on long
  blocks and not on short ones by no rule anybody wrote: one rule, in
  CONVENTIONS, applied on Today and the week alike. The stats ring on the
  left is empty and apart from the four numbers - one card, the number
  inside the ring, four aligned rows. The quick-add row has one height for
  all three controls and the category dots start at the field's left edge;
  "9 routine tasks stay" gets air from the edge and the helper grey. "Sleep
  23:00-07:00 - 8h, not free time" becomes "Sleep 23:00-07:00 (8h) is not
  counted as free." A content max-width, so a 2000px screen does not
  stretch a block to 1000px of 14px text.
- *The task sheet.* A thin custom scrollbar, or no scroll at 965px with
  TIME and SIZE on one row when wide. SIZE says "30" in the stepper and
  "30 min" beside it: one of them goes. The close cross in the sheet's
  corner rather than in the title field, and the title field full width.
  Save and Delete visible without scrolling. A darker backdrop, so the
  sheet reads as the foreground.
- *The month.* A stamped day's light blue on dark text reads as a piece of
  light mode in the dark theme: a 12-18% wash of the template colour with
  a coloured strip along the top, the text staying light, both themes
  measured. Past days show 0/9 and future days a list, by no rule: one
  rule for every day, the first three lines and "+N", a score only on a
  day that is over. "+6" centred under left-aligned lines - everything
  left. The dot in the top right corner explained or removed.
- *The week grid.* A short block's label by Today's rule. A past month's
  column (Mon 31) without its day-type pill and with a "+": the same
  height and width as the rest, the "+" on hover only. The foot "0/9 4h30"
  aligned with its column, the same gap.
- *The week template editor.* "Same as the wee" clipped: never a clipped
  word anywhere in the app, every long-worded control checked. The selected
  Sunday's frame the size of the other columns. The length field showing
  "min" with no number. Category dots all dark - one chosen, the rest
  visible. The row "dots | Nothing | Ongoing | Add to [Sunday] Weekdays
  Weekend All days" with Add block alone far to the right - two rows with
  a heading each (what, where), Add block with its group. An empty column's
  "-" becomes a faint "No blocks yet", or nothing.
- *The library.* Add reads as disabled while the other buttons are white:
  a real disabled style while the field is empty, or white. The add row's
  stepper taller than its field - one height.
- *Everywhere.* Every screen at 1920x1080, 1600x900, 1366x768 and 390x844
  in both themes by the same rule. A type scale and a spacing scale written
  into CONVENTIONS, every ad hoc value moved onto them. `npm run sweep` at
  zero on the desktop and on the phone.

**Stage 3 - two small features from the owner's notes.**

- *Low day*, the 40% doctrine as a button beside Replan. One press: the
  key tasks stay at 40% of their length (15 minutes at least), the one-offs
  that are neither key nor routine go to tomorrow as a proposal with
  Accept, routine stays. Undo as Replan has. The day carries a quiet "low
  day", and its score counts only the key tasks. Tests, and a DAILY.md
  paragraph, "When you do not feel like it".
- *A timer on a step.* A task's steps can carry a length ("Meditation - 10
  min"); a tap on such a step starts the existing timer widget for that
  long, and when it ends the step is ticked and the chime is quiet. So the
  07:30 ritual - water, meditation 10, gratitude, a Pressfield page - is
  one block with steps and a timer. Tests, and a DAILY.md sentence.

**Stage 4 - closing.** Unit, browser tests and both sweeps; two critique
passes on the desktop (1920 and 1366) and one on the phone to the same
pixel standard, every finding fixed rather than written down; the README's
screenshots regenerated; this table; DECISIONS "The pixel standard"; the
tag; then the handoff.

**Decisions taken on the way**, so nobody re-argues them by accident:

- The rail has three ways in - a mouse that comes in and moves, and is
  still there 150ms later; a Tab that brings the focus in; the pin - and
  the window changing hands is none of them. The focus path stays for a
  Tab and only a Tab: Escape handing focus back to the pen, or the window
  returning it to the item last pressed, is not somebody reaching for the
  rail. An opening needs an arrival: a press, a leave or the window losing
  focus ends the visit, and a mouse still in the rail after any of those
  does not reopen it by staying.

### The v2.3 wave: the journal

Briefed by the owner in one message, one stage. A journal that lives on
the day and never counts. One line in the morning under the North line -
"Today: ..." - and two questions on the evening close card, both optional:
"What was real today?" and "What do I want to tell myself tomorrow?".
Plain text, no limits, no streak; a skipped day costs nothing and shows
nothing. The week shows each day's lines under the day and has a button
that copies the week as markdown - the date, the morning line, the two
answers - to paste into another chat; Review has the same for the month.
The lines ride on the day entity, so sync, backup and snapshots carry them
with no migration: three optional fields.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 0 | Written down first | `8166dbb` | The brief and the decisions it forced, in this file, before any code |
| 1 | The journal | `2bca9f9` | `DayPlan.journal` with three optional fields and `mergeJournal` dropping blanks; `setJournal`; the morning line under the North line (`JournalLine.tsx`) saving on blur, Enter and leaving the day; the two questions on the evening card saving on blur and on Close; the agenda's lines under a day and the grid's morning line on a desktop; Copy week journal under the week and Copy week / month journal in Review, through one `CopyJournalButton`; the markdown in `lib/journal.ts`; the tests and the two browser tests |
| - | Found on the way: the explanation's hold timer | `cbc40b1` | The Focus term's sentence painted over the running card at three in the afternoon: a tap re-renders the card under the finger, the release goes elsewhere, and the half-second hold fired anyway. The click that follows a tap cancels the hold now, and so does unmounting. Since v2.0; every earlier phone sweep had run at night with nothing running |
| 2 | Closing and `v2.3` | `dcec338` | Every gate run, the phone walked, DAILY.md's "The evening questions", the docs read against the code, DECISIONS carrying the reasoning, the tag |

#### What the phone pass found

One deliberate pass at 390x844 on the sample day with the closing card
forced open, then the desktop at 1366x768.

| Found | What changed |
|---|---|
| The card's blur handler read the answers from the render's own state, so a blur landing in the same task as the last keystroke saved the line as it was one character ago - the walk's synthetic typing produced it, and a fast tap away from the field can too | The answers are mirrored in a ref, which is what the morning line already did for its draft |
| The morning line was meant to be boxless until touched, and the base input rule - a selector with five `:not()`s - outranked the class; on a desktop it drew as an ordinary field anyway | The rule now says what it does: a boxed field beside a label in the North line's register. A place to type should look like one |
| The phone browser test measured the card from where the starter's own button had scrolled the page to, and found the fields 259px above the top | The walk starts from the top of the page, as a person opening the app is |

**Decisions taken on the way**, so nobody re-argues them by accident:

- The three lines are one optional object on `DayPlan`, `journal`, with
  three optional fields, and a field is absent when it is blank: the store
  trims and drops, so an empty journal takes no bytes and a day nobody
  wrote on changes no sync entity.
- The morning line saves on blur, on Enter and on leaving the day, not on
  every keystroke: a controlled field bound to a trimming store eats the
  space being typed.
- The evening questions do not replace "Best moment today?", which has its
  own switch and its own place in the month, and they have no switch of
  their own: the owner asked for them, and a plain empty field is not a
  nudge.
- The copy button sits under the week, not in the bar: the bar on a phone
  is three rows already, and a fourth was fought off in v2.2. The grid
  shows the morning line under a day's name on a desktop only; the agenda
  shows all three lines in full on every screen.
- The markdown lists only the days with something written, so a pasted
  week is the week's words and nothing about the days that had none.

### The v2.2 wave: Replan v2

Briefed by the owner in one message, in Lithuanian, and built in one
sitting. The brief as understood is the numbered list under the table, kept
because every commit refers to it.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 0 | Written down first | `00de297` | The brief and the decisions it forced, in this file, before any code |
| 1 | The arithmetic | `22db34f` | `ensuredDay` as the pure half of `ensureDay`, and `applyReplan` running it first so a plan for Thursday lands on the Thursday that will exist; `planInterrupt` given a start-from and the day's own words; "Skipped" for a routine block and "Dropped" for a one-off; the free-windows line; the shapes, the WHEN row and the day words in `interrupt.ts`; the two-language line in `interruptParse.ts`; the last three names in `replanPrefs.ts`; `DayPlan.replannedOn` |
| 2 | The sheet, from six doors | `acd6c48` | The sheet at the root, reading the store given a day; two rows of chips, the words, the plan proposed, Accept; the header on any later day, the week's bar, the day preview's third action, the palette and R; the mark on the week's column and agenda; two phone passes and what they found (below); two browser tests, the phone one measuring three presses with nothing scrolled |
| 3 | Closing and `v2.2` | `a7cc157` | Full regression - unit, browser, both sweeps - DAILY.md's "When the phone rings", every doc read against the code, DECISIONS carrying the reasoning, and the tag |

#### What the two phone passes found

Two deliberate passes at 390x844 in both themes on the sample day, with the
phone ringing as the scenario - the sheet open in one hand, ten seconds.
Each finding has a place; the first three were written and caught the same
evening, which is the argument for walking before believing anything.

| Found | What changed |
|---|---|
| The undo toast carried the free line and wrapped into a column seven lines tall - a pill cannot hold a five-window sentence | The line stays in the sheet, where it is read with the phone at the ear; the toast is two words again and its wrap rule was reverted |
| The week's bar on a phone gained a fourth row for the new door, 55px off a grid whose whole job is to be a picture | Ordered after the Month / Week / Year segment below the wide breakpoint, it shares the Grid / Agenda row; the bar is back to three rows |
| A typed range of three hours lit none of the six length chips, and the row read as no length chosen | The length the line gave shows as a lit chip when none of the six say it |
| With room on both sides, what the afternoon lost went into the morning because the morning came first - lunch at eight, arithmetic nobody believes | The gaps after the interruption are tried first, and the ones a start-from opened up before it only when those are full |
| The sheet was going to preview a future day through the pure half of `ensureDay` without writing; a preview stamps its own copy with its own task ids, and the first store test found the routine blocks it had skipped still at their times | Choosing a day opens it through `actions.ensureDay`, exactly as looking at it would |

#### The brief, as understood

The scenario: the week is stamped from templates, and the phone rings -
"tomorrow at ten I need a hand", or "Thursday afternoon". The person is on
the phone, one hand on the device. From the call to a replanned day: ten
seconds, three presses, no scrolling through the week. Nine points, all
built:

1. **One way in from anywhere.** The Today header (there already), any
   later day's header, the week view, the calendar's day preview, `Ctrl-K`
   and the `R` key. One sheet opens, and its first row is WHEN: today,
   tomorrow, the five days after that with their dates, and Pick a day.
   Today is the default, and the day changes without leaving the sheet.
2. **Presets for the shape of it**, because a call rarely names a length:
   Morning gone (wake to 13:00), Afternoon gone (13:00 to 18:00), Evening
   gone (18:00 to sleep), Whole day gone, Custom (a time and a length), and
   Don't know how long (open-ended from a time). The name is optional -
   "Something came up" stands in - and the last three names used are chips.
3. **A typed line in Lithuanian or English**, beside the chips rather than
   instead of them: "tomorrow 10-13 dad", "thu afternoon", "ryt 10 val
   tetis", "pn ryte". Day, time and name come out of it and the chips
   redraw live, the way quick-add already does. A small table of tokens,
   not a language library; the short forms pr, an, tr, kt, pn, st, sk and
   ryt, poryt are in it.
4. **The plan is proposed, not asked for.** Choosing when shows that day
   before and after at once: what the interruption lands on and where each
   goes - that day's free gaps first, then the next day; a routine block
   (`isRoutine`: a template's or a repeat's) is skipped for the day rather
   than moved, because the template makes it again; key tasks are placed
   first. One Accept applies it. Tapping a row overrides that one - move,
   the next day, skip, keep - and nobody has to. The arithmetic is v1's
   `planInterrupt`, given a start-from and a way of naming the day, not a
   second copy.
5. **A day that does not exist yet is made.** An interruption landing on
   Thursday from Tuesday materialises Thursday first - its weekday template,
   its repeats - and applies the plan on top, in one commit, so opening
   Thursday later shows the day as accepted. `ensuredDay` in
   `lib/ensureDay.ts` is the pure half of `actions.ensureDay`, and
   choosing a day in the sheet opens it through the action, exactly as
   looking at it would - a pure preview was tried and stamps its own copy
   with its own task ids. Stamp week leaves the day alone afterwards, as it
   already leaves every day that has a template.
6. **The answer for the person on the phone.** One line under the plan,
   before Accept, read with the phone still at the ear: "Free tomorrow:
   15:30-17:00, after 19:30" - so "I can after half three" can be said
   into the phone without opening the day. It was going to ride in the undo
   toast too; a five-window line wrapped the toast into a column seven
   lines tall on a phone, and the toast went back to two words.
7. **One undo** for the whole thing, sync as for everything, and the week
   view marks the day with a quiet "replanned" (`DayPlan.replannedOn`).
8. **Tests** for each of those, and a browser test on a 390x844 phone:
   from the door to Accept in three presses, nothing scrolled.
9. **Two critique passes on the phone** with the stress scenario - the
   phone ringing, the sheet open in one hand, ten seconds - then DAILY.md
   gains "When the phone rings", and the tag is `v2.2`.

**Decisions taken on the way**, so nobody re-argues them by accident:

- The sheet moves to the app root and reads the store itself, given a day.
  It lived inside the day view because it was about today; it is about any
  day now, and the week view and the calendar open it without leaving.
- The WHEN row is seven days from today rather than Monday to Sunday of
  this week: a chip for a day that has passed is a chip nobody can use,
  and "Thursday" said on a Sunday means the one coming.
- A typed weekday means the next one, never today - the rule the palette's
  date parsing already keeps.
- Tapping a chip takes its word out of the line rather than rewriting the
  line in one of two languages: the line and the chips stay one truth,
  which is CONVENTIONS section 16's rule for quick-add.
- A routine block is skipped, not moved, and the summary says "Skipped";
  a one-off the person chose to drop still reads "Dropped". They are two
  different facts, and one word for both would hide that.
- The last three names are a device habit under their own key, outside the
  backup and outside sync, the same way quick-add remembers a length.
- There is no floating menu on the phone to put it in: the bar along the
  bottom is the six views, Scratch and Settings, and an eighth icon at
  390px is 48px each. On a phone the ways in are the day header on today
  and any later day, the month (a tap opens the day, whose header has the
  door), and the palette.

### Both waves closed

Two waves were briefed by the owner in one sitting. Both are done, committed
and pushed. Nothing below this table is owed.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 1 | Categories the owner owns | `adee903` | A list in `AppData` rather than a literal in a module, an editor in Settings, twelve curated colours with a readability gate, and a delete that moves what it would orphan |
| 2 | North window: goals and if-then in one place | `e33dd08` | North is the sixth view. Every rule lives under the goal it protects; `widgets/if-then/` is gone, and so are the three fields the day view's old surfacing needed |
| 3 | The explanation layer | `40722cd` | Twenty terms audited, all the copy in `lib/explain.ts`, one component in `views/Explain.tsx`, and a test whose data is the list itself |
| 4 | Library lanes: MIND, CRAFT, LIGHT | `878d4fb` | One queue of twenty became three that advance on their own. Still only from the palette, never on first open |
| 5 | Clean checkup | `d38990d`, `b71bbfb`, `3da5336`, `879b90d` | Sixteen places. Seven text tabs became a left icon rail; the (i) markers came back out a commit later at the owner's word; month cells say what is on a day; a day preview on hover; the week gained an agenda reading and a Someday strip; the template editor stopped opening with eight colour balls |
| 6 | Closing: desktop QA, DAILY.md, regression, tag | `890e0ad` | Desktop QA at two sizes in both themes on a realistic day, every `data-tour` target re-checked, DAILY.md, every doc read against the code, and the tag moved |
| - | **Week templates** (its own wave) | `a786b0b`, `8f7bb51` | One entity with a `kind`; `columnFor()` is the whole difference. Seven columns, Add to / Copy to / drag, a per-column day type and sleep, the week's shape on its card, a start-from-a-day expansion, four more explained terms, and DAILY.md on building one |

#### The tags, which are the thing most likely to confuse

| Tag | Commit | What it covers |
|---|---|---|
| `v2.0-desktop` | `46154c6` | Where `v2.0` stood before this wave: the desktop closed as a product |
| `v2.0` | `890e0ad` | Both halves. The tag was **moved forward** to the closing commit, as the plan written at the time said it would be |
| `v2.1` | `1384518` | North v2, the phone wave and the bug hunt, on top of the week-templates wave. Two commits sit above it, untagged: the zone-name table and this handoff |
| `v2.2` | `a7cc157` | Replan v2, on top of everything above: the plan, the arithmetic, the sheet, and the closing |
| `v2.3` | `dcec338` | The journal, on top of v2.2. One commit sits above it, untagged: the handoff of the time |
| `v2.4` | `f544c55` | The polish wave, on top of v2.3. Two commits sit above it before the next tag |
| `v2.5` | `57db593` | Notes, pictures, set-aside, the library's add row, the tour, the template timeline, the journal, the settings health check, and the closing. On top of v2.4. Three commits sit above it, untagged: the handoff, and the two waves of follow-up in the table under this one |
| `v2.6` | `493d9de` | The desktop wave, on top of everything above: the brief, the header, the seven stages in one commit, the health pass, and the closing |
| `v2.10` | `8a18e25` | The bug hunt: nothing added, two focus defects fixed, one hole closed in the suite, and the README made true again |
| `v2.12` | `d982446` | The night before a real week: seven day switches, a block that carries KEY, a category made where it is needed, a privacy guard, the rehearsal, the soak, and one page for 07:00 |
| `v2.11` | `978f661` | A template block carries a note and a list of steps onto every day it stamps, and the card's note mark became a press |
| `v2.9` | `595975b` | Four things met in use and one document: both day arrows inside the month, the day type as one line, the colours out of the time column and the candidate onto the timeline, one link on an item and a task, and an audit written for somebody who has not seen the app |
| `v2.8` | `1282b3d` | The calendar wave, the first the done contract produced: the day card, clearing a day, a week template that never reaches back, the writing marks, the arrows, the focus screen, and choosing a time against the day |
| `v2.7` | `b735de6` | The last wave: the header's three small things and the times on every block, Later where two shelves were, the Year view and Review's streak gone, where the plan and the week disagreed, the docs told the truth, the open questions closed, one voice over every string, and the closing. The app is done at this tag |

The move is why `v2.0-desktop` exists: nothing was published between the two
halves, so one version number is honest, but the earlier commit is worth
being able to name. The week-templates wave sits between `v2.0` and `v2.1`,
ending at `8f7bb51`, and is part of the later tag.

#### The bugs this wave found, all of them already shipped

Written down here because CONVENTIONS section 2 asks for it and because every
one of them had been in the app for versions:

| Found | Where it had been |
|---|---|
| The demo's own if-then rules carried "If" and "then" inside their strings while every place that drew one added its own "If", so the sample read "If If I open the laptop" | Since the demo was written |
| Eight tests queried the Inbox and Backlog folds with a loose `/Backlog/`, which any new control containing the word would have matched | Since those folds were built |
| The (i) marker reused the North line's four-version-old bug: a tap fires a focus and then a click, so a focus that opened the bubble meant every tap popped a sentence over the screen | Written and caught in the same wave |
| A 28px per-block library select in the template editor, under the 44px a finger needs | Since v1.9. The phone pass had no screen that opened a template editor until this wave added one |
| The sweep left its pointer resting on the rail after clicking a tab, so every screen was measured with a flyout open - nine false findings and then a 30-second hang | Written and caught in the same wave |
| A flat `min-height: 38px` on two rebuilt rows pulled four controls back under 44px on a finger | Written and caught the same afternoon, twice |

The last three are the measuring pass doing its job on code written hours
earlier, which is the argument for running it before believing anything.

### The v2.1 wave

Briefed by the owner in one sitting: North v2, then the phone, then a bug
hunt, then the tag.

| # | Stage | Commit | What it became |
|---|---|---|---|
| 1 | North v2, "The Picture" | `8b30713` | Four layers read as one page - the picture, the goals, what I do to deserve each, what pulls me off it - written in the window itself: one line of the picture to start, then everything behind one quiet Compose that saves in one commit. Settings lost its North and Rules sections; the two card switches moved to Nudges. The picture is one entity at `picture:north`, `deserve` rides on the goal, the Monday card carries one deserve line for the week, and the tour walks into North instead of Settings. The reasoning is in DECISIONS, "North is built once and left in peace" |
| 2 | The phone wave | `7b43311`, with stage 3 | `npm run sweep -- --phone` at zero: the stacked quarter-hour arrows are a side-by-side 44px pair on a coarse pointer (every stepper, not only quick-add) and the focus bar's exit carries the overlay. Then the walk itself, every screen at 390x844 in both themes with a full day - section 5 is ticked with what each item found. Nine more phone fixes came out of it, from a 43px day arrow to an agenda whose rows were 30px |
| 3 | The bug hunt | `7b43311`, with stage 2 | A day lived in the app from a stamped morning to the evening close, at 1920x1080, 1366x768 and on a phone, with console noise, overflow, focus and text clipping logged after every step. Eighteen findings with a place and a viewport each; the two that had shipped longest were the quick-add panels painting behind the task list since v2.0 and ten sheets dropping focus on close since they were built. See DECISIONS, "The phone is walked, not only measured" |
| 4 | Closing and `v2.1` | `1384518` | Full regression - unit, browser, both sweeps - the README screenshots regenerated, every doc read against the code, the tour walked with the North step rewritten, and the tag |
| - | **After the tag: Outlook's zone names** | `606aaeb`, `2b0d787` | The one debt that could move without the owner. `WINDOWS_ZONES` in `ics.ts`, consulted after `Intl` says no, and a quoted TZID unwrapped - which had failed the same way for a different reason. In the resolved-debts list below |

### The six briefs, kept as history

What follows is the owner's own words as this session received them, kept
because every commit above refers to them. **They are not work to do.** What
each one actually became is in its own commit message and, where it changed a
rule, in DECISIONS.md.

#### Stage 2 - North becomes a window, and if-then moves into it

The reported problem: **if-then is useless as it stands.** It is a list in
Settings that nobody ever sees, surfaced by day type and time of day into a
day view where it reads as noise. The fix is not to surface it harder; it is
to put every rule under the goal it protects.

- **North becomes its own view.** In the nav, reachable from the North line on
  Today, and in the command palette. `views/north/` beside `views/week/`.
- **Each goal is a calm card**: what / why / who it makes you, exactly the
  three fields `Goal` already carries, with no progress, no checkbox and no
  count of anything. ARCHITECTURE section 6 is the constraint and none of it
  moves. The rotation stays.
- **Under each card, "What pulls me off this"** - the if-then lines belonging
  to *that goal*. Written in the second person the owner writes in: "If I
  catch myself scrolling at 23:00 -> phone in the kitchen, book in hand."
- **Limits: four goals** (already `MAX_ACTIVE_GOALS`), **five rules per goal.**
- **A rule is never measured and never nudges.** It appears in exactly two
  places: the North window, and the slack-trigger card - where, under the
  why, *one* rule from that goal appears as "here is what you wrote yourself".
  The day-type and time-of-day surfacing of the old if-then board goes.
- **Data**: `IfThenEntry` gains an optional `goalId`. Optional because every
  rule on disk predates it - see the migration below - and because a rule can
  legitimately sit unassigned for a while.
- **Migration**: existing rules land in North as "unassigned", with an offer to
  put each under a goal. Nothing is deleted and nothing is guessed at.
  Settings -> Rules goes, replaced by a line pointing at North.
- **DECISIONS gets the sentence this is all for**: a rule with no goal is
  noise; under a goal it is armour.
- **The tour's North step is updated** - CONVENTIONS section 13 makes a stale
  tour a P0, and this moves the thing that step points at.
- Tests: the goal-rule link, the migration of unassigned rules, the slack
  card showing exactly one rule from the right goal, and both limits refusing
  rather than evicting.

#### Stage 3 - the explanation layer

The reported problem, in the owner's words: *"arriving for the first time I
would not even know what Ongoing means."*

- **Audit every unexplained term and control first, and put the list in the
  report.** The ones already named: Ongoing, Day type and each of its four
  values, Key task, Push, Backlog against Inbox, Stamp, Focus, the three
  Replan doors, Library units, North, sleep schedule, and sync against backup.
- **One tooltip component**, built from the tokens like everything else: 400ms
  delay, one or two sentences, and on a phone an `(i)` or a long-press, since
  a finger has no hover. **All the text in one file**, so the copy can be read
  as copy.
- **Day type**: choosing one puts a line under it saying what that choice
  actually changes. **Ongoing**: the explanation sits beside the button.
- A DOM test that every term on the audit list has a tooltip - the list is the
  test's own data, so adding a term to the list without writing its copy
  fails.

#### Stage 4 - three reading lanes from the palette

`Ctrl-K` -> "Load my reading plan" fills **three** lists instead of one, and
is idempotent - running it twice changes nothing. All three are counted in
chapters. A blank count means the book has no useful chapter count and the
note carries the intent instead.

- **MIND**: The War of Art (pages, blank, "one section a day - finish Book
  Two, skim Book Three"), The Courage to Be Disliked (5), Daring Greatly (7),
  Attached (12), The Status Game (blank), How to Fail at Almost Everything and
  Still Win Big (38), Sapiens (20), Models (13), Atomic Habits (20), Four
  Thousand Weeks (14).
- **CRAFT**: Turning Pro (pages, blank, "short - about a week"), The Missing
  README (blank, "before day one at the job"), The Pragmatic Programmer
  (blank, "dip-in, 100 tips"), Never Split the Difference (10), Deep Work
  (blank, "when the YouTube era opens").
- **LIGHT**: The Psychology of Money (20, "finish it"), Siddhartha (12), You
  Are Not So Smart (48, "one mechanism per chapter"), The Subtle Art of Not
  Giving a F*ck (9), Crime and Punishment (blank), Musashi (blank, "winter").
- **"Up next" after an item ends** offers the next book *from the same list*,
  and only when there is not already one - `upNext` in `lib/library.ts`
  already does the arithmetic; this is about it being per lane.

This is seeded on request from the palette and never on first open. That rule
is not a detail - it was a privacy bug in v1.9 that handed the owner's actual
bookshelf to anybody who opened the live demo. See `librarySeed.ts`.

#### Stage 5 - the clean checkup

The owner's report: *"a lot of places are not clean."* Named, in order:

- **The template editor.** Eight large colour balls above the form become a
  small swatch beside the name. The day-type segment gets a line under it
  saying what it changes (shared with stage 3). The block-add row is
  overloaded - time, text, minutes, six dots, Ongoing and Add on one line - so
  split it over two levels or use the compact controls quick-add already has
  (`DurationControl`, `TimePicker`). Existing blocks become a tidy list with
  drag reorder.
- **The library add line.** "how many" is clipped and the unit, count and Add
  are crushed together. Rebuild it as a quick-add row: the words dominate, the
  controls line up.
- **Everywhere**: one vertical rhythm, no clipped placeholder, one button
  height per row, and every empty state carrying exactly one clear next action.
- **A screenshot before and after for every screen touched**, and **at least
  fifteen fixed places across the app**. Fewer than fifteen means the pass was
  not thorough enough and gets a second round.

Note for whoever runs this: the browser pane's screenshot went blank for
anything but scroll position zero during stage 1, while `javascript_tool`
measurement stayed reliable throughout. A fresh `preview_start`, or a fresh
tab that actually has layout - a background tab reports `innerWidth: 0` and
every ref reads as off-canvas - is the thing to try first.

#### Stage 6 - closing

- **Desktop QA on a realistic day** - twenty tasks, three Library lists,
  thirty in the backlog, North with rules - at 1920x1080 and 1366x768 in both
  themes, aimed at what is *new*: the North window, categories, the tooltips
  and the rebuilt forms.
- **`DAILY.md` updated** (it exists): the North window with its if-then lines,
  editing categories, and the three Library lists with their template bindings.
- Full regression - unit and e2e - `npm run sweep`, `npm run shots` rerun,
  every doc read against the code, DECISIONS carrying the North/if-then
  reasoning, the tour walked, then commit, push and **tag v2.0**.

#### The wave after: week templates

Briefed and queued, not started. **No personal seed data - the owner builds
their own template.** In short: "New template" first asks Day or Week
(`kind: 'day' | 'week'`, everything existing is a day and nothing changes); a
week editor of seven columns with "Add to" chips (this day / weekdays /
weekend / all days), Copy to, drag between columns, a per-column day type and
sleep override, and blocks sharing a `groupId` when added together so editing
one can ask "this day or everywhere" the way a repeat does. Stamping takes the
weekday's column; a weekday map holding a week template fills all seven in one
press; idempotency is `blockId` plus weekday. A week template's card shows a
seven-column preview. Then: "Start from a day template" to expand one day into
seven and edit the differences, `DAILY.md` on doing exactly that (a gym
rotation across the week, Reading and CRAFT blocks bound to Library lists), the
tour's stamp step checked against a week template, and tooltips for the new
terms.

### The phone wave, done

v2.0 was a desktop pass on purpose, and the wave after it stayed on the
desktop. v2.1 walked the phone.

`npm run sweep -- --phone` reported **82 findings, which were two
controls** - the quarter-hour arrows at 22px each and the focus bar's exit
cross at 30px, counted on every screen in both themes. It reports **zero**
now. The honest way to count it, written here because this file got the
number wrong twice:

```bash
npm run sweep -- --phone | grep -oP '\d+px [a-z-]+' | sort | uniq -c
```

- **The arrows** could not be saved by the 44px overlay: two overlays in one
  44px column land on top of each other. On a coarse pointer every
  `.time-stepper` lays its pair side by side, 44px each - quick-add, the
  template editor, the sleep windows, the duration panel - and the control
  gets 54px wider for it. DECISIONS, "The phone is walked, not only
  measured", has the reasoning.
- **The exit cross** joined the overlay list, both halves of it.

Then the walk - the part no measurement replaces - with a full day at
390x844 in both themes, every screen, and a day lived in the app after it.
What it found that the pass could not is in the table below, and section 5
carries the tick against every checklist item.

#### The bugs the phone wave and the bug hunt found

| Found | Where it had been |
|---|---|
| The quick-add time and duration panels painted behind the first task card, on every viewport - `contain: layout` on quick-add made a stacking context that never said where it sat | Since v2.0's typing-performance change. jsdom has no paint order and the sweep never opens the panels |
| Ten sheets and popovers dropped focus on close - Escape on the task menu left a keyboard at the top of the document | Since each was built; the task menu since v1.1 |
| The mini calendar's 35 cells and the month grid's 42 were each a tab stop; quick-add was the sixtieth Tab from the top of the day view | Since the mini calendar shipped in v1.11 |
| The floating timer covered the task pane's rollover line at both desktop sizes and sat on the navigation bar on a phone | Since the bottom bar arrived in v2.0 |
| A timer that ran out while the app was closed logged Chrome's AudioContext warning on the next open | Since the chime was written in v1.2 |
| The week's agenda reading had 30px rows and 19px date headings, all of them buttons | Since the agenda arrived in v2.0's clean pass |
| The template editor's block remove cross was 23px wide; the day header's arrows measured 43 | Since v1.0 and since the phone header was laid out |
| A backlog row's grip sat alone on a line above its words on a phone; a scratch note's Delete wrapped onto a line of its own under a long date; a library list's unit line clipped; the week editor's "Same as the week" read "Same as the we" | Since each was built |
| The duration panel's minutes field came out 26px wide once the arrows sat beside each other | Written and caught the same afternoon |
| The agenda's first 44px rule sat earlier in the stylesheet than the rule it was meant to beat, at the same specificity, and lost | Written and caught the same afternoon |

The last two are the walk doing its job on code written hours earlier,
which is the argument for walking before believing anything.

### Built: categories the owner owns

Shipped, to the design this file carried. The six the app has always shipped
are still the six a fresh install opens with, and they are now a list in
`AppData` rather than a literal in `categories.ts` - renameable, recolourable,
deletable, and joinable by new ones.

**The six-category doctrine did not go, it moved.** DECISIONS still holds that
a day is only takeable-in-at-a-glance while the palette is about six, and
`RESEARCH-ADHD.md` section 7 is why. What changed is who decides *which* six.
No cap is enforced; the Settings copy says what the number is for, once, and
then gets out of the way.

What a reader should know without opening the diff:

- **`Category` is a top-level list beside `library` and `goals`**, not a
  settings field, because a settings field is one sync entity and two devices
  editing two different categories would fight over one key. `'category'` is
  an `EntityKind`; per-entity merge and tombstones come free.
- **`CategoryId` is `string`.** The six defaults keep their literal ids, so
  every task, template block and backlog item already on disk points at
  exactly what it pointed at before. A new one gets a `crypto.randomUUID()`.
- **Absent `color` means the built-in `--cat-*` pair**, which is what keeps a
  category meaning the same thing in Dark and Light. Only an edited or new one
  carries a literal hex. A category the owner made has no pair behind it, so
  its colour is required and "the app's own colour" is not offered there.
- **`validate` loosened the three fields that point at a category** from a
  closed list to `optional(text(1, 64))`, deliberately: an id somebody made up
  cannot be checked against a list nobody wrote. A category id is now what
  `templateId`, `libraryRef` and `sleepProfileId` already are.
- **A delete offers to move what it would orphan**, in one commit with one
  undo, and says what it is about to touch as a fact rather than a warning.
  The last one cannot go, and the disabled button says why.
- **A hand-picked colour is refused rather than clamped** when it will not
  read. The check is the one this file specified: the title mix at 22% against
  the strongest end of the wash at 30%, at 4.5:1, in every theme the app
  ships. `categories.test.ts` holds all twelve palette colours to it.

**One thing to know about that gate, said plainly**: with those numbers it is
a floor rather than a filter. The wash is 30% colour on the surface and the
title is 78% `--text`, so the pair stays close to text-on-surface and almost
any hex clears 4.5:1 - pure white in Dark measures 5.07. It genuinely refuses
anything that is not a hex at all, and it would catch a future change that
made the wash stronger, which is what it is for. What it does *not* police is
whether the 4px edge can be told apart from the surface. The twelve curated
colours are checked against that separately, in the test, at 3:1 in every
theme; a hand-typed hex is not. That was a deliberate call to implement the
gate this file specified rather than invent a second one, and it is the first
thing to look at if a hand-picked colour ever looks wrong on a card.

### Asked for, not yet built

**The done contract, from v2.7.** The app is finished. Anything asked for
from here goes into this list and waits until the owner has lived in the
app for a week, on the phone it was written for and on the desktop; the
next brief comes out of that week - out of "Where the plan and the week
disagreed" in Review, and out of what the week turns up by hand - not out
of a feeling. That week is also the first time a real finger touches the
block drag, the resize strip, the long-press menu and the calendar's
paint-across-dates gesture, all of which were built and verified with
synthesised pointer events; OPEN-QUESTIONS carried that note from v2.0 and
this is where it ends.

- **Return adds a block, and nothing says so.** The week rehearsal measured
  ninety-seven presses for a whole week when the controls are used as
  designed and a hundred and thirty-eight when they are not, and twenty-two
  of the difference were clicking "Add a block" where Return in the title
  field already does it. The presets are on the screen; this is not.
- **The soak drives ten gestures and proves five of them landed.** The low
  day, the replan, the two set aside and the photo are still best-effort:
  they press whatever is on the screen and carry on if it is not there.
  Each needs the same treatment the other five got - an assertion on its own
  effect, where it happens.
- **Dragging a block inside the template editor's timeline.** The picture
  arrived in v2.5 and is read-only: it draws the day a template makes, live,
  with its sleep and its clashes, and the blocks are moved in the list under
  it. Making the picture editable means the drag machinery the day view
  already has - pointer capture, the grid's geometry, the snap - reused
  rather than written a second time, which is why it is a piece of work of
  its own and not a follow-up commit. The owner named it as a v2.6
  candidate when the timeline was briefed.
- **The keyboard walk and the visual pass, as scripts beside the sweep.**
  Both were throwaway tooling in v2.10 and both found things the suite could
  not: the keyboard one found two focus defects, and the visual one is the
  only thing that has ever measured CONVENTIONS 24 with a real pointer. As
  `npm run keys` and a few more shapes inside `sweep.mjs`, they would be run
  every wave instead of rebuilt. Written down here rather than done, because
  the wave that wrote them was told to add nothing.
- **A reminder that can arrive while the app is closed.** Two nudges were
  removed in v2.5 - one before a timed task, one during focus work - not
  because nobody wants them but because neither could do the thing its name
  promised: with no service worker registration for push and no
  subscription, both could only speak from a page already open in front of
  somebody. A real one means a push subscription, a server that holds it,
  and a permission flow that asks at a moment that makes sense, which is a
  piece of work of its own. See DECISIONS "A setting has to earn its
  place".

### Asked for, and now built

The three things the v1.11 brief named. Two are done and one turned out not
to be what it looked like:

- **An "up next" offer when a library item is finished.** Built in v2.0.
  `upNext(list, today)` in `lib/library.ts`, the offer line above the loud
  card in `LibraryView.tsx`, and "finished - next is Deep Work" on the bound
  task's card. Bounded to today, because it is a moment rather than a state.
- **Typing lag in quick-add under a slow CPU.** Measured again, the same
  way - Playwright, CDP `Emulation.setCPUThrottlingRate`, frame times from
  `requestAnimationFrame`, production build - across a realistic day, a
  twenty-task day, a twenty-task day with three thousand external calendar
  events, and a phone viewport. **At 4x nothing drops a frame**: every
  scenario sits at a flat 16.7ms and the synchronous React render a
  keystroke costs is 2 to 3ms. The old 50ms figure was a frame measurement
  that included the page's own baseline. It does reproduce at 8x on a
  170-task day - 66.7ms at the 95th percentile - and an inert input on the
  same page costs 50ms of that, so most of it was never quick-add. The rest
  was a layout invalidation walking out of quick-add's subtree into the day
  beside it, which `contain: layout style` on `.quick-add-block` and
  `.timeline-grid` cuts to 33.4ms. `busyIntervals` and `suggestSlot` are
  memoised on what they actually read, which is another 14% of the render.
  **Do not chase this further without a measurement that reproduces it.**
- **Outlook's Windows time zone names in .ics files.** Resolved one commit
  above `v2.1`, the way the debt said it could be - see the resolved debts
  below.

### One flake, unreproduced, written down rather than argued away

`smoke.e2e.ts`'s first day failed once during v2.0's closing regression and
has not failed since: fifteen full runs after it, including four at four
workers, all green, and the test passes three for three on its own. No cause
was found and nothing was changed to chase it, because changing a test to fix
a failure you cannot reproduce usually means making it assert less.

One more, from v2.2's closing regression: a unit test failed once inside
the chained run - typecheck, suite, build, browser tests, screenshots in
one command - and the log that would have named it had been cut to its
last lines by the pipe that fed it to the terminal. The rerun a minute
later was green, 2095 of 2095, and so was the full run before it. Written
down rather than argued away, with the lesson: a chained gate keeps its
whole log in a file, and a pipe into tail hides an exit code.

If it comes back, the thing to know is that this same test failed
*deterministically* before v2.0 for a different reason - it read the real
clock and the evening close card appears after 21:30 - so a failure here is
worth reading carefully rather than re-running. CI retries once.

### Known debts, and why each one stays

Every one of these was looked at again in v2.0 and left. None is an
oversight; each is a trade with a reason, written here so nobody has to
guess whether it was noticed.

| Debt | Why it stays |
|---|---|
| **Week blocks are small targets** | A 20-minute block at a week's scale is ~20px tall, because its height *is* its duration - that is the whole of what the week view says. Raising it to 44px would make a twenty-minute thing look like an hour, which is a lie about the day in exchange for an easier tap; the block opens the same task the day view does, at a size that fits. `min-height: 20px` on coarse pointers is the compromise |
| **`timelineLayout.ts` at ~890 lines** | Dense geometry, and splitting it would put the two coordinate systems in different files, which is exactly where a bug would hide. Well tested, and it opens with a map - the two systems, the three windows, the invariants, and which function decides what - so the next person starts from the map rather than the middle. Kept whole on purpose |
| **Sync has no conflict UI** | Last-write-wins per entity, silently. For one person with two devices a real conflict means editing the same task on both within a few seconds, and "the later edit wins" is both correct and what anybody would expect; a dialog for it would be a question with no good answer, asked on the rare day when somebody is already busy. It would be wrong for two people, and this is not for two people |
| **Imported .ics calendars are device-local** | A file has no address to refresh from, so there is nothing to sync *to* - carrying the parsed events would make one device's stale copy authoritative on another. Subscriptions, which do have an address, sync. Stated in the UI where it matters |
| **A week template's block cannot be edited in place** | It is written once and changed by removing it and adding it again. A week's blocks are drawn at 20px in a 96px column, and putting a time, a length, a category and a library binding behind each one means either a form per block on the smallest surface in the app, or a sheet - and a sheet over a seven-column grid hides the thing being edited. The add row already holds every answer before the block exists, which is where the app puts that question everywhere else. DAILY.md says so up front, because it makes the order matter. Revisit if the owner hits it |
| **The month's cells drop their ratio below about 720px of height** | The zero-scroll rule says the month fits, and something has to give when it cannot. Detail goes, never cell height: a 30px row is not a calendar. The shape of the month survives, which is what the grid is for |

### Resolved debts, so you do not chase them

- ~~Outlook's Windows time zone names were read as local~~ - resolved after
  v2.1, the way the debt said it could be: `WINDOWS_ZONES` in `ics.ts`, two
  dozen of the names that actually turn up mapped to their IANA zones the
  way CLDR maps them, consulted after `Intl` says no. The Outlook fixture
  in `ics.test.ts` now resolves to 11:00Z and reports nothing. Found on the
  way: a *quoted* TZID - which Outlook writes for every zone, and RFC 5545
  allows - was refused by `Intl` for its quotes, so a quoted IANA name had
  been read as local too. Unwrapped first now, with a test. A name in
  neither place is still read as local and named in `ignored`.

- ~~The library's dot row was a control that did nothing~~ - found while
  categories were being rewired, and it was wrong twice over. `updateLibraryList`
  never carried `color` through its patch, so every button in that row had
  been inert since it was built; and the values it was writing were
  `var(--cat-*)` references, which `LIBRARY_LIST`'s own `validate` table only
  accepts as a hex - so the first list that had actually taken a colour would
  have made the whole payload fail to load and open as a clean default. It
  draws from `PALETTE_COLORS` now, like every other colour choice in the app.
- ~~The 20MB import test failed at random~~ - it was the default 5s per-test
  timeout acting as an absolute millisecond budget on a test that deliberately
  asserts a *ratio* (CONVENTIONS section 3). It builds a 20MB payload and
  imports it several times, which on a machine running a hundred test files in
  parallel is honest work that takes longer than five seconds. Reproduced on
  v2.0's own commit with nothing changed: two failures in four runs. It carries
  its own 60s timeout now, so the ratio is what can fail it.

- ~~The day view could stop showing the day~~ - fixed in v2.0. At 1366x768
  with the evening close card above it, `.task-list` measured zero pixels
  tall with seven tasks in it, and at 1920x1080 it showed four of seven
  behind an overlay scrollbar that draws nothing until a pointer is over it.
  The list has a floor of two cards when it has any, the pane scrolls when
  that floor cannot be honoured, and the list carries scroll shades so it
  says when there is more.
- ~~The month grid always drew six rows~~ - fixed in v2.0. `monthGrid`
  returned a flat 42 cells, so every five-week month carried a whole week of
  the next one. It emits the weeks the month is actually in, four to six, and
  the month fits 390x844 again.
- ~~Two anchors in one column could overlap~~ - fixed in v2.0. A cluster's
  floor was the largest any single member needed, so a column holding two
  32px blocks got 32px and the second was drawn over the first's title. The
  floor is the tallest column's stacked total, and a block is capped at the
  next one in its own column besides.
- ~~Typing lag in quick-add~~ - measured in v2.0 and mostly not there; see
  "Asked for, and now built" above for the numbers, and do not chase it
  without a measurement that reproduces it.
- ~~The library queue behaved like a conveyor and looked like a list~~ -
  fixed in v2.0.
- ~~The timeline fell off a cliff the moment a day stopped fitting~~ - fixed
  in v2.0.1. `fitPxPerMinute` returned the phone's own density when no
  density fit, which is the far end of the range from the answer: the starter
  template's nine-task day in the 445px column a 1990x860 window leaves drew
  at 1082px, six hundred pixels of scrolling for a day whose floors need 456.
  It aims at the floors' own height now and comes out at 464. The function
  had no tests at all, which is how it shipped; it has six.
- ~~Four ways to say a colour was chosen~~ - fixed in v2.0.1. The accent row,
  the six categories, a template's colour and a library dot each had their
  own idea of what "selected" looks like. One rule now, in DECISIONS: fill,
  a two-pixel gap in `--surface`, a two-pixel ring in the swatch's own colour
  through `--pick`, as a box-shadow so choosing one never moves the row.
- ~~The tick on a done task measured 2.42:1~~ - fixed in v2.0.1. It was a
  hard `#fff` on an accent fill, which is the exact case CONVENTIONS section
  5 was written about, on the most-looked-at mark in the app. 8.67:1 now, and
  the switch's thumb had the same bug. A check over every accent-filled
  surface in the stylesheet found those two and nothing else.
- ~~A percentage in the rail~~ - fixed in v2.0.1. The digest's ring carried
  `Math.round(fraction * 100)`, which is a percentage with the sign taken
  off, next to a "Done 1 of 9" that already said it correctly in words.
  `score.test.ts` had held the no-percentage rule for `formatDayScore` since
  it was written; the digest computed its own fraction and walked around it.
  The ring is a shape now, and `DayDigest.test.tsx` holds it.
- ~~Scroll shades that could not be seen~~ - fixed in v2.0.1, and it was a
  flaw in v2.0's own fix. The `background-attachment: local`/`scroll`
  gradient pair is the right answer only for a scroller whose children are
  transparent; a task card paints `--surface` edge to edge, so the shades sat
  behind the cards. `mask-image` driven by `useScrollEdges.ts`.
- ~~Three transitions mixed `0.15s` with `var(--dur-fast)`~~ - fixed in
  v2.0.1. The same number written two ways means the motion token no longer
  controls everything it claims to. The one genuinely bespoke duration left
  (the day progress bar at 0.35s) now says why.

- ~~Screenshots, and no way to make them~~ - `npm run shots` since v1.11,
  Playwright writing PNGs from the dev server with the clock pinned. The
  README leads with the hero it produces. Visual regression checking is
  still by measurement; the script is for the README, not for diffing.
- ~~The wide day view scrolls on a short laptop~~ - closed in v1.11 two
  ways. The gap and unsized-anchor floors follow the pointer, so a mouse
  gets 28px and 32px where a finger keeps 44px, and a nine-block day fits
  1440x900. Where it still cannot fit - 1366x768 - the grid's column takes
  the overflow, opened at now, and the page itself never grows.
  `e2e/demo.e2e.ts` measures both. Found on the way: the two
  `visually-hidden` live regions had no `top`, sat at their static
  position in an implicit grid row 700px under the window, and made a
  page that fitted its screen scroll anyway.
- ~~No end-to-end tests~~ - Playwright against the production build since
  v1.10: `npm run e2e`, 23 tests in ten files under `e2e/`. A first day
  (stamp, add, tick, the evening close arriving on the last tick, the reading
  plan from the palette), the tour walked naively on a desktop and on a phone
  doing only what each card says, two browser contexts syncing through the
  real `server/sync-server.mjs` on a spare port - one task both ways, and
  since v2.0 a tick here against an edit there with a delete in the middle -
  the demo's first screen, the three replan doors, a book bound to a template
  and ticked and then finished so the list names the next one, a backlog
  pull, a night passing with a daily repeat and the yesterday banner, a
  week-view drag, scratch's two ways out, export-erase-import, two snapshot
  restores (the empty first-mount one, and one that really brings a wrecked
  day back), and an .ics file over the day. Every test that depends on the
  hour pins the browser clock (`openFreshAt` in `e2e/app.ts`) to a Wednesday
  in Vilnius - `smoke` and `tour` did not until v2.0, and failed on any
  machine run after 21:30, which is the default evening close time. CI runs
  it in its own job; the deploy does not wait for it.
- ~~`storage.ts` at ~830 lines, almost all of it `validate()`~~ - split in
  v1.11. The guard lives in `validate.ts` as tables: one per entity, a
  field and what a value in it may be, built from a dozen small checks
  (a string, a whole number in a range, one of a list, optional, a list
  of). Same strictness - every rule tighter than the type kept its reason
  beside it - and the 96 tests that hold the contract did not change.
  `storage.ts` is 347 lines and is about loading, saving and migrating.
- ~~The tour lagged on a slow machine~~ - profiled in v1.11 under a 4x CPU
  throttle. The scrim was one full-window SVG path with the hole cut out
  and its `d` transitioned, so every move of the hole re-rasterised the
  window for a fifth of a second; scrolling under the spotlight ran a 95th
  percentile frame of 56ms. It is four solid shades now, moved by
  transform (`shadesAround` in `Tour.tsx`), the ring is positioned by
  transform, and the poll goes through the same per-frame gate as the
  observers. Scrolling is at 40-47ms at the 95th percentile under the same
  throttle, and typing under the spotlight costs what typing costs with no
  tour at all - what is left is the app's own render at a quarter speed,
  not the tour's. The 3.2 second caption hold is untouched; that is a
  pause, not a lag.
- ~~ICS: named time zones were read as local~~ - resolved in v1.11 through
  `Intl.DateTimeFormat`, which carries the IANA tables the debt said were
  needed; there was never a database to ship. A zone the browser does not
  know was read as local and reported until Outlook's Windows names got
  their own table after v2.1 - the entry at the top of this list.
- ~~ICS: monthly and yearly rules were skipped~~ - the plain shapes are read
  since v1.11: the same day each month, the same date each year, with the
  RFC's rule that a month without the day has no occurrence. The exotic
  shapes stay named in `ignored`, for the reason the debt gave. Tests
  include a trimmed Google export and a trimmed Outlook export.
- ~~Three bugs the browser tests found in v1.11~~ - the yesterday banner
  vanished on "Push to today" instead of saying what moved, because its
  early return on "nothing unfinished" ran before the confirmation branch;
  the source of a repeating series was pushed like a one-off, so the next
  day held it twice beside the instance the series had made
  (`sourceCovers` in `repeats.ts`); and `isTaskMarkOnly` in scratch read
  `/^s*!s*$/` with its backslashes missing, so " !" was written to the
  stream and deleted a keystroke later. Each has its unit test now.
- ~~`store.ts` at ~1600 lines~~ - split in v1.10 into ten area modules
  under `lib/store/`, with `store.ts` left as the facade so no import
  changed. Every action kept its doc comment and body; the one edit inside a
  body is reading the state through `getData()` instead of a module
  variable. `store.test.ts` checks that no action is defined in two areas.
- ~~The reading plan seeded itself on first open~~ - fixed after v1.9. It
  fired for anybody who opened the live demo and handed them the owner's
  actual bookshelf. The data and the stable ids stayed; the mount effect in
  `App.tsx` went, and the call sits behind "Load my reading plan" in the
  palette. Nothing in `librarySeed.test.ts` assumed the automatic trigger,
  and two tests in `App.test.tsx` now hold the new shape: an open writes no
  library, the command fills it.
- ~~The 400-day repeat lookback~~ - removed in v1.5. It was an expiry date
  pretending to be an optimisation.
- ~~`DayView.tsx` at 1238 lines~~ - split six ways in v1.5; it is 397 now.
- ~~The 38px button debt~~ - closed in v1.6. Every control on Today and the
  calendar meets 44px on a coarse pointer.
- ~~`normalizeLoaded` dropping optional settings~~ - fixed in v1.6. It had
  silently eaten `northDismissedOn` since v1.4.
- ~~Snapshot restore never reaching storage~~ - fixed in v1.5.
- ~~The backlog nobody had built~~ - shipped in v1.9, as a fourth shelf
  under the inbox rather than a seventh tab. It records no age, because
  nothing that cannot be recorded can ever be shown.
- ~~A season ending finished the whole series~~ - fixed in v1.9. Watching the
  last episode of season one of three filed the series under Finished and
  took the offer to start season two with it.
- ~~Text fields were not touch targets~~ - fixed in v1.9. The 44px floor was
  applied per class, so every field added since the last audit was 39px on a
  phone. It is on the base rule now.
- ~~Two 28px buttons on every inbox row~~ - fixed in v1.9. They had been
  there since v1.4 and survived the v1.6 touch pass because an inbox is
  collapsed by default and was empty every time the audit ran.
- ~~Timing tests asserting milliseconds~~ - all ten of them became ratios in
  v1.9, against a baseline measured the same way, alternating sides and
  keeping the fastest round. The shared machinery is `src/test/stress.ts`,
  and there is no absolute millisecond assertion left in the suite.
- ~~The rescue re-timed routine blocks~~ - fixed in v1.9. A missed Standup
  was fitted into the evening because the evening was free. `isRoutine`
  already existed; the rescue simply never asked.
- ~~`--week-days` was a custom property nobody set~~ - removed in v1.9.

---

## 5. Phone checklist

Run this at **390x844** in the browser pane before calling any wave done. The
owner is an iPhone user; Android and desktop must work too, but the phone is
the one that gets checked first. **Walked in v2.1**, every item, in both
themes, on the sample day; what each found is beside it.

- [x] **Today** - header, North line, capacity line, timeline disclosure, task
      list, Done fold, inbox, the rollover link (a button drawn as a link,
      exempt from the 44px audit by design). Scrolls vertically (expected),
      never horizontally. *Found: the two day arrows measured 43px, shrunk by
      the title column. Fixed.*
- [x] **Calendar → Month** - fits without scrolling. This is a hard constraint;
      if something must give, reduce stat detail, never raise cell height. It
      was 74px past the fold before v2.0, which is how a hard constraint goes
      quietly wrong: nothing measured it after the last thing that changed a
      height. Measure it, every time. *664 of 664 in both themes. A tap opens
      the day; the hover preview is a mouse's, on purpose.*
- [x] **Calendar → Week** - three columns, no scroll in either direction,
      template chip inside its own column. *Fits, and the Someday strip sits
      under the columns. The Agenda reading's rows were 30px and its date
      headings 19px - fixed to 44.*
- [x] **Settings** - every section reachable from the section list at the
      top, which is sticky; it must not cover the content at 390px, and the
      first entry is not clipped. *Nine sections since North left it; Nudges
      is three rows since the v2.5 health check.*
- [x] **Every visible button ≥ 44px**, or carrying a `::after` hit-area
      overlay. Measure it, do not read it - see `CONVENTIONS.md`. Documented
      exceptions, and nothing else: a week block (its height is its
      duration), a reorder grip (32 wide at 44
      tall), the six duration chips (40 wide at 44 tall - widening them wraps
      the row), and the time picker's 30px rows (a scrolling column; taller
      rows show fewer hours). The stacked quarter-hour arrows are no longer
      one: they are a side-by-side pair on a finger. **A new class in the
      `@media (pointer: coarse)` overlay list has to go in twice** - the
      `position: relative` list and the `::after` list - and `.setting-quiet`
      shipped in v2.0 missing from both, which the measured phone run caught.
      *The focus bar's exit and the template editor's block cross joined the
      list in v2.1.*
- [x] **No horizontal overflow anywhere**:
      `document.documentElement.scrollWidth > clientWidth` must be false.
      *False on all thirty-two screens walked.*
- [x] **Both themes** - dark and light. `--muted` and `--danger` are gated at
      4.5:1 by a test, but check that nothing new hard-codes a colour.
- [x] **A task detail sheet** opens as a bottom sheet and can be swiped away,
      clear of the home bar. *And hands focus back to the dots that opened
      it, since v2.1.*
- [x] **Settings and the detail sheet** get measured too. The v1.6 pass
      measured Today and the calendar and stopped there, which is how a 38px
      pill row and four sub-44px controls in the sheet survived two versions.
- [x] **Replan** - open all three doors. The summary must be on screen without
      scrolling, with five things in the way. It is the sentence the screen
      exists to produce. *"Nothing in the way. It goes straight in." sits
      above Accept without a scroll.* **Since v2.2, Something came up is two
      rows of chips, the words, the plan and Accept**: the day chip, the
      shape chip and Accept all inside the viewport with the sheet's body
      unscrolled, measured by `e2e/interrupt.e2e.ts`; every chip, row and
      segment 44px; the week's bar keeps its three rows with the new door on
      the Grid / Agenda row. *Walked twice in v2.2, both themes; the toast
      and the bar were the findings, both fixed.*
- [x] **The journal** - the morning line under the North line, a 44px
      field on a finger; the closing card with the best moment and the two
      questions, and Close the day inside the viewport with nothing
      scrolled, measured by `e2e/journal.e2e.ts`; the week's copy row under
      the grid without a scroll, the agenda's lines under the day, Review's
      row under its arrows. *Walked once in v2.3, both themes, on the sample
      day with the card forced open; the blur save was the finding.*
- [x] **Scratch** - the pen in the bar, and the close cross: on a phone the
      overlay is the whole screen, so there is no scrim to tap. *A note's four
      actions wrapped one at a time under a long date - fixed to wrap as a
      group.*
- [x] **The four shelves** - a task, an inbox line and a backlog item from the
      same field, and the Backlog fold under the inbox. Every row's actions on
      their own line, all of them 44px. *A backlog row's grip sat alone on a
      line above its words - fixed.*
- [x] **Library** - the chip row, a list folded and unfolded, the active card,
      and a detail panel opened from a row. The picker for a page-counted book
      is typed, not stepped. *A list's "7 going, counted in episodes" clipped
      beside its name - it wraps now.*
- [x] **Evening close** - the card at its time and the card on a finished day.
      It must span the content columns rather than land in the rail, and it
      must never say anything about what was not done.
- [x] **The tour** - both platforms, all nine steps, then once more doing
      only what each card says. The spotlight has to follow into a bottom
      sheet, which is where it first failed; the dots on the Walk card have
      to be visible while pointed at; the caption after the goal has to land
      on the North line under the day's title. This is not optional polish:
      CONVENTIONS.md section 13 makes a stale tour a P0 bug, because it is
      the first thing a new person sees. *Walked by Playwright on both
      viewports with the North step rewritten for the window - and the card
      sat on Keep it at 1366x768 until the button became a target of its own.*
- [x] **The quick-add row against the cards under it** - the duration
      control's right edge and the cards' right edge are one line, and the
      placeholder is whole. Both broke once without anybody measuring. *Whole,
      and the duration panel now opens over the cards rather than under them.*
- [x] **Library counts** - every row's count ends on the same x, the active
      card's included. *On a phone the count sits under the title, one x for
      all of them.*
- [x] **The wide layout with an empty day**, in each of the three focus
      states. Both rules that collapse the grid have to agree about the
      column names - see the grid-area note in section 6.
- [x] **North** - the window in both themes with a five-line picture and four
      goals, the empty window, Compose with four goals, and the Monday card
      with its deserve line. *One column, the picture at 20px over 10 wrapped
      lines, and Compose a long form that ends on Save - meant to be rare.*
- [x] **The week template editor** - seven columns on a phone. *They scroll
      sideways inside the card, 128px each since "Same as the week" clipped
      at 96; the add row sits below them at full width.*

The measurement snippet that has been used for the target audit:

```js
[...document.querySelectorAll('button, [role="button"]')]
  .filter(b => {
    if (!b.offsetParent) return false
    const r = b.getBoundingClientRect()
    if (r.height === 0) return false
    const after = getComputedStyle(b, '::after')
    const overlay = after.content !== 'none' && after.position === 'absolute'
    return r.height < 44 && !overlay
  })
  .map(b => ({ t: (b.textContent || b.ariaLabel || '').trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height), c: b.className }))
```

---

## 6. Things that will bite you

Collected from waves where they actually did.

- **`store/core.ts` calls `loadData()` at import time.** Anything that needs to
  influence what the store reads has to happen inside `loadData`, not in
  `main.tsx` - module imports are evaluated before the importing module's body.
  This ate the first version of demo seeding.
- **`normalizeLoaded` is where a new settings field lives or dies.** It spreads
  now, so you are fine, but the test in `storage.test.ts` is what keeps it that
  way.
- **`SYNCED_SETTINGS` is checked for exhaustiveness at compile time.** Add a
  field to `Settings` and the build fails until you say whether it syncs. That
  is deliberate.
- **A `Response` body can only be read once.** Test doubles must return a fresh
  one per call, or the second reader gets an empty body - this made a sync test
  fail for a reason that had nothing to do with sync.
- **`vi.unstubAllGlobals()` does not restore spies.** A `vi.spyOn` on
  `navigator.onLine` leaked across a whole test file and made two later tests
  pass by doing nothing. Use `vi.restoreAllMocks()` too.
- **The dev server caches modules hard.** If the browser shows an error naming
  a variable you already deleted, kill the dev server, `rm -rf node_modules/.vite`,
  restart. Do not debug the phantom.
- **jsdom has no layout and no hit testing.** `getBoundingClientRect()` returns
  zeroes and `document.elementFromPoint` does not exist until you define it.
  Any geometry has to be a pure function tested directly.
- **Line endings.** The repo is CRLF. A script doing string replacement has to
  detect which the file uses; several edits failed silently on this.
- **The browser pane's screenshot crops sometimes.** Retry, or open a fresh
  tab. Measurement via `javascript_tool` is more reliable than pixels anyway.
- **A grid-area naming an area no template declares is not ignored.** It is
  placed in an implicit track, so the grid quietly grows columns nobody
  declared. Two rules collapsed the day view to two columns and disagreed
  about the surviving column's name (`pane` against `tasks`); on an empty day
  with the Tasks focus both matched and the header was squeezed into 151px in
  a four-column grid. `gridAreas.test.ts` reads the stylesheet as text and
  fails on any name a template does not offer.
- **One stylesheet means class names are global.** `.palette` was the colour
  row in the template editor until the command palette took the same name in
  v1.3, after which eight swatches rendered stacked inside a 560px card. Grep
  the stylesheet for a name before using it. A script that lists every class
  defined twice at the top level takes four lines and found two more.
- **`.chip` is the category swatch.** It sets a dark ink for the coloured
  background its callers supply inline, so borrowing it without one gives a
  browser-default white pill with near-black text - loud, and wrong in the
  dark theme.
- **A popover needs a positioned ancestor.** `.time-picker-panel` is absolute
  at `top: 100%`; dropped into the quick-add row without one, it measured
  itself against the whole task column.
- **An effect that both sets state and clears a timer will clear its own
  timer.** The tour showed a tick for ever because the effect that started the
  advance timer re-ran the moment it set `celebrating`, and its cleanup killed
  the timer it had just made. Two effects.
- **For one render after the tour advances, `celebrating` belongs to the
  old step and `step` is already the new one.** Any effect keyed on both
  has to check `before.step === index` first, or the new step's caption
  fires on the old step's tick - which is how the goal step's relocation
  sent the shell to the day view on top of the index effect's `settings`.
- **A layout hook must not measure anything the page's scroll position
  moves.** `useAvailableGridHeight` read the grid's viewport-relative top;
  scrolled down, the grid claimed a screen it did not have, grew, pushed
  the document taller, moved under the scroll settling back, and re-measured
  - a feedback loop the tour exposed by scrolling Settings and switching
  tabs. It reads the document-relative top now.
- **`background` on a scroller paints behind its children.** The classic pair
  of `background-attachment: local` / `scroll` gradients that says "this list
  goes on" is the right answer only when the children are transparent. A task
  card paints `--surface` edge to edge, so the shades showed in the eight
  pixels between cards and nowhere else. What fades opaque children is
  `mask-image`, and a mask cannot be told to appear only while there is
  something to fade - hence `useScrollEdges.ts`.
- **A flex child with `min-height: 0` can be given nothing at all.** That is
  the point of it - it is what lets a column shrink - and it is also how the
  task list came to measure zero pixels with seven tasks in it on a 1366x768
  evening. Anything that must always show *something* needs a floor as well
  as permission to shrink, and the container needs somewhere for the
  overflow to go when the floor cannot be honoured.
- **An overlay scrollbar draws nothing until the pointer is over it.** On
  Windows Chrome with `scrollbar-width: thin`, a list that scrolls looks
  exactly like a list that ends. If a scroller matters, say so in the paint:
  the two `local`/`scroll` gradient shades on `.task-pane .task-list` are
  the pattern.
- **`:not(:empty)` is how a CSS floor stays off an empty list.** React
  renders no child nodes at all for an empty array, so `:empty` matches. A
  floor without that guard put a 120px ruled band under the first-run
  invitation, which reads as something failing to render.
- **A cluster's floor is not a member's floor.** `buildAnchorClusters`
  reserves per *column* - two anchors that do not overlap share a column and
  are stacked, so that column needs both floors end to end. It reserved one
  of them until v2.0 and drew "Wash the car" through the middle of "Reply to
  the landlord".
- **A test that reads the real clock fails at some hour of some day.**
  `smoke.e2e.ts` and `tour.e2e.ts` used `openFresh` rather than
  `openFreshAt`, so both failed on any machine run after 21:30 - the default
  evening close time - and had for as long as anybody ran the suite in the
  morning. CONVENTIONS section 10 already said to pin it.
- **The browser pane throttles a hidden tab.** Timers fire once a second
  and animation frames not at all, and after a few minutes chained timers
  fire once a *minute*. A page script with several `await sleep()` calls
  then takes minutes, every later tool call queues behind it, and it looks
  exactly like a locked renderer - three "hangs" in one session were this.
  Put waits between tool calls, never inside the page, and dispatch keys on
  elements rather than trusting `computer` key presses to land.
- **`contain: layout` makes a stacking context**, and one with no z-index
  paints in DOM order. Quick-add's panels painted behind the task list for
  a whole version because of it, and nothing that runs in jsdom can see
  paint order. `stacking.test.ts` holds every contained rule to a z-index;
  the next one needs its own.
- **A `@media (pointer: coarse)` block earlier in the stylesheet loses to a
  later base rule at the same specificity.** The agenda's 44px rows were
  written into the shared coarse block, hundreds of lines above the
  agenda's own `min-height: 30px`, and measured 30px on the phone the same
  afternoon. Put a coarse override after the rule it overrides.
- **A step the tour lights can have a button right under it that the card
  then covers.** The card avoids the hole, not the control beside the
  hole. Make the button a target of its own - the engine skips a disabled
  one, so it takes over the moment typing enables it.
- **`grep -c $'\r'` reports zero in the Bash tool for a file full of
  them**: it is POSIX sh, and `$'...'` is not expanded there. Count with
  `tr -cd '\r' < file | wc -c`. A session believed the tree was LF for an
  hour on that.
