# Where this project actually is

You are picking this up cold. This file is the handover: what exists, how it
got here, and what is still owed. Read it, then
[`CONVENTIONS.md`](CONVENTIONS.md) for how work is done here, then
[`ARCHITECTURE.md`](ARCHITECTURE.md) for where the code lives. Those three
should leave you able to start without re-reading the repo.

**Last updated:** the freeze preparation, the owner's seven points before Sunday 2026-09-28 (section below): points 1 to 3 are done - the app opens with no network on a phone and a deploy takes over with nothing pressed; every backup format since v2.20, each written by its own version's code, opens here, loses nothing and is a fixed point byte for byte; and a screen that cannot draw says so in its own place while every other screen goes on, a plan that cannot be read is kept and said, and none of the owner's six cases needs either. Before it one look is done - stage 8, one height in a row, closed it: the measure finds nothing on 111 screens and sizes, and the frame stands in one place per size; stage 7 before it, one left line - rows read the way the eye reads them, and a line under a title exactly under it; stage 6 before it, nothing stretched - one limit for a field and a joined line as wide as its parts; stage 5 before it, a row stays a row - every row that wrapped is a strip, a second row by design or one line that gives up its tail; stage 4 before it, it fits - on a desktop no page scrolls, every page is its head and a body that scrolls under it; v2.40 before it - a kind names the kind it is after a night, so the roster carries one letter for a rest day whichever shift came before it; v2.39 before it - a whole shelf pasted at once and North replaced at once, the last of the four-part brief; before it the night of 2026-09-23, docs/OVERNIGHT-2026-09-23.md: v2.38 is done - a kind put on a date by hand holds that kind only, and a date opened again holds each block once - and behind it the real templates file read where it lives, a week of its roster lived in the browser, and two devices on the real clock; v2.37 before it, routines in the templates file, part 3 of the owner's four-part brief; v2.36 before it, the starting map of meal words, the recipes a template block waits for and an erase that takes this device's keys with it; v2.35, blocks that end by themselves. Before it v2.34, an older copy is never written over a newer one: sync diagnosed path by path (docs/SYNC-AUDIT.md), fixed, and written down for the owner (docs/SYNC.md); v2.33, templates and a roster as JSON (docs/TEMPLATE-JSON.md), and Kitchen v2.32. One look's stage 3, one frame, is done too. v2.31, the night's own hours, is done, all four stages, with the first real month walked as a dry run. v2.29 rotating shifts is done, all ten stages, with an owner's pass on edges between stages 8 and 9. v2.30 (Kitchen as it was meant) is done, all six stages.

## The freeze preparation (2026-09-23 to 2026-09-28)

The owner's brief: from Sunday 2026-09-28 no new features, so everything
that is here has to be reliable, fast, and clear to another agent a month
later. Seven points, each with every gate green.

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
- **2. A screen fails, not the app: done.** Every page, sheet and panel of
  the header is in its own boundary (`src/ScreenBoundary.tsx`): what cannot
  draw says so in its own place - a page its name and a card (it could not
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

## v2.40 - A kind after a night

The owner's question of 2026-09-23: a free day after a night is not the free
day after a day shift, and a second letter on the roster is the thing to
get wrong.

- **`DayKindMark.afterNight`** (`lib/dayKinds.ts` `resolveAfterNight`,
  `lib/shiftDay.ts` `rosterApplied`): a kind names the kind it is on a date
  after a night; the roster carries one letter, and every door - the
  Roster's Apply and preview, the templates file (`afterNight` by letter,
  docs/TEMPLATE-JSON.md sections 2 and 5), a kind put on a date by hand -
  stamps the after-nights kind and says so ("Rest day after a night is After
  nights."). The date after a changed kind follows it both ways, never
  behind today.
- **The editor**: "After a night, this day is", a select of the other kinds,
  asked only of a kind.
- **Tests**: `afterNight.test.ts` (the rule, the roster, a hand, the way
  back, the past), `templateJsonAfterNight.test.ts`, `views/afterNight.test.tsx`
  (the three screens), `e2e/after-night.e2e.ts` on a desktop and a phone.
  DECISIONS "A kind names the kind it is after a night" and RESEARCH-SHIFTS
  2.6 have why, and what was rejected.

## v2.39 - A whole shelf pasted at once, and North replaced at once

The owner's four-part brief of 2026-09-22, part 4, and the last of it.

- **Library, Paste many** (`views/LibraryPasteMany.tsx`, `lib/libraryPaste.ts`,
  `actions.importLibrary`): one line a book, "A title - An author"; a line in
  capitals names the list the lines under it go into, and a list the
  library does not have is made; the lines before the first list line go
  into the list the screen is pointed at. Every row says its list, its
  author and whether it is new or writes over the book of that title; one
  Save writes them in order, and one undo takes them back. A book has an
  author now (`LibraryItem.author`), on its row and in its own fields.
- **North, Replace text** (`views/north/NorthReplace.tsx`): a whole text put
  in the place of the one here, with what it will make read as it is typed
  - how many headings, which are for the morning and the evening, an
  introduction, a signature - and one undo.
- **Tests**: `libraryPaste.test.ts`, `LibraryPasteMany.test.tsx`,
  `NorthReplace.test.tsx`, and `e2e/paste-many.e2e.ts` on a desktop and a
  phone. DECISIONS "A whole shelf pasted at once, and North replaced at
  once" has why.

## The night of 2026-09-23

The owner slept and asked for six stages, each committed on its own:
docs/OVERNIGHT-2026-09-23.md is the account - what was broken, what was
fixed, which tests were added, what is left with a recommendation, and ten
minutes of checking by hand for the morning. In short: v2.38 (stage 1);
`src/lib/ownersFile.test.ts`, the real templates file read where it lives and
skipped where it is not (stage 2, docs/OPEN-QUESTIONS.md has why);
`e2e/owners-week.e2e.ts`, the week walked on a desktop and a phone (stage
3); `syncTwoDevices.test.ts` on the real clock (stage 4); every gate from
zero on the final tree (stage 5); and this section (stage 6).

## v2.38 - A kind put on a date by hand

The owner's report of 2026-09-23: a free day by the roster, a shift put on
it by hand, and sometimes both days' blocks left on the date. Every hand
door was walked in `src/lib/handStamp.test.ts` - a free day made a shift and
a night, a shift and a night made free again, the roster over a hand stamp,
the same kind and the same ordinary template twice, an ordinary template
over a kind and a kind over one, what a hand wrote through every change -
and each rule broken on purpose to see its test go red. Two fixes:

- **An ordinary template over a kind takes the kind's routines with it**: the
  date is composed with no kind after the stamp, so the gym leaves rather
  than staying at the kind's time (`store/templates.ts`).
- **A date opened again holds each block and each routine once**
  (`onceEach` in `stamping.ts`, on every open in `ensureDay.ts`): two
  devices composing a date apart left every block twice, and the twins
  stayed until deleted by hand. The ticked twin is kept, else the moved one,
  else the first.
- `e2e/hand-stamp.e2e.ts` walks the rail's chip on a desktop and the month's
  stamp bar on a phone: a free day made a shift and made free again.
  DECISIONS "A kind put on a date by hand, and a date opened again".

## v2.37 - Routines in the templates file

The owner's four-part brief of 2026-09-22, part 3. docs/TEMPLATE-JSON.md
section 4 is the contract; DECISIONS "Routines in the templates file" has
why.

- **The file reads and writes routines**: a title (its key, matched the way a
  template's name is), a length - one number, or one for each kind of day -
  a category by name, a core mark, the weekdays written 1 to 7 with Monday
  first, and a time for each kind by its letter. The preview lists every
  routine new, updated, unchanged or skipped beside the templates and the
  dates; Apply is one step and one undo.
- **A routine may be a different length on each kind** (`Routine.kindMinutes`)
  and **may be core** (`Routine.core`), which is what a shift day counts.
  Both travel with the routine, so a day composed on any device gets the
  same task.
- **Tests**: the contract's example with two routines in it, imported with no
  notes and exported as itself; the reader's own tests (weekdays, a length
  per kind, an update by title, wrong fields, what is skipped); the day's
  composition for the length and the core mark.

## v2.36 - The words a name opens with, and the recipes a block waits for

The owner's four-part brief of 2026-09-22, part 2.

- **The map a new device starts with** (`lib/mealWords.ts`): Breakfast;
  Lunch, which is lunch and dinner; Pre-gym; After, dinner and post-gym;
  Pack, lunch and snack; Evening, a snack; Side, none - and Dinner, Post-gym
  and Snack after them for themselves. Read in Paste many and in New recipe,
  as before, and rewritten in Settings, Kitchen.
- **A block waits for a recipe by name** (`lib/waitingRecipes.ts`,
  `TemplateBlock.waitingRecipes`): a templates file that names a recipe
  Kitchen does not have keeps the name on the block, the preview says so, and
  the block takes the recipe as soon as one of that name is added - pasted
  many at once, written one at a time, or renamed into it. A day already
  stamped takes it the next time it is opened, as it takes any change to its
  template. An export names what is still waiting beside what was found.
- **An erase takes this device's keys with it** (`lib/eraseDevice.ts`) - the
  owner's report the same evening: erased on the computer, and the plan was
  back from GitHub a second later, because the sync switch and the token
  stayed behind. Every key the app wrote here goes now, by its `dienius:`
  prefix; what is on GitHub stays. DECISIONS "An erase takes this device's
  keys with it".
- **Tests**: the map in `mealWords`, `recipeImport`, Kitchen's paste and
  Settings' words; the waiting names in `templateJson.test.ts` and the
  Kitchen store's, and the kitchen-many walk; `eraseDevice.test.ts` and the
  erase in `e2e/data.e2e.ts`. DECISIONS "The words a name opens with, and
  the recipes a block waits for" has why.

## v2.35 - Blocks that end by themselves

The owner's four-part brief of 2026-09-22, part 1. An ongoing block - the
twelve-hour shift - and a Commute block are done once their end has passed,
quietly, and count as done in the day's score (`lib/selfEnding.ts`,
`actions.endSelfEndingBlocks`). Ticked by hand before its end it is done and
stays so; "did not happen", from the task's actions, is `Task.missed`: not
done, and the clock never changes it; unticking an ended block says the
same. Settings, Categories, a category's editor: "Ends by itself", on for
Commute until it is told otherwise (`Category.endsItself`). The app ends
what has ended on open, each minute, and straight after any write - held for
the page's first pull - over the last seven days. DECISIONS "A block that is
simply running ends by itself" has why.

- **Tests**: `selfEnding.test.ts` (the end passes; ticked early and kept;
  did not happen, never changed; yesterday's shift and last night's done
  the next morning; Commute by default and a category by Settings; no time
  or no length left alone; an ordinary block never; unticked after its end;
  a week back; the score; nothing written when nothing ended),
  `selfEndingScreens.test.tsx`, and `e2e/self-ending.e2e.ts` on the desktop
  and the phone. The smoke, data and tour walks now count the morning's
  commute in Done.

## v2.34 - An older copy is never written over a newer one

The owner's report of 2026-09-22: the phone sometimes wrote its old copy over
the desktop's. The wish with it: the desktop is the main device; a phone
joining through GitHub takes everything and writes nothing over it; after
that both push after every change and pull on every open, return and wake.
docs/SYNC-AUDIT.md is the diagnosis - ten paths, each with the test that
reproduced it before its fix - and docs/SYNC.md is how it works now and what
to do on seeing an old copy. DECISIONS "An older copy is never written over a
newer one" has why.

- **The route no longer forgets itself.** A device switched on through
  GitHub read as "a server of your own" after its first reload, and synced
  nothing from then on; `via` is read back with the rest.
- **The backup merges, one way.** Each write to `data/state.json` and the
  day's file is the merge of the file and this device, over the sha read,
  read and merged again on a refusal - never this device's whole plan over
  it. The merge goes to the file only. When the file held changes this
  device never saw and sync is off here, Backup and Sync say in red that the
  two plans do not see each other.
- **The first connection asks.** Nothing of its own: the shared plan is
  taken whole, stamping nothing. A plan of its own: Take from GitHub
  (recommended) or Merge, with both sides described, and nothing written
  until then. Devices that synced before are asked once.
- **Stamps from `lib/clock.ts`**: never behind any stamp this device has
  read, and on GitHub's clock, from the commit every write makes, where it
  differs by more than two seconds.
- **A day waits for the first pull.** On a page that has just loaded the
  store's own writes - a day stamping its template - wait for the first
  pull, at most five seconds, not at all offline.
- **Pushes**: three seconds after a change on a phone, eight on a computer;
  a round trip as the page is hidden; as it is closed, one write with
  `keepalive` over the version last read, where the plan fits; what is owed
  remembered and sent first on the next open.
- **Restore from cloud** offers Bring back what is missing first - a merge,
  nothing newer touched - and Replace everything second, armed, saying it
  replaces every device. Its note said the opposite of what happened.
- **Visible**: Settings, Sync shows the last pull and push, what waits to
  go and whether GitHub holds anything this device has not taken, and says
  "This device is behind GitHub. Press Pull." when it may be; a failed pull
  is said, never swallowed; while sync fails or waits for an answer, one
  line says so at the top of every screen.
- **A plan past a megabyte** is read in the Contents API's object form and
  raw, where the ordinary form is refused - which had read as a token
  GitHub would not take.
- **Tests**: `syncTwoDevices.test.ts` - two storages, the app loaded afresh
  for each open, the repo in memory with GitHub's lock, thirteen tests
  through every path; `clock.test.ts`; additions to `syncClient.test.ts`,
  `SyncSettings.test.tsx` and `BackupSettings.test.tsx`; `e2e/sync-github.e2e.ts`,
  a desktop and an iPhone-sized phone against one repo, the phone's tab
  closed straight after a change.
- **For the owner, once**: after this version each device that synced
  before asks which plan it keeps. On the desktop, Merge; on the phone, Take
  from GitHub.

## v2.33 - Templates and a roster as JSON

The owner's brief of 2026-09-22: templates and the rota written by another
agent, and pasted in by the owner. docs/TEMPLATE-JSON.md is the contract -
every field, whether it is needed, its bounds, and what happens when it is
missing or wrong, with one whole invented example: a day shift, a rest day, a
night shift with its meal and journey home after midnight, and six dates.
DECISIONS "Templates and a roster as JSON, by names" has why.

- **Import** - Settings, Templates as JSON (`TemplateJsonSettings`,
  `lib/templateJson.ts`): paste, Preview, Apply. The preview lists every
  template new, updated, unchanged or skipped, every date, and every note; a
  template of the same name is updated, never copied, and a block of the same
  title keeps its id and what the format does not carry. A recipe is named,
  and one Kitchen does not have is said, the block keeping its meal type. One
  wrong entry or field is left out with its note and stops nothing else. The
  roster goes through `rosterApplied`, the Roster's own Apply, neighbours and
  all. One commit, one undo.
- **Export** - the day templates and the roster from today on, one block to a
  line, the same text every time: exported, imported and exported again it is
  equal character for character, and the contract's example exports as
  itself (`templateJson.test.ts` reads it out of the document).
- **Tests**: the contract's example with no notes, the round trip into the
  same app and a fresh one, a recipe not found, a night's block landing on
  the next morning after the import, wrong fields left out with their notes,
  a letter already taken, the roster's skips, a text that cannot be read, an
  update keeping ids; the Settings section; e2e on a 375px phone and the
  desktop (`e2e/template-json.e2e.ts`). The sweep, keys, precision and
  text-size gates walk the section with a preview open.

**What the owner does:** give the other agent docs/TEMPLATE-JSON.md; paste
what it writes into Settings, Templates as JSON; Preview; Apply.

## v2.32 - Kitchen: many recipes at once

The owner's brief of 2026-09-22: about thirty recipes already written in
Kitchen's own shape - a line of numbers, INGREDIENTS, STEPS - and each one a
trip through New recipe. RESEARCH-KITCHEN.md section 7 is the design, and
DECISIONS "Many recipes at once, and a name that says its meals" the three
choices that look unusual. Done in one stage, with its tests, its docs and
both screens looked at.

- **Paste many**, beside New recipe (`PasteMany`, `lib/recipeImport.ts`). A
  line that starts `NAME:` begins a recipe, a line of `---` ends one; each
  piece is read the way New recipe reads one. Before the press, a list: each
  name, its kcal and protein, its meals, and New or Updates the one in
  Kitchen, with a box and the meals to change in each row. One Save; one
  undo. A name Kitchen has is written over and never copied - the store holds
  that too - and an update keeps the numbers its text does not say and every
  meal it has been given.
- **A name says its meals.** "Lunch: a bean bowl" is lunch by the words in
  Settings, Kitchen (`Settings.mealWords`, `lib/mealWords.ts`), which start as
  the six meals' own names; a word may say several meals or none. Read in
  Paste many and in New recipe, where a press on the meals after is kept.
- **Meals on a card, in place** (`MealsPicker`), and **Select**: cards picked,
  one meal given to all of them or taken off them in one press.
- **All Lunch and Follow Lunch** in a meal block's recipes: every Lunch recipe
  in one press, and a block that follows Lunch walks every Lunch recipe
  Kitchen has when a date is stamped, the ones added later too
  (`TemplateBlock.followMeal`). The stamp reads Kitchen now, so every stamping
  door hands it the recipes.
- **One look's shared Select**, found by Select's bar: every `select` is one
  control tall (36px, 44 on a finger), its line centred - it was 40 beside
  36px buttons in every row it stood in.
- **The backup**: `followMeal` on a block and `mealWords` in the settings,
  written into docs/BACKUP-FORMAT.md; `mealWords` is read past anything
  malformed rather than refused, and travels with the settings.
- **Tests**: the parting and naming of pieces, thirty generic recipes read and
  saved, a second paste that updates and never copies, the meal words and
  Settings' list, the form's name, the card's meals, Select, All and Follow, a
  block that follows through the stamp, the refresh and the guard; e2e on a
  375px phone and the desktop (`e2e/kitchen-many.e2e.ts`). The sweep, keys,
  precision and text-size gates walk Paste many, a card's meals and Select.

**What the owner does by hand, once:** Settings, Kitchen - write their own
first words and the meals each says (a word for two meals, a word that says
none). Then Kitchen, Paste many - paste the recipes, look down the list, Save.

## One look - the whole app made one (done, 2026-09-23)

The owner's brief after v2.31: seven rules for every screen and modal at
1920x1080 and on a 375x812 phone - one grid, one left line in a card, one
height in a row with one corner and five type sizes, nothing stretched, a row
that never wraps, screens that fit, one frame. DESIGN.md "One look, seven
rules" is the contract; `node scripts/sweep.mjs --unify` measures it and
docs/DESIGN-AUDIT.md holds the findings, screen by screen.

- **Stage 1 - the audit: done** (2b743e3). 1,088 findings on 103 screens and
  sizes; pictures in docs/screenshots/unify/before/.
- **Stage 2 - one grid, five sizes, one corner: done.** The tokens and every
  rule on them: no spacing written in pixels (`design.test.ts` holds it), no
  value off the scale drawn anywhere, one 8px corner, 11, 13, 16, 20 and 40.
  608 findings left, 12 screens closed. Three things moved with it: the rail's
  North headings are set at a single line's height so eight of them still fit
  a 1080p window; the journal on a phone is the bottom sheet the task opens in,
  since as a card its month's days were under a finger's 44px; a roster
  letter on a phone's month is the interface size, whole at every text size.
- **Between the stages, Kitchen v2.32** (above), a brief of its own that went
  first because features stop at the freeze. It brought one shared fix of
  this pass with it: every select one control tall. And one fix to stage 2: a
  task's three marks lost the pixel above and below that made them 17px, and
  on another system's face they were 15 - they are a line of the interface
  and a hairline now, one height everywhere.
- **Stage 3 - one frame: done.** Every page on the shell's whole width, its
  title at the frame's left edge and its action at the right, the same on
  every page at 1366, 1920 and on a 375px phone - `npm run precision` holds
  it now. Today's masthead runs across the rail's column and the rail begins
  under it, made a row shorter to keep eight North headings open on a 1080p
  window. The pages of two things stand them two abreast; Settings' rows and
  the forms keep a page's measure from the left edge; on a phone the day's
  and the month's arrows moved to the right of their names.
- **Stage 4 - it fits: done.** On a desktop no page scrolls: the shell is
  the window's height on every view (it was on Today and the week's grid
  only), `main` is a column, and every page is its head and a `.page-body`
  that scrolls inside its own box under it. Templates, Library, Kitchen,
  Settings, Review, North and the week's agenda have one; the two pastes'
  forms are their own. On a phone nothing changed but what the report
  counts as long by nature: the editor with its palette open, and the
  month with its roster. `e2e/one-look-fits.e2e.ts` walks every screen at
  1920x1080 and on a 375px phone, with something on each.
