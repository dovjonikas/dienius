# Where this project actually is

You are picking this up cold. This file is the handover: what the app is
today, the rules of the freeze it is under, how work is checked, and what is
still owed. Read it, then [`CONVENTIONS.md`](CONVENTIONS.md) for how work is
done here, then [`ARCHITECTURE.md`](ARCHITECTURE.md) for where the code
lives, and [`DECISIONS.md`](DECISIONS.md) for why things are the way they
are. How the app got here, version by version, is
[`HISTORY.md`](HISTORY.md): written as each version was done, so the code it
names is the code of that time.

**Last updated:** 2026-09-24, the freeze preparation - the owner's seven
points before the freeze of Monday 2026-09-28, in the section after the
next.

## Freeze nuo 2026-09-28: kas leidziama (bug fix, duomenu saugumas, docs) ir kas ne (naujos funkcijos, jos eina i BACKLOG parking skyriu)

*The freeze from 2026-09-28: what is allowed - a bug fix, data safety,
docs - and what is not - a new feature, which goes to the Parked section of
BACKLOG. The heading is the owner's, word for word.*

From Monday 2026-09-28 Dienius gets no new features. Everything that is
here has to stay reliable, fast, and clear to whoever picks it up next.

**Allowed:**

- **A bug fix** - the app doing something other than what it already says
  it does, or failing to do it: a wrong result, a crash, a screen that
  cannot draw, a control that cannot be reached, something drawn broken. A
  fix comes with a test that fails without it.
- **Data safety** - anything that keeps the plan from being lost, damaged
  or leaked: storage, backups and their formats, migrations, sync, erasing,
  the privacy guard. A new shape of the plan leaves its own backup file
  (CONVENTIONS 7).
- **Docs** - these files, the guides, and comments in the code.

**Not allowed:** a new feature - the app doing something it did not do
before, a new screen, a new setting, a new kind of data. Asked for anyway,
it is written down in the Parked section of [`BACKLOG.md`](BACKLOG.md) and
waits there, with who asked and why.

**The line between the two.** If the change needs a new sentence in section
2 below, it is a feature. If it makes an existing sentence there true again,
it is a fix.

**Every change, as before:** every gate green, one at a time (CONVENTIONS
10), STATE and DECISIONS where they are affected, a commit in English
without an apostrophe and with the trailer, a push, and a green deploy.

## The freeze preparation (2026-09-23 to 2026-09-28)

The owner's brief: no new features from the freeze on 2026-09-28, so
everything that is here has to be reliable, fast, and clear to another agent
a month later. Seven points, each with every gate green.

- **1. Backups and migrations: done.** `scripts/backup-fixtures.mjs`
  checked out, in a worktree, each of the 23 commits since v2.20 that
  changed the plan's shape, and let that version's own code write its
  backup - the sample day and a generic overlay of every field its guard
  knew. Nineteen formats differ; each is in `src/lib/fixtures/backups/`.
  `src/lib/backupVersions.test.ts` holds four things on every one: it opens
  without an error, the same by import as from storage; nothing is lost,
  every value where it was; nothing appears but what a written-down
  migration adds (an open goal retired, an empty list of recipes or
  routines, before v2.27 to v2.29); and after one import it is a fixed
  point, byte for byte - a file from v2.29 on is the same file back at
  once. No version broke, so no migration needed fixing; a planted lost
  field and a planted unstable export were both caught. CONVENTIONS 7 says
  how the next shape leaves its own file.
- **2. A screen fails, not the app: done.** Every page, every sheet the
  shell opens (Focus, the journal, Scratch, replan, the palette, the
  shortcuts, the tour, North after sleep) and every panel of the header is
  in its own boundary (`src/ScreenBoundary.tsx`), and a sheet a page opens
  itself fails with its page: what cannot draw says so in its own
  place - a page its name and a card (it could not
  be shown, nothing is lost, the error in one line, Try again, Export
  backup), a sheet or a panel one line - and the rail goes everywhere else
  (`src/screenFails.test.tsx`). `src/resilience.test.tsx` opens the app on
  each of the owner's six cases and walks every page: a store that cannot
  be read (five ways, and every other key the app keeps filled with six
  kinds of rubbish), a field nobody expected (it rides along through a
  save), an empty template, a date without a kind, a roster without days
  (on this device and in a templates file), a recipe without a name. None
  needs the boundary; a crash planted in Kitchen was seen before the walk
  was believed. Two were not crashes and not clear either, and are fixed: a
  stored plan that could not be read opened an empty app without a word and
  was written over by the first save - now it is kept aside
  (`lib/unreadable.ts`), a line over every page says so, and Settings saves
  it as a file or forgets it; and a recipe or a template with no name was a
  blank row - "Untitled recipe" and "Untitled template" now
  (`lib/names.ts`), the plan keeping the empty name. Found on the way:
  Kitchen's meal filter was a 4px band on every desktop since one look's
  stage 5 - fixed, and the sweep now sees a box squeezed shut. DECISIONS
  "One screen fails, not the app", "A plan that cannot be read is kept, and
  said" and "A strip in a column keeps its height".
