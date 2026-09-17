# Rotating shifts - research and design

The owner is going to work rotating shifts in a factory: day shifts, night
shifts and days off, on a schedule that moves and arrives from the employer.
They asked for Dienius to carry it, and said plainly that this is the hardest
thing asked of the app so far, so what matters is that it is right rather than
that it is quick: design and a test plan first, then code.

What they need, in short:

- a routine like the gym stays on the same weekdays, while its time follows
  the kind of day it lands on;
- each kind of day has its own shape and its own sleep;
- a month's schedule goes in within a few minutes of receiving it;
- the sleep a template brings is seen on its timeline while it is built.

This document is stage 1 of ten: what exists, the model, the one rule for
midnight, daylight saving, the rules for conflicts, how a schedule is applied
and changed, and the tests. Every stage after this one builds what is written
here, and changes this file first when it has to change the design.

Generic names only, in this file and in every test and picture of the feature:
the repo is public.

---

## 1. What exists

Everything below was read at `3fc3dc5`, by two passes over the whole source -
one for day types, templates, sleep, stamping, repeats and replan, one for
every place a time crosses midnight or a date is stepped.

### 1.1 The pieces the feature builds on

- **Day types** (`types.ts`, `DayType`): `full | shift | night | rest`. A
  template carries one (`Template.type`, absent is full); stamping copies it
  onto the day (`DayPlan.dayType`), where it is never looked up again. The one
  behaviour it drives is the score: a full day counts every task, any other
  counts only blocks marked `core` (`score.ts`). Month cells and Review ignore
  it.
- **Templates** (`Template`): a list of blocks, each a title with an optional
  time (`HH:MM`) and length in minutes, category, note, key mark, library or
  recipe binding. A **week template** (`kind: 'week'`) gives each block a
  `weekday`, and `weekDays` lets a weekday override the day type and the sleep
  schedule. `columnFor` in `stamping.ts` is the whole difference between the
  two kinds.
- **Sleep** (`Settings.sleepProfiles`, never empty, the first is the default):
  named windows of a bedtime and a wake time. A template, a week column and a
  day each may point at one by id, a dangling id meaning the default.
  `capacity.ts` turns a window into the day's waking hours (`wakingWindow`,
  clamped to one calendar day) and its length (`sleepMinutes`); `windowFor` is
  what capacity, gaps, the grid, quick-add and replan read.
- **Stamping** (`applyStamps`): the one place a day is written from a template,
  whatever door asks - the rail's chips, the month's paint and erase, Stamp
  week, the week view, the weekday map. It matches blocks to the day's tasks by
  block id, keeps what a day earned (done, key, pushes, notes written on the
  day), keeps tasks that are not the template's, caps key tasks, and writes
  `templateId` and `dayType`. Idempotent: stamping the same template twice
  changes nothing.
- **The weekday map** (`Settings.weekdayTemplates`) and **`ensuredDay`**: the
  first open of a day stamps its weekday's template unless the day already has
  one or is in the past, generates repeat instances, and marks the day set up
  so none of it happens twice. It also refreshes, on every open of today or a
  day ahead, the block fields a day still carries unchanged
  (`refreshFromTemplate`, by the `fromBlock` echo).
- **Repeats** (`repeats.ts`): a task with `repeat` (daily, weekdays, weekly) is
  a series; each later day gets a real task when first opened, with
  `repeatSkips` on the day as the tombstone for a deleted instance.
- **Replan** (`replan.ts`): pure; it takes the waking window as a parameter and
  never moves routine blocks, never touches type, sleep or template.
- **Undo** (`undo.ts`): one offer at a time, a label and a restore.
- **Task identity** (`taskIdentity.ts`): a task with a template or repeat origin
  has an identity (`template:<id>:<block>` or `repeat:<id>:`), and one guard
  keeps a day from holding two tasks with the same identity.

### 1.2 Fixed while auditing

Four defects the audit found were fixed at once, each with a test, because the
schedule would have walked into three of them on its first day:

- **Taking a template off a day wiped the day** (`02412cd`): the erase stroke
  rebuilt the day from its date and hand-written tasks, and what was written on
  it, its sleep, its skipped repeats, its low day, its replan mark and its time
  away went with the template. A date's kind will be its stamp (section 2.2),
  and clearing a kind goes through exactly this path.
- **A task moved onto a day was dropped by a stamp of another template**
  (`b777eff`): a moved task keeps its template mark, and stamping read every
  marked task as the day's own template's. Changing a date's kind is exactly
  such a stamp.