- **Stage 5 - a row stays a row: done.** Every row the measure found
  wrapping on a 375px phone or at 1920 is one of three things now, and the
  stylesheet's last section says which: a strip that scrolls sideways
  inside its own box (chips), a second row by design (a grid with a row
  for each part: the quick-add, the Library's add line, the calendar's
  bar, the review's nav, the editor's actions, a routine, the template's
  sleep, the editor's block row), or one line that gives up its tail (the
  task's meta line). The Today rail lists its templates as a column, and
  the palette is a grid. DECISIONS "A row stays a row" has the three
  shapes and why there is no exception list.
- **Stage 6 - nothing stretched: done.** One limit for a field, `--field-w`
  (24rem), on every field that reached a page's or a card's width at 1024
  and up - a template's name across 1500px, a block's words across 1350,
  the Library's forms, the searches, sync's fields, a routine's name, a
  recipe's name. A joined line is as wide as its parts, so its focus ring
  hugs it; the template's colour stands right after its name. The measure
  leaves out a field that is a narrow dialog's own line (the palette, a
  task's sheet, the replan), where the dialog is the limit.
- **Stage 7 - one left line: done.** The measure reads a row's start the
  way the eye does (DESIGN.md rule 2; DECISIONS "One left line, as the eye
  reads it"): 79 findings were mostly the measure counting a single row's
  parts as rows and a quiet word's reaching ground as its start. What was
  real: a list's "Used by" line two pixels past the name it stands under,
  and under the list's settings form whenever that was open - it is exactly
  under the name now, above the form; and a routine's row on a phone, three
  rows with its two presses alone on the last, is its name and presses on
  one row with what it is under them.
- **Stage 8 - one height in a row: done, and one look with it.** Every
  control in a row is one height: a book's steps and its grip, a list's
  head, the words' Delete, the focus bar's cross, a list's round "new list",
  a task sheet's title, the presses in a task's meta line, and on a phone
  the add and the edit beside a block's category dots (DECISIONS "One
  height in a row"). Planting a defect showed the rule 2 measure blind to a
  row made of one wide press and to what a reader is not told; with that
  fixed it found two more real things, both fixed - the phone's books 8px
  right of the one being read, and the week template's hours 6px in from
  the card's line. The sync walk now waits for its server to end before
  the next test starts one on the same port. The measure finds nothing on
  any of the 111 screens and sizes, and the title's frame compared by its
  centre line stands in one place per size.
- **Next:** freeze preparation, the owner's seven points, before Sunday
  2026-09-28.

## Pirmas realus menuo, dry run

The first real month, walked end to end in a browser on 2026-09-22 the way the
owner would do it, with generic data only: an empty app, two sleep schedules,
four kinds of day built in the template editor, two routines, a four-week rota
laid by the roster's cycle across a month's end and the night the clocks go
back, every kind of day looked at, one date changed, and the plan backed up and
brought back by file and by the copy on GitHub. The same walk on a 1920x1080
desktop and a 375x812 phone. What is worth keeping of it is in
`e2e/night-hours.e2e.ts` and the tests named below.

**The rota.** From Monday 5 October 2026, the cycle D D N N A R R R. Day shift:
breakfast 05:15, on shift 06:00 to 18:00, lunch 12:00, sleep Early (21:30 to
05:00). Night shift: dinner 19:00, on shift 21:00 to 07:00, the night meal at
01:00 and the drive home at 07:00 both on the next day, sleep Day sleep (08:00
to 15:00). After nights: dinner 18:00, sleep Day sleep. Rest day: breakfast,
lunch and dinner, the ordinary sleep. The gym on Monday, Wednesday and Friday -
18:30 on a day shift, 15:30 on a night, 16:00 after nights, 10:00 on a rest day
- and a language practice every day, with no time after nights.

### What worked

- **Everything was entered by hand in the app**, with no file and no code: the
  sleep schedules in Settings, the kinds and their blocks in the template
  editor (Next day pressed on the night's two blocks, and the line under the
  picture saying them), the routines with a time per kind.
- **The roster**: the cycle filled October from the 5th, the preview said week
  by week the letters and the one routine a week that needs a time, and Apply
  wrote the dates and the night of the 31st onto the 1st of November.
- **Every kind of day was what it should be.** The day shift's evening ended at
  its own early bedtime. The second night's morning had last night's shift at
  the top, the night meal inside it and the drive home, both marked "last
  night" with N. After nights slept 08:00 to 15:00 with the gym at 16:00, and
  the language practice said it needs a time. The night of 24 October ran
  through the clocks going back, and its hours were on the 25th.
- **The week** drew the kinds over its columns, each night's shift in the next
  column's first hours, the night's meal and drive home in it.
- **One date changed**: a rest day made after nights - the preview named it,
  Apply changed it and nothing around it, Undo put it back.
- **Backup by file**: exported (168 KB), everything erased, imported - every
  day, template and routine exactly as it was, only sync's own stamps written
  again, which an import is.
- **The copy on GitHub**, with GitHub's answers played in the browser:
  `data/state.json` was the plan byte for byte, and Restore from cloud brought
  all 57 days back into an emptied app.

### What got stuck, and was fixed at once

1. **November could not be carried on.** The cycle filled only to the end of
   the month it started in: on November it filled nothing, and a start moved
   into November began the pattern again at D on the 1st - which should have
   been N. It now fills to the end of the month on screen, keeping its place
   from the day it started, and opens on that day after a reload, so the next
   month is one press (RosterMode.test.tsx, the two tests on carrying on).
2. **Free time across a sleep.** On the morning after a night the grid offered
   "9h 30 min free" between the drive home and the afternoon's first routine,
   across the daytime sleep. Sleep is busy time in the grid's gaps now
   (timelineLayout.test.ts).
3. **Free time inside last night's shift** - "5h 30 min free" between the night
   meal and the drive home - found while building stage 3, fixed there.
4. **A template card said "· Early"**, a separator in front of nothing
   (TemplatesView.test.tsx).

### What the owner decides - no programming, only choices

1. **The first night of a run wakes from an ordinary night.** A kind's sleep is
   the sleep its date wakes from, and one Night shift kind with Day sleep says
   the first night's date slept 08:00 to 15:00 - after a day shift, whose
   evening then has no bedtime at all (in the dry run, the Tuesday before the
   first night showed 14h 20 min free). Make the first night a kind of its own
   - First night, its own letter, the ordinary sleep - and the cycle D D F N A
   R R R. From the second night on, a night wakes from the day sleep, as Night
   shift says.
2. **Colours.** A new template starts Blue; give each kind its own with the
   swatch beside its name, so a month reads at a glance.
3. **A routine's category** starts as the first one; choose Health for the gym.
4. **Day types.** A kind is a Full day until Shift, Overnight or Rest is chosen,
   and that decides what Review counts.

### What is still missing

Nothing stands between the owner and a real rota. What would make it smoother
is one thing: a kind whose sleep follows the kind before it, so one Night shift
would do for the first night and the rest. That is v2.40: a kind names the
kind it is after a night, so Night shift names a night-after-a-night kind
with the day sleep, and the roster is written `N N N`.

## v2.31 - the night's own hours, and the days after a change

The owner, once v2.29 was done: the gym is always its weekday at the time its
kind of day gives it, food the same, because on a night shift lunch is not
lunch, and all of it automatic - "the hardest part is that it has to take into
account which days come after". docs/RESEARCH-SHIFTS.md section 10 has the
review of every door and the design; DECISIONS "A night's hours land on the
morning after, and a kind reaches the dates around it" has why.

1. The design.
2. The data and composition.
3. The editor and the day.
4. A guide for another agent, and a contract for a program reading the backup.

### Stage 1 - the design: done

Section 10 of RESEARCH-SHIFTS: what already held (routines per kind through
every door, meals as each kind's blocks, tonight's sleep from tomorrow's kind,
last night's shift as this morning's busy time), and the two gaps - a night's
hours after midnight had nowhere to be written, and a date given a kind left
the days around it as they were.

### Stage 4 - a guide for another agent, and the backup's contract: done

- **docs/AGENT-GUIDE.md**: Dienius for another agent - what it is, where the
  plan is kept and which copy to read, the plan's shape, the rota in full
  (kinds, routines per kind, meals per kind, midnight, the night's own hours,
  the days around a date, how a rota reaches the dates, what is never done
  without the person, clock changes), reading one date, what a journal takes
  from it, the words the app uses, and the repository's rules.
- **docs/BACKUP-FORMAT.md**: the backup's contract - where and what, the seven
  things a reader can rely on, every field of the fifteen shapes a reader
  needs, the rules read out of the plan, and what each version added. v2.31's
  two fields are marked.
- **backupContract.test.ts** holds the contract to the code: the document names
  every field the guard knows, under its shape (`BACKUP_SHAPES` in
  validate.ts, each record's check carrying its field names); a backup recorded
  by the code at 24f5099, the last before v2.31 - four weeks of a rota, two
  routines, recipes, a reading block, a weekday map, a tick, a hand-written task
  and a journal line - imports and exports again byte for byte; and opening
  five weeks of it does exactly what opening them did then. Each of the four
  broken on purpose once, and caught.

### Stage 3 - the editor and the day: done

- **Next day** on a template block, beside Core, Key and Ongoing and on the add
  row - a plain toggle, as asked. A week made from a day template brings every
  block over as its own weekday's.
- **The picture** says the night's hours in the line under it ("After
  midnight: 01:00 Night meal, 07:00 Drive home") and leaves them out of the
  day's numbers, its overlaps and the hours the time field calls taken.
- **A phone's block row**: the four marks behind one word naming the ones that
  are on, on the line with Note and the cross, opening as a line of their own.
  Found by looking: Next day had pushed Note and the cross onto a third line.
- **The morning after**: "last night" and the night's letter on the task's
  row; the block in the night's colour on the grid. And a bug the pictures
  showed: the grid offered "5h 30 min free" inside last night's shift, between
  the night's meal and the drive home - last night's hours are busy time in
  the grid's gaps now.
- A walk on both screens, `e2e/night-hours.e2e.ts`; the sweep's and the
  precision check's morning after carries the night's meal, and both open a
  night shift's template. Every new rule broken on purpose once, and caught.

### Stage 2 - the data and composition: done

- **`TemplateBlock.afterMidnight` and `Task.nightOf`**, optional in the guard,
  carried by v2.28's frozen copy, kept by a backup byte for byte.
- **The stamp writes a night onto the date after** (`stampNight` in
  stamping.ts, behind every door): the night's tasks marked with the night,
  kept through the date after's own stamp, taken off with a change of the
  night's template, matched by block on a re-stamp so a tick survives, a task
  of the block pushed there by hand taken for the night's rather than doubled,
  key tasks shared with the date's three, a meal's recipe walking by the
  night's date - at the stamp and when the day is opened.
- **Busy time, hand edits and the readers find the night on the date after**:
  a routine on the morning after runs into the night's drive home; ticking the
  night meal is a hand edit of the night's date, not of the morning's; the
  block counts and the plan reading count a night's block on its night.
- **A kind reaches the dates around it** (`followNeighbours`): the day before
  and the two after are composed again whenever a date's kind changes - by the
  roster, a kind stamped by hand, an ordinary template stamped over a kind, or
  the weekday map - and only a routine's task still as its rule left it moves.
  Applying is composed date by date against the plan the dates before left, so
  a night is never written over.
- **The preview says it**: `rosterApplied` is the one function behind Apply
  and its preview; the preview names "the days next to these" that follow,
  and a day left alone takes its followers with it.
- **The weekday map opens the night first**: the date after a night the map is
  about to stamp gets its night whichever of the two is opened first.
- **A task carried to another date by hand loses the mark** - push, the
  evening's push, a move, a replan, a low day all go through `arrivingByHand`
  - and the evening's push no longer takes a date stamped with a night's
  template for one that will receive that night's task.
- Tests: nightHours, nightCompose and nightStore (43), the roster bar's line,
  and the property tests with nights in the generator - invariant 1 now says
  exactly what a date the roster was not asked about may take from its
  neighbours, 2 covers the dates that follow, and 8 is new: every night's task
  stands for a block after midnight of the template on the date before it, and
  each such block stands once. 200 runs each, green. Every new rule was broken
  on purpose once and a test failed for it.

## v2.30 - Kitchen, as it was meant

The owner used Kitchen and said what it had missed, between the fourth and the
fifth stage of rotating shifts, with the word to finish everything that is not
finished after it: a lot of recipes, sorted by meal; on cards like North's,
with a kitchen's character; no Cook button; recipes into a template's meal
block the way books go into a reading block; and numbers typed into a recipe's
text filling their fields, which can still be filled by hand. Six stages;
docs/RESEARCH-KITCHEN.md section 6 has every decision and why.

1. The design.
2. Cook goes, and a recipe needs only its name.
3. Numbers read from the text, one truth with the fields.
4. Kitchen on cards, by meal.
5. A meal block takes recipes from Kitchen, a day at a time, and Add to template.
6. The phone, the pictures and the last tests.

### Stage 1 - the design: done

RESEARCH-KITCHEN section 6, written from reading Kitchen's code, the Library's
add line and its Add to template, North's cards and the guard. The decisions
that shape the rest: the `cooked` field stays in the data and is shown by
nothing; an empty text is the empty string, which every guard back to v2.28
already takes; numbers are never read from inside the ingredients or the steps;
a recipe for two meals stands under both; several recipes on a block are walked
by the date, and the block's `recipeId` is written as the first of them so an
older device still stamps a meal.

### Stage 6 - the phone, the pictures and the last tests: done

- **The browser walk goes on into a template** (`e2e/kitchen.e2e.ts`): two
  recipes put into a template's dinner from their own pages, the block holding
  them in that order with the keys back on the button, and the two days stamped
  from it taking one recipe each. The first walk runs on the phone too, where it
  also checks the open field stays inside the screen; the stamping half is the
  wide layout's, since a phone stamps a template from the calendar. A walk that
  has not been made to fail is not a walk yet: a planted walk that always gave
  the first recipe failed the second test and nothing else.
- **Looked at on every screen**: the field open with sixteen recipes at 1366x768,
  1920x1080 and on a phone, in both themes, and Add to template with a new block
  in both. The sections stand side by side where there is width and one under
  another on a phone.
- The whole run, once more: 3116 unit tests, the build, 115 walks, the sweep on
  both screens, keys, precision, the three text sizes and the privacy guard.

### Stage 5 - a meal block takes recipes from Kitchen, and Add to template: done

- **`TemplateBlock.recipeIds`**: a meal block holds several recipes, optional in
  the guard and v2.28's frozen copy, carried whole by a backup. `recipeId` is
  written as the first of them, so a device on v2.29 still stamps a meal;
  `blockRecipeIds` reads a block either way, and `mealFields` is what every
  editor writes - recipes or a kind of meal, never both, the recipes first.
- **The walk** (`recipeForDate`): consecutive dates take consecutive recipes and
  round again, from the date alone - the same on every device, nothing stored, a
  skipped day moving it on. Stamping and a re-stamp give each date its own, and
  the echo remembers what the block gave that date.
- **`views/kitchen/RecipesField.tsx`** replaces the one select every meal was
  chosen with. Its line says what the meal holds ("Lentil soup and 2 more") and
  names itself for a screen reader; pressed, it is Kitchen in small: a search,
  the recipes in sections by meal (side by side on a wide screen, one under
  another on a phone, never boxed into a scroll of their own), a press to add or
  take out, the chosen ones numbered in the order the days take them with Take
  out on each, and the kinds of meal to leave to the day. Both template editors
  use it; the day's details use it for one recipe, which closes it, with no Done
  of its own beside the sheet's.
- **Add to template** on a recipe's page (`AddRecipeToTemplate.tsx`): a template,
  then one of its meal blocks to join - chips, with their radios kept for the
  arrow keys - or, on a day template, a new meal block named for the recipe's
  first meal at a time and a length. The page says where it went and the keys go
  back to the button. `addRecipeToTemplate` joins a recipe once.
- **A recipe deleted** leaves every walk it was in (`removeRecipe`), and its undo
  puts the recipe and the walks back.
- **The runs look at them**: the sweep, keys, precision and text size open Add
  to template and a meal block's recipes, and the sweep a day's meal choosing
  its recipe. Opening the template editor showed keys a climb that was not one:
  the template's picture of its day scrolls in its own box, and the browser
  brings a focused gap to the middle of it, so the next gap down stood higher on
  the screen. Two stops in one scrolling box are compared where they stand in it
  now; a climb planted inside the box was caught in both themes before the zero
  was believed.
- DAILY, ARCHITECTURE and DECISIONS say it. Looked at on a laptop, a phone and in
  the light theme, with sixteen generic recipes. A mutation pass broke twelve of
  the field's and the walk's rules and eleven failed a named test; the one that
  lived - a block keeping its kind of meal beside recipes - has its own test now.

New tests: `kitchenTemplates.test.ts` (the walk by date, `blockRecipeIds`,
`mealFields`, stamping and the echo, a day following its block's new list,
`recipeIds` through both guards and a backup, a deleted recipe leaving the
walks and its undo, and Add to template in the store), `RecipesField.test.tsx`
and `AddRecipeToTemplate.test.tsx`. Changed tests: the day's details and both
template editors choose through the recipes field where they chose in a select
(`MealOnDay.test.tsx`, `TemplatesView.test.tsx`, `WeekTemplateEditor.test.tsx`),
and the select's own test went with it.

### Stage 4 - Kitchen on cards, by meal: done

- **Sections by meal** (`recipeSections`): each meal with a recipe, in the app's
  order, with how many it has; a recipe for two meals under both; the recipes
  with no meal yet last under "No meal yet". A chip shows one meal's cards as one
  grid with no heading, since the chip says which; the search narrows every
  section, and a meal or a search with nothing says so in one line, as before.
- **A card** (`cardLines`): the name, how long and how many servings, the kcal
  and protein, and the first three ingredients on one line that ellipsises - a
  whole button that opens the recipe, and the focus comes back to it.
- **North's plate with a kitchen's mark**: the cards lie in a grid on the shelf's
  width (the page and half the reading width, four abreast on a laptop and a
  1080p screen, one to a row on a phone), carry North's small shadow and in a
  dark theme the light at their top, and take the Meals category's colour down
  their left edge with a breath of it in the ground. Under the pointer the ground
  deepens; the keyboard's halo is the ring. DESIGN counts them as the second
  exception to "nothing on the page casts a shadow".
- Looked at with a dozen more generic recipes at 1366x768, 1920x1080, on a phone
  and in the light theme.

New tests: `recipeSections` and `cardLines` in `kitchen.test.ts`; the sections
with their counts, a card's lines and the Meals colour in `KitchenView.test.tsx`.
Changed tests: the chips, the search and a meal to open on read cards in
sections where they read rows; opening a recipe presses the first of its two
cards; the Kitchen walk reads the cards under their sections.

### Stage 3 - numbers read from the text: done

- **`lib/recipeNumbers.ts`** reads kcal, protein, carbs and fat for a serving,
  servings and minutes where a number stands beside its word, after it or
  before it, with grams or a colon between, in English and in Lithuanian with
  and without its letters; a decimal comma is a decimal, and "1 h 30 min" and
  "1 val. 15 min" are minutes. Never from inside INGREDIENTS or STEPS, never
  from a word inside another ("carbonara", "fatty"), one number never read
  twice, and the first mention of each is the one read.
- **The form keeps text and fields one truth**: typing the numbers fills the
  fields and opens More; a field changed rewrites the number in the text, in
  the style it was written in (a comma stays a comma, hours stay hours); a field
  cleared takes the mention out with the comma it was listed with, and a line
  left empty goes. A field the text says nothing about is filled by hand, as
  before. The line under the field now says so.
- DAILY, ARCHITECTURE and CONVENTIONS 16 say it; a mutation pass broke eight of
  the reader's rules and each failed a named test.

New tests: `recipeNumbers.test.ts`, and three in `KitchenView.test.tsx` - the
fields filled from the text and saved, a field rewriting and clearing the text,
and a field filled by hand leaving the text alone.

### Stage 2 - Cook goes, and a recipe needs only its name: done

- **Cook is gone**, with what only it did: `CookMode`, the screen kept awake
  (`useWakeLock` and its tests), `markCooked`, the "Cooked 3 times" on a row
  and in a page's facts, Cook's styles, its picture in the sweep and its part of
  the Kitchen walk. A recipe's page has Edit, a secondary button now that it is
  the only action.
- **`cooked` stays in the data**: a backup and an older device carry it and
  both guards accept it; an edit keeps a count an older device wrote, and
  nothing shows it or writes it.
- **A name alone is a recipe.** Save waits for the name; the text is kept as
  the empty string, which the guard and v2.28's frozen copy both take, and the
  page says "Nothing written yet." where the method would begin.
- The demo and the sample day lost their counts; DAILY and ARCHITECTURE say
  what Kitchen is now.

New tests: a page with Edit and no Cook and no count, a recipe saved with only
its name, and an empty text through both guards. Changed tests: the row, the
page's facts and `factsLine` no longer say how often a recipe was cooked;
`cookedLabel`'s, `markCooked`'s and Cook's tests went with them; a recipe saved
with a name and no text is a recipe now, where it was refused; an edit keeps a
count an older device wrote rather than one Cook made; the Kitchen walk reads
the page instead of cooking.

## v2.29 - Rotating shifts

The owner's brief for rotating factory shifts: kinds of day with their own
shape and sleep, routines like the gym on fixed weekdays at a time that
follows the kind of day, a month's schedule entered in a few minutes by taps
or a cycle, a preview before it is applied, one rule for what crosses
midnight, daylight saving counted right, and a template's sleep seen and set on
its timeline. Correctness over speed: design and a test plan first. Ten
stages; docs/RESEARCH-SHIFTS.md is the design, and each stage changes it first
when the design has to change.

### Stage 1 - the audit, the design and the test plan: done

- **The audit** read every reader of day types, templates, week templates,
  sleep schedules, stamping, the weekday map, repeats and replan, and every
  place a time crosses midnight or a date is stepped. RESEARCH-SHIFTS section 1
  lists what exists, what was fixed, and what waits for its stage.
- **Fixed at once**, each with a test and its own commit: taking a template off a
  day wiped what was written on it and the rest of the day (`02412cd`); a task
  moved onto a day was dropped by a stamp of another template (`b777eff`);
  Review's month skipped the month after a short one (`bb845bb`); the cloud
  backup read the day of its last copy in UTC (`d14b517`).
- **The design**: a kind is a day template with a letter; the roster is the
  stamps; a routine is written once with a time per kind and never guesses one;
  a block belongs to the date it starts on and a sleep to the date it ends on;
  a block is on the wall clock and its real length is computed; conflicts
  against the kind's blocks, yesterday's continuation and both sleeps; Apply is
  one previewed, idempotent commit that asks about hand edits; only optional
  fields and new lists, so an older device still reads the plan.
- **The test plan**: a unit test per rule, seven property invariants over
  400-day stretches with fast-check, the switch nights of 2026 to 2028 and 29
  February 2028, a migration fixture compared day by day, a test that an older
  version's validation accepts every new field, and browser walks on both
  screens. DECISIONS: "Rotating shifts: a kind is a template, the roster is the
  stamps, and a sleep belongs to the day it wakes into".

New tests (with the fixes): stamping nothing keeps everything besides the
template, and a moved-in task stays through another stamp
(`stamping.test.ts`); a month back and forward is the month it started on
(`ReviewView.test.tsx`); a copy made just after midnight is today's
(`cloudBackup.test.ts`).

### Stage 2 - the data: done

- **Recorded first** (`7d38aed`), before any data was touched: a backup a
  person without shifts has - a week template with weekday overrides, a day
  template on the weekday map, a stamped day written on, a repeat, a block
  moved by hand - opened for a month with a range painted and a stamp erased,
  kept as a golden file every later stage is compared with day by day.
- **v2.28's validation, frozen** in `src/lib/fixtures/validate-v2.28.ts` with
  the two constants it read written in: the older device every new field has
  to get past. The test proves the copy can still say no - a task origin it
  does not know is refused - which is why a routine's task names its routine in
  a field of its own.
- **The fields**: `Template.dayKind` (a letter of one or two characters and a
  whole-number order), `AppData.routines` (a title, a length from a minute to
  twelve hours, weekdays each once and at least one, a clock time per kind),
  `Task.routineId` and `Task.fromRoutine` (what the rule gave: a time or
  none, and a length), and `DayPlan.routineSkips`. Validated, backfilled on
  load, synced (`routine:<id>` entities, merged and tombstoned per routine),
  counted in the restore's summary, carried out and back byte for byte.
- **A routine's task is known by its routine** (`routine:<id>`), so a day
  never holds two; `isRoutine` became `hasIdentity`, since a template's
  block, a repeat's instance and a routine's task are all things that come back
  on their own.
- **The helpers** (`dayKinds.ts`): a kind is a day template with a mark, the
  kinds in order with the name breaking a tie, a date's kind is its stamped
  kind template, and a tap walks to the next and round, never to none. And
  `cleanRoutine` with the store's four actions: mark or unmark a kind (a week
  template is never one), add, change and remove a routine - a routine with no
  title or no weekday is not written, and a change that would leave none
  changes nothing.

New tests: the golden month and the old backup's round trip
(`shiftsMigration.test.ts`); the guard for every new field, the file, v2.28's
validation accepting all of it and still refusing an unknown origin, a
routine's identity, routines as sync entities, a kind mark travelling with its
template, and the summary's Routines row (`shifts.data.test.ts`); kinds, the
tap's walk, a routine as it is kept, and the store's actions
(`dayKinds.test.ts`). Changed tests: `isRoutine` is `hasIdentity` in
`taskIdentity.test.ts`, and the goal readers' search counts the frozen
validation as the data layer's own (`goalsRetired.test.ts`).

### Stage 10 - the phone, the walks, the guide and the last tests: done

- **The walk** RESEARCH-SHIFTS section 8.4 asks for, in `e2e/shifts.e2e.ts`, on
  the desktop and on the phone - the phone project runs it now. Four kinds
  made on the Templates tab with their letters; a gym with a time on three of
  them and none on the fourth; a month filled by a cycle; the preview naming a
  routine that needs a time and one that runs into the shift; Apply; a day
  shift ticked by hand and then made a night in the roster, the preview naming
  it changed by hand, Apply, and Undo giving the day shift back tick and all.
  Then one in the morning after a night: the shift's last hours at the top of
  the day, and the night shift what is running. And the night the clocks go
  back: a night shift stamped on 24 October has seven real hours left at one in
  the morning, on the wall's six.
- **The phone**: every screen of the feature is measured on the phone by the
  sweep, keys and text scale, in both themes. The one thing it draws
  differently - its week keeps the waking axis - is stage 9's.
- **The guide**: DAILY.md has "Shifts, from a rota", and step 3 points a shift
  worker there instead of at the weekday map.
- The pictures of each screen, at 1366 and 390 in both themes, went to the
  owner and are not kept in the repo, as Kitchen's were not.

v2.29 is done. What it leaves: a running Focus session's bar squeezes a phone's
week (offered as its own task in stage 9); and RESEARCH-SHIFTS section 6.5,
a kind's template edited after dates were stamped, re-measures routines on the
dates ahead through the ordinary template refresh and has no walk of its own.

### Stage 9 - the day, the week and the month with kinds: done

- **The morning after a night shift** draws the shift's last hours at the top
  of the day's grid - "Night shift, from yesterday", "until 06:00" - and at the
  top of the next column in the week. Not a block of the day's: nothing to
  press, drag or tick. The drawn day, and the week's axis on a wide screen,
  open at midnight for it, and on a wide day fitted to one screen the band keeps
  a block's floor.
- **A kind is its letter** in the day's masthead chip and the week's column
  chip, where the dot stood, and right after the date in the month.
- **A routine with no time says why**, in the time's place on its row: "Needs a
  time on Day shift", "Runs into On shift", "Runs into sleep", "The clock skips
  03:30 that night".
- **The evening close** leaves a task still to come tonight, and one running
  now, off what it offers to push.
- **A phone's week keeps its waking axis** and draws what of a continuation
  that axis reaches; the day draws all of it. Opened at midnight, three columns
  fitted to a phone gave an hour nine pixels, and the phone's sweep found
  twenty-four blocks covered and two hour labels on each other. A floor of room
  per hour was tried first and made the ordinary week scroll on a small phone.
- The morning after a night shift was the first screen the precision pass saw
  yesterday's notice on, and its Dismiss stood its word 12px in from the
  notice's edge; it stands on it now.
- Found in passing, and left for its own task: a running Focus session's bar
  squeezes a phone's week to about a hundred pixels, where every block and hour
  label lands on the next. The sweep's two new screens clear a session an
  earlier screen left running, since they measure the morning after a night
  shift and nothing else.

New tests: `Continuation.test.tsx`, `RoutineNotes.test.tsx` and
`KindLetters.test.tsx`; the carried band in `timelineLayout.test.ts` and
`TimelineGrid.test.tsx` - the last on a full day fitted to a short window,
which is how the band was found missing in the first picture; the week's in
`weekLayout.test.ts` and `WeekView.test.tsx`; `stillAhead` in
`eveningClose.test.ts` and `EveningClose.test.tsx`. A mutation pass broke
twenty rules; four lived at first - a task later tonight with no length,
"Runs into sleep", the skipped clock, and a routine at its time given a note -
and each has its test now. Precision, sweep and text scale have the morning
after a night shift on the day and in the week. The new styles are drawn the
new way: the category's edge as a shadow inside the box, no pixel floor, and
the tight leading token - the design ratchet caught all three.

### Between stages 8 and 9 - every start corner on another: done

Three messages from the owner with pictures - the week editor's add form, the
empty pages seen as somebody new, and the Library's new list - and the rule
they share: every start corner stands on another. DECISIONS "Every start
corner lines up with another" has the why.

- **The week form's answers start on one edge**: the dots, the list (its label
  had no column width), the day switches, the presets and "Adds to Wed", which
  now shares the last line with Add a block. On a phone every answer is under
  its label. Every category picker stands its colours on its edge now - the
  day editor's, the routine form's, the task sheet's, a scratch note's - with
  the chosen one's ring outside it; the day's quick add, at the task pane's
  scroller edge, keeps the ring's inset, the one exception.
- **An empty page is framed as a full one**: Kitchen at the shelf's width with
  no recipes, North with a page's title and Write where Edit stands, the
  Library with New list at its title (Something else is gone), every empty
  line at the reading width, and every title row one control tall - the day's
  on a first visit and the calendar's were 4.5px and 4px off every other.
- **The new list's form takes the item panel's label column**, its sentences'
  fields to the right edge and its short form four letters wide.
- **A quiet button at a row's end stands its word on the edge**: the Library's
  Edit, every template's Edit, the Deletes of the template editor, the item
  panel and the task sheet, and the roster's Throw it away.

`npm run precision` has three checks more - a form's answers, a quiet word at
a row's end, and the frame across the pages empty and full (`--frame` runs it
alone) - and eight screens more; each was run against its defect put back and
caught it. The row check no longer counts an empty box, which has no centre:
six of the week grid's seven column feet are empty. Sweep, keys and text scale
have the new list's form, and keys and text scale the week editor. New tests:
North's Write where Edit stands and its title until there are words, the
Library's New list on an empty page, and the week form's sentence and button
on one line. Changed tests: five in `LibraryView.test.tsx` open the form by
New list rather than Something else.

### Stage 8 - a template's sleep, set where the template is built: done

- **The sleep is set over the picture that draws it.** The day template's
  timeline already drew the sleep its schedule brings; a row over it now holds
  the two edges, Bedtime and Wake time, and the band and the summary under the
  picture move the moment a time does - an hour earlier to bed is "Sleep 9h"
  before anything is saved.
- **It is the named schedule's**, which other templates may sleep on, so the row
  says who: "Also used by Working day and Slow Sunday." It is written to the
  schedule with the template on Save (`setSleepProfileWindow`), only when it
  changed, and Cancel leaves it as it was - the editor keeps its one rule that
  nothing is written until Save.
- A row over the picture rather than pickers on the band's own edges, as
  RESEARCH-SHIFTS section 7 first drew it: the band is a few pixels tall at an
  hour, a field hung on it would cover the blocks it is there to be seen against,
  and the row reads the way the rest of the editor does. The week editor keeps
  its per-column schedule select; the kinds are day templates.