- **3. The phone with no network: done.** `e2e/offline.e2e.ts` and
  `e2e/deploy.e2e.ts`, on the production build under /dienius/, on a
  desktop and a 375px phone: opened once, the app opens with no network -
  the day, the roster's Apply and Export backup all work - and the same
  with the network gone in the middle of a session; a deploy written over
  the served build is what the next open runs, its cache the only one left.
  Found and fixed: the app opened offline as an empty page under a server
  that answers `Vary: Origin` (the worker ignores Vary now; GitHub Pages had
  spared the live site by luck), and after every deploy the first open said
  "An update is ready" over a page that already was the update (the worker
  answers from its own build first, and a takeover is announced only for a
  page of another build). A page left open asks for a newer version when it
  comes back into view. No reload the person did not ask for: DECISIONS
  "The phone with no network, and a deploy that takes over"; the same steps
  on the iPhone itself are CHECKS-BY-HAND B3. And one look was counted: every
  control and heading on every screen at both sizes, with the lines each
  label takes, at v2.40 and now - nothing is missing, and the Library's
  quick starts and a book's Counted in keep their words whole again
  (DECISIONS "A strip in a column keeps its height").
- **4. Speed and the keyboard: done.** docs/SPEED.md has the numbers and
  what each costs. Lighthouse on the production build (`scripts/lighthouse.mjs`):
  a phone 95-96 for performance, 100 for accessibility and best practices;
  a desktop 100, 93 and 100. Nothing is under 90. What holds the phone at
  95 is the first paint over a slow line, one 232 KB script (the price of
  splitting it is written down, and it is not paid in the freeze); what
  holds the desktop at 93 is the mini month's faded days (3:1 on purpose,
  CONVENTIONS 22), the quick-add's Return hint (4.2:1, a quiet repeat of
  the key's own label) and the time field's arrows (a smaller target the
  field itself stands in for). Two names Lighthouse found not holding the words
  on their controls are fixed: the length button, and the empty day's
  starters. The bundle (`scripts/bundle-parts.mjs`): 799 KB of script,
  232 KB over the wire, React 23% of it and nothing else not the app's own;
  247 KB of stylesheet, 39 KB over the wire. The keyboard pass walks the
  sheets too now - 39 screens, 11 of them sheets - and found Tab running
  off a sheet into the page under its scrim: the page behind an open sheet
  is `inert` (`lib/modalInert.ts`), every covering sheet is `aria-modal`,
  the tour stands over them, and the pass finds nothing. DECISIONS "The
  page behind a sheet is out of reach" and "A control is named by the words
  on it"; CONVENTIONS 4 "A sheet is modal".
- **5. Dead code: done.** Every module the app imports was read for exports
  nothing uses, and every comment in `src` for a name the code no longer
  has. Out: sixteen functions, types and constants nothing in the app used,
  some kept alive only by their own tests - the month's summary line v2.20
  took off the screen, the week column's footer from before the week was one
  timeline, the list of steps Cook read (Cook went in v2.30), a step typed
  as a line from before v2.13, the journal's old type, the Scratch icon from
  the rail, an entity list sync stopped asking for, a photograph check, the
  snapshot clear the erase no longer calls, and five more - with their
  tests; a dozen comments that named a report, a component or a function
  that is gone (the if-then board's widget id, TimeStepInput, isRoutine,
  willRepeatOnto, a Cook view); and two screenshots left in the repo's
  root. What stays although only tests call it, on purpose: the test seams
  (a reset for each module that keeps state, the in-memory stores) and five
  rules the tests name (`isNorthHeading`, `splitNorthHeading`,
  `parseIcsDate`, `tourWordTotal`, the fills table); the retired goals'
  data, which a backup still carries (`goalsRetired.test.ts`). Found on the
  way, from a comment that said "Erase all data" called a function it did
  not: the erase left the photographs in the notes and the files picked for
  the Library in their own databases. It deletes all three databases now,
  and a test fails if the code opens one the erase does not know (DECISIONS
  "An erase takes this device's keys with it").