- **Review's month skipped the month after a short one** (`bb845bb`): forward
  added thirty-one days to the month's last day.
- **The cloud backup read the day of its last copy in UTC** (`d14b517`): a copy
  made just after midnight counted as the day before.

### 1.3 Found, and left to the stage that owns it

- **Four readers disagree about a day's sleep** on a week template: the day
  view, replan and the week view read the column's override; quick-add, Later
  and the task sheet read only the template's own; the set-aside strip reads
  only the day's. Stage 4 puts one function in front of all of them.
- **A bedtime after midnight** (02:00 to 13:00) breaks "Sleep in", the grey
  band, the screen reader's sentence and a template's sleep total, because the
  waking window is clamped to one calendar day. Stage 4.
- **Anything at or past 24:00 prints as "24:00"** (`formatClock`), so a week's
  label, a template's overlap line, a widened grid and a drag to the bottom
  edge all say 24:00 for a time on the next day's clock. Stage 4.
- **What runs past midnight is invisible after it**: at 00:10 last night's
  22:00 block is not running anywhere, the focus bar and the focus screen count
  from today's midnight, and "away" stays on yesterday. Stage 4 for the rule,
  stage 9 for the views.
- **Daylight saving is tested in name only**: the two tests that mention it use
  fixed offsets or waits that never cross the switch, and the unit suite runs in
  UTC on the runner. Stage 4.
- **Not this feature's** and written down so they are not lost: the week editor
  cannot mark a block core, so a week column typed shift, night or rest scores
  nothing; deleting a sleep schedule leaves it on week overrides; the Library's
  "Add to template" offers week templates and adds a block with no weekday;
  deleting a template leaves weekday-map entries behind; an imported calendar
  event with a duration is not cut at midnight, one cut is reused for every
  repeat, and a multi-day all-day event shows on its first day only. They go to
  STATE's list of things asked for and not built.

### 1.4 The constraint that shapes the data

An older device - a phone whose copy of the app has not updated yet - loads
the plan through `validate`, and a payload that fails it is discarded whole:
the app opens empty. Sync hands that device whatever this version writes. So
this feature may only **add optional fields and new top-level lists**, which an
older `validate` ignores; it may never put a **new value into an existing
field** an older `validate` checks - no new day type, no new task origin, no new
template kind. This rules out several otherwise natural choices below, and is
why.

---

## 2. The model

### 2.1 A day kind is a day template with a letter

The four kinds - rest, day shift, night shift, after nights - are day
templates the owner already knows how to build: blocks, a day type, a sleep
schedule, a colour, a name. What makes a template a kind is one optional field:

```ts
Template.dayKind?: { letter: string; order: number }
```

- `letter` is what the roster draws on a date - one or two characters, `R`,
  `D`, `N`, `A` - in the template's own colour.
- `order` is the kind's place in the cycle a tap walks through.
- Only a day template can be a kind. A week template carrying the field is data
  out of place and is not offered as a kind, the way every other field out of
  place degrades here.

**After nights is not a fifth day type.** A new value in `DayType` would fail
every older device's `validate` (section 1.4), and the type only drives the
score, which already has the right answer: the owner types the after-nights
template `rest` or `shift` as they mean it. What makes the day after nights
different is its sleep and its shape, and a template already carries both.

**Rejected: a `DayKind` entity** with a template id, a letter and a colour. It
would name, colour and order a template a second time, in a second list, with
its own sync entity and its own dangling ids - two things to keep in step where
one does the job.

### 2.2 The roster is the stamps

Which kind a date is, is which kind's template is stamped on it:
`DayPlan.templateId` pointing at a template with `dayKind`. Nothing else holds
it.

- **Exactly one kind per date is structural**: a field has one value. There is
  no second record to disagree with the day.
- **It is already everywhere it needs to be**: a stamped day syncs as its own
  entity, travels in every backup and export, is restored by every snapshot,
  outranks the weekday map (`ensuredDay` never stamps over a template id), and
  is what the month, the week and Review already read.
- **Changing a date's kind is a stamp of another kind**, which since `b777eff`
  keeps every task that is not the old kind's own, and clearing a kind is a
  stamp of nothing, which since `02412cd` keeps everything else on the day.

**Rejected: a roster map** (`date -> kind`) beside the days. It would be a
second answer to "what is this day", right until the moment the two disagree -
a day restamped by hand from the rail, a snapshot restored, a sync that carried
one and not the other - and then the app would have to decide which one lies.