- What crosses midnight was already drawn by section 3's rule since stage 4,
  "(next day)" and all, in this picture as in the day's.

New tests: three in `TemplatesView.test.tsx` - the two edges set and saved with
the picture following at once, Cancel leaving the schedule alone, and a shared
schedule naming who shares it. A mutation pass broke five rules; the one that
lived at first - the wake time written as the bedtime - has its own assertion
now. The suite waits fifteen seconds before it calls a test hung rather than
vitest's five: the heaviest interaction tests take two or three seconds alone,
and under the whole suite a different one crossed five on most runs.

### Stage 7 - preview, apply, change and undo: done

- **Apply says what it will do first** (`lib/rosterPreview.ts`), week by week:
  the letter each date would take, and under the week how many routines would
  land with no time, how many would run into a shift or sleep, and how many days
  were changed by hand. A date the roster would not change is counted and not
  listed, because a preview that lists thirty unchanged days hides the three
  that matter. It composes through `composeDay` with the same `kindOf` Apply
  uses, so what it promises is what Apply writes.
- **A day changed by hand is asked about, date by date** (section 6.3): "changed
  by hand: 1 done, 2 taken off" with Leave it beside it. A date left alone stays
  as it is and stays in the draft: a rota somebody typed in is not thrown away
  by a decision about one day.
- **Apply is one commit** (`actions.applyRoster`) over every date the draft holds,
  and a draft that changes nothing writes nothing at all, which is what makes
  applying the same month twice the same as applying it once. The way back is the
  app's own undo bar, and it puts the draft back with the days.
- **Every door that stamps a kind composes it** (section 6.2). The month's brush,
  the rail's chip and a week all go through `actions.stamp`, which sends kinds
  through `applyRoster` now - with the one thing a hand may do that a roster may
  not, reach a day that is over, since somebody is looking at that date while
  they press it - and the weekday map composes a mapped kind (`ensuredDay`) the
  first time a day is opened. A kind means the same day whichever door it came
  through, and taking a kind off takes its routines with it.
- **A routine whose rule changed offers the days ahead, once** (section 6.4):
  `followRoutines` makes every date from today on agree with the routines as they
  are now, and only where they still say what the rule said - an instance moved,
  renamed or ticked by hand keeps its change, and a date behind today is never
  touched. Nothing follows without the press, and the press has its own undo.

New tests: `lib/rosterPreview.test.ts` (the weeks and their letters, the past and
a dangling kind left out, an unchanged date counted, the two numbers a week
carries, and what was changed by hand), `lib/rosterApply.test.ts` (applying,
applying twice, the undo, the reach, every door, and the days ahead following a
routine that changed), three in `views/shifts/RosterMode.test.tsx` (the preview,
Leave it, and nothing to apply) and two in `RoutinesSection.test.tsx` (the offer,
and no offer where only a name changed). The precision pass caught the kind
column in the preview moving a few pixels from row to row, since a day is not
the same width in every week; it has a column of its own where there is room
for one. A mutation pass broke twelve rules;
one lived at first, applying the same month twice still writing, and the test
for it watches for the write itself now, since a write that changes nothing is
still a sync push.

### Stage 6 - the roster: the month, the taps, the cycle and a draft: done

- **A mode of the month** (`views/shifts/RosterBar.tsx` and the month's own
  cells), because a rota arrives as a month and is read as one. The bar carries
  the letters, the Clear tool and the cycle; the grid under it is the same grid.
  It is offered only once a template is a kind of day.
- **A tap walks the kinds** by their order and round again (`nextKind`); Clear
  is the other gesture, kept apart from the tap so neither can be the other by
  accident. A date behind today is drawn and never changed.
- **In the roster a cell is read as a rota**: the letter in the middle, the
  kind's name under it and the kind's colour on it, and none of the three lines
  of what is on the day - those are what the date will be made of once the draft
  is applied, and while a month is being laid out they are in the way of the one
  thing being decided.
- **The cycle** (`cycleDates`): the kinds pressed in the order they come round and
  a date to start on, filling to the end of that month in one press, keeping its
  place over today and writing nothing behind it. The last cycle used is offered
  again, because next month is usually this pattern moved on.
- **The draft is this device's** (`lib/rosterDraft.ts`, under `dienius:roster-draft`):
  read when the month opens, written on every tap, thrown away in one press, and
  never in `AppData`. A half-built month is not something to sync, back up or
  export, and a draft in the plan would be a second answer to what kind a date
  is. Everything under the key is read defensively: what does not read as a
  draft reads as no draft.
- **Nothing reaches the plan yet.** Apply and its preview are stage 7; the bar
  says how many days are waiting, and Throw it away is the other way out.
- **The runs walk it**: the sweep lays a few dates out and opens the cycle, and
  keys, precision and the text sizes mark a kind through a template and open the
  roster on the demo. Two things came back. The text sizes found the ratio of a
  past day cut under the letter at the largest size, which was the roster drawing
  what a cell in it does not say: how a day went goes with the lines. And keys
  found the month behind an open cycle "reachable only with a pointer", which
  was the walk itself: a date field is three fields to a browser and takes three
  Tabs, and the walk read the second as the ring closing and stopped there.
  Since v2.29 the same element twice in a row is a segment and the same element
  after others is the loop; a planted trap that always takes focus back is still
  caught.

New tests: `lib/rosterDraft.test.ts` (a draft kept on the device and not in the
plan, a draft that is not one, the cycle and its edges, the last cycle kept, and
what a date is after a draft), `views/shifts/RosterMode.test.tsx` (the roster
offered only where there is a kind, a tap walking and round again, a date behind
today, the Clear tool, a cycle that keeps its place over today and is offered
again, and a draft that outlives a reload and can be thrown away), and `monthEnd`
in `dates.test.ts`. A mutation pass over the draft, the cycle and the month
broke twelve rules; two lived at first - a template that is no longer a kind
read as one, and the last cycle not offered again - and each has its own test
now.

### Stage 5 - the routine editor, and what makes a template a kind: done

- **A day template is marked a kind of day by its letter**: one field in its
  editor, under the day type, kept in capitals as it is typed. The mark is the
  letter - typed, the template is a kind; emptied, it is an ordinary template
  again. It is written through `setDayKind` and after the template itself,
  since an ordinary update writes the template as it was read and would put the
  mark straight back. A kind takes its place at the end of the cycle when it is
  first marked; where kinds come in that cycle is arranged with the roster, in
  stage 6. The list draws the letter where the dot goes, in the template's own
  colour as a tint.
- **Routines** (`views/shifts/RoutinesSection.tsx`) stand under the templates on
  the same tab, because a routine is timed per kind of day and a kind of day is
  one of the templates above it. A name, a category, a length, the weekdays it
  is on, and a time for each kind. Save waits for a name and for one weekday,
  which is `cleanRoutine`'s own rule said on the button rather than found out
  by pressing it. A row says what a routine is in one line - "Mon, Wed, Fri, 60
  min, D 17:00, R needs a time" - and a kind left with no time says so, because
  the day it lands on will say the same and never borrow one.
- **Nothing is drawn until a kind exists.** The offer is made where a kind is
  made, in a day template's editor, and the section appears the moment one is.
- **A routine removed can be undone**: `removeRoutine` hands back its undo, the
  way `removeRecipe` does, through the app's one undo bar.
- Two words joined the vocabulary, "A kind of day" and "Routine", each placed on
  a real screen - which `Explain.test.tsx` checks.
- **DAILY says nothing about routines yet, on purpose.** Written today, a routine
  reaches no day until the roster stamps kinds on dates, which is stages 6 and 7;
  a guide that said otherwise would be wrong for two stages.

New tests: `views/shifts/RoutinesSection.test.tsx` (the section is not drawn
without a kind, a routine written once, Save waiting for a name and a day,
editing in the same form, the undo, and a time kept only for a kind) and five in
`TemplatesView.test.tsx` (the letter marks a template and comes off again, a
second kind after the first, a week template never asked, the routines appearing
once a kind exists, and the letter in the list). A mutation pass broke ten of the
editor's rules and each failed a named test.

### Stage 4 - midnight and daylight saving everywhere: done

A second audit - every place a time is written past midnight, every reader of
"now", every reader of a day's sleep, and `away` - and what it found, fixed.
docs/RESEARCH-SHIFTS.md section 4.5 lists it reader by reader.

- **A day's sleep has one resolver** (`sleepOn`). The day view, replan,
  quick-add, Later, the task sheet, the set-aside strip and the week all ask it,
  and a test reads the source to keep it that way; four of them had disagreed
  about a week template's column. A date nobody has opened reads the template
  its weekday will give it.
- **The evening ends at tomorrow's bedtime.** A sleep belongs to the date it
  ends on (`wakingDay.ts`), so the bedtime that closes a day is the next
  date's schedule's. The free-time figure counts to it, past midnight where it
  is; last night's shift still running takes its time from the morning; the
  grid greys the sleeps that fall on the day, so the hours after a night shift
  are not grey; "Sleep in" counts real minutes to the next bedtime; the day's
  sleep figure is the real length of the sleep it woke from; the grid's
  screen-reader sentence says the real bedtime; a template's sleep total is its
  schedule's sleep.
- **Clock text**: `formatClock` writes a time past midnight on the next day's
  clock, and every range ends with "(next day)" there - the week's blocks, the
  week template grid, a template's overlap line, a resize's drop label. 24:00 is
  only the end of a day: a drag to the bottom edge starts a block at 23:59, and
  so does replan's "from now" in a day's last minutes.
- **A resize of a block cut at midnight** changes its real length by the
  distance dragged. It used to set the end where the cut edge was dropped, so a
  grab and a small drag cut an eight-hour shift to two.
- **After midnight, last night's shift is running**: the header's running line
  and time left, the F key, the focus bar and the focus screen - on the
  session's own date's clock, so a session at 01:30 reads "4h 30 min left" and
  not a day and a half. On a wide screen the header says that time left itself,
  since today's grid does not draw last night's block yet (stage 9), and not a
  second time while the focus strip is saying it. It is busy time for
  quick-add's and Later's slot and a taken hour in the time pickers, and
  yesterday's banner neither counts it unfinished nor pushes it.
- **Away lasts past midnight, until the day wakes**: when today has none, the
  header, the menu, the palette and Back read last night's ("Away since 22:00
  yesterday"), and Back clears it where it was written. The first full e2e run
  caught the first version carrying it through the whole next day - the week
  soak went away on Wednesday and found no Away door on Thursday - so it ends
  at the end of the sleep the day wakes from.
- **Kept**: the time pickers' arrows wrap round the clock; grids are drawn on
  the wall clock.

New tests: the day between two sleeps and "Sleep in" across the clock change
(`wakingDay.test.ts`), what is true after midnight (`afterMidnight.test.ts`),
the one resolver (`sleepReaders.test.ts`), the day's arithmetic at night
(`capacity.nights.test.ts`), the header at night
(`DayHeader.night.test.tsx`), and new cases in the tests of the layout, the
template summary and timeline, the week, the drag, replan, Later, the focus
bar and yesterday's banner. Changed tests: four encoded the evening cut at
midnight and the old sleep rule - a daytime sleeper's free time in
`capacity.test.ts`, and three day views in `DayView.test.tsx`, two of which
now give the next date the same schedule so they still test what they were
written for; the week layout's per-day window test hands in the resolver; and
the test of a date's own sleep moved with `ownedSleep` to `wakingDay.test.ts`.

### Stage 3 - composition: done

- **The wall clock** (`wallClock.ts`): the instant a date's clock reads a
  time, whether a time happens at all that night, and a block's real minutes -
  540 for 22:00 plus eight hours on 24 October 2026, 420 on 28 March.
- **A date's composition** (`shiftDay.ts`), the one place a date is made of
  its kind: a sleep belongs to the date it ends on; a date's sleep is its own
  choice, then its kind's, then its template's, then the default; busy time is
  the kind's blocks, what still runs in from the two dates before, the sleep the
  date wakes from and the one its evening ends in, and what a late routine
  reaches past midnight; each routine goes at its kind's time, or with none and
  why - it needs a time, the clock skips that hour, or what it runs into.
  `composeDay` stamps a change of kind and never the same kind again, and brings
  routine tasks in line field by field where they are still as the rule left
  them; `applyRoster` lays a draft over the plan from today on and hands back
  the plan itself when nothing changes; `handEdits` counts what was done, moved
  and deleted by hand.
- **The echo grew a title and a category**, so a routine's task renamed by hand
  is known for what it is; stage 2's validation ignores keys it does not know.
- **Every door a routine's task leaves its date by writes a skip** - delete,
  clear, move, push, roll over, a replan's and a low day's "tomorrow" - and the
  task lands elsewhere without its echo, left where it was put.
- **fast-check** joined the dev dependencies: seven invariants over 400-day
  stretches from 2026 to 2028, with two rosters and hand edits between them -
  one kind per date and nothing else touched, no routine left by its rule in
  busy time, a second Apply returning the same plan object, export and import
  byte for byte, nothing duplicated, nothing written by hand lost, real minutes
  off by exactly sixty and only across a clock change. Twenty-five runs in the
  suite; three hundred were run once, all green.
- **Nothing on screen yet.** The editor, the roster and Apply are stages 5 to 7.

New tests: every rule of composition, the calendar's edges (29 February 2028,
31 December, the four clock-change nights of 2026 to 2028), and a mutation
pass: thirty-two deliberate breaks of the rules, each made to fail a named test
before this was called done (`shiftDay.test.ts`); the doors a routine's task
leaves by (`routineLeaves.test.ts`); the invariants
(`shiftDay.property.test.ts`). Changed test: the echo's validation cases in
`shifts.data.test.ts` gained the title and the category.

## v2.28 - North is one text

The owner's final North model, replacing every earlier North brief: goals
are retired, and North is one text in the three parts the shared parser
already reads - the picture before the first heading, the headings with
their lines, and the signature after `---`. Old goals are still read from a
file, and a plan whose text has no picture takes the active goals' titles
and whys as its picture, so nothing is lost. Every reader of goals is
replaced by the text or taken out, and the dead code with it. The page: a
small quiet North with Edit, the picture larger in the text's ink, headings
bold with their lines under them, the signature last after a large gap, about
640px and no frames, one field for all of it. The window after sleep shows
the picture and the signature. The day's top keeps its line from under the
headings; after 21:00 and on the evening close the signature stands under
it, and nothing when there is none. The rail's North is compact: a small
North, one line per heading cut with an ellipsis, a card on a hover or a
tap, the whole section folding with one press remembered on the device - and
the rail as a whole fits a 1080p screen without scrolling. Six stages: the
audit; the migration and goals out of use with DECISIONS; the page; the
morning window and the evening signature; the rail; the phone, the pictures
and the last tests. Rotating shifts are queued after it.

After the fifth stage the owner asked for the page itself to fit one screen,
on clean cards with a small shadow, premium and dark, which replaced the
brief's 640px column with no frames - see "After stage 5" below.

### Stage 1 - every reader of goals: done

What reads a goal or a rule today, and what becomes of it. Found by
searching the source for the goal and rule types, their lists, their
helpers and every goal-shaped word in copy, tests, gates and docs.

| Reader | What it reads | Becomes |
|---|---|---|
| `widgets/day-plan/NorthLine.tsx` | the day's goal title, with its why and identity, where the text has nothing for the day | taken out: no text for the day, no line |
| `widgets/day-plan/NorthCard.tsx`, mounted in `DayView` | a goal, its why, identity, a deserve line and a rule, on a Monday and after a slow day | taken out: the window after sleep brings the picture every morning, and a second card over the day would say it again |
| `lib/north.ts` `northPrompt`, `wasSlowDay`, `hasStuckTask`, `deserveForWeek`, `weekNumber`, `ruleForDay` | the card's choice of goal and line | taken out with the card |
| Settings, Nudges: Bring a goal forward (`north.afterASlowDay`), and `northDismissedOn` | the card's switch and its dismissal | the row taken out; both fields kept, unread, for files and older devices |
| `widgets/day-plan/EveningClose.tsx` | the first active goal's title under the close | the signature, and nothing when there is none |
| `views/ReviewView.tsx` North section | active goals with their ages at a review's foot | taken out |
| `views/north/NorthView.tsx` with `NorthGoals.tsx`, `GoalRules.tsx`, `RuleText.tsx` | the goal lines at the top, the goal editor and More, the rules under a goal ("What pulls me off this"), archiving | taken out, the three files deleted |
| `lib/store/goals.ts` | `addGoal`, `updateGoal`, `archiveGoal`, `restoreGoal`, `deleteGoal`, `composeNorth`, `dismissNorth` | taken out; `setPicture` and `setNorthSettings` stay, as North's |
| `lib/store/ifThen.ts` | the rules' actions | taken out |
| `lib/north.ts` goal helpers | `activeGoals`, `archivedGoals`, `canAddGoal`, `goalAge`, `goalForDay`, `ageLabel`, `rulesForGoal`, `unfiledRules`, `canAddRule`, `cleanDeserve`, `cleanAvoid`, `applyNorthDraft` | taken out; `dayNumber` (the day's line) and `withPicture` stay |
| `lib/tour.ts`, `lib/tourAssist.ts` | the tour's goal step, its event and its assist, goals in the tour's own clean-up | the step taken out; the tour ends on North's text |
| `lib/demo.ts`, `scripts/sample-day.js` | two and four sample goals, three sample rules | taken out; the pictures stay |
| `lib/explain.ts`, the palette's North line, the shortcut card | the `deserve` explanation; "the few things the days are for" | the explanation taken out; the North words reworded to the text |
| `lib/cloudBackup.ts` | a Goals row in the restore's summary | taken out |
| `views/SettingsView.tsx` | "goals" in the delete-everything sentence | reworded |
| `lib/search.ts` | nothing | nothing to do |
| The data: `types.ts` `Goal`, `IfThenEntry`, `AppData.goals`, `AppData.ifThens`; `validate.ts`; `storage.ts`; `syncEntities.ts`, `syncMerge.ts` | the entities, their guard, their sync | kept, so an old file and an older device keep every goal and rule; the migration runs in `normalizeLoaded` |
| Gates and tests | the sweep's North (goal), the tour and week-rehearsal walks, `NorthCard`, `north.test.ts` goal helpers, Review's, Evening close's, Settings', Explain's and the tour's goal tests | changed or taken out with their readers |
| Docs | DAILY's "The goal at the top" and "And what pulls you off them", ARCHITECTURE section 6, DESIGN's North notes | rewritten as the stages reach them |

### Stage 2 - goals retired, and nothing lost: done

- **The migration** (`retireGoals`, lib/north.ts): where a plan has active
  goals and North's text has no picture part, their titles and whys become
  it, one paragraph a goal, over whatever the text holds; every active goal
  is archived today, every field kept, and what changed is stamped now. It
  runs in `normalizeLoaded` - every open and import - and after every sync
  merge, once: a plan with no active goal comes back as the same object.
- **Out of use:** the day's goal line (nothing stands there now where the
  text has nothing for the day), the Monday and slow-day card and its
  Nudges row, Review's goals, North's goal lines, editor and rules, the goal
  and rule store areas (eleven areas now), the tour's goal step (the North
  step ends on Save, the caption on the words kept), the demo's and the
  sample day's goals and rules, the deserve explanation, and some eighteen
  thousand characters of stylesheet. The evening close ends on the
  signature. The restore summary counts North's lines where it counted goals.
- **Kept:** the goal and rule types, their validation and their sync kinds;
  `afterASlowDay` is still written because an older device requires it.
- DECISIONS: "North is one text, goals retired".

New tests: the migration's rules (`north.test.ts`), an old backup with
goals opening with them as its picture and every goal and rule kept, a text
with a picture left alone, the plan on the device read the same way, and
export then import bit for bit (`storage.test.ts`), a remote and a poll
with active goals arriving retired (`syncClient.test.ts`), the source read
for any goal reader, any screen saying goal, any store action or CSS rule
for one, and the doors that retire them (`goalsRetired.test.ts`), the
evening close's signature (`EveningClose.test.tsx`), the North step and
its event (`tour.test.ts`, `tourAssist.test.ts`, `Tour.test.tsx`), a
plan holding goals showing none on North (`NorthView.test.tsx`), and the
restore summary's North lines (`cloudBackup.test.ts`,
`BackupSettings.test.tsx`). Changed tests: the day's line with nothing for
the day draws nothing (`NorthLine.test.tsx`), Nudges is four rows
(`SettingsView.test.tsx`), the demo carries a text and no goals
(`demo.test.ts`), a Kitchen fixture lost its goal (`kitchen.data.test.ts`),
and the borders ratchet came down to 47 (`design.test.ts`). Removed with
what they tested: `NorthCard.test.tsx`, the goal helpers' and compose tests
in `north.test.ts`, North's goal and rule tests in `NorthView.test.tsx`,
the if-then store tests, the goal line's peek tests, and the goal's
explanation. Browser walks: the North line's edge is measured on a text, the
tour writes a line and saves it, and the week rehearsal writes the whole
text in one field.

### Stage 3 - the page: picture, headings, signature, one field: done