- **Found on the way, after point 5.** The eight defects the rotating-shifts
  audit had left for their own time, each checked in the code first and
  each fixed with a test that failed without it: a week's shift, night or
  rest column can mark a block Core, so such a day scores again; deleting a
  sleep schedule clears it off a week's own days; the Library puts a list's
  block on a day template only, since a week's block needs a weekday;
  deleting a template takes it off the weekday map, and a map that still
  names a deleted one (an older plan, an older device) counts as unmapped,
  so Stamp week no longer says it stamped what it could not and the push
  no longer leaves today's tasks for a tomorrow that will not get them; an
  imported event given a length is cut at midnight like one given an end,
  each repeat at its own midnight, and an all-day event is on every date it
  covers; the worker tells the browser why a file could not be served.
  Six store actions nothing called went, with twenty classes the
  stylesheet kept for screens that are gone. And the owner's own reading
  plan, which any visitor could load from the palette, is out of the app:
  nothing of the owner's belongs in a public repo (DECISIONS "Eight
  defects and a reading plan, before the freeze").
- **6. Documents for the next agent: done.** STATE was the handover and the
  whole history at once - 5,800 lines, a version at a time - and is two files
  now: this one, the app as it is, and [`HISTORY.md`](HISTORY.md), every
  version as it was written. The four handover documents were read as one
  set, against the code and against each other, by six reviews at once, and
  each finding was checked before it was taken: ARCHITECTURE had 53 things
  no longer true (sync's GitHub route missing, twelve store areas counted
  as eleven, files and settings long gone), CONVENTIONS 37 (the tour's step
  count, the kinds of button, rules the stylesheet no longer kept), DECISIONS
  91 across its entries - an entry a later change overtook carries the
  file's own Superseded note under its heading now, saying what is true and
  where, and a sentence that was simply wrong is corrected - and STATE 81,
  which is why sections 1 to 6 are rewritten rather than edited. A script
  that checks every backticked file and name in the four against the repo
  finds none missing. [`BACKLOG.md`](BACKLOG.md) is sorted into Parked
  (where a request goes during the freeze), Done and No longer relevant,
  with the one-item list that stood in the repo's root folded in. The
  documents beside the four that pointed into the old STATE, or told
  somebody to press what is gone, point where things are now.
- **7. Deploy, commit, push: done.** Every point went out on its own, every
  gate green before it and the deploy green after it - "Freeze, point N" in
  the log - and the fixes found on the way as their own commit. What was
  checked, found, fixed and left:

| | Checked | Found | Fixed | Left, and why |
|---|---|---|---|---|
| **1. Backups** | Every backup format since v2.20, each written by its own version's code: 23 commits, 19 formats | Nothing broken | Nothing needed fixing; CONVENTIONS 7 says how the next shape leaves its file | - |
| **2. A screen fails alone** | Every page, sheet and header panel; the six broken-data cases, each on every page | A plan that could not be read was opened empty and overwritten by the first save; a nameless recipe or template was a blank row; Kitchen's meal filter was 4px tall | All three, each with its test | - |
| **3. Offline** | The build under /dienius/ on a desktop and a 375px phone: no network from the start and from the middle of a session, a deploy over the served build | The app opened empty offline under a server that sends `Vary`; after every deploy the first open offered an update it already was | Both | The same on the iPhone itself: CHECKS-BY-HAND B3, the owner's to run |
| **4. Speed and keyboard** | Lighthouse at both sizes, the bundle file by file, 39 screens on a keyboard alone | Tab ran off an open sheet into the page under it; two controls were named apart from their words | Both: the page behind a sheet is out of reach | Phone performance 95-96: the first paint on a slow line, whose price is splitting the script (SPEED.md, parked). Desktop accessibility 93: faded days at 3:1 on purpose, a quiet key hint, and the time field's arrows, which the field itself stands in for |
| **5. Dead code** | Every export, store action, class in the stylesheet and comment that names code | 16 exports and 6 store actions nothing called, 20 classes for screens that are gone, a dozen comments about what is gone, 2 stray files; Erase all data left two databases behind | All removed; an erase deletes all three databases | The test seams, and five rules the tests name - kept on purpose |
| **Found on the way** | The eight defects the rotating-shifts audit had left, each traced in the code | All eight still true; the owner's own reading plan one palette command away for every visitor | All eight, each with a test that failed first; the reading plan is out of the app | Its titles, and the older file path, stay in the repo's history: taking them out needs a force push, which is the owner's call (OPEN-QUESTIONS) |
| **6. Documents** | STATE, ARCHITECTURE, CONVENTIONS and DECISIONS against the code and each other; BACKLOG item by item | 262 findings, and 97 names or files the four pointed at that the repo no longer has | All: STATE split into STATE and HISTORY, the other three corrected, BACKLOG sorted | - |
| **7. Deploy** | Each point as its own commit, pushed, the deploy watched | - | - | - |