**Past dates are not in the roster's reach.** A lived day says what it was: the
roster draws its kind and does not change it, the same rule the weekday map and
Stamp week keep (DECISIONS "A template never fills a day that is behind you").

### 2.3 Routines

A routine is a commitment written once:

```ts
interface Routine extends Timestamped {
  id: string
  title: string
  category?: CategoryId
  minutes: number                  // its length, 5 to 720
  weekdays: number[]               // 0 = Sunday ... 6 = Saturday, at least one
  times: Record<string, string>    // kind template id -> 'HH:MM'
}
AppData.routines: Routine[]        // a top-level list, one sync entity each
```

On a date whose kind is K and whose weekday is in `weekdays`, the routine puts
one task on the day:

- **`times[K]` set and free** (section 5): a task at that time, of that length.
- **`times[K]` absent**: a task with no time, and the day says it **needs a
  time**. The app never guesses one - not the time from another kind, not the
  nearest gap.
- **`times[K]` set but not free**: a task with no time, and the day says what
  it runs into ("runs into Night shift", "runs into sleep"). Placing it anyway
  would put a gym session inside a shift; moving it would be a guess.

A routine does nothing on a date with no kind. The feature is the roster; the
weekday map and repeats go on working for everyone else exactly as they do.

**The instance on the day** is a real task, like a repeat's, so it can be
ticked, moved, noted and pushed:

```ts
Task.routineId?: string                              // the routine it came from
Task.fromRoutine?: { time?: string; minutes: number } // what the rule gave, for telling it from a hand edit
DayPlan.routineSkips?: string[]                      // routine ids deleted from this day by hand
```

Its identity is `routine:<id>`, read by `identityOf` from `routineId`, so the
guard that keeps a day from holding two copies of a block keeps it from holding
two copies of a routine. **Not a new task origin**: a task origin of `routine`
would fail an older device's `validate` (section 1.4). An older device sees an
ordinary task.

**Rejected: routines as repeats.** A repeat is a task on one day that copies
itself forward with one fixed time; the thing a routine exists for is a time
that differs by kind, and a repeat has nowhere to keep one. Nor as blocks in
every kind template: the gym on Monday, Wednesday and Friday would be the same
block written into four templates, with four copies of its title to keep in
step, and a template has no weekdays.

**`isRoutine` in `taskIdentity.ts`** today means "has an identity" (a template
block or a repeat). Stage 2 renames it `hasIdentity` before the word means
something else.

### 2.4 A date's composition

For a date D with kind K:

1. **K's template**, stamped - its blocks, its day type, its sleep schedule.
2. **The routines** whose weekdays include D's weekday, each placed by
   section 2.3 against section 5's busy time.
3. **The sleep** D wakes from, from K's schedule; and the sleep that starts on
   D's evening, from the next date's kind (section 3).
4. Everything the day already had that is not K's template's or a routine's -
   hand-written tasks, repeats, moved tasks, what was written on it - stays.

One pure function composes it: `composeDay(data, date, kindTemplateId)` returns
the day and what it found (routines without a time, conflicts). Applying,
previewing and the property tests all call it; nothing composes a day a second
way.

### 2.5 Where the roster is edited, and what is kept on the device

- **The roster** is a mode of the month (stage 6): a tap on a date walks it
  through the kinds by `order` and back round; a long press or the Clear tool
  takes the kind off. Letters and colours on every date.
- **The cycle** is a sequence of kinds and a start date, filling a chosen
  stretch (stage 6): `D D N N A R R R` from the 3rd to the end of the month.
- **Taps and cycles build a draft**, kept on this device under its own key
  until applied or thrown away - a half-built month survives a reload, and a
  draft is not a plan anybody else should see. The last cycle used is kept the
  same way, because next month's is usually the same pattern moved on.
- **Nothing reaches the plan until Apply**, after a preview (section 6).

---

## 3. Midnight

### 3.1 The rule

**A block belongs to the date it starts on. A sleep belongs to the date it
ends on - the day you wake into.**

A night shift from 22:00 to 06:00 is Tuesday's: it is a task in Tuesday's
record, stamped by Tuesday's kind, counted in Tuesday's review, synced with
Tuesday. The sleep from 23:00 on Friday to 07:00 on Saturday is Saturday's: it
comes from Saturday's kind's schedule.

### 3.2 Why sleep is the other way round

The first half is the one the owner proposed. The second half is the answer to
their own example rotation - day, day, night, night, after nights, rest, rest,
rest - and nothing else survives it:

- **The night before the first day shift** has to end by the shift's start.
  Owned by the day it ends on, it comes from the day shift's own schedule (to
  bed 21:30, up 05:00) and is right. Owned by the day it starts on, it would
  come from the rest day before it (up at 07:00, an hour after the shift began).
- **The night after the after-nights day** has to exist. Owned by the day it
  ends on, it is the first rest day's (23:00 to 07:00). Owned by the day it
  starts on, it would have to come from the after-nights schedule, which is the
  daytime sleep 08:00 to 15:00 - so that night would have no sleep at all.
- **A kind's sleep, said the way a person says it** - "on a day shift I get up
  at five", "after nights I sleep eight to three" - is the sleep that day wakes
  from. The schedule a kind carries means what its owner means by it.

So one sentence still holds for everything: **a date owns its waking day** -
the sleep it wakes from, and everything that starts before its next sleep.

It is also what `wakingWindow` has always assumed: a day's own schedule gives
the wake time that opens its waking hours. What changes is only the evening:
the bedtime that closes a day comes from the next date's kind when that sleep
starts before midnight. On a plan where two days share a schedule - every plan
today - the result is identical.

### 3.3 What the rule means on each surface

- **The day view** draws, on D's timeline: the part after midnight of D-1's
  blocks as a continuation band at the top, named for what it is ("Night shift,
  from yesterday") and not a task of D's; D's own blocks, those running past
  midnight ending at 24:00 with their real end said; the sleep D wakes from; and
  tonight's sleep from D+1's kind. At 01:00 on D the running task is D-1's
  night shift.
- **The week and the month** draw a kind's letter on its start date only; a
  night shift's continuation is drawn in the next column's first hours as a
  continuation, never as a second block.
- **Review** counts a block's minutes on the date it starts on, whole.
- **Capacity** counts D's free time between the end of the sleep D wakes from
  and the start of tonight's sleep, less D's blocks and D-1's continuation.
- **Sync, backup and export** carry each task in its start date's record and
  nothing split, so the rule needs nothing of them.
- **Conflicts** (section 5) and **the property tests** (section 8) read the
  same busy time the day view draws, from one function.

### 3.4 Clock values past midnight

- A block's `time` is its start on its own date's clock, `00:00` to `23:59`, as
  now. Its length may carry it past midnight.
- An end on the next date's clock reads with "(next day)", as the day grid
  already does, everywhere a range is written - the week, a template's overlap
  line, the time picker's preview - and never as "24:00" for anything after
  midnight. `24:00` is the one value meaning exactly midnight at a day's end.
- A dragged block cannot be dropped at `24:00`; the last start is `23:59`.

---

## 4. Daylight saving

### 4.1 Which nights

Lithuania keeps EU time: summer time starts on the last Sunday of March, when
03:00 becomes 04:00, and ends on the last Sunday of October, when 04:00 becomes
03:00 (Europe/Vilnius). In the years this plan will hold:

| Year | Spring (23-hour day) | Autumn (25-hour day) |
|---|---|---|
| 2026 | Sunday 29 March | Sunday 25 October |
| 2027 | Sunday 28 March | Sunday 31 October |
| 2028 | Sunday 26 March | Sunday 29 October |

Measured on this machine's clock with the zone set: 25 October 2026 has 25
hours and 29 March 2026 has 23.

### 4.2 A block is on the wall clock

A shift is agreed by the clock on the factory wall: the night shift that starts
at 22:00 ends at 06:00 whatever the clocks do in between. So a block's `time`
and `minutes` are **wall-clock**: its start, and its end as a clock reading
`minutes` later on the clock face. Its **real length** is the time that
actually passes, and on the two switch nights it is not the same:

- Saturday 24 October 2026, 22:00 to Sunday 06:00: **9 hours**.
- Saturday 28 March 2026, 22:00 to Sunday 06:00: **7 hours**.

One function answers it for any date, from the device's own time zone:
`realMinutes(date, time, minutes)`. Stage 4 writes it and uses it wherever an
amount of time is meant rather than a place on a clock face:

| Wall clock (where) | Real minutes (how much) |
|---|---|
| positions on every timeline, labels, "(next day)" | free time on the day, sleep length, a shift's hours in Review |
| a block's stored `time` and `minutes` | conflicts and the busy time they are measured against |
| the time pickers | "Sleep in", "ends in" and the running block's time left |

### 4.3 Times the clock skips or repeats

- **A time that does not exist** - 03:30 on 29 March, inside the skipped hour -
  cannot hold a routine. The routine goes on that day with no time and says so
  ("the clock skips that hour"). The browser's own answer, moving it to 04:30,
  would be a guess.
- **A time that happens twice** - 03:30 on 25 October - means the first 03:30,
  which is what the device's clock does.
- **A block that crosses a switch** keeps its wall-clock start and end and
  takes its real length from 4.2.

### 4.4 Testing it

The unit suite runs in UTC on the runner and in Vilnius here. Every test of
this section sets the zone to Europe/Vilnius for its own file, and the first
test in that file checks the setting took - that 25 October 2026 has 25 hours -
so a test that silently ran in UTC fails instead of passing for the wrong
reason.

---

## 5. Conflicts

**Busy time on a date D**, in real instants, is the union of:

1. D's own timed blocks, each from its start to its wall-clock end.
2. The part after midnight of D-1's timed blocks.
3. The sleep D wakes from (D's kind's schedule, ending on D).
4. The sleep that starts on D's evening (D+1's kind's schedule, when it starts
   before midnight).