- **The picture** - the lines before the first heading - is the first thing
  on the page, at the page title's size (`--t-lg`) in the text's own ink and
  the reading weight, as one block with the person's own line breaks: every
  blank line typed in it is a blank line on the page (`northPicture`, read by
  the shared parser's new `introText`).
- **The headings** at the same step in the strong weight - in capitals, which
  makes them the larger - with their lines under them a step smaller at the
  reading size, all open.
- **The signature** at the very foot after the largest gap on the page (96px,
  twice the air over a heading), a step over the lines and in the quieter
  ink.
- The column is 640px, with no frame, ground or shadow on any part of it; the
  small quiet North and Edit at the right stand as they did, and Edit opens
  the one field with the whole text and the grey line under it.

New tests: the three parts by name - all three, no headings, only a picture,
only a signature, only headings - and the picture as typed
(`northSections.test.ts`), and nothing on the reading page with a frame, a
ground or a shadow (`NorthView.test.tsx`). Changed tests: the picture reads
as one block with its blank lines, and the page's type test holds the new
sizes and inks (`NorthView.test.tsx`, whose space helper now reads a step
times a number), and the browser walk reads the picture as one block
(`north.e2e.ts`).

### Stage 4 - the window after sleep, and the signature in the evening: done

- **The window after sleep** shows the picture and the signature and nothing
  else: the picture as typed, blank lines and all, in the page's own type, and
  the signature under it calm, in the quieter ink after a wide gap. It opens
  only where the text has a picture, and one press closes it - Close, Escape
  or a press outside.
- **The day's top** is the day's line alone until the evening. From 21:00 -
  the evening as the day's line already reads it, so the three hours after
  waking stay the morning - the signature stands under the line, inside the
  same press; with no line for the evening it stands alone, and with no
  signature nothing does. Another day looked at in the evening shows no
  signature.
- **The evening close** ends on the signature (since stage 2), and on
  nothing when there is none.
- Settings says what the window holds in plain words: the lines before the
  first heading and the signature.

New tests: the window holds the picture as typed and the signature and no
heading, and a picture with no signature opens alone (`App.test.tsx`); the
signature comes under the line from 21:00 and not at 20:59, not on another
day, alone in the evening with no line, and nowhere without a signature
(`NorthLine.test.tsx`). Changed tests: the day's line at noon has no
signature (`NorthLine.test.tsx`), and the browser walks read the signature
on the day only after nine, the window's picture as one block, and the
phone's North group from the line (`north-line.e2e.ts`, `north.e2e.ts`).

### Stage 5 - the rail: a compact North that folds, and a column that fits: done

- **North in the rail** is a small North and the headings, nothing else: one
  line each in the small type at the reading weight, a long one cut with an
  ellipsis and never wrapped. A resting pointer or a press shows the
  heading's lines on a card beside it, opening with the heading written whole
  when the rail cut it; nothing moves. The signature left the rail - the
  day's top says it in the evening, and the day's end.
- **The word North is the fold**, on the rail and on the phone alike: one
  press puts the headings away and another brings them back, and the device
  remembers which (`lib/northFold.ts`, its own key, outside the plan and
  sync).
- **Where nobody chose**, the rail starts with North open unless the rail
  would not fit its window with it open - measured before the first paint,
  once, so nothing jumps - and then North starts folded: the month, the
  templates, what is next and the day's numbers are the day, and North's
  headings are an index to a page one press away. The phone starts folded.
- **The whole rail fits 1920 by 1080** with five templates and eight headings,
  two of them longer than the rail, with nothing scrolled; in a 1366 by 768
  window North starts folded.

New tests: the rail's small North that folds and no picture or signature in
it, a heading on one line cut with an ellipsis, a cut heading whole on its
card, the fold remembered on the device and kept across days, North folded
from the start in a rail too full and open in one with room, a choice on the
device winning over both, and the phone opened once staying open
(`NorthDay.test.tsx`); the rail fitting 1920 by 1080 with nothing
scrolled, every heading on one line and a long one's card whole, with the
picture attached to the run, and North starting folded in a short window and
staying open once pressed (`rail.e2e.ts`). Changed tests: a text with no
heading puts nothing in the rail (`NorthDay.test.tsx`), and the North walk
finds the rail's North open with no signature (`north.e2e.ts`). The sweep's
North open scene presses the fold only while it is folded.

### After stage 5 - North on cards, on one screen: done

The owner asked, once the page of stage 3 stood, for North to fit one
screen with nothing scrolled, on clean cards with a small shadow, premium
and dark. That replaces the brief's single 640px column without cards.

- **The picture on a plate** across the top of the page, with more room inside
  than a card; **every heading on a card** of its own in a grid under it, as
  many abreast as fit at 17rem or more, in columns that line up from row to
  row, and fewer cards than fit share the whole width so no row stops short
  of the plate; **the signature at the foot** on no card, calm, after the
  widest gap. The sizes are stage 3's: the picture and the headings a step
  over the lines, the signature in the quieter ink.
- **Cards** stand on the surface's ground with the card corner and the small
  shadow a popover has - a hairline ring and a soft fall of dark. In a dark
  theme each is matte metal: its top lit a few percent and a hair of light
  along its upper edge. The light theme's cards are flat.
- **The page is 1160px wide** - the page width and half the reading width -
  enough for three cards abreast, and a picture and eight headings of two
  lines stand on one 1920 by 1080 screen. On a phone the cards stack.
- **Writing** is the one field on a card of its own at the page width.

New tests: the plate, the cards in an auto-fit grid, the shadow and the
signature on no card, read from the stylesheet, and the picture's plate
first with one card per heading (`NorthView.test.tsx`); North standing on
one 1080p screen with eight headings, columns under the plate's edges and a
shadow on the cards, with its picture attached to the run (`north.e2e.ts`).
Changed tests: the page's type test holds the cards' sizes and no longer
the single column, the no-frame guard went with the column, and the North
walk measures a heading's air inside its card and the cards abreast on a
wide window (`north.e2e.ts`).

### Stage 6 - the phone, the pictures and the last tests: done

- **The phone**, walked in both themes: the day's line, the signature under
  it after nine and the North fold under both; the evening close ending on
  the signature; the window after sleep with the picture as typed and the
  signature; North's cards stacked one under another.
- **Pictures** in the dark and the light theme: North's page on a 1920 by 1080
  screen, the day at twenty to ten, the rail with five templates and eight
  headings, and the phone's North, evening and window after sleep.
- **The brief's tests, and where each lives:** an old backup with goals
  opening with them as its picture and nothing lost (`storage.test.ts`, and
  a remote and a poll in `syncClient.test.ts`); no goal on a screen and no
  goal reader outside the data layer, read from the source
  (`goalsRetired.test.ts`); the parser's picture, headings and signature -
  all three, no headings, only a picture, only a signature
  (`northSections.test.ts`); the window after sleep holding the picture and
  the signature (`App.test.tsx`) and the evening's signature under the day's
  line and at the end of the close (`NorthLine.test.tsx`,
  `EveningClose.test.tsx`, `north-line.e2e.ts`); the rail fitting 1920 by
  1080 with nothing scrolled, its picture attached (`rail.e2e.ts`); export
  then import bit for bit (`storage.test.ts`); and generic text only, the
  privacy guard.
- **Gates:** 2959 unit tests; 112 browser walks passed and 14
  skipped; the sweep on every screen, desktop and phone, the precision pass,
  the keyboard pass and the text-scale pass at 0 findings; the privacy guard
  clean.

New tests: the day ending on North's signature on both screens - under the
day's line after nine and at the end of the card that closes the day, and
neither before (`north-line.e2e.ts`).

## After v2.27 - one line everywhere

From two screenshots the owner sent: a Cancel alone on a row of its own, and
a template editor's time, words and length as three boxes with gaps where
Today's quick-add is one line.

- **The kind question's Cancel** (Templates, New template) stands at the end
  of the question's own row, its word on the choices' right edge. The row is
  the one the card always has, so Cancel is in the same place with or
  without a day to start a week from.
- **One joined line, shared** (`.joined-line`): quick-add's rules became the
  line's, and both template editors' add rows and the Library's add line wear
  it - the parts touching with a hairline between, only the outer corners
  rounded, one halo round the whole line.
- **On a phone** the line is one block of two rows: the words across the top
  and the rest across the row under them, the block's four outer corners
  rounded and none inside. Quick-add's phone rule had been dead since the
  Return field began wrapping its input - it ordered the input rather than
  the line's own part - so the time hung alone on the top row with square
  corners; it moves the Return field now. The Library's add line does the
  same.
- A scan of every main screen for field-like controls side by side with a
  gap found nothing else of the kind.

New tests: the kind question's row (`TemplatesView.test.tsx`), the joined
line in both template editors (the same file) and in the Library's add line
(`LibraryAddLine.test.tsx`), and quick-add's phone rule
(`QuickAdd.test.tsx`).

## v2.27 - Kitchen

Queued during v2.25 (the brief is under v2.25, "Queued after North") and
begun when v2.26 closed, under the same word to go on without stopping. A
recipe library that looks and feels like the Library with data of its own,
recipes read by North's heading rule through one shared parser, Cook with the
screen kept awake, and meal blocks on the day and in templates that point at
a recipe or a kind of meal. No calorie goals, totals, progress or verdict;
no scaling, no parsed amounts, no shopping list. Generic recipes only in the
demo, the tests and the pictures. `docs/RESEARCH-KITCHEN.md` has the why.
Seven stages: the model; the shared parser; the list with its filters and
search; a recipe's page, adding and editing; Cook; the day and templates; the
phone, the pictures and the last tests.

### Stage 1 - the model: done

- **`Recipe`** (`lib/types.ts`): an id, a title and one text, required; meal
  types (`MEAL_TYPES`: breakfast, lunch, dinner, pre-gym, post-gym, snack,
  several allowed), kcal, protein, carbs and fat per serving, servings,
  minutes and times cooked, each optional and absent rather than nought.
  `AppData.recipes` is a top-level list, backfilled to empty.
- **What a form's input becomes** (`cleanRecipe` in `lib/kitchen.ts`): name
  and text trimmed at their ends and both required; meal types this app has,
  in its order, once each; kcal whole and grams to a tenth, from nought;
  servings and minutes whole from one; anything else left out.
  `RECIPE_LIMITS` bounds the numbers.
- **The guard** (`validate.ts`): a `RECIPE` table, so a file with a wrong
  recipe anywhere is refused whole.
- **Sync**: one entity per recipe at `recipe:<id>`, stamped by the diff,
  tombstoned when removed, merged recipe by recipe; `isSyncableState` and
  `normaliseRemote` know the list.
- **The restore's summary** counts recipes, and a restore that would bring
  fewer marks the row.
- **Actions** (`store/kitchen.ts`): `addRecipe`, `updateRecipe` (the form's
  whole input, keeping times cooked), `markCooked` and `removeRecipe`.
- **Demo**: four everyday recipes, three with INGREDIENTS and STEPS, one a
  plain paragraph.
- ARCHITECTURE has the entity, the field and the two files;
  `docs/RESEARCH-KITCHEN.md` is written.

New tests: `kitchen.data.test.ts` (the guard, the file both ways, a backup
from before Kitchen, stamps and tombstones, two merges, the syncable shape,
the summary) and `store/kitchen.store.test.ts` (saving, the optional fields,
an edit, cooking, removing).

### Stage 2 - one parser for North and a recipe: done

- **`lib/headings.ts`** holds the capitals rule and the one parser,
  `parseHeadings(text, rules)`, with its line kinds, heading test, tag and
  mark. The rules are what a kind of text adds: a tag pattern and a
  signature. Without them a line of `---` is text and brackets are words.
- **North** (`lib/northSections.ts`) is now its rules on top -
  `NORTH_RULES`, the two tags and the signature - and the names its screens
  call, each one line into the shared parser. No North test changed.
- **A recipe** (`lib/recipeText.ts`): `readRecipe` reads the text by the
  same parser with no rules, and turns a heading of INGREDIENTS into a list
  and one of STEPS into steps - one item a line, a pasted bullet or step
  number taken off, with or without a colon after the heading, the whole
  heading only. Other headings stand over their paragraphs, every part in
  its written place, and a text with no heading reads as typed.
  `recipeIngredients` and `recipeSteps` gather every list for Cook.

New tests: `headings.test.ts` (the rule with no rules, North's rules, and
North and a recipe finding the same headings in the same texts) and
`recipeText.test.ts`.

### Stage 3 - the list, its chips and its search: done

- **A seventh view**, Kitchen, with a pot in the rail and the bar, the `7`
  key, a palette command and a line on the shortcut card. At the end of the
  rail, so every key a hand knows still reaches what it reached. Eight in
  the phone's bar: under 376px each keeps its height and gives up a few
  pixels of width, 38 at the narrowest, where eight 44px targets ran off a
  320px screen.
- **The list** (`views/kitchen/KitchenView.tsx`), built from the Library's
  parts: its page and header, the chip row, one card and quiet rows. The
  chips are All and the six meals, one pressed at a time on the accent's
  ground, wrapping rather than scrolling; the field at the top of the card
  searches names and texts within the chosen meal. A row is the name, the
  kcal and protein on one quiet line when known (`macroLine`) and how often
  it was cooked at the end (`cookedLabel`), the recipes in the order of their
  names (`recipesForMeal`). An empty Kitchen says what it is for; a meal or a
  search with nothing says so in one line. The view takes a meal to open on,
  for the day's meal blocks later.
- **Search** (`searchRecipes` in `lib/search.ts`): the app's own matching,
  a name counting twice a text, ties in the list's order, an empty field
  the whole list and one letter already narrowing.
- **The gates**: Kitchen is a screen in the sweep (and with a meal chosen),
  in precision, keys and the text sizes; the sample day has four generic
  recipes, twenty when heavy.

A row opens nothing until the recipe's page, stage 4.

Changed tests: `NavRail.test.tsx` counts seven views in the order of their
keys and presses Kitchen; `App.test.tsx` names Kitchen · 7. New:
`kitchen.test.ts`, recipe search in `search.test.ts`,
`views/kitchen/KitchenView.test.tsx`, and 7 opening Kitchen in
`App.test.tsx`.

### Stage 4 - a recipe's page, and writing one: done

- **The page** (`RecipePage`): in the list's place, Kitchen at the top with
  its caret on the column's edge goes back to the list as it was left - the
  same meal and search, the focus on the row - and Edit stands at the right
  of the row. One card: the name, the four numbers for a serving and the
  facts (meals, servings, time, times cooked) on two quiet lines when there
  are any, then the text by `readRecipe` - the introduction as typed,
  INGREDIENTS after small dots, STEPS numbered in their own column, the
  words of both lists on one edge, other headings over their paragraphs,
  everything at the reading measure. The name takes the focus on opening.
- **The form** (`RecipeForm`), for New recipe in the header and for Edit:
  Name, one large Recipe field with the rule said once under it, and More
  with the fold's caret for the rest - the meals as chips, servings and
  minutes, and kcal, protein, carbs and fat under Per serving, four to a row
  and two on a phone. More opens by itself on a recipe that has any of them.
  Save waits for a name and a text; Ctrl or Cmd with Enter saves and Escape
  cancels. Saving opens the recipe's page. Delete, on a recipe that exists,
  asks a second time, goes back to the list and offers the recipe back
  (`restoreRecipe`).
- **The palette** finds recipes by name and by text and opens one on its page;
  every other way into Kitchen - the rail, 7, the palette's Kitchen - opens
  the list, a fresh Kitchen each time.
- **The gates**: the sweep, precision and keys measure the recipe's page and
  its form, and the text sizes the page. The keys walk no longer presses the
  demo banner's way out, which had left every screen after it measured on an
  empty plan - found when the recipe's page could not find a recipe.

New tests: the page, going back, opening on a recipe, New recipe, More, Edit,
the keys and Delete in `KitchenView.test.tsx`; `fullMacroLine` and
`factsLine` in `kitchen.test.ts`; `restoreRecipe`; recipes in the palette's
search; the palette opening a recipe in `App.test.tsx`.

### Stage 5 - Cook: done

- **Cook** (`CookMode`), the primary action beside Edit on a recipe's page:
  the recipe over everything on the page's own ground, the way Focus is, a
  step larger - the name, the introduction, each ingredient and each step as
  a line with the app's drawn box that a press anywhere on the line ticks,
  a finger tall at least, a step's number in its own column, a ticked line
  struck and quieter. Other headings stand over their paragraphs. It scrolls,
  and Close stays put.
- **The ticks are the cooking's own**: they live in the screen and go with
  it, so the next Cook starts clean.
- **Awake** (`lib/useWakeLock.ts`): the Screen Wake Lock API while Cook is
  open, asked again whenever the page comes back into view (a browser lets a
  lock go when the page leaves it) and every lock released on closing.
  Without the API, or when the browser refuses, nothing is said and nothing
  breaks.
- **Done** adds one to times cooked and closes; the page's facts say it at
  once. Close or Escape counts nothing and gives the focus back to Cook. A
  bare key pressed inside is Cook's own (`data-keeps-keys`), so a stray 3
  cannot take the recipe away mid-step.
- The sweep measures Cook with a ticked ingredient and a ticked step; the keys
  walk opens it from the page and closes it with Escape.

New tests: `useWakeLock.test.tsx` (awake, asked again on coming back,
released, off, and no API or a refusal) and Cook in `KitchenView.test.tsx`
(the lines to tick, a tick by the line's words, the ticks gone with the
cooking, Done counting, Close and Escape not).

### Stage 6 - meals on the day and in templates: done

- **The fields**: `recipeId` and `mealType` on `TemplateBlock` and on `Task`,
  each optional, checked by the guard, carried by a backup. `mealLink`
  (`lib/kitchen.ts`) is the one reading of them: only a block or task in the
  built-in Meals category (`isMealCategory`, the id `meal`, whatever it is
  called now) has one; a recipe before a kind of meal; a recipe removed on
  another device degrades to the kind of meal, or to nothing.
- **Stamping** copies both from the block, like the category, and echoes them
  in `fromBlock`, so opening a day takes a block's new recipe while the day
  still holds what the block gave, and keeps a recipe chosen on the day for a
  block that left a kind of meal open. A re-stamp takes the block's, the
  way it takes a category.
- **On the day** a meal's card carries its recipe's name, or "Lunch recipes",
  in the card's pill, and a press opens the recipe's page in Kitchen or
  Kitchen on that meal; a long name gives way inside the pill. The detail
  sheet asks Recipe on a meal only (`setTaskMealLink`), and choosing a recipe
  clears the kind of meal it was chosen for.
- **In templates** one select asks every meal the same question
  (`views/kitchen/RecipeBinding.tsx`): no recipe, a kind of meal to choose
  from on the day, or a recipe by name. The day editor asks it on the add row
  once the block is a meal - where a list would be asked, since a meal does
  not read through one and two questions there pushed Add a block onto a line
  of its own - and on a meal block's own line under its row, where the
  binding's line goes: in the row it pushed every column of the meal's row
  left of the rows around it. The week editor asks it on the add row and in
  an open meal block's panel, for every day the block is on. A list already
  chosen stays in sight. The add row's recipe clears after each block;
  `addTemplate` carries both fields.
- The demo and the sample day point meals at recipes and kinds of meal.

New tests: stamping and the echo (`stamping.test.ts`, `ensureDay.test.ts`),
the fields through a backup and the guard (`kitchen.data.test.ts`),
`mealLink`, the card's press, the detail sheet and the select
(`views/kitchen/MealOnDay.test.tsx`), both editors (`TemplatesView.test.tsx`,
`WeekTemplateEditor.test.tsx`), and a card opening Kitchen in `App.test.tsx`.

### Stage 7 - the phone, the pictures and the last tests: done

- **The phone**, walked in `e2e/kitchen.e2e.ts` on both projects (the phone
  runs the file): the meals wrap inside the screen with nothing running off
  it, and every line in Cook is a finger tall. The pictures in both themes,
  desktop and phone - the list, a recipe's page, Cook with lines ticked, the
  form, and a meal's card on the day - found nothing to change.
- **The last tests**: a recipe written from nothing, read back as a list and
  numbered steps, found by its meal and by a word inside it, cooked with the
  screen asked to stay awake and let go of on Done, and counted; a meal on the
  day opening its recipe, and a kind of meal opening Kitchen on it.
- **The brief's data promises**, and where each is held: a new entity by
  CONVENTIONS 7 with sync, the guard, export and import both ways
  (`kitchen.data.test.ts`); a backup without Kitchen importing cleanly (the
  same file); the demo's four generic recipes; generic text only in the tests
  and the pictures (the privacy guard, and every line in these files).
- `docs/DAILY.md` has Kitchen; DECISIONS has "Kitchen: recipes are their own,
  read by North's rule, and never added up"; `docs/RESEARCH-KITCHEN.md` was
  written in stage 1 and still says what was built.

Changed tests: `playwright.config.ts` gives the phone `kitchen.e2e.ts`. New:
`e2e/kitchen.e2e.ts`.

v2.27 is done.

## v2.26 - North that holds the eye

Asked for the night v2.25's last stage ran, and begun when it closed, with
the owner's word to go on through everything queued without stopping. North
worked, the owner wrote, and did not hold anybody: the day showed a goal's
name cut off under the date, the rail's headings read like a menu, and the
page opened folded. The brief, as understood, and the North editor's own
last two stages, which are done inside it:

1. **The line.** One whole line of the text on the day, from under a
   heading - never a heading, a blank line or the introduction - the same
   all day on every device and another the next. A heading ending on
   `[morning]` lends its lines only to the three hours after waking, waking
   read as the window after sleep reads it; one ending on `[evening]` only
   to the day from 21:00; untagged headings the rest of the time. The tags
   are read and never shown.
2. **The day's top.** That line where the goal's name was, never cut - it
   wraps - with the signature under it, quieter, always; a press opens
   North; the goal's name only where North has no text.
3. **The rail.** Headings as they were written, not tracked like a menu; a
   small card of a heading's lines beside it under the pointer, moving
   nothing, and the same card on a press on a phone; a small "North" over
   them and the signature under them.
4. **The page.** For reading, so everything is open: the introduction at the
   text's own size and ink, headings a little larger and heavier with more
   room over them than under, the signature last after more room and a
   little larger, Edit at the right of the title's row, about 640px wide.
5. **The phone and the last tests.**

Generic text only in the tests and the pictures, the tests green and this
section brought up to date after each stage.

### Stage 1 - the line and its two tags: done

- **Tags.** A heading may end on `[morning]` or `[evening]`, in either case;
  it is still a heading, the tag is kept on its section and its heading is
  the words without it (`lib/northSections.ts`), so nothing that draws a
  heading can show one. A line that is only a tag, or lowercase with one, is
  text.
- **The line** (`lib/northLine.ts`): every line written under the headings
  for the part of the day, one a day in the order written by the date's day
  number, so the same on every device, never the same two days running while
  there is another, and read through end to end. The morning is the three
  hours after the last waking, the evening from 21:00 by the device's clock,
  a morning past 21:00 still the morning; a part of the day with no heading
  of its own takes the untagged lines, and with none of those the day has no
  line rather than one from the wrong hour.
- **The waking** (`lib/northRead.ts`): the moment the app comes into view
  after five hours out of view, written on the device whether or not the
  window shows, and said on the window so the line can turn to its morning
  at once; `useNorthMoment` keeps the part of the day current by the minute.

Changed tests: `northRead.test.ts`'s count of the device's own keys is three,
with the waking.

### Stage 2 - the day's top: done

- **The line** (`NorthLine`): where North has a text, the day's top under
  the date is the text's line for the date and the part of the day - today's
  part of the day only on today - in the text's ink at the body size, whole
  and wrapping, with the signature under it a step smaller in the secondary
  ink, the two one thing to press, which opens North. At an hour whose lines
  are all under the other tag the signature stands alone.
- **The goal's name** stands there only where the text has nothing for the
  day - no text, or introduction alone with no signature - and where the
  switch under Nudges takes North's text off the day; the tour, which types
  one line and a goal, still ends on the goal's line.
- **In the masthead** the line runs down from the top of its row, its first
  line on the centre line of the progress and the view toggle beside it, and
  the row grows to hold the signature.
- **On the phone** the folded North under it says North and opens the
  headings; the signature is the day's line's to say.
- The sample day and the demo have a `[morning]` heading and an `[evening]`
  one, generic lines, so the pictures and the sweep show all three parts of
  the day.

Changed tests: `NorthDay.test.tsx`'s folded line says North and draws
nothing without a heading; `e2e/north.e2e.ts` taps North on the phone rather
than the signature. New: the text's line in `NorthLine.test.tsx` (which line,
the press, the same date, the morning and the evening, the signature alone,
the goal where the text has nothing) and its wholeness and place in
`e2e/north-line.e2e.ts`.

### Stage 3 - the rail: done

- **Beside the day** (`NorthDay`): a small North in the rail's label style,
  the headings as they were typed - the reading ink at the interface size,
  no tracking, no longer a menu of sections - and the signature under them.
  A heading with nothing under it is words, not a control.
- **The card.** A pointer resting on a heading, or the focus on it, shows a
  small card of its lines beside it over the day, its first line level with
  the heading's words; leaving takes it away. A press shows it and keeps it,
  and a second press, a press anywhere else or Escape puts it away. The card
  is a layer fixed to the window and takes no press, so nothing under it
  moves - the rail's old way, laying the words out over the rail and fading
  what followed, is gone. Placed by `northCardPlacement.ts`: beside the
  heading, under it where there is no room beside, above it where the screen
  ends, never past the window's edge.
- **On a phone** the folded North opens the headings, and a press on one
  opens the same card under it.
- The rail's box is a step wider than its column and gives the step back as
  padding, so the ground under a heading can reach out past its words without
  scrolling the rail sideways - the sweep's first run found the 8px.

Changed tests: `NorthDay.test.tsx` is rewritten for the card (the pointer,
the press and its three ways away, the layer, a bare heading, the folded
card); `e2e/north.e2e.ts` hovers a rail heading for its card and checks that
nothing in the rail moved, and taps one on the phone; `scripts/sweep.mjs`'s
Today (North open) presses the new heading. New: `northCardPlacement.test.ts`.

### Stage 4 - the page: done

- **Everything open** (`NorthSection`): a heading is an `h3` over its lines,
  not a control, and nothing on the page folds - no press, no hover preview,
  no Escape. The fold, the preview laid over the page and the state that kept
  a just-closed heading quiet are gone with their rules.
- **The type.** The introduction and the lines at the reading size in the
  text's ink, as before; a heading `--t-lg` at the strong weight, written as
  typed with no tracking, 48px of air over it and 8px under it; the signature
  a step larger in the text's ink after 72px, no longer after a rule and no
  longer grey - the same ending the window after sleep has.
- **Edit** stands at the right of the title's row, its word on the column's
  edge and its ground reaching out past it, on one centre with North. The row
  is one control tall with or without Edit, so opening the field moves no
  line under it. The column is `--read-w`.
- **In the field** a heading's `[morning]` or `[evening]` is drawn in the
  quiet ink without the heading's stroke (`northTagAt`), the only place a tag
  is ever seen.
- `docs/DAILY.md` says the day's line, the tags, the rail's card and the open
  page.

Changed tests: `NorthView.test.tsx`'s reading and heading tests are rewritten
for the open page (nothing in the words to press, Edit in the title's row and
its row kept while writing, every heading with its lines, the tag never
drawn, the type and the air read from the stylesheet); `e2e/north.e2e.ts`
walks the open page and measures the air over and under a heading and Edit's
place, and its drift test writes a tag; the sweep's North (heading open) went
with the fold, since North at rest now measures every line. New: the tag in
the field, `northTagAt`.

### Stage 5 - the phone and the last tests: done

