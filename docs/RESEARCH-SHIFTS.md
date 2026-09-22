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
  `D`, `N`, `A` - in the template's own colour, kept in capitals so it reads
  at a glance (`cleanLetter`).
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
  minutes: number                  // its length, 1 to 720
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
Task.routineId?: string          // the routine it came from
Task.fromRoutine?: {             // what the rule gave, for telling it from a hand edit
  title?: string; time?: string; minutes: number; category?: CategoryId
}
DayPlan.routineSkips?: string[]  // routines taken off this day by hand
```

**The echo holds the title and the category as well as the time and the
length** (stage 3). Section 6.3 asks whether a routine's task was renamed or
recategorised by hand, and only an echo can answer that. Stage 2's validation
checks the echo with a record check that ignores keys it was not told about, so
a device on stage 2 reads the two new fields without complaint.

**A routine's task that leaves its date by hand leaves a skip behind.**
Deleting it, clearing the day, moving it to another day, pushing it, rolling
the day over, and a replan's or a low day's "tomorrow" all add its routine to
the date's `routineSkips` (`leftByHand` in `routines.ts`), so composing the
date again does not bring it back. Where it lands it keeps its routine id - a
date still never holds two - and loses its echo (`arrivingByHand`): it is
where a person put it, and composing that date leaves it there and never takes
it away. Setting it aside keeps it on its day and writes nothing.

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

**`isRoutine` in `taskIdentity.ts`** meant "has an identity" (a template block
or a repeat). Stage 2 renamed it `hasIdentity` before the word could mean
something else; a routine's task has an identity too, so replan leaves it
where it is and an interruption drops it for the day, as it does a block.

### 2.4 A date's composition

For a date D with kind K:

1. **K's template**, stamped - its blocks, its day type, its sleep schedule.
2. **The routines** whose weekdays include D's weekday, each placed by
   section 2.3 against section 5's busy time.
3. **The sleep** D wakes from, from K's schedule; and the sleep that starts on
   D's evening, from the next date's kind (section 3).
4. Everything the day already had that is not K's template's or a routine's -
   hand-written tasks, repeats, moved tasks, what was written on it - stays.

One pure function composes it: `composeDay(data, date, kind, kindOf)` in
`shiftDay.ts` returns the day and where each routine went. `kindOf` answers
which kind every other date is - the plan's, or a draft's laid over it - so a
preview reads tomorrow as it will be. `applyRoster` composes every date of a
roster through it. Applying, previewing and the property tests all call it;
nothing composes a day a second way.

- **Only a change of kind stamps.** A stamp puts every block back at its
  template's time, so stamping a date's own kind again would undo a shift moved
  or deleted by hand every time a roster was applied. A kind's template edits
  reach its dates the way any template's do (section 6.5).
- **A routine's task follows its rule field by field**, and only in the fields
  that still carry what the rule last gave: a time moved by hand stays while a
  changed length follows. A ticked task is a record and is not touched. A task
  whose routine is no longer on the date - deleted, off the weekday, the date no
  longer a kind - leaves, unless it was ticked, moved or put there by hand. Two
  tasks of one routine on a date, which two devices can make, become one unless
  the second was changed by hand.
- **No kind** takes a kind off a date and nothing else; a date whose template is
  not a kind has no kind to take off and is left as it is. A draft's id naming a
  kind deleted since leaves its date as it is, rather than guessing.
- **A date whose composition changes nothing keeps its own object**, and a
  roster that changes nothing returns the plan itself - which is how Apply knows
  there is nothing to commit.

### 2.5 Where the roster is edited, and what is kept on the device

- **A kind is marked in its day template's editor** (stage 5): one field for
  the letter, kept in capitals, and the letter is the mark - emptied, the
  template is an ordinary one again. A kind takes its place at the end of the
  cycle when it is first marked, since where it comes in the cycle only means
  anything where a tap walks the kinds, which is the month.
- **Routines are written under the templates**, on the same tab (stage 5): the
  times a routine is asked for are the kinds in the list above it. Nothing is
  drawn there until a template is a kind.
- **The roster** is a mode of the month (stage 6): a tap on a date walks it
  through the kinds by `order` and back round; the Clear tool takes the kind
  off. Letters and colours on every date, and nothing else on them: the lines
  of what is on a day are what the date will be made of once it is applied.
- **The Clear tool, and not a long press** (stage 6, changing this design): on a
  grid where a tap walks the kinds, a press held a moment too long would take a
  kind off by accident, and there is no way to see that it was about to. The
  tool says what the next tap will do before it is made.
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

**Stage 9, as built.**

- The day's grid takes last night's blocks as `carried` (`carriedInto`,
  shiftDay.ts) and opens the drawn day at midnight for them. The band runs from
  the top to where each ends, "Night shift, from yesterday" and "until 06:00",
  in a done block's quiet with the category's edge; nothing on it is pressed,
  dragged or ticked, and the same words are said once in a sentence a reader
  hears, since the layer it is drawn on is decorative. It is in the vertical
  map beside the day's own blocks with a block's floor: a wide day is fitted to
  its room, a full one at nought pixels a minute, and there an empty morning -
  and the shift's last hours with it - was nothing.
- The week takes the same, per column, and on a wide screen its shared axis
  opens at midnight when a column carries one; the band stands at the top of
  the morning's column, the block in the evening's. A phone's three columns
  keep their waking axis - the whole clock fitted to a phone is nine pixels an
  hour - and draw what of the continuation that axis reaches.
- A kind is its letter wherever its date is drawn: in the day's masthead chip
  and the week's column chip where the dot stood, and right after the date in
  the month. The start date only, by the midnight rule.
- A routine's task with no time says why, in the time's place
  (`routineNotes`): "Needs a time on Day shift", "Runs into On shift" or
  "Runs into sleep", and "The clock skips 03:30 that night". Section 5's
  conflicts on the day are this.
- The evening close offers to push only what is behind it: a timed task that
  has not started yet (with a length or without) or is running now is
  tonight's, not unfinished (`stillAhead`, eveningClose.ts).

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

### 4.5 Stage 4, reader by reader

A second audit at `fda1cb8` walked every place a time is written past
midnight, every reader of "now", every reader of a day's sleep, and `away`.
What stage 4 changed - all of it built, each with a test that failed first:

**A day's sleep, from one resolver** (`sleepOn` in `shiftDay.ts`, the day
between two sleeps in `wakingDay.ts`):

- The day view, replan, quick-add, Later, the task sheet, the set-aside strip
  and the week all ask `sleepOn`, and a test reads the source to keep it the
  only place a date's sleep is worked out. Four of them had disagreed about a
  week template's column.
- A date's evening ends at tonight's bedtime, which is the next date's schedule.
  A date nobody has opened reads the template its weekday will give it, or
  Friday's evening would change the moment Saturday was opened.
- The free-time figure counts the waking day to that bedtime, past midnight
  where it is, and what still runs in from last night takes its time from the
  morning.
- The grid greys the sleeps that fall on the day, not the waking hours turned
  inside out: after a night shift, midnight to a daytime sleep is awake.
- "Sleep in" counts real minutes to the next bedtime, past midnight included.
- The day's sleep figure is the real length of the sleep it woke from, and the
  phone's sentence names tonight's bedtime where it differs.
- The grid's screen-reader sentence says the real bedtime and wake time, and a
  template's sleep total is its schedule's sleep rather than a day less the
  waking window cut at midnight.

**Clock text:**

- `formatClock` writes a value past midnight on the next day's clock and a value
  before it on the day before's; exactly 1440 stays "24:00", the end of the day.
- Every range adds "(next day)" to an end past midnight: the day grid already
  did, and now the week's blocks, the week template grid and a template's
  overlap line do too.
- No start is saved as "24:00": a drag to the bottom of the grid stops at 23:59,
  and so does replan's "from now" in the last minutes of a day.
- Resizing a block drawn cut at midnight moves its real end by the distance
  dragged, not to where the cut edge was dropped - a grab and release no
  longer shortens an eight-hour shift to two.

**Now, after midnight:**

- What still runs in from yesterday is running today: the header's running
  task and time left, the F key, the focus bar and the focus screen, in real
  minutes.
- A focus session open across midnight counts on its own date's clock, so it
  reads the hours left rather than a day and a half.
- Last night's block still running is busy time for quick-add's and Later's
  slot, and a taken hour in the time picker.
- Yesterday's banner does not count a task still running as unfinished.
- `away` set before midnight is still away after it, through the night until the
  day wakes: when today has none, the header, the menu, the palette and Back
  read yesterday's, and Back clears it where it is. After the sleep the day wakes
  from, a new waking day has begun, and an away nobody came back from is not
  carried into it.

**Left to stage 9**, the views: the continuation band on the next day's grid
and in the next week column, and the running block drawn there. And the
evening close, which shows from 21:30 and offers to push what is unfinished -
on a night-shift day that includes a shift that has not started yet.

**How it was built**, for whoever reads the code next:

- `wakingDay.ts` is the day between two sleeps, in minutes on the date's own
  clock; `SleepSettings.tonightProfileId` carries the next date's schedule into
  every function that already took a schedule id, so no reader's signature
  changed and a template - which has no next date - reads its own schedule on
  both sides. `windowFor` is that day cut to its own clock (for placing and
  drawing) and `wakingDayFor` is the whole of it (for amounts); on one
  schedule the first is exactly the old waking window, every existing case
  measured.
- `sleepOn`, `carriedInto`, `carriedIntervals` and `runningOn` are in
  `shiftDay.ts`; `clockMinutesOn` is in `wallClock.ts`; `awayOn` in `away.ts`;
  `formatEndClock`, `formatTimeRange` and `sleepSentence` beside `formatClock`.

**Kept as it is, and why:**

- The time pickers' arrows wrap round the clock - 23:58 and five minutes is
  00:03 on the same date. It is a documented choice (`stepTime`), and the field
  shows what happened.
- Grids are drawn on the wall clock (section 4.2): a 23-hour day still draws the
  skipped hour, and a 25-hour day draws the repeated one once.
- "Moved earlier 23h 15 min" for a block moved from 23:30 to 00:15 is true: a
  time is on its own date's clock.

**Not this feature's**, and written down so they are not lost: a replan with
no length sets `away` to the interruption's start, which can be later than
now; `away` promises that no nudges fire, and there are no nudges; the yesterday
banner reads its dismissal once, so it is not asked again when the date turns
while the app is open; the soak e2e test steps dates by twenty-four hours of
milliseconds, which drifts an hour across a clock change.

---

## 5. Conflicts

**Busy time on a date D**, in real instants, is the union of:

1. D's own timed blocks, each from its start to its wall-clock end.
2. The part after midnight of D-1's timed blocks.
3. The sleep D wakes from (D's kind's schedule, ending on D).
4. The sleep that starts on D's evening (D+1's kind's schedule, when it starts
   before midnight).
5. What a routine late in the evening can reach past midnight: D+1's blocks and
   the sleep after them. A routine is at most twelve hours long, so busy time is
   read as far as noon on D+1. Stage 3 added this: without it a session at
   23:30 could be placed across a shift that starts at 00:30.

**Which blocks.** A date that already carries its kind is read from what is on
it - a shift moved by hand is where it was moved, one deleted or set aside is
not on the clock. A date a draft is about to give a kind is read from the kind's
template, which is exactly what the stamp will write. So a preview and the plan
after Apply measure the same busy time. Blocks are read from the two dates
before D, which covers any block up to two days long from any start time.

**A routine conflicts** when its interval overlaps busy time by at least a
minute. Touching is not overlapping: a gym session ending at 22:00 before a
22:00 shift is free.

- An **untimed** block is not on the clock and takes no time.
- A block with a **time and no length** - or a length of nothing - takes its
  start minute only, so a routine covering that minute conflicts with it and
  one beside it does not.
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
- **Every door that stamps a kind composes it.** A kind can reach a date without
  the roster - the rail's template chip, the month's paint, Stamp week, the
  weekday map on first open - and until stage 7 those stamp its blocks with no
  routines. Stage 7 puts `composeDay` behind every one of them, so a kind
  means the same day whichever door it came through.

### 6.3 A date changed by hand

A date is **changed by hand** when any of these is true of its current kind's
template tasks or routine tasks: one is done; one's time, length, title or
category differs from what its block or rule gave (`fromBlock`,
`fromRoutine`); a block or routine has no task on the day and no skip (it was
deleted); a routine task was placed by hand. Hand-written tasks do not count -
they stay through any stamp.

`handEdits` counts each task once, a done tick before a move, and a routine's
task that arrived by hand as moved. A block added to a kind after a date was
stamped reads as deleted from it, since nothing records which blocks a stamp
placed: the question then names one too many, and Apply gives the date the whole
new kind, which is what was asked.

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
- The band's two edges are set right there: a row over the picture holds a
  bedtime and a wake time (stage 8 put them in a row rather than on the band's
  own edges, which at an hour are a few pixels apart and would cover the blocks
  the band is seen against). They edit the **named schedule**, which other
  templates and days may share, and the row says so when they do ("Also used by
  Rest day."). Written with the template on Save, never before.
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

As built in stage 3 (`shiftDay.property.test.ts`): two rosters from random
cycles with hand edits between them - a task written, a tick, a routine or a
block moved, a routine deleted - and sometimes every routine's time and length
changed. Invariant 2 is held on the dates the second roster composed; a date
whose draft id names a deleted kind is left as it is, and so is its routine.
Invariant 3 is held as strictly as it can be: the second Apply returns the very
same plan object, so there is nothing for sync to stamp. Twenty-five runs each in
the suite, which keeps it to a few seconds; `SHIFT_RUNS=300` hunts harder and
takes about eighty. Over twenty-five runs a sample measured about six thousand
composed dates, most of them a change of kind, and about fourteen hundred routine
sessions checked against busy time, eighteen hundred dates with a shift running
in from the night before, thirty blocks across a clock change, and 29 February
2028 in ten of the twenty-five stretches.

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

As built in stage 10 (`e2e/shifts.e2e.ts`, both projects): the gym has a time
on three kinds and none on the fourth, and its day-shift time runs into the
shift, so the one preview names both; the hand edit is a tick, and Apply is
taken over it rather than Leave it, so that Undo has something to give back.
The switch night is read where it shows: a night shift stamped on 24 October
2026 has seven real hours left at one in the morning, on the wall's six. The
week draws by the wall's clock, so the same night there is the ordinary
continuation, which the day and the week's own tests hold.

---

## 9. Stages

1. **This document**, the audit and its fixes, and DECISIONS.
2. **The data**: `dayKind`, `routines`, `routineId`, `fromRoutine`,
   `routineSkips`; validation, sync kinds, backup counts, export and import, the
   migration fixture and the older-validate test; `hasIdentity`.
3. **Composition**: `composeDay`, busy time, placement, hand edits; fast-check
   and the property tests; every door a routine's task leaves its date by
   writes its skip.
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

---

## 10. After v2.29: the night's own hours

The owner, once v2.29 was done: a gym day is always that weekday, at the time
the kind of day gives it - a routine, and so it is. And the same with food,
because on a night shift lunch is not lunch. And all of it without being told
twice: a date is given its kind, and what follows from it follows, **the days
after it included** - the hardest part, in the owner's words. A review of every
door a kind reaches a date by, for all three.

### 10.1 What holds already

- **A routine is its weekdays, at each kind's time** (section 2.3). Every door
  that gives a date a kind composes it - the roster, a kind stamped by hand from
  the rail or the month, the weekday map - so the gym is on its weekdays at the
  day shift's time on a day shift, the night's on a night, and needs a time,
  said on the day, where its kind has none. **An ordinary day is a kind too**:
  a date with no kind gets no routines, so a rota's days off and its ordinary
  days are kinds of their own, with a letter, and the routine has a time on
  them.
- **Meals are each kind's own.** A meal is a block on a kind's template, with
  its kind of meal and its recipes from Kitchen; each date takes the recipe its
  place in the block's walk gives it, through the same stamp every door uses.
  So a day shift's template has its lunch at noon, and a night shift's has
  none, and a meal before the shift instead - "lunch is not lunch" is a
  template each, not a rule about lunch.

- **Tonight's sleep is tomorrow's** (section 3.2): the bedtime that closes a
  date comes from the next date's kind, so the evening before an early shift
  ends early without being told.
- **Last night runs into this morning** (section 3.3): a night shift's hours
  after midnight are the next date's busy time, drawn at the top of its
  morning, and what is running at one in the morning is the night shift.
- **A routine is measured against the dates around its own** (section 5): the
  blocks of the two dates before, the sleep it wakes from, tonight's, and what
  a late routine reaches past midnight.

### 10.2 What did not: the hours after a night's midnight

A block belongs to the date it starts on (section 3). A night shift's meal at
01:00 and the drive home at 07:00 start after midnight, so by that rule they are
the next date's - and nothing on the next date knows whether the night before was
worked. Written in the night kind's template they land at 01:00 on the night's own
date, the morning before the shift, when the person is asleep after a day shift;
written in the templates of the kinds that follow a night, they land after a day
shift as well, since the first night of a run follows one. A rota of two days
and two nights had no way to say "the night shift eats at one" at all.

**The fix: a template can hold the hours after its midnight.** A block on a day
template can be marked **after midnight**: its time is on the next date's clock,
and it belongs to the night of the date the template is on. It is written where
it belongs - "Night meal, 01:00, after midnight" in the night shift - and:

1. A date given the template gets its ordinary blocks, and the **next date** gets
   its after-midnight blocks, as that date's tasks, each marked with the night it
   belongs to (`Task.nightOf`, the date whose template put it there). They
   happen on the next date, so that date draws them, ticks them and counts them -
   Review counts a block on the date it starts on, unchanged.
2. A date whose template changes, or goes, takes its night's tasks off the next
   date with it and gives the next date the new template's. A task of the night
   that somebody ticked or changed is a hand edit of the night's date (section
   6.3), and changing that date's kind asks first.
3. The next date's own template never touches them: its stamp keeps every task
   another night put there, the way it keeps what was written by hand.
4. They are the next date's busy time like any timed block there, so a routine on
   the next date runs into them.
5. Routines stay on their own date. A routine during a night shift runs into the
   shift; its hours are the template's to hold.
6. A week template's blocks are a weekday's own and are not offered it.
7. A task of the night pushed, moved or carried on to another date is that
   date's own from then on, and loses the mark: it is no longer the night's
   to take away.
8. Review, the block counts and the plan reading find a night's block on the
   date after the one it was stamped on.

### 10.2a What did not either: the dates around a date whose kind changes

Composition measured a date against its neighbours (10.1), but only a date
being composed was measured. A date given a kind by itself - one tap on a
Monday - changed what the days around it are made of and left them as they
were: a gym at six on the Tuesday after a Monday made a night shift kept its
six o'clock under the shift's last hour, and the day showed nothing, since a
routine's task with a time says nothing about where it went.

**The fix: a kind reaches the dates around it.**

9. When a date's kind changes - by the roster, a kind stamped by hand, or the
   weekday map - the dates around it that have a kind are composed again: the
   day before, whose evening ends in the changed date's sleep and whose late
   routines reach into its blocks, and the two after, whose mornings its blocks
   and its night run into. Their kind is not changed and nothing is stamped on
   them; only a routine's task still as its rule left it moves, and one ticked,
   moved or written by hand stays. A date behind today is not touched.
10. The preview names the days that follow, and Apply is what it named: both
    come from one function.
11. A date the weekday map will give a template with hours after its midnight is
    given it when the date after it is opened, if it has not been opened yet, so
    its night is on that date whichever of the two is opened first. Only the
    one date before, and only today or ahead.

`TemplateBlock.afterMidnight` and `Task.nightOf` are optional fields: absent is
"not after midnight" and "the date's own", every block and task written before
them reads that way, and an older version carries them untouched (the validator
lets a field it does not name ride along).

### 10.3 Stages

1. **This section** and DECISIONS.
2. **The data and composition**, one stage, since two fields nothing writes are
   not a stage anyone could see: the fields, validation, export and import,
   sync; the stamp writes a template's night onto the next date, every door
   through it; the dates around a changed kind follow it; the hand edits count
   the night; the preview names the days that follow; property tests: nothing
   duplicated, applying twice is applying once, nothing written by hand lost,
   and every night's task standing for a block of its night, with nights in the
   generator.
3. **The editor and the day**: "After midnight" on a block, the template's
   picture drawing it past 24:00, and the day marking a task as last night's.
   As built (10.4), the picture says the night's hours rather than drawing
   them, and the toggle is called Next day.
4. **A guide for another agent** - how the plan is kept and read, the rota above
   all - and a contract a program reading the backup can rely on; the phone,
   pictures, the gates.

### 10.4 Stage 3, as built

The owner's words for it: the night's hours visible and editable where they
live - on the next day's morning with a clear mark that they are the night's,
and in the template editor as a plain toggle, not a field of its own with an
explanation; nothing new in the calendar's grid; the 375px floor; and every
decision looked at on a phone and on a desktop until it fits both.

- **Next day**, a toggle on a block's row beside Core, Key and Ongoing, and on
  the add row. Nothing to read beside it: what it does shows on the picture
  above the moment it is pressed. A new block is not on the next day unless
  asked, like Core and Ongoing. A week made from a day template brings every
  block over as its own weekday's (rule 6).
- **The picture is the template's own day.** A block on the next day is the
  morning after's, and a drawing of it at one in the morning here would say it
  happens the morning before the shift - the very thing section 10.2 fixed. So
  it is said under the picture, in the line the day's numbers are in: "After
  midnight: 01:00 Night meal, 07:00 Drive home". The day's numbers, the
  overlaps and the hours the time field calls taken are the day's own, and
  leave the night's out.
- **A phone's row.** Core, Key, Ongoing and Next day, the note and the cross
  are more than a 375px line, and the row that wrapped left Note and the cross
  on a line of their own. On a phone the four marks stand behind one word on
  the line with the note and the cross - the marks that are on ("Ongoing, Next
  day"), or "Marks" - and open as a line of their own above it. A wide screen
  keeps them in the row, as they were.
- **The day marks a night's task.** Its row says "last night" beside the
  night's letter on the kind's colour - the chip the day's masthead and the
  week's column already draw a kind with - so the mark reads without the
  colour and the colour without the words. A night template that is not a kind
  gives the words alone. On the grid a night's block wears the night
  template's colour rather than the morning's (TimelineGrid's
  `templateColorFor`), the rule the grid always had: a block shows the colour
  it came from.
- **Found while looking**: with the night's meal at one and the drive home at
  seven on the morning after, the grid offered "5h 30 min free" between them -
  inside last night's shift. Last night's hours are busy time in the grid's
  gaps now (`computeInteriorGaps`), and the stretch after the shift ends is
  the day's own free time like any other.
- **The calendar's grid is as it was.** The month and the week draw a night's
  task as the date's task it is; the day's peek lists it without the mark.
- A browser walk on both screens (`e2e/night-hours.e2e.ts`): the meal written
  on the next day, the roster, the mark on the morning after, and the night
  taken away with its meal. The sweep and the precision check open a night
  shift's template, and their morning after carries the night's meal.