**A routine conflicts** when its interval overlaps busy time by at least a
minute. Touching is not overlapping: a gym session ending at 22:00 before a
22:00 shift is free.

- An **untimed** block is not on the clock and takes no time.
- A block with a **time and no length** takes its start minute only, so a
  routine covering that minute conflicts with it and one beside it does not.
- A date whose neighbour has **no kind** reads that neighbour the way the day
  view does today: its template's sleep if it has one, the default otherwise.
- Hand-written tasks and repeats are **not** busy time for placing a routine.
  They are the person's, and the day view already shows an overlap for what it
  is; a routine is refused only where the day's own kind or sleep leaves no
  room.

What a conflict produces is section 2.3's third case: the task, with no time,
saying what it runs into.

---

## 6. Applying, and changing

### 6.1 Preview

Apply always shows what it will do first, week by week: each date's letter, and
under the week how many routines have no time, how many run into a shift or
sleep, and how many days were changed by hand (6.3). Dates whose kind does not
change and whose composition would not change are counted as unchanged and
not listed.

### 6.2 Apply

- **One commit.** Every changed date is stamped with its kind and its routines
  are composed, in one `commit`, so sync stamps each entity once and nothing is
  half applied if the tab closes.
- **Idempotent.** Stamping matches blocks by id and routines by
  `routine:<id>`; a date already carrying exactly what the draft says is not
  rewritten, so applying the same draft twice leaves the plan equal, entity
  stamps included.
- **Undo.** The existing undo offer, restoring every touched day as it was.

### 6.3 A date changed by hand

A date is **changed by hand** when any of these is true of its current kind's
template tasks or routine tasks: one is done; one's time, length, title or
category differs from what its block or rule gave (`fromBlock`,
`fromRoutine`); a block or routine has no task on the day and no skip (it was
deleted); a routine task was placed by hand. Hand-written tasks do not count -
they stay through any stamp.

Changing such a date's kind asks first, the way replan asks, naming what would
go: "Wednesday was changed by hand: 1 done, 2 moved. Apply Night shift anyway?
What you added stays." Apply or Leave it, per date, in the preview.

### 6.4 Changing a routine

Saving a routine with a different time, length or weekdays offers, once, to
update today and the dates ahead whose instance is still what the rule gave. A
past date is never touched, and an instance changed by hand keeps its change.
Nothing updates without the press.

### 6.5 Changing a kind's template

A kind is a template, so editing it already reaches the dates ahead the way
editing any template does (`refreshFromTemplate`). What the roster adds is that
the routines on those dates are measured again: a routine that now runs into
the new shift says so on the day and in the next preview. It is not moved.

---

## 7. The template editor and sleep (stage 8)

- The timeline draws the template's sleep as a darker band - the sleep the day
  wakes from at its start, and the same schedule's bedtime at its end - so the
  shape of a kind's day is seen with its sleep while it is built.
- The band's two edges have time pickers beside them, so a schedule's bedtime
  and wake time are set right there. The pickers edit the **named schedule**,
  which other templates and days may share, and the editor says so when they do
  ("also used by Rest").
- A sleep crossing midnight and a block crossing midnight are drawn by section
  3's rule, with "(next day)" on what ends after midnight.

---

## 8. Tests

The feature is judged on these. Every name and time in them is generic.

### 8.1 A unit test per rule

- **Kinds**: a day template with `dayKind` is a kind; a week template with one is
  not; the cycle order; a dangling kind id on a day reads as no kind.