- **The fold says it opens.** On the phone the word North under the day's
  line carries the caret every fold in the app carries, turned by its state
  (the clock panel's rule, shared).
- **The day's North is one group.** Line, signature and fold ended flush on
  whatever came next, so the word North read as the next notice's label; the
  group now ends with the progress's own step of air under it.
- **The last tests.** `e2e/north-line.e2e.ts` walks the day's line on a
  clock that moves, on both screens: the same line all day, the evening's
  after nine, the window after a night away and the morning's line under it,
  the next day's other line three hours on, and no tag anywhere - on the day
  or in the window. On the phone the group's air is measured and the fold
  opens. The phone project runs the file now; its wide-layout tests skip
  there. `leaveAndReturnAt` moved to `e2e/app.ts` for both files.
- That file's oldest test told its story with a quote and a goal title that
  were not generic; both are generic now.
- DECISIONS has the entry, "North holds the eye"; ARCHITECTURE lists the
  device's third North key.

What the brief's tests asked for, and where each is held: the day's line is
never a heading, a blank line or the introduction (`northLine.test.ts`, and
on the screen `north-line.e2e.ts`); `[morning]` only in the three hours after
waking and `[evening]` only from 21:00 (`northLine.test.ts`,
`northRead.test.ts`, `NorthLine.test.tsx`, and on a moving clock
`north-line.e2e.ts`); the tags never shown (`NorthView.test.tsx`,
`NorthDay.test.tsx`, `NorthLine.test.tsx`, `north.e2e.ts`,
`north-line.e2e.ts`); the same day the same line and another day another
(`northLine.test.ts`, `north-line.e2e.ts`); the page open without a press
(`NorthView.test.tsx`, `north.e2e.ts`); generic text only (the privacy guard,
and every line in these files).

Changed tests: `NorthDay.test.tsx` has the fold's caret and the group's air;
`playwright.config.ts` gives the phone `north-line.e2e.ts`.

v2.26 is done. Kitchen is next.

## v2.25 - the design pass

Asked for in one message the evening v2.24 closed: the app should feel like
one calm, exact thing - the owner named Things 3, Linear, Bear and iA Writer
- where today every screen looks put together on its own, fields look like
forms, spacing and type sizes differ, and buttons are scattered. Precision,
not decoration. Ten stages.

The rules over all of it: the look and the experience only - no feature
changes and no change to the data model; every existing test stays green;
DECISIONS and CONVENTIONS keep their voice, with nothing red and no verdict;
no questions back to the owner; screenshots and tests carry generic or demo
content only; never stop in the middle of a stage. After each stage:
pictures before and after in both themes on a desktop and a phone, the tests
green, and this section brought up to date.

The brief, as understood:

1. **Audit.** Every screen - the day, the week, the calendar, templates, the
   library, Review, North, notes, the journal, search, Settings, the palette,
   the modals and the empty states - in both themes at desktop and phone
   width, and what is uneven written down with its place in the code in
   `docs/DESIGN-AUDIT.md`.
2. **The system**, in `docs/DESIGN.md` and as tokens, extending
   `lib/theme.ts` and `lib/themes.ts` rather than replacing them: one type
   scale of five or six sizes with clear weights and a reading line height
   near 1.6; one spacing scale (4, 8, 12, 16, 24, 32, 48); two or three
   corners; ground, surface, raised surface, text, secondary, quiet, accent
   and line, passing the contrast tests there are; as few borders as
   possible, separation by ground and space; shadows only on modals and
   menus; motion at 120 to 180ms, easing out, never bouncing, and still for
   reduced motion; fields with no loud edge, a quiet ground and a quiet
   focus; three buttons (primary, secondary, quiet text) at one height, one
   spacing, always in the same place; an empty state as one quiet line and
   one action.
3. **What every screen shares:** buttons, fields, modals, menus, navigation.
4. **The day and the timeline.**
5. **The week and the calendar.**
6. **The template editors.**
7. **North:** a writing surface with no frame, 17 to 18px type about 640px
   wide, capitals and `---` drawn as they are typed by a layer under the
   transparent field (the keyboard, undo, copy and paste and the phone's
   keyboard all the field's own), the rule under it in sentence case,
   Ctrl or Cmd and Enter to save, Escape to cancel.
8. **The library, Review, notes, the journal and search** - and the
   library's adding flow, asked for earlier the same day.
9. **Settings and the palette.**
10. **The last look:** every screen again for old styles, colours or spacing
   outside the tokens, and what is left undone written into the audit.

**Queued after the pass, from a message during stage 2:** North's editor as a
writing place rather than a form - iA Writer, Bear, Notion - in five stages
of its own, begun only once the ten are done. A page, not a field: no edge,
no loud focus, about 640px, 17 to 18px at a line height near 1.7, growing
with the text with no inner scroll and no resize corner. Formatting seen as
it is typed through a layer under the transparent field, plain text kept,
the caret, the selection and the text meeting to the pixel on long wrapped
lines: a capitals line heavier, a little tracked, with more room over it; a
`---` line a thin faint rule; the signature's lines a little quieter. One
grey line under it in sentence case, "Capital lines become headings. A line
of --- starts your signature.", and the placeholder "Write who you are.".
Save at the right in the primary style, always looking live when there is a
change and hidden or quiet when there is none, never looking broken; Cancel
a quiet text button beside it; Ctrl or Cmd and Enter to save, Escape to
cancel; 150ms between reading and writing, with nothing jumping. Reading
and the day with the same type and spacing as the editor, so nothing moves
between them; the page's title "North" smaller and quieter than its
content. Tests for the keyboard, undo, the two keys, the text kept bit for
bit, capitals and `---` recognised as typed; pictures in both themes at both
widths. Stage 7 of the pass builds North to this brief already, so the five
stages then finish and prove it rather than redo it.

**Asked for during stage 6, and folded into the pass from there on:** the
owner looked at the sheets and found Today's and the calendar's bars
careless - random gaps between buttons, controls centred on a different
line than the title beside them, the now line floating between the date and
the view toggle, Month and Week floating between two groups - and asked for
the same care everywhere, because these are the first things anybody sees.
The rule taken from it for every remaining stage and for the screens
already done: every control stands in a group anchored to an edge of its
column, nothing floats in the middle of a row, one row has one centre line,
the stacked blocks of a column share its two edges, and nothing moves when a
title changes length.

Done first, before stage 6 went on: Today's masthead is two rows over the
day and the task column at every wide width - the day's name and date at
the left, its template, doors and arrows at the right; the clock and the
running task at the left, the progress and the view toggle at the right -
and no longer spans the rail from 1500px. The calendar's bar has its title
at the left and one group at the right with the arrows last, the mode in
one place in both modes. A settings row centres its control. `npm run
precision` now measures every row of controls for one centre line and for
anything floating between two open gaps, at 1366 and 1920, and was made to
fail on the old stylesheet first; `e2e/header.e2e.ts` holds the masthead's
new geometry.

**Queued with the North editor, from a message during stage 10: North that
holds the eye.** The day's top shows one whole line of North's text where
the goal's name was - a line under a heading, never a heading, an empty line
or the introduction - wrapping rather than cut, the same line all day on
every device and another the next day. A heading ending in `[morning]` lends
its lines only in the first three hours after waking (waking as the morning
window already reads it, the first open after five hours away), one ending
in `[evening]` only after 21:00, and untagged headings the rest of the time;
the tags are read and never shown. Under the line, quieter and always, the
signature; a press opens North; the goal's name shows there only when North
is empty. The rail's headings are written as typed, not tracked capitals,
each opening a small card of its lines beside it under the pointer without
moving anything, and on a phone on a press, under a small "North" and over
the signature. North's page is for reading, so everything is open: the
introduction at the text's size and ink, headings a little larger and
heavier with more room above than below, the signature last after more room
and a little larger, Edit at the right of the title's row, about 640px wide.
Tests: the day's line is never a heading, an empty line or the introduction;
the tagged lines keep to their hours and the tags never show; one day, one
line; North's page all visible without a press; generic text only. Five
stages: the picking with the two tags; the day's top; the rail and its card;
North's page; the phone and the last tests. The North editor's own stage for
reading and the day is done inside these, and its last stage with theirs.

**Queued after North, from a message during stage 6: Kitchen.** A
recipe library that looks and feels like the Library but keeps its own data
- a recipe has no progress units, so it is not a `LibraryList`. A recipe is a
name and one free text, with optional meal types (breakfast, lunch, dinner,
pre-gym, post-gym, snack, several allowed), kcal, protein, carbs and fat per
serving, servings and minutes. The text follows North's rule - a line in
capitals is a heading; lines under INGREDIENTS are an ingredient list, under
STEPS numbered steps, and a text with no headings is shown as it is - with
the parser shared with North, not copied. Screens: the list with meal-type
chips (All and the six) and a quiet row per recipe (name, kcal and protein
on one quiet line when set, times cooked); a recipe's page (name, macro
line, ingredients, steps); adding and editing (name, a large text field,
More for the optional fields, saveable with a name and a text); Cook - larger
type, ingredients and steps ticked off with a press, the screen kept awake
through the Screen Wake Lock API where it exists and silently not where it
does not, and Done adding one to times cooked; search by name and text
through `lib/search.ts`. On the day: a block or a template block whose
category is a meal may carry a recipe or a meal type - a recipe shows its
name and opens it, a meal type opens Kitchen filtered to it, and a block
with neither works as it does now. Not in it: calorie goals, day totals,
progress bars or any verdict (macros are information on a recipe), serving
scaling, ingredient quantities, shopping lists. The data: a new entity by
CONVENTIONS 7 with sync, validation and an export and import round trip; a
backup without Kitchen imports cleanly; demo mode with three or four generic
recipes, tests with generic text only, none of the owner's recipes in the
repo; `docs/RESEARCH-KITCHEN.md` and a DECISIONS entry. Seven stages, the
tests green and this file updated after each: the model with validation,
export, import and migration; the shared heading parser; the list with its
filters and search; a recipe's page, adding and editing; Cook with the wake
lock and the count; the meal blocks on the day and in templates; the phone,
pictures in both themes and the last tests.

Pictures: the audit's are kept in the repo, one sheet per screen, in
`docs/screenshots/design/before/`, and the last stage's go beside them. The
before and after of the stages between are shown to the owner as each stage
closes and not kept, so the repo does not carry eight sets of the same
screens half-done.

### Stage 1 - the audit: done

`docs/DESIGN-AUDIT.md`, from two readings that check each other:
`scripts/design-inventory.mjs`, new, which counts every type size, line
height, weight, letter spacing, spacing value off the scale, corner, border,
shadow, duration, colour literal and button kind in the stylesheet with its
line, and 45 screens photographed at 1366x768 and on an iPhone 13 in both
themes, 45 sheets. What it found, in short: seven title positions for seven
views; nine heights for pressable things; 183 drawn borders; one field rule
whose ground is the page's wherever it stands; 180 buttons outside the
three shared kinds; tracked capitals at six spacings beside sentence-case
labels; empty states of up to five actions.

And on the way: the Notes popover starts 37px left of a phone's screen; the
audit script reports a thing past the left edge only when all of it is past,
so it could not see that; the sweep parks the pointer on North's first
heading at 1366x768 and so never measures North at rest; `--faded` is
declared three times; `--r-chip` is used and not defined. The first two are
stage 3's, with the popovers.

### Stage 2 - the system: done

`docs/DESIGN.md` is the system, from five principles to where an action
stands on a sheet, and CONVENTIONS section 5 is its short form. In the
tokens:

- **Spacing** in steps of four, 4 to 48, with `--s12` new; `--s5` and `--s7`
  retired.
- **Type** in six sizes, with `--t-read` (17px) new for reading, writing and
  every field on a phone; three line heights and three weights as tokens;
  `--t-2xs` and `--t-input` retired.
- **One control height**, `--control-h`: 36px, 32px at compact density, the
  touch target on a finger; and two page widths, `--page-w` 840px and
  `--read-w` 640px.
- **Two corners:** every preset's edge is 10px, the same as its radius.
- **The quiet grounds** `--fill` and `--fill-strong`, the text mixed into
  the surface in a dark mode and into the page in the light one, one
  `--scrim` per mode, and `--ring` for focus. `FILLS` in `lib/themes.ts`
  writes the mixes once. Light's secondary ink is `#60656a`, a step darker,
  so it reads at 4.5:1 on both fills.
- **Motion** at 120 and 180ms; `--e1` retired.
- `--faded` is declared once, not three times.

`design.test.ts`, new: every value against DESIGN.md; text and secondary
text at 4.5:1 on both fills in every preset, mixed the way the browser mixes
them; a fill that can be told from both the page and a card; and the
ratchet, twelve retired things counted with what is left, each only going
down. Planting 200ms, a 7% light fill or a new pixel height fails it, each
one.

What shows: cards round at 10px, motion is shorter, and the light theme's
secondary text is a step darker. The rest is tokens that stage 3 puts to
work.

### Stage 3 - what every screen shares: done

In the shared rules, so every screen that used them changed at once:

- **Buttons.** Three kinds: primary on the accent, secondary on the fill,
  quiet with no ground (`btn-quiet`, new); destructive is the quiet kind in
  the danger ink, filled once armed. No edges, one height, no shrink on a
  press; a disabled one quietens to the fill and the secondary ink.
- **Fields and selects.** The fill and no edge, one control's height, the
  strong fill under the pointer, a halo of `--ring` on focus with a
  transparent outline kept for forced colours; 15px on a mouse and 17px on a
  finger, where 16px stood everywhere.
- **Chips, segments, steppers, the task sheet's small buttons.** Chips are
  fill pills with the accent's ground when chosen, a template's own colour
  for a template chip; a segmented control is one fill with a thumb; a
  picker's options are menu rows; steppers and the time and length fields
  are fields.
- **Layers.** Modals, sheets, popovers, menus, bubbles, the toast and the
  floating clock stand on the raised ground with no border; `--e2` and `--e3`
  carry a hairline ring of their own and are softer on Light; one `--scrim`
  under every modal and sheet; labels in sentence case; the replan sheet's
  actions at the right, Cancel quiet and first in the document. A swatch
  ring's gap follows the ground of the sheet it stands on.
- **Navigation and the page.** The rail loses its line and answers the
  pointer with the fill; the header's tools are quiet buttons with no shadow
  when lit; Templates, the Library, Review and Settings share `--page-w` and
  one title row, so their titles begin at one height and one edge.
- **A phone defect:** the Notes popover hangs from the right edge of the
  header's tools on a phone, from x = 74 rather than -37.

The tooling: the audit counts a thing partly past the left edge (a tenth
self-check shape, planted); the sweep parks its pointer at the window's top
edge, not on North's first heading; and the audit reads a mixed ground,
which it had read as none - so the day the fields took the fill, a Return
field's own hint came back as text over text. The sweep then found three
real ones and each was fixed rather than excused: segmented options 40px
tall on a finger, a replan row's time in the quiet ink on a fill at 4.46:1,
and the key mark in the accent on a fill at 4.23:1 on Light. DESIGN.md
gains what applying it taught: the thumb, quiet text never on a fill, menu
rows, steppers as fields, the lifts' hairline, the phone's panel anchor, and
Cancel first in the document.

The ratchet: borders drawn 183 to 120, black as `rgba()` 29 to 8, pixel
heights 76 to 64, weights 91 to 83, tracked capitals 23 to 20, `--s5` 18 to
13, `--s7` 5 to 2, `--t-input` 9 to 7, `--e1` 8 to 6, and no press that
scales - the count sees a transform that translates as well now.

### Stage 4 - the day and its timeline: done

- **The header.** The day's template is a chip on its own colour, Replan and
  Low day are secondary buttons, all three one control's height with no
  edge; the arrows on a phone are quiet with no box; the note a day that is
  not today wears is a fill in sentence case. North's goal under the title
  is sentence case at the interface size, not tracked capitals, and so is
  the journal's line.
- **The yesterday banner** is a card on the page's ground with no edge and
  no mark down its side, and the timeline's door on a phone is a secondary
  button.
- **The rail.** The mini calendar's days are grounds with no edge, today a
  ring of the accent inside the cell, a stamped day its template's tint
  without the bar over it; Up next is a card with its category as an inset
  mark and no edge or shadow; the day's numbers are a card with neither;
  every label in the rail is sentence case.
- **The task pane.** A task card has no edge and no shadow, a key task its
  warm ground, the running one a ring of the mark inside it; the key
  task's weight is the strong weight rather than 650, on the card, the block
  and the editor's list. Push to tomorrow is a quiet fill, and Done wears the
  same plain count Later does.
- **The timeline.** A block with no category stands on the fill with no
  edge, and a block under the pointer brightens a little instead of lifting
  on a shadow.

Every screen of the day measures clean at four widths and on the phone in
both themes, and Today again at 22:00 and 09:00. The ratchet: borders drawn
120 to 106, weights 83 to 75, pixel heights 64 to 60, number line heights 79
to 78, tracked capitals 20 to 15, `--e1` 6 to 2.

### Stage 5 - the week and the calendar: done

- **The month** is 35 grounds with no edge: a stamped day keeps its wash
  and the strip of its template's colour, today its outline on the page's
  ground.
- **The week.** A day's track is the surface with no edge, today's a ring
  of the accent inside it; a weekday is sentence case; an offered template
  over an empty day is quiet text that takes the fill under the pointer; the
  stamp menu is a popover on the raised ground with a popover's lift; the
  question it can ask has buttons one control tall.
- **The agenda**'s dates and its journal's labels are sentence case.

The calendar measures clean at four widths and on the phone in both
themes. The ratchet: borders drawn 106 to 104, weights 75 to 74, pixel
heights 60 to 59, tracked capitals 15 to 12.

### Between 5 and 6 - the bars lined up: done

Today's masthead and the calendar's bar rebuilt to the alignment rule above,
a settings row centred, and `npm run precision` taught to measure rows -
see the paragraph under the brief.

### Stage 6 - the template editors: done

- **The list.** A template is a card on the page with no edge, its name at
  the medium weight, Edit a quiet button at its right. The question a new
  template asks is a card with no edge, the question in the text's ink,
  Cancel quiet at the card's right. The first run's sentence is the empty
  state's quiet line at the left edge over the offers, and an offer is a
  card with its colour as an inset mark rather than a coloured edge.
- **A day template.** The editor is a card with no edge. The day type is a
  quiet button whose words stand where the name's words stand in the field
  above it; `change` is not underlined. A block's row has no rule under it,
  and its own controls are quiet - Key, Ongoing and Note are words until
  pointed at or chosen, the library a quiet select one width on every row,
  the cross a quiet square - so the note, the list and the cross stand in
  columns down the list. A block's note panel has no ground: its box is a
  field on the card.
- **The add row** stopped painting every button in it with the page's
  ground and an edge. The time and the length are fields, a chip is a chip,
  a chosen control the accent's quiet ground, and the pencil and the pluses
  quiet round grounds instead of dashed rings. The pencil was a 20 by 32
  oval on a mouse and is round.
- **The last row** is the destructive action at the left and Cancel then
  Save template at the right, in the document too; on a phone the delete
  takes its own line above. `.row button` painted Delete template the
  surface and an edge with the text's ink, so it had lost its danger ink.
- **A week template.** The day switches are the fill, on ones the accent's
  quiet ground rather than seven accent squares; What and Where are labels
  in sentence case; a block with no time is a chip on the fill in every
  column's foot, the feet keep room for the busiest day's chips so Copy to
  stands on one line across the week, and Copy to and the day type are
  small quiet buttons, not underlined words. The open block's cross is a
  quiet square, Remove has no rule over it, and folded Add a block is a
  secondary button rather than a dashed box across the editor.
- **What every screen shares.** A one-line field is exactly one control
  tall, 36px where it was 39 beside 36px buttons; a field's label is the
  label style; a note's box is a field; the chip class is the system's
  chip. The rules of the seven-column week editor, gone since the week
  became a grid, are deleted.

Both editors measure clean on the precision pass at 1366 and 1920, and the
whole app on the sweep at four widths and on the phone in both themes. The
ratchet: borders drawn 104 to 89, pixel heights 57 to 46, weights 74 to 71,
number line heights 78 to 76, tracked capitals 12 to 10, `--t-2xs` 10 to 8,
`--t-input` 7 to 6, black as rgba 8 to 7.

### Stage 7 - North: done

Built to the North brief queued above, so its five stages later finish and
prove what is here rather than redo it.

- **The field is the page.** No edge, no ground, no padding and no halo:
  17px at a leading of 1.7, the words standing exactly where the reading
  page puts them, so Edit moves no line. It grows with the text and never
  scrolls inside itself. The empty field asks "Write who you are." and
  shows no example.
- **Formatting while typing**, drawn under the transparent field: a heading
  heavier by a stroke round its letters, `---` a thin faint rule across the
  page in its own line's height, the signature's lines the quieter ink. The
  tracking and the room over a heading the brief asked for are the reading
  page's only - a textarea cannot give one line either without moving every
  caret after it (DECISIONS). A browser test holds the drawing to the field
  line by line, long wrapped lines included, and was made to fail first.
- **The rule and the buttons.** One grey sentence-case line under the field,
  "Capital lines become headings. A line of --- starts your signature.";
  Cancel quiet and Save primary at the right, Save waiting quiet until
  there is a change; Ctrl or Cmd with Enter saves, and with nothing changed
  closes; Escape cancels. The browser's own undo still takes back typing.
- **Reading.** The introduction, a heading's words and the signature at the
  writing's size and leading; a heading the same size at the strong weight
  and tracked; one line of air between the parts; the signature after a
  thin rule in the quieter ink; Edit a quiet button at the right. The page's
  name is smaller and quieter than the text. Reading and writing fade in
  over about 150ms.
- **A goal and its rules.** A goal's last row is More at the left, Cancel
  and Save at the right; a rule being written is a card with no edge ending
  Cancel and Save at the right; a rule's Edit and Delete stand on its first
  line's centre. The underlined `.setting-quiet` is gone with its last use.

The day's North - the rail and the window after sleep - keeps its own type
until the North brief's stage 4, which is about exactly that.

### Stage 8 - the library, Review, notes, the journal and search: done

- **The library.** A list is a card with no edge or resting shadow; its
  name, what it is counted in and a quiet Edit share one centre line. The
  add line is at the top of the list, under its name - the adding flow the
  owner found a chore meant scrolling past every book to reach it - and its
  amount is a field rather than an outlined box. A row's own actions stand
  at its right edge: the count, the arrows, and + and the cross, always
  there and quiet, where hidden until hovered they left a hand's width of
  nothing at the end of every row; while a row's panel is open their room
  is kept, so the arrows no longer jump. The loud row is the larger title
  and its bar with no ground of its own - a fill under it swallowed the
  fields and buttons of its panel, and an open row takes no fill under the
  pointer, where its Delete read at 4.2:1. The panel has no rule over it and
  ends with Delete at the left and its three errands at the right; its file
  links are small quiet buttons. A new list's form ends Cancel and Save at
  the right; a list's settings and Add many have no wash of their own. On a
  phone the page stands on the same edge as every other page, 12px further
  out than it did.
- **Review.** The stretch's name at the left, and at the right Copy week
  journal and the arrows, last, on one row - they were a row of arrows round
  the name and a copy button on a row of its own. The cards have no edge,
  the figures' labels and the reading's template names are sentence case,
  and the copy buttons are quiet buttons rather than accent links.
- **Notes and the journal.** The notes panel's lines and its Open notes
  start where the box's words start. The journal panel's arrows are quiet
  squares, its caption readable. The whole journal has no edge and stays on
  the card's ground - on the raised ground its fields sank into it. Quick
  notes has one rule, under its count, where a second one under the field
  stopped short of the buttons beside it; its controls are one control
  tall, and a note set to become a task takes the accent's quiet ground.
- **Search.** The field's halo, clipped into a thick accent line under it,
  is gone, and the chosen row takes the accent's quiet ground.

The ratchet: borders drawn 88 to 70, weights 66 to 60, number line heights
71 to 65, pixel heights 45 to 41, tracked capitals 9 to 7, `--t-input` 5 to
2, `--s5` 9 to 8, `--s7` 2 to 1, `--t-2xs` 8 to 7, `--e1` 2 to 1.

### Stage 9 - Settings and the palette: done

- **Settings.** The rows are separated by their room, and the one line left
  on the page is between one group and the next - the divider DESIGN keeps
  for a long list. A group's name is one control tall, so it stands on the
  centre line of its section in the list beside the page. A setting's name
  is the medium weight. The section list is quiet rows beside the page and
  a strip of chips on a phone, one weight for all of them so a chip does not
  change width as the page scrolls. A switch that is off is the strong fill
  with its thumb in the secondary ink - on the page's own ground it had
  disappeared in the dark theme - and the last resting shadow, the thumb's,
  is gone. A second schedule's name and its Delete stand on the label
  column's edge, Delete a quiet danger word rather than an underlined link.
  A category's Edit is quiet; its editor ends Delete at the left and Cancel
  and Save at the right, and its delete panel Cancel then the delete. The
  snapshot row lost its rule.
- **The palette** needed nothing more than stage 8 gave it.

The ratchet: `--e1` 1 to 0, weights 60 to 55, borders drawn 70 to 68, number
line heights 65 to 64, pixel heights 41 to 40.

### Stage 10 - the last look: done

The inventory again and the 45 screens again, and four messages from the
owner while it ran. What it found and did, and what is kept, is section 14
of `docs/DESIGN-AUDIT.md`; the after sheets are in
`docs/screenshots/design/after/`.

- **A layer's fills.** In the dark themes every field, chip, row and
  secondary button on a sheet, a popover or a menu had no shape - the fills
  were mixed over the card's ground and came out the raised ground's own
  colour, and so did a chosen segment. Every layer re-mixes them over its
  ground now, held to contrast in both dark presets, and a new raised ground
  not in the list fails the test.
- **Today's masthead** (the owner): no day arrows where the month is beside
  the day; a subgrid of the day's column and the task column, so the chip,
  the doors, the progress and the view toggle stand on the task column's
  two edges; the time on the day's own line with the date. The task column's
  floor grows with the window, 320px at 1024 to 440, so the half over it
  fits at 1366. The quick add's time, words and length are one line of three
  touching controls with one halo.
- **A status and its actions on one row** (the owner): a pasted list's
  count, a colour's name and the days staged stand at the left of their
  buttons' row; every Cancel is quiet and first; the last underlined links
  are buttons.
- **Check boxes** (the owner): one tick path through a mask, centred at 24
  and 18px, where the rotated-border tick sat on the small box's edge; a
  reduced-motion bug that shrank a ticked task's box is gone.
- **Phone defects found:** the whole journal's month had no styles below
  1024px, and the 44px floor for fields made four writing boxes one finger
  tall.
- **The retired tokens are gone**, declared nowhere; every weight and every
  line height but the five smallest boxes' is a token; no tracked capitals.
  The Focus screen's way out, the timer's Try and buttons, the floating
  clock, Later, the evening card, the day peek, the reminder, the Focus
  strip, Settings' calendar and restore rows and the template sheets lost
  their edges or became the kinds. Three bottom sheets are centred cards
  from 600px.

Changed tests: `e2e/header.e2e.ts` measures the new masthead - no day
arrows, the doors and the toggle on the task column's edges, nothing moving
when the day changes, which it now reaches through the month; `library` and
`overnight` move between days through the month too, with a `goToDay`
helper; `DayView.wideLayout.test.tsx`'s arrows test is now that the wide
header has none and the month moves the day. `design.test.ts` folds the five
retired tokens into one count, declared or named, at nought; adds the
layers' fills and their contrast in the dark presets; and the ratchet goes to
weights 0, tracked capitals 0, number line heights 5, borders drawn 51,
pixel heights 20.

## v2.24 - North as one page, a window after sleep, and the day's timeline

Asked for in one message that replaces everything asked about North, the
timeline and Review's counts earlier the same day, in nine stages. The rules
over all of it: DECISIONS and CONVENTIONS kept; goals never measured, no
streak, no red, no verdict; the repo carries none of the owner's text and
every line in a test is a generic one; after each stage the tests are green
and this section says where the wave is.

The brief, as understood:

- **A. The text's rules**, for display only - the text stays the one string
  typed, and a backup carries it unchanged. The lines before the first
  heading are the introduction. A line in capitals is a heading and owns
  everything to the next heading or to a line of only `---`, blank lines
  included. Everything after `---` is the signature. A text with no heading
  reads as it was written.
- **B. The North page.** A quiet goal at the top, one line, edited in place,
  the rest of a goal behind More and a title enough to save; the
  introduction, the headings unfolding on a hover or a tap, and the
  signature at the foot, a little larger with more air over it; one field
  with Save and Cancel, capitals and `---` drawn heavier while typing, and a
  grey line saying both rules; an empty page is one line and one button; one
  column, one rhythm, no frame, card or shadow on the reading page, and the
  buttons in one style in one place.
- **C. The day.** The signature always there as one quiet line, and the
  headings as a quiet list unfolding the same way: a narrow column beside
  the timeline on a desktop, one folded line on the phone. Never the
  introduction. A switch, on by default.
- **D. A window after sleep.** The introduction and the signature over the
  day, the first time the app is opened after five hours closed and never
  twice in twelve; closed by its button, Escape or a press outside, with no
  timer and no tick; never with no introduction, in the demo or switched
  off. The time is a device fact beside the day North was read, outside the
  plan and outside sync. It replaces the morning's opening on the North page.
- **E. The timeline.** The hour marks and the blocks on one scale, held by a
  test; a thin now line with the time beside it, the hour mark near it
  hidden, moving every minute, the grid opening with it in its top third;
  the running block's "ends in" and, in a gap, the next block's "starts
  in"; past blocks a step back; free labels from half an hour, small and at
  the left; the sleep hours one quiet ground.
- **F. Review's counts** - how many of the last 7 and 30 days each repeating
  block happened on, a number and nothing else.

### Stage 1 - what was already there

Built earlier the same day, from the messages this one replaces, and kept:

- The heading rule reaching to the next heading, blank lines as paragraphs,
  the introduction always shown, the round trip held (`0e41084`).
- The reading page: the introduction, the headings unfolding over the page
  under a resting pointer and in the page on a press, one row of buttons
  (`16d92c8`).
- The field: one textarea, Save and Cancel, capitals drawn heavier while
  typing, an empty page as one line and Write, no cap on length (`2e6501a`).
- All of F, since v2.23 (`66e71a1`): "How many times" on Review, the last 7
  and 30 days per repeating block, computed from the days as they are.
- Part of E: free labels already start at 30 minutes, the now line already
  moves every minute and hides the hour mark it would cover, and the wide
  grid already opens with now in its top third.

### Stage 2 - A, the text's rules: done

A line of only `---` - spaces around it aside, and nothing else counting -
ends the headings, and everything after it is the signature, in paragraphs;
after it nothing is a heading, capitals or not, and a second `---` is a line
of the signature. `parseNorth` returns the signature beside the
introduction and the sections, and `northLineKinds` reads each line of the
text as a heading, the mark or text by the same rule, for the field to draw.
Tests cover a heading with two paragraphs, the introduction, a text with no
heading, blank lines, the signature and a text without one, and a property
that every line but the mark comes out once and in order; planting capitals
after the mark as headings fails two of them. The round trip test's text
carries a signature now and still comes back from validate, export and
import character for character. The page already draws the signature whole
at its foot, so no text lost it between stages.

### Stage 3 - B, the North page: done

One column, 40rem, centred the way Settings is. Under the page's name, each
goal is one quiet line, and a press on it edits it where it stands: the
title in a box that wraps, Save or Enter, Cancel or Escape, and More for
the why, the who, the two lists and the rules. At the end of More, under a
hairline, the rarer things: Archive this goal (at once), Add another goal
(keeps this one and opens the next, and at four the sentence saying so),
the archived fold, and rules with no goal. With no goal and a text, the
line is Add a goal; an empty North stays one line and Write. The goal cards,
the Goals fold, Edit goals and the Compose form are gone, with their styles
- `NorthCompose.tsx` deleted, `RuleText` moved to its own file, `NorthGoals`
new. The field draws heading lines and the `---` mark heavier - the mark on
a quiet band as well, because three heavier hyphens are still three short
strokes - by `northLineKinds`; the grey line says "A line in capitals
becomes a heading. A line with --- starts the signature."; and the empty
field shows an example of the shape, sized so none of it is cut off.
Examples in empty boxes are one invented goal and one invented shape of a
text, nobody's.

The measuring pass read the field as two texts painted over each other on
every line - the field's transparent value over its own drawing - and
`scripts/audit.js` now counts a field whose text is fully transparent as
painting none; planted, a visible value over text and a placeholder over
text are still reported, and a transparent value is not. The sweep's North
screens are North, morning, heading open, goal (the editor with More) and
writing (the field); all clean at four widths in both themes. The tour's
North step starts at Write and ends on the goal's Save, and walks on both
devices.

### Stage 4 - C, the day: done

`NorthDay` in place of the headings row under the day's title. Where there
is a rail it stands in the rail, between the templates and what is next:
the signature as one quiet line and the headings as a quiet list in the
rail's small tracked register, each opening its words by the page's own
`NorthSection` - a resting pointer lays them over the column, and what
follows in the rail steps back while they are read; a press opens them in
the column. Between the templates and the digest rather than at the rail's
foot, because at the foot a 768px window needed the rail scrolled to see
the signature; the day's numbers are what gives way there now. Where there
is no rail it is one line under the day's title - the signature, or North
where the text has none - and a press opens the headings under it. Never
the introduction, and nothing at all when the text is only introduction.
The switch is "North on the day", on by default; the field stays
`stripOnDay`. Tests cover the parts on the day, the introduction kept off
it, both shapes, the switch, forty headings and a day change; the browser
test walks the rail's hover on a desktop and the folded line's taps on the
phone; the sample seed carries a signature; every Today screen measures
clean at four widths in both themes.

### Stage 5 - D, the window after sleep: done

The app opens on the day. The first time it is in view after five hours
out of view, and never twice in twelve, North's introduction and signature
open in a window over it - one Close, and Escape and a press outside do the
same; no timer and no tick. Never with no introduction, in the demo, or
with "North after sleep" off (on by default, only off carried). The rule is
`northWindowDue` in `lib/northRead.ts`, pure, over two device moments -
last in view, last shown - written on arriving, on every minute in view and
on leaving view; a tick that comes back hours late is a laptop waking and
opens the window then. The sleep schedules were not used: they say when
somebody means to sleep, and the nights this is for are the ones that did
not go to plan. The morning's opening of the North page, its Start the day
and the day-read key went; the Monday goal card waits under the window
rather than standing beside it.

Two things the tests found. Leaving view is only leaving from in view: a
tab closed hours after it went out of view fires pagehide too, and wrote
the break's start as the closing - a test plants that and fails. And any
reload writes the moment it leaves, so the browser test, the sweep's new
Today (North after sleep) screen and the look script all set the break
back after the app's own pagehide; a picture of the sweep's screen shows
the window it measured. Tests cover five hours against two, a night shift
against a nap, twelve hours, no introduction, the switch, the demo, a
device never seen, the memory staying out of the plan, and the old key
cleared; the app shows it over the day, closes it three ways, and opens
on the day.

### Stage 6 - E, the timeline's scale: checked, and one thing fixed

Measured on the sample day in a browser: every block and every hour line
is placed by the same map of its minute (`computeVerticalLayout`'s
`topPx`), and a block that starts on an hour starts exactly on that hour's
line. The hours are uneven on purpose - CONVENTIONS 4: a short block or gap
is given the room it needs to be read and pressed, and at 1366x768 the
whole day fits by drawing an hour anywhere between nothing and seventy
pixels. What was wrong was the labels: an hour mark inside a block's body
put its number beside the block, and the eye read it as the block's time -
the owner's "13:30 drawn at the 14:00 mark", which was 14:00, a third of
the way down. `legibleHourLabels` no longer labels an hour strictly inside
a block; the block says its own start and end, and an hour at a block's
edge keeps its number. Tests: a block starting on an hour has that hour
line's top on a day whose hours are measurably uneven, a block starting
between two hours lies between their lines, and no labelled hour stands
beside a block's body; planting the labels back fails two.

### Stage 7 - E, now, the running block, the past, free time, sleep: done

- **Now**: a 1px line in a softened now colour, and in the hour column a
  small rounded marker with the time to the minute in the line's colour -
  back after v2.6 took the line's clock away, because on an unevenly spaced
  grid a line between two hours does not say where between. An hour label
  inside eighteen pixels of it is dropped; the minute turns over on the
  minute rather than a minute after mount; the wide grid still opens with now
  in its top third.
- **The running block** loses its ring and takes a third of its colour
  rather than a fifth, and says "ends in 25 min" on its time line; in free
  time the next block says "starts in 10 min". One line on one block, from
  `nowHint`, and nothing else counts down.
- **The past** - a block that has ended, `isPastBlock` - steps back: its
  colour quietened and its time faded once; its title keeps its ink. Never a
  colour of its own. Three shapes were measured and dropped first, each by
  the sweep's contrast pass: the whole block faded, the words in the second
  ink, and the title faded.
- **Free labels** stay from half an hour, at the blocks' own left, upright,
  in the third ink, with the rules either side gone - quieter rather than a
  smaller size, because 11px is already the smallest Today uses and a fifth
  size is what CONVENTIONS 5 counts.
- **Sleep** is one quiet ground: a lighter tone, no hour or half-hour rules
  across it, and an edge that fades only toward the waking hours.

Tests: the hint for a running block, for the next block in free time, for
hours and minutes, and after the last block; past for ended, running and
unsized blocks; on today's grid the marker's minute, the one hint and the
past class, and on any other day none of them; the marker above the blocks.
Today and Templates measure clean at four widths in both themes.

### Stage 8 - F, Review's counts: done

Read against the brief - a count beside each block a template put on the
days, from the days as they are, no percentage and no colour - one thing fell
short of it and one was true and untested.

- **Only the number.** Each line said its windows in words, "2 in the last 7
  days, 3 in the last 30", the same phrase for every block, and on a phone
  the phrase broke in the middle of seven lines of ten. The counts are a
  table now: the block's name heads its row, a number stands under each
  window, and "Last 7 days" and "Last 30 days" are said once, over their
  columns. A template's name heads its rows when there is more than one. The
  table is never wider than a line of reading, so on a wide card a number
  stays near its block, and on a phone the columns are as wide as their
  names.
- **Nothing saved.** A test draws the counts, ticks a block and reads what
  was saved: drawing writes nothing, the count moves with the tick, and what
  the tick saves is the plan with that task done and nothing beside it.
  Planting a count in storage while drawing, in the plan while counting, or
  in the plan with the tick fails it, each one.

Tests: a row per block with digits alone in the number cells; two templates
under their names with the windows named once; the saved plan above. Review
measures clean at four widths and on the phone, in both themes.

### Stage 9 - the phone, the gates, and what they found: done

Every screen at four desktop widths and on the phone in both themes, the
screens that depend on the clock again at 22:00 and at 09:00, and the
audit's self-check; then the browser tests, the keys and precision passes
and the privacy guard. What they found, and what changed:

- **Two presses reached into their neighbours.** On a phone the folded
  North line stood two pixels under the goal's line, and each is a 44px
  target around its middle, so a press on the goal opened the headings:
  the line is a step lower now. On North the goal lines were four pixels
  apart, and with the list half scrolled under the top of the screen a press
  on one went to the next: sixteen apart on a finger. The sweep counted six
  and two; both are none.
- **Running means what the day means.** A block ticked done before its end
  still said "ends in", and one ticked done ahead of its time could say
  "starts in". The grid takes the running block from `activeTask`, the
  header's own rule, and the next from the blocks not done; a block running
  past the grid's edge says its real end rather than where it is cut.
- **Said once.** With the grid beside the header, the header said the
  running task's time left and the block said when it ends; in free time
  the rail's Up next said "in 50 min" beside the block's "starts in 50 min".
  On a wide screen with the day pane showing, the header names the task
  without its time left and Up next leaves a start the grid is saying; with
  the Tasks focus, or on a phone, both say it as before. CONVENTIONS 23 says
  what the now line and the running block carry now, and why.
- **On a phone the day does not scroll itself to now**, and DECISIONS says
  why.

Tests: the hint for a block the day does not call running, for a real end
past the grid's edge, and for blocks ticked done; the header and Up next on
a wide screen, with the Tasks focus, and on a phone. Each failed before its
change.

DECISIONS: "The signature stays on the day, the introduction comes after
sleep, and now says its minute".

Left for later, from the same day: the library's adding flow, which the
owner found a chore to fill in, goes into the design pass's library stage.

## v2.22 - the quality wave, part one: the pictures

The owner's brief after the first real week was one sentence: nothing that
looks unprofessional, nothing that makes you think, and this is going to be
one of the main things in the day. The feature list already covers what a
calendar does for one person, so the wave is a quality wave, in this order:

1. **The pictures, looked at** - every screen at 1366 and on the phone, in
   both themes, read one at a time and fixed until nothing was left. Done;
   see DECISIONS "The pictures, looked at". The sweep leaves the pictures
   behind now (`--shots=DIR`), so the next look costs one command.
2. **One voice** - every label, verb and sentence consistent across screens.
   Done.
3. **One clear action per screen** - the rarely-pressed demoted, the empty
   states saying the one thing to do. Done.
4. **An answer to every press** - hover, press, tick and undo consistent,
   transitions one length, nothing jumping. Done.
5. **The first minute** - a fresh open with a clear path and no thinking.
   Done.
6. **Settings in plain words**, grouped, fewer switches on the screen. Done.
   Parts two to six are one DECISIONS entry, "Every press has an answer,
   and every screen has one thing to do".
7. **Trust** - A1 run by the owner; the morning digest push if wanted. A1 is
   the owner's, with its checklist in CHECKS-BY-HAND; the digest stays where
   "D3 is not built" below leaves it.

What part one found is the reason the rest is worth doing: the navigation
rail could be scrolled empty by anything that scrolls; the sweep had been
photographing the timer for fourteen versions where it thought it had the
Notes and Journal popovers; and every time field on the phone had shrunk to
38px the day the base rule went weightless, because the check either side of
that change ran on a desktop. None of these was visible from the passes.
They were visible in a picture.

## v2.22, part two - North is a text

Asked for the same evening, in one paragraph: a personal text seen every
morning, a dozen short lines in blocks, no headings and no fields, typed by
the owner and never suggested by the app. Built in four stages, one commit
each: the model held by tests (it was already there as the picture), the
editor on the page, reading as blocks with the goals folded under and the
morning opening, and the phone with the browser test on both devices. See
DECISIONS "North is a text". The repo is public and carries none of the
owner's text; every line in a test is a generic one.

## v2.22, part three - the rest of the quality wave

Parts two to six, done in one sitting and written up together in DECISIONS
"Every press has an answer, and every screen has one thing to do": one
vocabulary for making a thing (New category, New list, New template, Edit
goals); a hover for the eleven kinds of control that had none, in the
register the rest of the app uses; a first screen with one filled button on
it and no door onto nothing; Delete moved inside the editor for templates
and categories, with a scratch note's three rarer actions behind More; and
Settings read as a document, every section with its heading and every
description cut to what the setting does. Nothing was removed from Settings
and no switch was hidden: what "fewer switches" turned out to mean was fewer
words in front of each one.

## v2.23 - three small things, and a count instead of a streak

Asked for in one message, in five stages, one commit each - after a message
an hour earlier that had asked for the goals to go altogether. The owner's
second thought kept them and lightened the form, and nothing of the removal
reached the repo. See DECISIONS "A line in capitals is a heading".

1. **Headings in the North text** - a line in capitals is a heading and the
   lines under it, to the next blank line, are its text. Parsed for display
   only (`lib/northSections.ts`); the text stays the one string typed.
2. **Reading with the lines folded** - the page shows its headings; the lines
   under one come on a hover, over the page, and on a tap in the flow on the
   phone. A text with no heading reads as before.
3. **A lighter goal form** - a goal is a What until more is written; the
   other fields and the rules wait behind Add more.
4. **North on the day** - the headings in a row under the day's title, each
   opening its lines under the row; a switch under Nudges, on by default.
5. **How many times** - on Review, beside each repeating block, how many of
   the last 7 and 30 days it happened on. A count and nothing else.

## v2.21 - eight reports in one day, and what they had in common

The owner used the app for a day and reported eight things. Six were real
defects, every one of them older than the wave that found them, and none of
them from v2.20. What makes them worth a section together is that they are
four shapes, not eight problems.

**A day resolves something once and never asks again.** A list bound to a
block, then a note written on a block, neither reaching days already on the
calendar - "speju is naujo turiu idet". Both were fixed one field at a time
before the shape was obvious. It is general now: a task remembers what its
block last gave it (`Task.fromBlock`, the idea `templateNote` already carried
for one field), and a day opened later takes the block's new value for any
field it is still carrying the old one in. A field somebody has since changed
is left alone, and that distinction is the whole point: after a stamp the
day's title *is* the block's title, so comparing them says nothing about who
put it there.

**A measuring pass that has never been made to fail.** The sweep ran at three
widths and reported zero while the page scrolled sideways at 1024 - the one
width where a layout meant for wide screens is at its tightest, and an iPad in
landscape. Its three columns needed 968px and the window gives 926; the
arithmetic in the comment had been done by hand twice and both times it forgot
the 56px navigation rail. The sweep walks 1024 now.

**Nothing measured how a thing is placed.** The tick was drawn against the
left wall of its own checkbox, running from -0.1px to 10.5px across a twenty
pixel box, because the mark is a box turned forty-five degrees about its own
top left corner and the numbers placed it before the turn. The digest kept
three straight edges and let the air between them change on every row.
`npm run precision` is new and checks both, on every screen in both themes.
It reported nothing for its first two planted defects, which is how the hole
in it was found before it was believed.

**A browser contract taken on trust.** The install offer arrives once, early,
and the listener was armed inside the bundle - so on a fast load nobody was
listening and Settings said "Not available here" for the session. It is caught
in the head now. `color-scheme` was never set, so every browser-drawn thing -
scrollbars, native dropdowns, date pickers, the autofill wash - came out of
the light set on a dark screen. The backup's retry re-read a sha through a
plain fetch, which GitHub caches for a minute, so the retry could carry the
sha that had just been refused.

And one sentence that claimed something it could not know: "another device
wrote the backup at the same moment", read by an owner with one device.

## v2.20 - the night pass

**What is different this morning:** the app is quieter and the loud things
mean something. Blue used to be on every ticked checkbox, every chosen
segment and both kinds of now line - seventeen blue things down a full day -
so it marked nothing; it is back to being the one thing on a screen you can
act on, and gold is the one thing happening now. Every period arrow is a bare
glyph instead of a bordered box on two screens and a bare glyph on a third.
Corners come in three sizes with nothing left hard-coded, so a theme can
reach all of them. Everything that moves takes one of two durations, nothing
moves under the cursor, and reduced motion turns things off rather than down.
Every screen lost exactly one element - a word on the sleep band, a summary
line that counted what the grid below it draws, a count that the line above
it already spelled out - and one screen, North, was left alone because there
was nothing on it left to take. Numbers in columns line up. And two things
that only broke at the largest text size, which nothing in the repo had ever
looked at, are fixed.

The wave's own account, with before and after numbers and every decision
made without the owner, is in [`audit/NIGHT.md`](audit/NIGHT.md). Screens
before and after, both themes, are in
[`screenshots/night/`](screenshots/night).

## v2.19 - the reading page stops naming its own fields

v2.18 fixed the layout and the owner read the result as *"very much like
Notion, where I would just get a notepad and write it down instead"*. That is
a diagnosis rather than a complaint: the window looked like a **record
somebody filled in**, because it was full of field names with values under
them - "What I do", "What I don't do", "What pulls me off this", "61 days
lived toward this" - each in a box with a rule down its left.

One rule for the wave: **North is a page somebody wrote. Editing is a form;
reading is not.** Everything that names a field, counts anything, or can be
pressed moved into Compose. What is left on the page is a picture, four
goals, and under each one a title, a sentence, a sentence in another voice,
and the lines that cost.

### The count, which is the wave's own answer

The brief's test: photograph the page at 1920 and count the words on it the
owner did not write, not counting "North" and "Compose". The target was zero.
The result is **three words, ten times** - and here is why each one is still
there.

- **"never"**, six times, once at the front of each away line. It is the
  opposite of a label: a label sits above content and names it, and this sits
  inside the sentence and finishes it. Somebody typed "go quiet for a day"
  into a field called *what I don't do*; on a page where that field has no
  name, "never go quiet for a day" is the same sentence, whole, in the same
  voice. Take it away and the away lines read as more things to do, which is
  the one misreading [`RESEARCH-NORTH.md`](RESEARCH-NORTH.md) says must not be
  possible - an unanswered "don't" is threat without efficacy, the condition
  Witte's model predicts backfires.
- **"If"** and **"then"**, twice each, one pair per rule on the page. A rule
  is one sentence the owner wrote in two halves, in two boxes; these are the
  joint between them and nothing else. They used to be small caps and an
  arrow, which is a diagram of a sentence rather than a sentence, and that is
  the part that went.

Nothing else on the page comes from the app. No head over any list, no
invitation where a list is empty, no count of anything, and no control of any
kind - **the reading page has no buttons on it at all** beyond Compose in the
corner.

### The count of days is gone, one version after being kept

v2.18 asked whether "61 days lived toward this" could fall, found it could not
- `goalAge` is arithmetic on two dates and `createdAt` is stamped once - and
kept it. That reasoning was right and it answered the wrong question. The test
it passed was "is this a streak". The test it fails is a different one: a
figure that counts something is a spreadsheet's idea of a page whatever the
figure can and cannot do to you, and North is where somebody comes to remember
why rather than to check a number.

It is gone from the reading page, and `north.test.ts` holds that nothing on
that page is a number at all - not a count, not a digit. `goalAge` stays,
because the archived fold inside Compose still says how long a goal was
carried before it was put away and the review's North line still says an age;
both are records being read rather than a page being lived on. DECISIONS
carries the argument.

### What moved into Compose

Everything that acts. What pulls you off a goal is a field under that goal
now, with the instruction beside it rather than printed on four cards; the
rules keep their five-per-goal cap, their edit and their two-press delete, and
they write at once rather than on Save - the same exception the archived fold
already makes, because a rule is its own entity and deferring it would mean a
Cancel that had to un-write sentences somebody watched appear. Rules with no
goal went with them, which is also where the fold that orphans them lives.

Two things fell out of that move. `unfiledRules` has to be asked about *every*
goal and offered only the active ones - asked about the active ones alone it
spills an archived goal's rules into the waiting group the moment anybody
archives anything, which is what a test that had passed for four versions
started saying out loud. And the window now counts an unfiled rule as
something to compose, because deleting the last goal leaves its rules behind
on purpose and a window that hid the only way in would have hidden them with
it.

### And nothing is drawn around a goal

Four cards with a two-pixel rule down the left of each is four cells of a
table whatever is written in them. The gaps do all of the separating now: 56
pixels between rows and 64 between columns, against about twelve inside a
goal. No edge, no background, no padding pushing the text off its own column.
Four goals came to 971px of page before the wave and 814 after it, with more
air in them, which is what comes of not printing a label over every list.

## Where a rule shows up after it is written

Read first, because the answer was not what the question assumed.

**There is one list.** `data.ifThens`, and nothing else. The separate if-then
board with its own day-view surfacing went in v2.0, along with the `dayTypes`,
`when` and `lastSurfaced` fields it needed; `storage.ts` still names the dead
`if-then` widget id for payloads written before then. There is no second list
and no strip under the day cards - that was the old board, and it is gone.

**A rule appears in two places, which is what was wanted.** Under the goal it
protects, on the North page and in Compose; and on the day, inside the card
that brings a goal forward. Nothing else reads one.

**But the second place almost never happened.** `northPrompt` shows that card
on a Monday, or on a morning after a day that got away, and until this wave
the rule was on the slow-day version alone - a Monday deliberately carried
none, on the argument that a Monday is a morning with nothing behind it yet.
Which means a person whose days do not get away saw the card only on Mondays,
and their rules exactly nowhere outside the North window.

That argument is right about repair and wrong about what an implementation
intention is. Gollwitzer and Sheeran's finding is that the if-then link works
by being loaded *before* the moment, and that a plan rehearsed at least once
does more than a plan written once. A Monday is the better of the two
mornings for that, not the worse one. So the Monday card carries the rule
too, without the slow-day card's lead over it: "here is what you wrote
yourself" exists to say the sentence is the person's own rather than the
app's advice, and a Monday has nothing to defend against.

**And the sentence was being drawn twice.** `RuleText` on the North page, and
a hand-written copy of the same markup inside `NorthCard` - two
implementations of one sentence, CONVENTIONS 23, and they had already
drifted: v2.19 turned the arrow between the halves into the word it stood
for, and the card was still drawing an arrow. One component draws it
everywhere now, and a test holds that the card reads exactly what the page
reads.

**The colour a rule could carry is gone**, and DECISIONS has the reading: it
was nine swatches whose whole effect was two pixels of edge on one line of
one screen.

## Before that: v2.18 - the layout wave

The brief added nothing to the app. It rearranged what was there, on the
argument that a screen where five kinds of content sit at one weight is a
screen the eye has nowhere to start on.

**North.** The window was 62ch wide, so on a 1920 screen four goals came to
1956px in a 434px column and three of them were below the fold - on the one
screen whose whole point is seeing all of them at once. It is 1360px now with
the cap on the text rather than the window, the goals stand two abreast in a
grid, and four of them fit a 1080 screen without scrolling. Under that: one
order of importance out of the four sizes CONVENTIONS 5 allows, with weight
and ink doing the last two steps; the picture is the only t-lg on the page; a
goal with no rules yet spends one line saying so instead of four. And the
pair shipped in v2.17 as "He does" and "He doesn't" is first person now - the
app had started narrating its owner on the one screen meant to be their own
writing, and [`RESEARCH-NORTH.md`](RESEARCH-NORTH.md) carries the correction
rather than quietly reading differently than it did.

**The age on a goal was read against the streak rule and stays.** The
question the brief asked was whether "61 days lived toward this" can fall. It
cannot: `goalAge` is arithmetic on two dates, and `createdAt` is stamped once
by `addGoal` and the Compose draft and by nothing else in the store - edit
does not restamp it, archive deliberately does not so an archived goal still
knows how long it was carried, and restore does not. No missed-day arm to
break and no zero to reset to, so it is not a streak with the word filed off.
It stays where "Review says facts, and no longer a streak" already put it,
drawn at the smallest size in `--faint`, and `north.test.ts` now walks a goal
through edit, archive and restore and holds the number against each.

**What the month showed on hover, before this wave: nothing.** Written down
because the brief asked for the inventory first and because the answer is not
what anybody assumes. `onPointerEnter` on a cell only ever painted, and only
while a template was in hand; there was no preview, no tooltip and no title
attribute. What a cell said, it said at rest: the day number, two or three of
the day's own lines with the key ones marked, "+N" for the rest, a done/total
and a bar on a day that is over, the template's colour as a wash and a strip,
and two small marks for a journal and a note. The whole day was one press
away, in the day card. There *had* been a hover preview - it opened the real
day card after 400ms and closed the moment the pointer left the cell, so the
pointer could never reach it - and v2.8 removed it, with the owner's words on
the record: *"we cannot move the mouse down onto that list"*.

**And what it shows now.** A read-only layer, and read-only is the whole
design: the v2.8 failure was a surface the pointer had to arrive at, and
there is nothing on this one to arrive at. Which day, what shape of day it
came from, how many tasks and how many of those are key, the key ones by
name, and whether anything was written that day. It waits a quarter second
before opening, so crossing the month on the way somewhere shows nothing;
once open it swaps in place with no close and no second wait; it hides at
once when the pointer leaves the month; focus shows the same thing without
the wait; and it refuses to appear at all rather than cover the day it is
about. On a phone it does not exist, because a press already opens the day
there and that is the right answer.
[`e2e/calendar-peek.e2e.ts`](../e2e/calendar-peek.e2e.ts) holds all of it by
counting how many times the layer is *added to the page*, which is the only
honest way to ask about flicker - and that count is what caught the first
version of it remounting on every step across the month.

## Three screens the owner reported from, mid-wave

Outside the brief, and each one a real defect rather than a preference.

**The library panel had two buttons under one word.** "Counted in" offered
the list's own unit beside a built-in pages track, so a list of books whose
unit is "page" drew two buttons both reading "pages" that did different
things. The report was "sometimes you press the wrong one", and it was the
app's fault. It is called page numbers now. In the same panel: how long a
book is can be typed - `LibraryItem.total` and `updateLibraryItem({ total })`
had both existed since the feature did, and the panel drew "of 139" with
nowhere to put the 139 - and the six rows share one label column, where half
of them used to lay the label inline at 78px and half stacked it over a
full-width box. Delete list came out of the row of nine colour dots and onto
its own line at the foot.

**The masthead read after its arrows.** Two bordered 44px squares, then the
word, which left "Today" as the one thing in that column not standing on the
column's own left edge; and the date under it had a row-gap of zero against
the underside of those buttons. The word leads now, the arrows are the same
bare glyph the month's own arrows are sixty pixels below them, and the date
has a step of air.

**The hour axis counted in whatever fitted.** It kept each hour that happened
to clear the last one kept, and because the grid is not linear a real
afternoon printed 06, 08, 09, 11, 12, 13, 14, 16, 18, 19, 21 - every number
correct and the sequence unreadable. It takes the smallest regular step that
clears everywhere now, anchored on the clock, and 1366x768 reads 06, 08, 10,
12, 14, 16, 18, 20. The greedy walk stays as the last resort, because text
over text is the one rule that cannot bend. The now line also starts twelve
pixels earlier so its dot always ends something: now is almost always inside
a block, the line is drawn under the blocks on purpose, and what was left on
screen was one orange circle at a block's corner.

## Before that: v2.17, the hunt before the week

**Was it ready for the week? Yes, with one thing to watch.** Fourteen
findings, two of which would have spoilt a real morning - an app left open
overnight kept yesterday and wrote the morning's first task onto it, and the
update notice covered the whole tab bar on a phone so no tab could be pressed.
Both are held by tests that were red before the fix. Nothing A-level is
outstanding, three passes over the app found no new A or B on the last two, and
the closing sweep - every screen, four widths, both themes - reports zero.

The one thing to watch is S-01 in [`audit/HUNT-v2.17.md`](audit/HUNT-v2.17.md):
if the app ever comes back *blank* after a deploy, that is the suspected one, it
was never reproduced on a clean run, and the file says which line to look at
first.

Every gate is green, including CI - but one of them took a change to get
there, and it is worth knowing why. The browser job failed three runs in a row
at `playwright install --with-deps`, before a single test ran, because Google's
Chrome apt repository was serving a `Packages.gz` whose hash did not match its
own `Release` file. `--with-deps` runs `apt-get update` across every repo on
the runner, so an outage in a repository this project never touches -
Playwright ships its own chromium, from its own CDN - failed a job that did not
need it. The install is in two steps now and the job is green again.

The wave added nothing to the app on purpose, with one exception the owner
asked for mid-wave and then extended: a list can now be bound to a template
block that already exists rather than only to one being made, and a list can be
made from the block that is about to be bound to it rather than four screens
away. Everything else is a fix. Three of the fifteen findings were the owner's
own, two of them from one screenshot of one row - which is the argument for the
three measuring passes this wave added to the sweep rather than for anything
else it did. The full account, finding by finding with how to
repeat each one, is in [`audit/HUNT-v2.17.md`](audit/HUNT-v2.17.md).

**Before that: v2.13.** Four passes over a real day: every screen at three sizes in both themes, every
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
| North headings row | The text's headings in a row under the North line, each opening what is under it under the row; off under Settings > Nudges |
| North card | After a slow day or on a Monday, one goal comes forward with its reason - on a Monday with one line of what you do to deserve it, for the week. Never a word about how yesterday went |
| Evening close | A quiet card at a set time, or the moment the last task is ticked. One sentence about the day, an optional line about the best moment, the journal's two optional questions, and a way to end it. Never a word about what was not done - see CONVENTIONS section 15 |
| Journal | Three lines a day, none required: "Today: ..." under the North line, and the two questions at the close. Never counted, never streaked; read under the day in the week's agenda, copied as markdown for a week or a month. See `lib/journal.ts` |

### The other tabs

| Tab | What it is |
|---|---|
| **Calendar → Month** | A month that fits without scrolling; every past day shows its ratio, a thin bar, what was carried on, a dot when every key task was kept. No red at any threshold |
| **Calendar → Week** | Seven columns of one shared timeline. Drag a block between days, tap to open, tap empty space to add, stamp per column or the whole week. Three days at a time on a phone |
| **Templates** | Named, coloured sets of blocks; stamped onto dates by clicking or dragging, nothing commits until Save. A week template is drawn as a week - the calendar's own seven-column layout, fed template blocks, so a template week and a real week are drawn by one set of rules. Blocks sit at their real times; pressing one opens its note, its KEY mark and its removal in a panel under the grid; a block with no time sits under its column rather than vanishing; dragging moves it between days. "Add to" is seven day switches with Weekdays, Weekend, All days and Only-this-day as presets over them, and a line saying where the next press lands. The combination survives the add, so a rotation is set once |
| **Library** | Lists worked through a unit at a time. The add line is the words plus a unit control and a count control that already hold an answer, remembering the unit per list; a typed "Dune, 20 chapters" still works and the controls redraw to show it. Lists fold and a chip row jumps between them; in each, the item you are on gets a card with its progress and its pace note while everything behind it is one quiet line. An item can be counted in the list unit, in pages, as a film, or as seasons and episodes. A session goes onto a day in two taps, or onto a template in one flow; ticking it off advances the book. When one ends, the list says what it moved on to and puts a sitting on today in one press - the block was already bound to the *list*, and until v2.0 nothing said so |
| **Review** | Week and month facts, all derived from the days themselves: done over planned, deep work, key tasks, two charts, the goals' ages, what was read. No streak since v2.7. On a week, "Where the plan and the week disagreed": one line of facts per template block, sorted by disagreement, with a Copy - the reading the next brief comes out of. "How many times": beside each repeating block, how many of the last 7 and 30 days it happened on, a count and nothing else |
| **North** | One text, read every morning: short lines in blocks, a line in capitals a heading whose lines come on a hover or a tap. Under it, behind one quiet line, up to four goals - a What until more is written, then why, who it makes you, the deserve and never lines, and the if-then rules under each - edited behind one Edit goals that saves in one press. Nothing measured, ever |
| **Settings** | General, Sleep, Week, Categories, Nudges, Calendars, Backup, Sync, Appearance. General also replays the tour, in a sandbox. Nudges is exactly three rows since v2.5 - closing the day, when the evening starts, bringing a goal forward - and every setting in the screen has been walked against CONVENTIONS section 21 |

### Across the app

| Feature | What it is |
|---|---|
| Weekday templates | A template per weekday, so a new day opens already set up. A stamp by hand always wins |
| Repeating tasks | Daily, weekdays or weekly, materialised as real tasks. "Just this day" vs "every day it repeats" is a standing choice |
| If-then rules | Trigger plus action, under the goal it protects, in North. Never measured, never surfaced onto the day; one appears under the why on the card after a slow day |
| Later | Something to do, on no day, in the order you would pull it: one list since v2.7, where an Inbox and a Backlog were. Collapsed behind a plain count, nothing ever says how old anything is; one press puts an item on the day at the next free slot |
| Links | One optional address on a library item and on a task, typed in either editor. A small door on the library row, on the task title's own line, on Up next and on the focus screen, always opening a new tab, always its own target so the card's own press is unchanged. Typed without a scheme it is normalised on save - `http://` for a machine of your own, `https://` for everything else - and an address that will not parse says so under the field. One icon for a machine of your own and another for the internet, with the address in a bubble under it. Nothing about it goes to the network |
| What a block carries | A template block holds a note, a KEY mark and a category as well as a title, a time and a size, and every one of them lands on each day it stamps. The note and the mark defer to the day: what somebody wrote or unmarked on a Tuesday survives a re-stamp, and a block edited later reaches only the days nobody touched. Three key tasks per day is enforced in both editors, per day rather than per template, and at stamp time |
| A note as choices | A line beginning with `## ` starts a section, and its heading becomes a choice. The headings show on the task card and on Up next; pressing one opens it over the day with the others beside it, read-only, closed by Escape, the cross or the ground. No other markdown, ever - a stray asterisk in a shopping list is an asterisk. One checkbox per block shows the intro without a press, cut to four lines with a Read under it when there is more. Steps were folded into notes in v2.13 and every one of them survived as a line. The editor says the rule three ways since v2.14 - an example in the placeholder, one line under the box, and the card's own choices drawn live from what is typed - with a **+ Choice** button that writes the heading |
| Making a category | The `+` at the end of any row of category dots, in both template editors and in quick-add, with a pencil on whichever dot is chosen. The curated palette and no colour wheel - every colour offered already passes the readability gate. A colour another category holds is still offered, named for the one holding it. Deleting stays in Settings, where the question about the orphaned tasks lives |
| Return adds it | Four rows add a thing when Return is pressed in the title - quick-add, both template editors, the library's add line - and each says so at the field's own right edge, in the quietest ink there is, with nothing pressed and nothing hovered. The Add button beside it stays: the mark is for the hand on the keys, the button is for the hand that has never tried Return |
| Keyboard layer | Single keys for common actions; a card behind `?`. Never fires while typing in a box, except Escape. The control a key reaches names it in its own bubble - the rail's icons, and the header's two tools since v2.14 - and a stepper's arrows name what Shift does to them |
| Command palette | Ctrl-K / Cmd-K: run a command or find a thing. Linear scan, no index |
| Undo | One app-wide offer, five seconds, on the expensive mistakes |
| Snapshots | A full copy once a day in IndexedDB, seven kept, restorable from Settings |
| Cloud backup | The third copy: the plan as JSON in a private GitHub repo, written after the evening close, on the first open of a new day, and on a button. Token on this device only. Restore describes both copies before an armed replace. See ARCHITECTURE section 7 |
| Export / import | Plain JSON, both ways, deliberately manual |
| Sync | Optional, off by default, through a server you host. Per-entity last-write-wins with tombstones |
| External calendars | ICS subscriptions or file import, as a read-only layer. Free time counts them |
| Demo mode | `?demo=1` fills a sample fortnight under its own storage key. Today is lived up to the clock (never earlier than one o'clock), yesterday is finished so no banner sits above the first screen, and the seed carries a bound book, a backlog, a scratch stream and a task whose note carries two choices |
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
| **v2.17** | The hunt before the week the owner lives in this app, which added nothing and looked for what was already there. Two defects that would have spoilt a real morning: an app left open overnight kept the day it read at mount, so the header said Today over yesterday and the morning first task was written onto the day before - and the update notice covered the whole tab bar on a phone, so not one of the seven tabs could be pressed while a notice that is deliberately ignorable stood on it. Five more that would have grated - a 17px touch target, a Delete drawn exactly like the Edit beside it because one rule out-specified btn-danger and had defeated its own fix for versions, an undo toast over four tabs, a scratch row with one control twelve pixels taller than its neighbours, and the library binding, which turned out to be three different controls: reachable only while making a block in one editor, absent from the other one's add row, unlabelled in both, and hidden outright while the library is empty - which is the state a first template is built in. One component now, a visible label everywhere, and a list can be made from the block being bound to it. Five cosmetic, three of them rows whose contents did not line up. Three of the fifteen were the owner own, two from one screenshot - so the sweep gained the two passes that would have caught them, and the screen it had never opened |
| **v2.16** | Books into the library without a martyrdom. A whole shelf pasted at once - one line an item, an optional total after a vertical bar, and a live count of what the press will do including how many the list already has. A row moves by button as well as by drag and by key, and the loud row says what it is: the item every bound block will carry onto its next day. The binding says which book from the end that only named a list, and the empty case - the block keeps its own title - is finally said rather than discovered. And a quick-start preset that makes three empty reading lanes in one press |
| **v2.15** | What the timer sounds like, and what things actually took. Four sounds from one synthesiser and one table of parameters - off, soft, bell, alarm - chosen where the timer is started, with a start bell for the ten minutes nobody can look at the screen and five ways to end an alarm that is filling the room. The stopwatch stopped pouring its number away: started on a task, it offers to write down what that task actually took, and the number reaches the card and the week's reading. And the timer panel folded down to what it is for |
| **v2.14** | What the app knew and did not say. The note editor demonstrates the `## ` rule in its placeholder, says it in one line under the box, draws the card's own choices live as they are typed, and carries a button that writes the heading; a long note is cut to four lines on the card with a Read into the reader. Return adds a block, and the field's right edge says so in all four rows that do it. The door beside a title is three quarters of the title, in the meta ink, off its last word. A length reads as a number and a unit. And one pass over the whole interface asking what else it can do and never mentions, with a verdict written down against each answer |
| **v2.13** | One place text goes. Steps are gone and every one of them is a line in the note it sat beside, migrated at the single gate both loading and importing pass through and safe to run twice. A note with `## ` lines shows its headings as choices on the card and on Up next, and opens one at a time over the day. The week template is drawn by the calendar's own week layout instead of seven lists of chips. The link icon moved onto the title line, the day switches became seven identical squares, a category is made from the swatch row, and the current-time line stopped striking out the time of the block that is running |
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

Still true, and checked rather than assumed. The suite is green - **2647
tests in 162 files, plus 74 Playwright tests across two viewports** - the
typecheck and the build are clean, and `npm run sweep -- --phone` reports
**zero findings** with all three of v2.17's new passes armed, with
`--self-check` at 8/8. The working tree is empty and pushed.

One thing about running that sweep, found in v2.9 and worth the next
session's time: **it hangs when it is started from a backgrounded shell**
and finishes in about nine minutes in the foreground. Twice it sat for
twenty minutes on five seconds of CPU, and the phone pass needs more than
ten minutes, which is longer than one foreground call gets - it was run in
groups with `--only` instead. Nothing about the app; something about how
the process is started.

v2.14 sharpened that by accident. A run *started* in the foreground and then
moved to the background when it passed the ten minute mark hangs exactly the
same way - twenty minutes with nothing more written - so it is not only
about how the process is launched but about the shell it ends up attached
to. The same command in the foreground came back in 8m48. One `--hour`
per foreground call is the shape that works.

The count is five lower than v2.6's and the app is larger, which is the
shape of that wave: the Year strip took forty-two tests with it and Review's
streak seven, and the twenty-six that came in - the fold into Later, the
next free slot, the week's disagreements, the keys, the chip that asks -
are about things that exist.

v2.14 added twenty-two unit tests and three browser walks and removed none.
Most of them hold things that were already true and had nothing holding
them: that an open note has no mark beside it, that the door beside a title
is three quarters of the title in the meta ink, that pressing that door does
not tick the task off, and that the header's two tools name the keys that
also reach them.

Read that sweep line as stronger than the same sentence in v2.4. The pass
now sees through a fade, reads what a field says, walks a pinned clock
rather than whatever hour it was run at, settles a page before reading it,
and checks that a chosen control is drawn differently from the ones beside
it. Every one of those five was a hole it had been reporting clean through,
and the last one is the shape the owner had reported twice by hand. See
DECISIONS "A tool that cannot see a thing will say it is fine".

**Where to start:** [`MORNING.md`](MORNING.md) if you are the owner and it is 07:00. Otherwise the v2.16 wave below - which begins with an inventory of what already worked, because most of it did - then v2.15, which gave the timer four sounds and the stopwatch somewhere to put its number. Then the v2.14 wave - which adds nothing and puts six things the app already did where a hand can find them - and the sweep under it, which is everything else it can do and does not say, with a verdict on each. Then the v2.13 wave, then the v2.12 wave, then the v2.11 wave - a template block can carry a
note and a list of steps, so a meal block arrives with the recipe on it and
a morning routine arrives with its four steps. Under it, the v2.10 wave, which added nothing and fixed two
things - both about where focus lands when a panel closes, both found by
crossing the app on a keyboard alone. Its table also says what each of the
four passes measured, so the next session can measure the same things
without inventing them again. The v2.9 table under it is closed, and so are
v2.8, v2.7, v2.6, v2.5, v2.4, v2.3 and v2.2, commit by commit. The debts
table further down has gained one line and lost none: `docs/AUDIT-v2.9.md`
names what the two old ones would cost.

### The v2.17 wave: the hunt before the week

The wave that added nothing. The owner starts living in this app for a real
week - real mornings at 07:00, on a phone and on a desk - and every wave
before this one ended on "done" and then had one more bug crawl out of it. So
this one went looking, first, for him. The whole account, finding by finding
with how to repeat each one, is in
[`audit/HUNT-v2.17.md`](audit/HUNT-v2.17.md). What matters here is what it
changes about the app and about how it is measured.

**Twelve findings: two A, five B, five C. Ten fixed, two left on purpose, one
suspected and never reproduced.** Every gate was green before it started -
2629 unit tests, 62 browser tests, a clean typecheck and build, ten of ten CI
runs - which is exactly the point: none of the twelve was going to be found by
running the suite again.

**The day the app is standing on.** `todayKey()` is a reading, not a
subscription, and every caller in this app took it once. That was invisible
for as long as every session began with a page load, because a phone swaps the
tab out overnight and the morning's first look is a fresh mount. It is not
true of the desk the owner works at all day. Left open overnight, the header
said "Today" over yesterday's date until the day view's own thirty-second tick
re-rendered it, then said "Past" and stayed there - and the first task typed
that morning was written onto the day before. `lib/useToday.ts` is the signal
the app never had: one timeout aimed at the next local midnight, re-arming
unconditionally so a fire that finds the same date does not go quiet for a
day, plus `visibilitychange` and `focus`, because a laptop asleep at midnight
fires no timeout at all and those are the events a real morning carries. The
shell follows it **only when the day on screen was today** - somebody who
walked forward to Friday is looking at Friday on purpose. Two more things were
keyed on the mount for the same wrong reason and are now keyed on the day: the
daily snapshot, which promises seven days and would have taken one on a tab
open all week, and the cloud backup's copy of the day that just ended.

**The tab bar, with two things sitting on top of it.** Below 1024px the rail
is a bar along the bottom, and both surfaces fixed to that edge were on it.
The update notice covered it edge to edge at 390x844 - all seven tabs failed a
hit test - and it is deliberately ignorable, so somebody who ignored it could
not change tabs at all until they reloaded. Every deploy raises it. The undo
toast covered four tabs for the five seconds it is up. `--rail-bar-h` names
the bar's height, the rail states that height rather than letting its content
decide it, and both surfaces sit above it.

**A Delete that was never red.** `.template-card button` is a class and an
element, so it out-specified `.btn-danger` wherever that sat in the file, and
painted the destructive button on every template card in the muted ink with
the plain border - exactly like the Edit beside it. The comment above that
button describes the fix for that precise defect. The fix had never taken
effect: only `.is-armed`, at two classes, ever got through, so the danger
colour first appeared on the *confirming* press, after the decision it was
there to inform. Found while chasing a six-pixel height difference in the
same row, which is the argument for measuring small things.

**A binding you could only make once.** Raised by the owner mid-wave. The
library binding lived on the add row alone, so a list could be bound to a
block being made and never to one already on the week - changing your mind
meant deleting the block and rebuilding it with its time, its category, its
note and its days. It is on the open block now, going through the same
`editBlock` as every other field, so a block on seven days binds on seven at
once. It carries a visible label where the add row's has only an aria-label,
and that difference is the point: on the add row it is one of a line of chips
in a sentence being written, and in the panel it is a field on a form. An
unlabelled dropdown between a note and two buttons is a control nobody can
name, which is the other half of why it was not found.

### What the sweep can see now, and could not before

Three of the fifteen findings were the owner's, two of them from one
screenshot of one row. That is the finding about the findings, and it is what
most of this wave's tooling work is for. Both of those were shapes nothing in
the repo could report - jsdom has no layout, and neither is text cut off, a
control covered, or anything else `scripts/audit.js` looked for. Three passes went in, and each one found
something on its first run that nothing had reported before.

- **Not centred in a row that centres.** A child more than a pixel and a half
  off the middle of a row whose `align-items` is `center`. `.setting-quiet`
  and `.setting-remove` both carry `align-self: flex-start` with a two-pixel
  nudge, written for the column they were born in, and `align-self` on a child
  beats `align-items` on its row. Eleven pixels in the week editor's note
  header; eight on six rows of Settings at once. Measured against the row's
  *content* box, and skipping any child with a transform - a chevron here is
  two borders of a square turned 45 degrees, and the translate inside that
  rotation is what pulls the ink back to the middle of a box the rotation has
  made bigger, so its rect is 11px where its box is 8. Sixteen of those were
  reported before that clause went in, and none of them was a defect.
- **Two heights in one row.** Two controls drawn as boxes, side by side, more
  than two pixels apart. `.block-add-marks` was fixed for exactly this in v2.9
  - "everything here was between 28px and 44px, which put three baselines in
  one row" - and the fix was written for that one row rather than looked for
  anywhere else. Only boxed controls are compared: a quiet word with no
  background and no border is deliberately the height of its own text.
- **A scroller that goes sideways.** "Nothing scrolls horizontally, ever" -
  CONVENTIONS 4 - and the check written beside that sentence reads the
  *document's* width. A scroller inside the page absorbs the overflow instead,
  so the document stays exactly as wide as the window and the rule was
  unenforced everywhere it is most likely to break: a two-hundred-character
  title with nothing to break at measured 2014px in a 310px column and gave
  the task list 1753px of sideways scroll while `hScroll` read zero. Reported
  only when **one child is wider than the box it is in**, which is what tells a
  defect from a design - a strip that scrolls on purpose, like the week
  editor's seven columns on a phone, is a row of things that each fit. Without
  that clause it reported six of those a run, and the one real defect would
  have sat among them.

And one screen: **the week template editor with a block open**. The sweep
built the seven-column grid and never pressed anything on it, so the panel
inside it had been unmeasured at every size for six versions. Three findings
sat on it.

### What the hunt checked and found nothing in

Worth having written down, so a later pass does not spend the time again.

- **The timer across midnight and across both daylight-saving switches.** A
  run is an instant and a duration in epoch milliseconds and no date
  arithmetic touches it, which is why the day view had a defect there and the
  clock did not. Now held by `lib/clockTools.midnight.test.ts` so a later
  change that introduces some fails there rather than on a Sunday morning.
- **The tour started on a real day** from the palette or the shortcut card,
  rather than in Settings' sandbox. Reads like a defect, is deliberate and
  documented, and is safe: everything the tour makes is flagged `tourCreated`
  and "Start clean" removes exactly that.
- **Three accent things on one screen.** Measured rather than eyed on the
  busiest screen the app draws: exactly two elements carry the full-strength
  accent - the day's progress bar and the mini calendar's ring on today.
  Everything else that reads as tinted is a `color-mix` at reduced strength.
- **The two daily paths.** An ordinary morning - stamp the day, tick three
  things, run a timer, write a note - is seven presses with nothing to hunt
  for and no wrong press. An evening - move what is left, write the journal
  line - is three, and the line is on the day by the time focus leaves the box.

### The v2.16 wave: books into the library without a martyrdom

Twenty-eight books, one at a time, through a field that clears itself between
each. Nothing about that is hard and all of it is tedious, which is the exact
shape of thing that stops a list from ever being filled in - and an empty list
is a reading block that stamps its own title forever.

| # | Stage | What it is |
|---|---|---|
| 0 | Read first | The inventory above, written before a line changed |
| 1 | Paste many | "Add many" beside the add line: one line an item, a total after a bar, a live count of what the press will do |
| 2 | Order is a queue | Up and down buttons beside the drag and the keys, and the loud row saying what will take it |
| 3 | The binding says which book | One line under the control that names a list, in both editors |
| 4 | Three lanes in one press | A fourth quick-start preset making MIND, CRAFT and LIGHT, empty, in three colours |

#### The decisions worth keeping

- **A vertical bar, and nothing else.** A pasted line carries a total after
  `|` and no other punctuation is read: no trailing count, no comma shape,
  none of what `parseLibraryItemInput` reads on the add line. A pasted list
  comes from somewhere else and its titles have commas and numbers in them
  for their own reasons. The bar is the one character that almost never
  appears in a title - "x 34" and "- 34" both do, since half the books on a
  shelf have a dash and a hyphen is how a subtitle is written.
- **Nothing typed is ever thrown away.** A bar with something other than a
  whole positive number after it is not a total, so the whole line keeps the
  bar and is the title. A person pasting a title with a bar in it meant the
  bar.
- **A duplicate never blocks and never doubles.** The count says "3 already
  in this list" before the press and those lines are skipped, which is the
  app neither deciding for somebody nor making duplicates behind their back.
- **The drag stayed.** A row already moved two ways - dragged with a pointer
  or a finger, nudged with the arrow keys off the grip - and both are still
  there. What was missing is the way that is neither a gesture nor a key,
  because a drag on a phone is a guess about whether the list or the page is
  going to move. Three ways now, and the buttons are the ones named for what
  they do.
- **The empty binding is an answer, not an error.** A list with nothing going
  resolves to nothing and the block keeps its own title. True since v1.9,
  said nowhere, so somebody who bound an empty list saw a block that had
  ignored them. The line says it now and the behaviour is untouched.
- **The preset's names are shapes rather than subjects.** MIND, CRAFT and
  LIGHT, empty. What somebody reads is theirs to put in, and a preset that
  arrived with titles in it would be this app deciding what an evening is
  for. Three, because three lists are three folders and the folders are the
  part this app does not need.

#### Three defects it walked into

- **The disabled reorder arrows failed contrast**, at 2.17:1 on Light against
  the 3 a mark like that needs. A disabled button in this app inherits
  `opacity: var(--faded)`, which puts a muted grey on a white row; switching
  the ink alone made it 2.15 because the opacity was still underneath. Faded
  by ink at full opacity, which is the lesson `.btn-secondary:disabled`
  already carries in its own comment. Found by the sweep, not by looking.
- **An 18px checkbox drew its tick through its own border.** The mark is two
  borders of a box rotated forty-five degrees about its *top left corner*, so
  the long arm sweeps down and to the left by the box's height over root two
  - which means `left` has to be bigger than that rather than smaller, and
  the numbers it had were five in a box with fourteen pixels of room. The
  size was wrong too: the app's 24px tick fills about two thirds of its box
  and this one filled nearly three quarters, which reads as a tick crammed in
  rather than the same mark, smaller. `.day-card-check` had the identical
  numbers and had been drawing through its own border since v2.8.
- **The quick-start pills were not centred.** All the same height and the
  same position - measured - with their words three pixels under the top edge
  and sixteen above the bottom. `align-items: baseline` lines a name up with
  its unit and then puts the pair at the top of a pill taller than it, which
  is what flexbox does with a baseline group.

#### What the wave refused

No folders inside a list, because three lists are three folders and a flat
model is right here. No book lookup and no API - this app does not go to the
internet, and `lib/link.ts` says why in its own comment. No reading speeds,
no forecasts, no statistics: units are already counted and a week of data is
not data. And `currentItem` is untouched - first unfinished in order is
correct, and every line this wave added is about saying so out loud.

### The v2.16 wave: what was already there, before a line was written

The wave is mostly about joining up things that already exist, so the first
thing it did was find out which of them do. Written down before any code
changed, because "add a way to reorder a list" and "the list already reorders
three ways and none of them is a button" are different pieces of work, and
only one of them is honest.

| Asked | What was actually there |
|---|---|
| `TemplateBlock.libraryListId`, and how a stamp resolves the item | **Whole and working.** `boundTo` in `stamping.ts` calls `currentItem`, which is the first item in the list that is not finished, *in array order*. The stamped task takes that item's title and a `libraryRef` pointing at it. An empty list, or one where everything is finished, resolves to nothing and the task keeps the block's own title - deliberate, and never said anywhere |
| Whether a block editor can pick a list at all | **Yes, in both editors**, as a bare select reading "Nothing" or "From Books", hidden entirely while the library is empty. Reachable, and mute: it says which list, and nothing about what will land on the day |
| Whether a list can be reordered | **Three ways, and none of them a button.** A grip that drags with a pointer or a finger (`useListReorder`), and the same grip taking ArrowUp and ArrowDown from a keyboard. No up and down controls, which is the one way that is neither a gesture nor a key |
| Whether more than one item can be added at once | **No.** `LibraryAddLine` is one title, one press, and that is the whole of it |
| What `upNext` does, and where it shows | Returns the item finished *today* and the one the list moved on to, or nothing. Drawn as an offer line above the loud card in the list, and as "finished - next is X" on the bound task's card. Bounded to today on purpose: it is a moment, not a state |
| Whether the item a block will use is marked | **It is the loud card**, first among the unfinished, and the list's own doc comment says so. What is not said is *why* it is loud - that it is the one tomorrow's block will take |

So of the four stages that followed, one built something genuinely absent
(pasting many at once), one added the missing third way to a feature that
already had two, and two said out loud what the app had been doing silently
since v1.9.

### The v2.15 wave: what the timer sounds like

The owner runs one timer for two jobs that want opposite sounds. Ten minutes
of meditation with the eyes shut wants something quiet enough not to jolt,
and a mark that it has *started*, because there is no way to check from
behind closed eyes. Something on the stove wants a sound that reaches the
next room. The one two-tone this app had served neither, and the middle of
the two would serve neither either.

| # | Stage | What it is |
|---|---|---|
| 1 | One engine, four shapes | `lib/chime.ts`: the synthesis out of the widget and into a table of parameters, with thirteen tests against a fake `AudioContext` that records rather than plays |
| 5 | Where it is kept | `Settings.chime` - three fields, synced like every other setting, and sanitised on load rather than able to refuse a payload |
| 2 | Where it is chosen | Four chips, a Try button and a volume slider at the foot of the timer panel, which is where a timer is started |
| 3 | The start bell | One switch, and the alarm starts as a bell because an alarm at the moment somebody presses Start is nonsense |
| 4 | Five ways to end it | Stop on the widget, Escape, Done, starting another timer, and closing the tab |
| 6 | Heard rather than assumed | `scripts/chime-wavs.mjs` renders all four to `docs/audio/` through the app's own code |

Stage 5 came before stage 2 because the picker needed somewhere to write.

#### The numbers, so the next session does not guess them

Every profile is a list of tones and every tone is a frequency, a start, an
attack, a release and a gain. The gain is multiplied by the volume setting on
one node the whole sound passes through, and the profiles are calibrated at
the default half volume rather than at full, since that is where most of them
will ever be heard.

| Profile | Wave | Tones (Hz at s, attack / release, gain) | Repeat |
|---|---|---|---|
| off | - | nothing; no audio context is opened at all | - |
| soft | sine | 880 at 0.00, 0.02 / 0.20, 0.18 · 1320 at 0.18, 0.02 / 0.20, 0.18 | once |
| bell | sine | 440 at 0.00, 0.08 / 4.00, 0.22 · 880 at 0.01, 0.09 / 3.20, 0.08 | once |
| alarm | triangle | 659 at 0.00, 0.01 / 0.18, 0.72 · 880 at 0.14, 0.01 / 0.18, 0.72 · 1175 at 0.28, 0.01 / 0.34, 0.80 | every 3s, for 60s |

Rendered at volume 0.5, that is peak 0.089 for soft, 0.145 for bell and 0.389
for alarm - which is what makes "soft at full volume" quieter than "alarm at
half", the whole reason there are four profiles rather than one sound and a
slider.

**Which one is for what.** Bell for a meditation, with "ring at the start
too" switched on: it arrives rather than starts, its attack is four times
slower than the soft chime's, and it dies away over four seconds. Alarm for
the kitchen, at whatever volume reaches the other room. Soft is the default
because the quiet one is wrong in the fewest places, and off exists because
sometimes the screen is enough.

#### What was protected, and stayed protected

Every one of these was right before this wave and is untouched by it: a
timer is stored as an instant plus a length and never as a countdown; a
separate timeout to the end instant carries a backgrounded tab; the countdown
is in the tab title; the sound is synthesised and nothing is loaded;
`hasSeenAGesture` guards the audio context and a refusal is swallowed
silently; and there is one timer and one stopwatch, never several.

#### Four decisions worth the reading

- **The alarm's repeats are on the audio clock, not on a chain of timeouts.**
  A background tab may clamp a timeout to once a minute, and a tab nobody is
  looking at is exactly the tab an alarm is for. All twenty rounds are
  scheduled at once and `stop()` takes them all down.
- **A triangle wave, in the one place.** A sine puts all its energy at a
  single frequency, which is the quietest a waveform can be for a given peak
  and the wrong property for a sound crossing a room out of a laptop's
  speakers. A triangle's harmonics fall away as the square of their number,
  so it carries much further and is still a soft-edged tone rather than a
  buzz. Loud is a parameter; harsh is a mistake, and a harsh alarm measurably
  leaves people worse off than a melodic one (McFarlane and colleagues, PLOS
  ONE 2020).
- **The sound settings are clamped on load rather than able to refuse a
  payload.** `validate` refuses a whole file over a malformed `density`,
  and that is right for the plan - a file edited by hand is a file to be
  careful with. Refusing to open a year of somebody's days because a timer's
  volume says "banana" is the wrong trade in both directions.
- **The files in `docs/audio` are rendered by the app's own code.** A node
  script computing the same sine waves would be a second implementation that
  can drift, and a reference file that no longer matches the app is worse
  than none.

**And the one thing nothing here can answer**: whether the alarm reaches the
next room. That is a room, a door and a pair of laptop speakers, and it is
the owner's to check - `docs/audio/alarm.wav` is there to check it with.

### The v2.14 wave: what the app knew and did not say

The owner used the app for a week and did not know about two features that
had been written for a version. A line beginning with `## ` had been a
choice on the card since v2.13, and Return had added a block for longer than
that. Neither was wrong; neither was on the screen.

So this wave adds nothing. Every stage takes something the app already does
and puts it where a hand meets it - which is the older rule, CONVENTIONS 17,
asked as a question instead of checked as a box: not "is there a control"
but "would somebody find this without being told".

| # | Stage | Commit | What it is |
|---|---|---|---|
| 1 | The note editor says the rule | `2686d7b` | One box wherever a note is typed, saying `## ` three ways - an example in the placeholder, one quiet line under the box, and the card's own choices drawn live from what is in it - plus **+ Choice**, which writes the heading. `insertSectionHeading` is the half worth a test |
| 2 | Return adds it, and the field says so | `f65c842` | A mark inside the right edge of every title field that Return adds from, visible with nothing pressed. The tooltip it replaces is gone: a hint that needs a pointer resting on it is a hint for somebody who already went looking |
| 3 | A long note costs four lines | `5fff03a` | An open intro is cut to four lines with **Read** under it, and the reader learned a page for the note's own opening, beside the `## ` sections |
| 4 | The door beside a title | `8d54084` | Three quarters of the title, in the meta ink, 0.4em off its last word, centred on its x-height, at a stroke that reads at the weight of the ink it shares. Every number against the title's own type, so all of it moves with the text scale |
| 5 | A length is a number and a unit | `fe9ae2c` | "45min" is a word. A fifth of the unit's size between the two, in all four places a length is asked for, without touching the written form `parseQuickAdd` reads back |
| 6 | One pass over the whole app | `b2175d4` | Twelve things it can do and does not say, each with a verdict - the table is above. Two came out as work: the header's two tools name their keys the way the rail's icons do, and a stepper's arrows say what Shift does |

#### The five defects it walked into

None of them is what the wave was for, and every one had shipped:

- **The note reader had never been over the day.** Opened from a task card
  it was drawn inside the card - 318px wide, in the scrolling column, under
  the timeline - while the comment above its own scrim said it was over the
  day. Two ancestors and two separate mechanisms: the task list is faded
  with a `mask-image`, which makes it a stacking context, and a card's
  arrival animation used `animation-fill-mode: both`, whose forwards fill
  holds `transform: none` as the identity matrix rather than releasing the
  property - and a computed transform that is not `none` is a containing
  block for anything fixed inside it. `backwards` is what that animation
  wanted; the reader goes through a portal regardless, the way `TipLayer`
  does. **`toBeVisible()` was true of it the whole time**, and jsdom has no
  paint order to be wrong about: it was found by measuring the scrim's own
  box in a browser.
- **The block panel's checkbox was drawn twice.** "Show this note without
  opening it" had a painted box with no rule anywhere that filled it, and a
  13px system checkbox beside it doing the work. The hiding rule was
  written for the day's tasks and every later `.check` had to remember to
  join it. From v2.11 to now.
- **Return in the week editor ate the title.** With no day switch on there
  is nowhere to put a block, Add block is disabled and says so in words -
  and Return was not: it built nothing and cleared the field anyway.
- **The task sheet's note was 13px**, under the iOS zoom floor, so a tap
  into it zoomed the sheet on the phone this app was written for.
- **`.block-list button` strips every button inside it back to plain
  words**, which is right for a block's row and wrong for the panel under
  it: the new button and the preview's choices came out unstyled in the day
  editor and correct everywhere else.

#### What this wave is worth remembering for

- **A control that is only reachable by hovering something is not visible.**
  v2.13 answered "nothing says Return adds a block" with a tooltip on the
  Add button, which is an answer for somebody who already knew. The person
  who does not know is the one person who will never rest a pointer there.
- **The gap and the binding are two jobs.** The link icon was bound to the
  title by a non-breaking space, and that space was also the gap - so the
  spacing of a mark was whatever a space happened to be at the size in
  force. A word joiner binds and has no width; the gap is 0.4em in the
  stylesheet.
- **An `em` is only useful if it is the right one.** The icon asked for
  1.15em and got 1.15 of the card's 13px, because that is what the line it
  sits on inherited. The line carries the title's own size and leading now,
  which also makes `vertical-align: middle` centre on the title's x-height
  rather than on the x-height of a size that line does not contain.
- **A written form and a drawn form are different things.** `durationToText`
  is what gets typed into a quick-add line and read back out of it, so the
  gap in "45 min" had to be drawn rather than typed. The round trip is a
  test, and it would have caught a space in the string - which is the only
  reason it was not put there.

### What the app can do and does not say - the v2.14 sweep

The wave's own question, asked once over the whole interface: **where does
this app know how to do something and never mention it?** Not a list of
things to add - a list of things already written that a hand cannot find.
The rule it was measured against is CONVENTIONS 17, which is older than the
question: every feature has one control somebody can see, in the place the
feature belongs, and the tooltip on that control names the key.

Two came out as work and are done here. The rest are written down with a
verdict, which is the other half of what the brief asked for: a thing that
is deliberately not on the screen has to be a decision somebody made, not a
gap nobody noticed.

| What | Verdict |
|---|---|
| **Q and J, on the header's two tools** | **Made visible.** The rail has named its key on every icon since v2.0 - `Today · 1` - and the header's Notes and Journal buttons never did, so the two keys that open them lived in the `?` card and nowhere a hand would meet them. Both carry `Notes · Q` and `Journal · J` now, read out of `SHORTCUTS` so the bubble cannot drift from the handler, with a test on it beside the rail's |
| **Shift on a stepper's arrows** | **Made visible.** A press moves five minutes, or one of whatever is being counted; Shift moves fifteen, or ten. Nothing anywhere said so - the `?` card holds the shell's keys and a widget's own keys are not in it. The arrow pair carries `Shift for 15 min` and `Shift for 10`. Nothing on a phone, where there is no Shift and no pointer to rest |
| **Shift on a time field's arrows** | **Written down instead.** The same accelerator, an hour at a time, in `TimePicker` - which has no arrow buttons to hang a bubble on. Its visible road is the column of times behind the caret, and the caret's own bubble is about that list. A tooltip on the field would sit over the thing being typed |
| **Ctrl-K, the command palette** | **Written down.** It has no control anywhere in the app, and on a phone there is no chord to press, so on a phone it does not exist. That is the shape it was built in and it holds, because of the rule in its own doc comment: every command in it is already reachable by hand, and the palette is a faster route rather than the only one. Checked command by command in this pass, and the claim is true with one exception below |
| **"Load my reading plan"** | **Written down.** The one palette command with no other door, deliberately: it fills a Books list with the owner's standing queue, and it is asked for rather than offered because loading it on first open is what put the owner's bookshelf in front of anybody opening the demo - see `lib/librarySeed.ts`. A phone gets the list by sync once a desktop has run it, which is the only way it is meant to arrive there |
| **Hold a card for the actions menu** | **Written down.** The three dots beside the card do the same thing, are drawn at all times and on both platforms, and are the road; the hold is the accelerator for a finger already on the card |
| **Double-click a card or a block** | **Written down.** Opens the detail sheet, which the actions menu reaches by name from a button that is always there |
| **The resize strip on a block** | **Written down.** Always drawn on touch, where there is no hover to reveal it, and revealed by hovering the block on a pointer - which is a control that already has its box, the one thing CONVENTIONS 24 allows a hover to show. Changing a length without it is the sheet's own How long field |
| **Drag across the month to stamp** | **Already said.** One line under the grid: "Click or drag across days to stamp. Click a stamped day to clear it." This is the shape the rest of the list is measured against |
| **Quick-add's leading time and trailing length** | **Written down.** "09:00 Walk 20min" is read as all three, and nothing invites it. What the app does say is the answer rather than the offer: the chips under the box show the time, the length and the category the moment anything is typed, so the parse is never a guess once it has happened. The placeholder cannot carry it - "Add a task, and press Enter" was already cut to "Add a task" at 380px in v1.9, and the field now carries the Return mark as well |
| **Enter finishes a note in Scratch** | **Already said.** In the placeholder, and again in the line under the box: "Enter keeps it and starts the next." The pattern stage 1 and stage 2 of this wave generalised |
| **Swipe a sheet down to close** | **Written down.** From the grab bar only, which is drawn; Done and the close cross are both on screen the whole time |

### The v2.13 wave: one place text goes

Steps were a list beside a note. A template block could carry both, and so
could a task. In a year of use the list was never the thing anybody reached
for and the note always was - so the note became the only place, and it
learned to hold more than one thing at a time.

The owner's case: a lunch block carrying three recipes. One note held all
three, and reading any of it meant opening the whole thing and scrolling past
the other two.

| # | Stage | Commit | What it is |
|---|---|---|---|
| 0 | Where steps lived | `00903f5` | Written down before a line changed - section 5b below, kept because the field is called `steps` on a block and `subtasks` on a task, and the repo has five other things called step that must not be touched |
| 1 | The parser | `9264056` | `parseNote`: a line beginning with `## ` starts a section, everything above the first one is the intro. One rule, no engine, and a note with no such line parses to exactly what it always was |
| 2-4 | Sections on the card, the reader, the toggle | `9f989fd` | The headings are on the task card and on Up next; pressing one opens it over the day with the others beside it. `noteExpanded` is one checkbox in the block's panel, governing the intro only - headings are choices, and a choice you cannot see is not one |
| 5 | Steps folded in, and taken out | `9bef54e` | Every step becomes a line at the end of its note - `- Water`, `- Meditation (10 min)`. It runs at the one gate both loading and importing pass through, and twice safely: a line already in the note is not added again |
| 6 | The week as a picture | `bd83939` | Seven lists of chips became the calendar's own week, fed template blocks - the same layout code and the same stylesheet, so a template week and a real week are drawn by one set of rules rather than two kept in step by hand |
| 7 | The door on the title line | `7f9bd0f` | The link icon left the meta row, which is facts about a task, for the title's own line, bound to the last word. And Focus found its centre, ten pixels late |
| 8 | Seven identical squares | `4614c48` | The day switches were all 30px wide and still looked untidy: the sizing came from padding, so every letter overflowed its own box by a different amount |

Two more things the owner found while it ran, both fixed here: **the running
block's time was struck through** by the current-time line (`7b9e0a5`), which
had been true since the anchors became stacking contexts and was only ever
visible on a short block; and **a category is made from the swatch row**
(`5c421f9`) rather than four screens away in Settings.

#### What this wave is worth remembering for

- **The migration is the feature.** Removing steps was easy; not losing them
  was the work. `lib/stepsToNote.ts` is idempotent by content rather than by
  flag - a line already in the note is not added again - so a half-migrated
  file, and a migrated file exported and imported, both come back the same.
- **`validate` still refuses a malformed step.** A v1.1 backup may carry one,
  and the migration runs after validation, never instead of it.
- **A brace-blind removal broke the build silently.** Cutting CSS rules by
  "selector to the next closing brace" ate two enclosing media blocks, and
  vite then transformed 209 modules and emitted nothing at all, with an error
  about a service worker. The stylesheet is one file of fourteen thousand
  lines; remove from it brace-for-brace or not at all.
- **Three separate slices took more than they meant to** - the library marks
  on a task card, `setTaskLibraryRef`, and the whole stylesheet - each caught
  by a typecheck or a test rather than by reading. Cut by exact text, not by
  a scan for the next delimiter.

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
| `v2.13` | `7b9e0a5` | Steps folded into the note, which learned to hold sections; the week template drawn as a week; the link on the title line |
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

**The v2.14 wave is the last one before that week**, and the brief it came
from said so: the owner lives in the app from tomorrow, and the next brief
comes out of that week rather than out of a session with time left. What
the four gestures above still have in common is that none of them has been
touched by a finger; what changed in v2.14 is that each of them now has a
verdict written down beside it in the sweep table further up, so the week
can report on whether the verdict was right rather than on whether the
gesture exists.

**Chosen on 2026-09-15, after the first real week.** The owner read the
plan that came out of that week and said "darom visus" - all of it - with
one correction that changes the weights: **the computer is the main device
and the phone is for being out.** The repo's doctrine had the phone first;
from here a choice that trades desktop quality for phone quality goes the
other way. Both still have to work.

The order below is the order it is being done in. A-tier is sync trust,
because the owner started depending on it this week and it has not yet run
against the real GitHub. C-tier is the nets - almost every defect this week
was seen by the owner before any pass - and it comes before the features so
the features land on something that catches them. B and D after that.

- **A1** - sync proven against the real GitHub, both directions, on the
  owner's two devices. This one is the owner's to run: it needs their token,
  which is not for anybody else to hold. A checklist is theirs.
- **A2** - Backup and sync no longer confusable: with sync on, Restore from
  cloud says it replaces the plan with a copy and how much older that copy
  is than the last sync.
- **A3** - an open screen catches up on its own: while visible, read the
  repo once a minute, read only.
- **A4** - a sync line that says when the last change from the other device
  arrived, so "does the phone have it" is answered without looking for it.
- **B1** - the four gestures on real iOS Safari, in the owner's hand. Not
  doable from here; the checklist is in the plan.
- **B2** - the book's file on the phone too: a link to the same file in a
  cloud drive beside the local handle, and the door picks whichever this
  device can open.
- **C1** - the precision pass learns alignment: things stacked in one
  column share a left edge.
- **C2** - the keyboard walk as `npm run keys`.
- **C3** - the sweep starts and stops its own preview, like the other two.
- **C4** - the 45 React act() warnings cleared, so a real one is visible.
- **C5** - the base field rule's five :not()s rewritten through :where(),
  with the sweep run either side.
- **D1** - dragging a block inside the template editor's timeline.
- **D2** - a way into the command palette on a phone.
- **D3** - a reminder that can arrive while the app is closed. The only
  design that needs no server of the owner's is a scheduled GitHub Action
  reading the shared plan and sending web push; it is last because it is
  the largest and the one most likely to be cut.

**Where that list stands, the same evening.** Everything on it but D3 is
built and in this history, one commit each, each with its reasoning in
DECISIONS:

- A1 and B1 are the owner's to run and are written as tables in
  CHECKS-BY-HAND.md, the expected sentence beside every step. B2 has a
  third table there, since the door's decision can only be watched on the
  two real devices.
- A2: Restore says, at the press, that sync already has the shared plan
  here. A3 and A4: an open screen pulls once a minute, read only, and the
  Sync line says when the other device's last change arrived, or that
  nothing has come yet.
- B2: a picked file carries the same file's address for the phone inside
  its one link, and the door is the file's where the file is and the
  address's where it is not.
- C1: the precision pass sees stacked things a few pixels out of line.
  C2: `npm run keys`. C3: the sweep serves the build itself. C4: the
  forty-seven updates outside act are gone, and the test setup fails the
  next one. C5: the base field rule is 0,0,1, and four fields look the way
  their rules asked - measured either side.
- D1: a block on the template's picture is dragged and pulled, through the
  day's own drag hook made host-agnostic. D2: a Search button in the header
  is the palette's door for a hand with no Ctrl.

**D3 is not built, and this is the case for leaving it.** The only design
with no server of the owner's is a scheduled GitHub Action in the data
repo, reading the shared plan and sending web push. GitHub's schedule is
a five-minute grid that runs ten to thirty minutes late under load and is
sometimes skipped. A reminder "ten minutes before Deep work" would arrive
after Deep work had started often enough to be worse than no reminder,
and a planner that is wrong about the time is the one thing this app must
not be. What that schedule can carry honestly is a **digest**: the day's
timed tasks at seven in the morning, and the evening close at its hour,
where twenty minutes late is fine. That is the shape to build if the
owner still wants something to arrive while the app is closed: a VAPID
key pair (the app can generate one), the private key as a secret in the
data repo, the workflow file there, `web-push` in the Action, and the
phone's install on the home screen, which is where iOS allows web push
at all. About a day, and every part of it checkable only on the owner's
devices. It waits here.

- **The two Shift accelerators the "?" card cannot hold.** A stepper's
  arrows say what Shift does to them since v2.14, and the time field's do
  not, because it has no arrow buttons to hang a bubble on - its road is
  the column of times behind the caret. If the week finds somebody wanting
  an hour at a time in a time field, the answer is a control, not a line of
  help.
- **The command palette has no control anywhere**, and no chord on a phone.
  It holds because everything in it is reachable by hand, which was checked
  command by command in v2.14 and is true with one exception written down
  in the sweep table. If the week wants it on the phone, that is a door to
  design rather than a bug to fix.
- **The return half of the Away door is not driven by the soak.** It is the
  one place `Task.setAside` is written, and only for a task that no longer
  fits in what is left of the day - which needs a day shaped for it rather
  than the ordinary week the soak lives on. `replan.e2e.ts` covers it on
  such a day; the soak asserts the half it can honestly reach, that the day
  pauses.
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
- **What the rotating-shifts audit found that is not that feature's**, found
  in v2.29's stage 1 (docs/RESEARCH-SHIFTS.md section 1.3) and left for
  their own time: the week editor cannot mark a block core, so a week column
  typed shift, night or rest scores nothing; deleting a sleep schedule
  leaves it on week overrides; the Library's "Add to template" offers week
  templates and adds a block with no weekday; deleting a template leaves
  weekday-map entries behind, and Stamp week then counts days it cannot
  stamp; an imported calendar event with a duration is not cut at midnight,
  one cut is reused for every repeat, and a multi-day all-day event shows on
  its first day only.

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

## 5b. Where steps lived, before they were removed

Taken on 2026-09-09, before a line of it was changed, and kept as the record
of what the removal worked from. Steps are folded into the note now - see the
v2.13 wave in section 4. Nothing in this list is still in the app; it is here
because the next person to remove a feature this wide will want to see what
the list looked like. The field is called `steps` on a template block and `subtasks` on a
task, which is most of why a grep alone was not enough.

**The data**

| Where | What |
|---|---|
| `src/lib/types.ts` | `Subtask` interface; `Task.subtasks?`; `TemplateStep` interface; `TemplateBlock.steps?` |
| `src/lib/validate.ts:217` | the `SUBTASK` table |
| `src/lib/validate.ts:237` | `subtasks` on the `TASK` table |
| `src/lib/validate.ts:257` | the `TEMPLATE_STEP` table |
| `src/lib/validate.ts:269` | `steps` on the `TEMPLATE_BLOCK` table |

**What moves them**

| Where | What |
|---|---|
| `src/lib/stamping.ts:60-77` | `stepsFrom(block)` - a block's steps as a day's own list |
| `src/lib/stamping.ts:216` | the stamping rule that reads a match's subtasks, then the block's steps |
| `src/lib/store/days.ts:336-388` | `addSubtask`, `completeSubtask`, `toggleSubtask`, `deleteSubtask` |
| `src/lib/store/templates.ts:34,58` | `steps` in `addTemplate`'s input table and in its body |
| `src/lib/repeats.ts:118` | a repeat instance copies its source's subtasks, unticked |
| `src/lib/demo.ts:179` | the demo's one task with sub-steps |

**What shows them**

| Where | What |
|---|---|
| `src/widgets/day-plan/TaskRow.tsx:163-165,325-327` | the "0/2" mark on a card |
| `src/widgets/day-plan/TaskDetail.tsx:72,88-89,427-500` | the Steps section, its add line, and the per-step timer |
| `src/views/BlockNote.tsx` | the steps half of a block's panel, and `blockCarries` |
| `src/views/TemplatesView.tsx:108,251,510,521,681,770` | the draft field, its setter, both panel props, load and save |
| `src/views/WeekTemplateEditor.tsx:277,417,536` | the same, through `editBlock` |
| `src/widgets/clock/FloatingClock.tsx:145,153` | the timer that ticks a step when it rings out |
| `src/lib/clockTools.ts:33` | `Subtask.minutes` is what a step timer points at |
| `src/styles.css` | `.task-steps`, `.subtask`, `.task-detail-subtasks`, `.block-note-steps` |

**Tests that mention either name**: `backup.v11`, `repeats`, `scale`,
`stamping`, `storage`, `syncMerge`, `taskDetail`, `tour`, `tourAssist`,
`TemplatesView`, `WeekTemplateEditor`, `FloatingClock`, `autoSlot`,
`QuickAdd`, `TaskDetail`, and the `blocknote` and `week-rehearsal` walks.

**Not steps, despite the word**: the tour's own steps (`Tour.tsx`,
`lib/tour.ts`), `CountStepInput.tsx` which is a numeric stepper,
`.library-step`, `stepTime` in `capacity.ts`, and every `mouse.move` in the
browser walks that takes a `steps` option.

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