**After the seven, the same day: the owner's sync report.** The computer
set up and backed up, the phone switched on - and the phone joined the
computer's plan to its own instead of taking it. Two causes, both fixed with
tests that failed first: a device that had joined once never asked again,
so sync switched back on merged whatever it held without a word; and a
device whose plan is the right one had no answer that kept it when the
shared copy already held another - Take lost it and Merge kept both. Sync
turned on again now asks again, and the question has a third answer, Keep
this one, asked twice. And Settings says what the owner could not have
known: a backup alone does not join the other device (DECISIONS "Sync
turned on again asks again, and the right plan can be kept").

---

## 1. What Dienius is

A day planner for a brain that needs the plan to be visible or it stops
existing. It is two things at once, and both matter to how decisions get made:

1. **A tool one person uses every day.** Every feature has to survive a real
   bad Tuesday, not a demo.
2. **A public portfolio piece.** github.com/Quicasha/dienius, deployed at
   quicasha.github.io/dienius. Everything is public: the code, the commit
   messages, the docs. It has to read as a professional codebase, and nothing
   anywhere may look machine-generated. Nothing of the owner's own may go in
   it: examples and tests are generic, and `npm run privacy` guards it.

The whole philosophy - why no streaks, why the push bound stops at two, why
nothing about a day is scored as a verdict - is in
[`DECISIONS.md`](DECISIONS.md) and [`RESEARCH-ADHD.md`](RESEARCH-ADHD.md). Do
not re-litigate those without reading them.

## 2. Every feature, one line each

The app as it is at v2.40, with one look done and the freeze preparation
applied. The rail has seven places - Today, Calendar, Templates, Library,
Review, North, Kitchen - and Settings after them; the header carries the
timer, Notes, the journal and Search on every page.

### Today

| Feature | What it is |
|---|---|
| Quick-add | Three parts on one line: a time control, the field, a length control. Both controls open holding an answer, so a title and Enter is a placed, sized task; a time typed at the start or a length at the end is read out of the words and shown before Enter |
| Capture | The same field writes to the day or to Later, chosen by a toggle; Later asks for no time |
| Categories | Six to start, then the person's own: renamed, recoloured, reordered, or deleted with their tasks moved, in Settings; made or renamed from the swatch row; picked before typing; the same colour on the card and on the timeline block |
| Timeline grid | Anchored tasks at their real time and size, free gaps as labelled regions, a line at now. Drag moves a block, its bottom edge resizes it, dropping it on the list un-anchors it. A free gap pressed offers the untimed tasks that fit; an untimed task pressed offers it the gaps. Another calendar is an outlined layer, sleep a grey band, and a night shift from the date before runs on into the morning after. On a phone it folds behind Show timeline |
| Capacity | What is anchored, how much is free across how many gaps, what the untimed still need, and that sleep is not counted as free: one sentence under the day on a phone, the rail's card on a desktop |
| Key tasks and the score | Up to three key tasks a day. Done over planned, no percentage, no streak, nothing on a day with no plan |
| Day types and Core | A Shift, Overnight or Rest day (a template's day type, or a week column's) counts only its blocks marked Core, so it is not scored like an ordinary Tuesday |
| Push twice, then decide | An unfinished task moves to tomorrow twice; after that, do it today, let it go, or mark it ongoing |
| Blocks that end by themselves | An ongoing block, or one of a category that ends by itself (the commute), is done once its end has passed, unless it is marked as not having happened |
| Yesterday's line | What yesterday left, said once, moved forward in one press - never on its own |
| Replan | Something came up, for today or any of the six days after it (the phone call answered in three presses); Shift the rest; Away and Back. A one-off in the way waits under the day as Set aside until Bring back, and is gone after midnight. One undo |
| Low day | The key tasks at 40% of their length, the routine kept, the rest to tomorrow, and the day scored on its key tasks alone |
| Task menu | The dots on a card or a long press: Details, Time this, a free gap to place it in, Remove time, Push to tomorrow, Mark as ongoing, did not happen, Delete (Let go at the bound). A right click has the short list; a double click opens the detail |
| Task detail | Everything the card does not show: the exact minute, the length, the category, the key mark, the repeat (this one or the series), the library item it draws from or a meal's recipes, the note it was made from, a link, and the note. A panel on a desktop, a sheet on a phone |
| A note as choices | A line starting `## ` begins a section; its heading becomes a choice on the card, read over the day. No other markdown |
| Meals | A meal's card names its recipe, or its kind of meal, and opens it in Kitchen |
| Focus | One task, its own planned time, a ring, a way out; a bar over every page while it runs |
| Timer and stopwatch | In the header. Survive a refresh, keep time in a background tab, run in a corner on every page, ring Soft, Bell or Alarm (or nothing) at a volume, with a start bell if asked for; a stopwatch started from a task's Time this offers to record what it actually took |
| North on the day | One line of North's text under the day's title, the signature under it from 21:00; North's headings one line each - in the rail on a desktop, folded under the title on a phone - each opening a card of its lines (both off in Settings, Nudges) |
| North after sleep | North's window over the day, once, after a break long enough to be a night |
| Close the day | A quiet card at a set time, or once the last task is ticked: one sentence about the day, Close the day, and the push offered. Never a word about what was not done |
| Notes and the journal | The header's Notes (a line kept in one press; Open notes is Scratch - one stream, photographs in a note, a note made into a task, sent to Later or pinned) and Journal (a line or more a day, never counted; the whole of it on its own page with a month and a search, copied as markdown) |
| Sleep | Named schedules in Settings; a template, and once there are two a single day, says which it follows. The timeline greys those hours, free time is counted around them, and the header says when sleep is near |
| The day's rail | On a desktop, beside the day: a month to move by, the templates as chips that stamp the open day, North's headings, Up next, and the day's figures; the header chooses which panes show |
| First day | An empty first day offers the tour, a sample week, and three starter templates that plan the day in one press; Templates offers the same three while it has none |

### The other places

| Place | What it is |
|---|---|
| **Calendar → Month** | A month that fits without scrolling: each day's first lines (its template's name where it has none) and its kind's letter, a past day's ratio and marks. A pointer resting on a day shows what is on it; a press opens its card - tasks to tick, Open day, Notes, Journal, Something came up, Clear this day. The Stamp bar lays a template on dates by clicking or dragging. With kinds of day, the **roster**: a tap walks a date through the kinds, a cycle fills the rest of the month, and Apply says what it will do before it does it; nothing reaches the plan until then |
| **Calendar → Week** | Seven columns of one timeline: blocks dragged between days, a press on an empty column adds a task there, a stamp or Clear this day per column and Stamp week for the whole; Later under the columns, dragged onto a day; or the week as an agenda. Three days at a time on a phone |
| **Templates** | Day templates and week templates, each drawn as the day or the week it makes - a day template's blocks dragged and resized on its picture - and laid on dates from the Month's Stamp bar, a week column or the day's rail. A day template can be a **kind of day**: a letter for the roster, and the kind it becomes on a date after a night. Any template has a day type and a sleep schedule. **Routines** - a length, their weekdays and a time on each kind of day - land on every date of a kind on those weekdays, untimed with a reason where the kind has no time for them. A block can end after midnight, on the next date |
| **Library** | Lists worked through a unit at a time - pages, chapters, episodes, films, lessons - with a card for the item you are on, a pace note, an author, and a whole shelf pasted at once. An item goes onto today or tomorrow in one press, or onto a day template as a block bound to its list, which draws its next item; finishing one offers the next |
| **Review** | Week and month facts from the days themselves: done over planned, deep work, key tasks, what was read and watched, where the plan and the week disagreed, how many times each repeating block happened, and the journal copied as markdown. No streak |
| **North** | One text on its own page: the introduction on a plate, every heading on a card with its lines open - a heading tagged [morning] or [evening] lends its lines to that part of the day - and a signature after a line of `---`. Written with Write or Edit, or put in whole with Replace text, which says what it found first |
| **Kitchen** | Recipes by meal and by search, one to a card; a recipe's page reads its INGREDIENTS and STEPS and puts it on a template's meal; Paste many saves many at once; Select gives one meal to several recipes, or takes it off. A meal block takes recipes a date at a time, follows every recipe of its meal, or waits for a recipe by name until Kitchen has it |
| **Settings** | General (export and import, a plan that could not be read, install, snapshots, shortcuts, the tour, erase), Sleep, Week, Templates as JSON, Categories, Kitchen (the words a recipe's name starts with), Nudges, Calendars, Backup, Sync, Appearance |

### Across the app

| Feature | What it is |
|---|---|
| Weekday templates | A template per weekday, so a new day opens already set up. A stamp by hand always wins |
| Repeating tasks | Daily, weekdays or weekly, materialised as real tasks |
| Later | Things to do on no particular day, one list; one press puts one on the day at the next free slot |
| Links | One address on a task or a library item - or, for a library item in Chrome and Edge, a file on this computer picked once, which can carry the same file's address for the phone - opened from a small door beside it |
| Templates as JSON | Templates, routines and a roster written somewhere else and read in with a preview first, or written out the same way; a reading block names its Library list, and one not there yet waits for it; pasted again, today and the dates ahead follow it, the past stays as it was lived and today is cut at now - docs/TEMPLATE-JSON.md |
| Search | The header's Search, or Ctrl-K: one box for the app's commands and for things - tasks and their notes, library items, Scratch notes, recipes - and a date typed to jump to it |
| Keyboard | Single keys for the common actions, a card behind `?`; every page and sheet passes on a keyboard alone |
| Words explained | Every word the app invents - Stamp, Low day, a key task, a kind of day - explains itself in a bubble on a rest or a hold |
| Undo | One app-wide offer, five seconds, for the expensive mistakes |
| Snapshots | A copy of the plan once a day on the device, seven kept, restorable from Settings |
| Export and import | Plain JSON both ways, by hand - docs/BACKUP-FORMAT.md |
| A plan that could not be read | Kept aside, as it was, before anything is saved over it; a line over every page says so, and Settings saves it as a file |
| Backup to GitHub | The plan as JSON in the owner's private repo, written when a day closes, when a new one opens and on Back up now; Restore from cloud compares both copies, then brings back what is missing or replaces everything; the token stays on the device |
| Archive | Beside the backup, in the same repo: a file for every lived day - its kind, blocks, what was ticked and when, meals with recipe and numbers, notes, the score - and the whole plan once a week, never written over; "Archived until" in Settings, Backup - docs/ARCHIVE-FORMAT.md |
| Sync | Optional, between devices, through GitHub or a server of your own; per entity, the later write wins, a delete is kept; a device joining with a plan of its own - or turning sync on again - chooses Take from GitHub, Keep this one or Merge first, and a line over every page says when sync fails or waits - docs/SYNC.md |
| External calendars | An imported .ics file, or a subscribed address fetched through a sync server of your own, drawn as a read-only layer on Today and the week; free time counts their timed events |
| Screens that fail alone | A page, a sheet the shell opens, or a panel of the header that cannot draw says so in its own place, and everything else goes on; a sheet a page opens itself fails with its page |
| Offline and updates | Installs as an app, opens and works with no network, and the next open after a deploy is the new version |
| Demo and tour | `?demo=1`, or a sample week on an empty first day, is a sample fortnight under its own key, thrown away on leaving; the tour is nine real actions on the person's own plan the first time, and replayed from Settings in a sandbox |
| Themes | Dark, Light and Midnight, or following the device; an accent, a density and a text size; body, secondary and danger text held to 4.5:1 and the accent to 3:1 by a test |
| Erase | Everything on this device - every key, the snapshots, the photographs, the picked files - and nothing on GitHub |

---

## 3. Version history

One line each, newest first. [`HISTORY.md`](HISTORY.md) has every version
in full, as it was written when it was done. Tags exist for v1.0 to v2.13;
after that a version is found by its number in the commit messages
(`git log --grep=v2.29`).

| Version | What it was |
|---|---|
| **The freeze preparation** | 2026-09-23 to 2026-09-28: every backup format since v2.20 proven, screens that fail alone, the phone with no network and a deploy that takes over, Lighthouse and the keyboard, dead code out, these documents |
| **One look** | Eight stages, done 2026-09-23: the whole app made one - on a desktop no page scrolls, a row stays a row, nothing is stretched, one left line, one height in a row |
| **v2.43** | An archive of every lived day, beside the backup |
| **v2.42** | A templates file pasted again brings today and the dates ahead along |
| **v2.41** | A reading block names its list in the templates file |
| **v2.40** | A kind after a night: a kind of day names the kind it is after a night |
| **v2.39** | A whole shelf pasted into the Library at once, and North replaced at once |
| **v2.38** | A kind put on a date by hand holds that kind only |
| **v2.37** | Routines in the templates file |
| **v2.36** | The words a meal's name opens with, the recipes a block waits for, and an erase that takes this device's keys |
| **v2.35** | Blocks that end by themselves |
| **v2.34** | An older copy is never written over a newer one: sync diagnosed and fixed ([`SYNC-AUDIT.md`](SYNC-AUDIT.md), [`SYNC.md`](SYNC.md)) |
| **v2.33** | Templates and a roster as JSON ([`TEMPLATE-JSON.md`](TEMPLATE-JSON.md)) |
| **v2.32** | Kitchen: many recipes at once |
| **v2.31** | The night's own hours, and the days after a change; the first real month walked as a dry run |
| **v2.30** | Kitchen as it was meant: Cook went, a name alone is a recipe |
| **v2.29** | Rotating shifts: kinds of day, the roster, routines |
| **v2.28** | North is one text; goals and their rules retired |
| **v2.27** | Kitchen |
| **v2.26** | North that holds the eye |
| **v2.25** | The design pass |
| **v2.24** | North as one page, a window after sleep, and the day's timeline |
| **v2.23** | Three small things, and a count instead of a streak |
| **v2.22** | The quality wave: the pictures, North as a text, the rest |
| **v2.21** | Eight reports in one day, and what they had in common |
| **v2.20** | The night pass |
| **v2.19** | The reading page stops naming its own fields |
| **v2.18** | The layout wave |
| **v2.17** | The hunt before the first real week |
| **v2.16** | Books into the Library without a martyrdom |
| **v2.15** | What the timer sounds like, and what things actually took |
| **v2.14** | What the app knew and did not say |
| **v2.13** | One place text goes: a block's steps became lines of its note |
| **v2.12** | The night before a real week: seven day switches, the key mark on a block, the privacy guard |
| **v2.11** | A template block carries a note onto every day it stamps |
| **v2.10** | A bug hunt on a keyboard alone, and nothing added |
| **v2.9** | An arrow, a question, and what a picker was pretending to know |
| **v2.8** | The calendar's day card, the focus screen, and a time chosen against the day |
| **v2.7** | The last wave before the app was lived in: the Inbox and the Backlog became Later, the Year view and the streak went |
| **v2.6** | The desktop: information appears once, and nothing moves on hover |
| **v2.5** | Notes with pictures, the day set aside, the template's picture, every setting walked |
| **v2.4** | The polish wave, and a low day |
| **v2.3** | The journal |
| **v2.2** | Replan: something came up, for any day of the week |
| **v2.1** | North as a page, and the phone measured |
| **v2.0** | The desktop closed as a product; categories the owner names, the rail, a calendar that says what is on a day |
| **v1.11** | Screenshots from the demo under a pinned clock, seven more browser walks, calendar time zones |
| **v1.10** | The tour's standing rules, the store split by area, the first browser tests |
| **v1.9** | Quick-add as three controls, the Library's lists, the evening close |
| **v1.8** | Replan, Scratch, the quick-add time picker |
| **v1.7** | The interactive tour |
| **v1.6** | The week view, external calendars, the demo |
| **v1.5** | Sync between devices |
| **v1.4** | North, the calendar's day marks |
| **v1.3** | Repeats, Review, the command palette, snapshots and undo |
| **v1.2** | Installable and offline, touch, the keyboard, a real test suite |
| **v1.1** | The Library, the task detail, sleep schedules |
| **v1.0** | Templates, stamping, the day view, the timeline grid, categories, the capacity line, the push bound, themes |

---

## 4. Open work

### Nothing is half-built

Checked, not assumed, at the end of the freeze preparation (2026-09-24):
**3584 unit tests in 239 files** (and 8 skipped on purpose: a backup from
before v2.29 is the same file back only after one import, not at once -
`lib/backupVersions.test.ts`), **147 browser tests** on a desktop and a
phone (16 more skip on purpose, where a walk has nothing to say on one of
the two), a clean typecheck and build, and every measuring pass at zero -
the sweep at four desktop sizes and on the phone, the keyboard walk over 39
screens, the precision pass, the three text sizes, and the privacy guard.
Nothing is started and left.

### The gates

CONVENTIONS section 10 lists them and says how to run them: one after
another, never two at once, because the browser ones build or serve `dist`
and two at a time measure each other. Their exit codes are not the verdict
for the measuring passes - `sweep`, `keys`, `precision` and `textscale`
print their findings and the last line says how many; read it. A run that
dies with `ERR_NETWORK_IO_SUSPENDED` is the machine going to sleep under
it, not a finding: run that one again.

### What only the owner can do

[`CHECKS-BY-HAND.md`](CHECKS-BY-HAND.md) is the list, each step with the
sentence the app should say beside it. None of it can be done from here:

- **A1** - sync against the real GitHub, both ways, on the two real
  devices, with the owner's own token.
- **B1** - every drag, the resize, the long-press menu and the calendar's
  paint across dates, by a finger on a real iPhone.
- **B2** - a book's file on the computer and the same book on the phone.
- **B3** - the phone with no network, and a deploy taking over, on the
  iPhone itself (the freeze's point 3 proved both in a browser).

### Asked for, not yet built

Parked in [`BACKLOG.md`](BACKLOG.md), with who asked, why it waits and
what it would take. From 2026-09-28 anything new asked for goes there, and
stays there while the freeze holds.

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

Every one of these was looked at again in v2.0, and again before the
freeze, and left. None is an oversight; each is a trade with a reason,
written here so nobody has to guess whether it was noticed.

| Debt | Why it stays |
|---|---|
| **Week blocks are small targets** | A 20-minute block at a week's scale is ~20px tall, because its height *is* its duration - that is the whole of what the week view says. Raising it to 44px would make a twenty-minute thing look like an hour, which is a lie about the day in exchange for an easier tap; the block opens the same task the day view does, at a size that fits. `min-height: 20px` on coarse pointers is the compromise |
| **`timelineLayout.ts` at ~1,250 lines** | Dense geometry, and splitting it would put the two coordinate systems in different files, which is exactly where a bug would hide. Well tested, and it opens with a map - the two systems, the three windows, the invariants, and which function decides what - so the next person starts from the map rather than the middle. Kept whole on purpose |
| **Sync has no conflict UI** | Last-write-wins per entity, silently. For one person with two devices a real conflict means editing the same task on both within a few seconds, and "the later edit wins" is both correct and what anybody would expect; a dialog for it would be a question with no good answer, asked on the rare day when somebody is already busy. It would be wrong for two people, and this is not for two people |
| **Imported .ics calendars are device-local** | A file has no address to refresh from, so there is nothing to sync *to* - carrying the parsed events would make one device's stale copy authoritative on another. Subscriptions, which do have an address, sync. Stated in the UI where it matters |
| **A week template's block cannot be retimed in place** | Its time, title, length and category are written once and changed by removing it and adding it again; an open block changes its note, its Key and Core marks, its recipes and its list, and is dragged to another day. A time, a length and a category behind each block would be a form per block on the smallest surface in the app, or a sheet over a seven-column grid that hides the thing being edited. The add row already holds every answer before the block exists, which is where the app puts that question everywhere else. DAILY.md says so up front, because it makes the order matter. Revisit if the owner hits it |
| **The month's cells drop their ratio at 800px of height or less** | The zero-scroll rule says the month fits, and something has to give when it cannot. Detail goes, never cell height: a 30px row is not a calendar. The shape of the month survives, which is what the grid is for |

---

## 5. Phone checklist

The owner's phone is an iPhone. Since 2026-09-15 the computer is the main
device and the phone is for being out: both have to work, and a choice that
trades one for the other goes the computer's way. What used to be walked by
hand at 390x844 before a wave was called done is measured by the gates now,
on every run:

- **Every screen at 390x844, in both themes, on a full day** - `npm run
  sweep -- --phone`: text that does not fit its box, a control with
  something over it, text painted over text, anything past an edge, a page
  that scrolls sideways, every string's contrast against what is painted
  under it, and every control 44px on a finger or carrying a 44px hit area.
  One is allowed under it and nothing else (`SMALL_ON_PURPOSE` in
  `scripts/sweep.mjs`): a week's block, whose height is its length (the
  first of the known debts above).
- **Centring, rhythm and one left line at 375x812** - `npm run precision`.
- **Three text sizes at 390x844** - `npm run textscale`.
- **What a phone does, walked in a real browser at the size of an iPhone
  13** - the `phone` project in `playwright.config.ts`: the tour in the
  phone's words, the phone call answered in three presses, the journal,
  North, Kitchen, the templates file, the rota and its nights, a pasted
  shelf, and the app with no network and after a deploy.

What is left to a hand is what only a finger and the real phone can say:
[`CHECKS-BY-HAND.md`](CHECKS-BY-HAND.md) B1 and B3 (section 4).

**When a change touches the phone**, look at it at 390x844 once more
before the gates, in the browser pane: the gates find what is broken, not
what reads badly. `--shots=<dir>` on the sweep leaves a picture of every
screen it measured, which is the quickest way to look at all of them.

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
- **Line endings.** The repo stores LF; a Windows checkout with
  `core.autocrlf` writes CRLF, except the backup fixtures, which are LF
  everywhere (`.gitattributes`). A script doing string replacement has to
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
- **`.chip` is the choice pill** - the quiet fill and the text's ink, one
  control tall. A category's colour is `.category-swatch` with `--cat`; do
  not borrow one for the other.
- **A popover needs a positioned ancestor.** `.time-picker-panel` is absolute
  at `top: calc(100% + 4px)`; dropped into the quick-add row without one,
  it measured itself against the whole task column.
- **An effect that both sets state and clears a timer will clear its own
  timer.** The tour showed a tick for ever because the effect that started the
  advance timer re-ran the moment it set `celebrating`, and its cleanup killed
  the timer it had just made. Two effects.
- **For one render after the tour advances, `celebrating` belongs to the
  old step and `step` is already the new one.** Any effect keyed on both
  has to check `before.step === index` first, or the new step's caption
  fires on the old step's tick - which is how a step's relocation once
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
  the mask `useScrollEdges` puts on `.task-pane .task-list` is the pattern.
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
  them**: Git for Windows' grep reads a CR before the line feed as part of
  the line ending, so it never matches one there. Count with
  `tr -cd '\r' < file | wc -c`. A session believed the tree was LF for an
  hour on that.