- **Composition**: each case of 2.3 (free, no time, runs into a shift, runs into
  sleep, a skipped clock hour); weekday filtering; a date with no kind gets no
  routines; manual tasks, repeats and moved tasks survive; `routineSkips` keeps
  a deleted instance deleted.
- **Midnight**: a 22:00 + 480 block is the start date's; its continuation is
  busy time on the next date and not a task there; the sleep a date wakes from
  comes from its own kind and tonight's from the next date's; two days sharing a
  schedule give exactly today's waking window.
- **Daylight saving**: `realMinutes` for 22:00 + 480 on 24 October 2026 is 540
  and on 28 March 2026 is 420, and 480 on every other night of 2026; a routine
  at 03:30 on 29 March 2026 needs a time; 03:30 on 25 October 2026 is its first
  occurrence.
- **Conflicts**: overlap by a minute conflicts, touching does not; a block with
  no length is its start minute; untimed blocks take no time; a neighbour with
  no kind reads its template's sleep or the default.
- **Hand edits**: each of 6.3's conditions alone makes a date changed by hand, and
  a hand-written task alone does not.
- **Clock text**: nothing after midnight prints "24:00" (`formatClock` and every
  range writer).
- **Boundaries**: a cycle across the end of a month, across 31 December into the
  new year, and across 29 February 2028; composition on 28 February, 29 February
  and 1 March 2028.

### 8.2 Property tests, with fast-check

`fast-check` joins the dev dependencies in stage 3. Generators: four to six kind
templates with random blocks (some crossing midnight, some untimed, some with
no length), random sleep schedules (overnight, daytime, equal times), random
routines with random weekdays and a random subset of kinds with times, random
cycles, and 400-day stretches starting anywhere from 2026 to 2028, so every run
can cross both switches, a year end and 29 February. Invariants, each over
every date of the stretch:

1. **Every date has exactly one kind** after Apply, and dates outside the stretch
   are untouched.
2. **No routine task on the clock overlaps busy time** (section 5), in real
   instants.
3. **Applying twice is applying once**: the plan is deeply equal after the
   second Apply, and the second Apply stamps no entity.
4. **Export then import returns the same file**, byte for byte, after Apply.
5. **Nothing is duplicated**: each block and each routine at most once per date.
6. **Nothing written by hand is lost**: every hand-written task before Apply is
   on its date after Apply, and after a change of kind.
7. **Real minutes differ from wall minutes only across a switch**, and there by
   exactly sixty.

A failing run prints its seed and its shrunk case, and a found case becomes a
unit test before it is fixed.

### 8.3 Migration

- An old backup with week templates, weekday overrides and a weekday map - a
  fixture file built with generic names - imports, stamps a month exactly as it
  did before the feature (compared day by day with the stamps recorded from
  `main` before stage 2), and exports back unchanged.
- A backup without `routines`, `dayKind`, `routineId`, `fromRoutine` or
  `routineSkips` loads with none of them, and a backup with them loads with them.
- The fields this feature writes pass an older version's `validate`: the
  validate tables of `3fc3dc5` are copied into a test and run over a plan with
  every new field filled.

### 8.4 Browser walks

On the desktop and the phone: create four kinds with letters; write a gym routine
with a time for each kind; fill a month with a cycle; read the preview (a week's
letters, a routine without a time, a conflict); apply; change one date's kind,
answer the hand-edit question, and undo. Then the day after a night shift at
01:00 shows the continuation and the running shift; and a DST night stretch in
the week view draws the long shift.

---

## 9. Stages

1. **This document**, the audit and its fixes, and DECISIONS.
2. **The data**: `dayKind`, `routines`, `routineId`, `fromRoutine`,
   `routineSkips`; validation, sync kinds, backup counts, export and import, the
   migration fixture and the older-validate test; `hasIdentity`.
3. **Composition**: `composeDay`, busy time, placement, hand edits; fast-check
   and the property tests.
4. **Midnight and daylight saving everywhere**: one sleep function in front of
   every reader, the evening from the next date's kind, `realMinutes`, clock text
   after midnight, continuation and the running block after midnight.
5. **The routine editor**: title, category, length, weekdays, a time per kind.
6. **The roster**: the month's roster mode, taps, the cycle, the draft.
7. **Preview, apply, change and undo**: sections 6.1 to 6.4.
8. **The template editor's sleep band** and editing sleep in place.
9. **The day, the week and the month with kinds**: letters, colours,
   continuation, routines that need a time, conflicts on the day.
10. **The phone, pictures, browser walks and the last tests.**
