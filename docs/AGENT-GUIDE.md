# Dienius, for another agent

This is for an agent working beside the person who uses Dienius: one that has
to understand how a day is planned here, where the plan is kept, what can be
read from it and how, and what must never be done to it. It is one read, top
to bottom. Where a question goes deeper, it points at the document that holds
the answer.

Every name and time in it is an invented one.

## 1. What Dienius is

A day planner that runs in the browser and installs as an app, on a computer
and on a phone. It is local first: the whole plan is one JSON object in the
browser's storage (`localStorage`, key `dienius:data`), and everything the
app does is a function of that object. There is no account and no server of
ours.

The screens, as the navigation names them:

- **Today** - the day: its tasks as a list and on a timeline, the sleep it
  wakes from and the one it ends in, a Focus timer, a replan for when a day
  goes sideways, and the evening close.
- **Calendar** - the month, the week and an agenda. The month is where a rota
  is laid out (the **Roster**).
- **Templates** - shapes of a day (and of a week) that are stamped onto dates.
  A template with a letter is a **kind of day**; under the templates are the
  **routines**.
- **Library** - lists of books, films, courses; a block can draw its title
  from the next unfinished item.
- **Review** - how the plan and the days agreed, counted, never scored as a
  streak.
- **North** - the person's own text, read every morning. Nothing counts it.
- **Kitchen** - recipes, by meal. A meal block on a template holds recipes and
  walks through them a day at a time.
- **Settings** - themes, sleep schedules, categories, sync, the copy on
  GitHub, export and import.

Three optional layers, none of them needed: **sync** between the person's own
devices through a small server they host, **a copy on GitHub** in a private
repo of theirs, and a week of **snapshots** on each device.

## 2. Where the plan is, and which copy to read

The live plan is on the person's devices. The copy another program can read
is the private GitHub repo the backup writes to:

| File | What it is |
|---|---|
| `data/state.json` | The whole plan, the latest copy. Start here. |
| `data/history/YYYY-MM-DD.json` | That day's last copy of the whole plan. One file a day. |
| `data/sync.json` | Sync's own machinery. Not for reading. |

The format of both, field by field, what a reader can rely on from one version
to the next, and how the plan's rules are read out of it, is
[BACKUP-FORMAT.md](BACKUP-FORMAT.md) - the contract. A file exported by hand
(Settings, Export and import, Export backup) is the same text.

**How fresh.** A copy is written at most every ten minutes while something
has changed, when the evening closes, when a new day starts, and whenever
"Back up now" is pressed. A device that is off writes nothing.

**Reading is safe; writing into these files is not.** The app never reads
them on its own. It reads `state.json` only when the person presses Restore
and confirms, and it writes over all of them on its next backup. So:

- Never edit `data/*.json` expecting the plan to change. It will not, and the
  edit is gone at the next backup.
- To change the plan, the person changes it in the app. A whole plan prepared
  elsewhere can be brought in by the person, with **Settings -> Export and
  import -> Import backup** - it replaces everything, and it is refused whole
  unless every value in it passes the app's own check
  (`src/lib/validate.ts`).

## 3. The plan's shape

`AppData` in [`src/lib/types.ts`](../src/lib/types.ts) is the place to start;
every field there says what it means and what absent means.
[ARCHITECTURE.md](ARCHITECTURE.md) section 2 draws the tree. What a reader
needs most:

- **A date key is `YYYY-MM-DD` on the person's own clock.** Dates sort as
  strings.
- `days[date]` is a **DayPlan**: its `tasks`, the `templateId` stamped on it
  and the `dayType` that came with it, its `journal` text, and a few marks.
  A date with no record is a date nothing has been put on yet.
- A **Task**: `title`, `time` (`HH:MM`, or absent for a task with no time),
  `minutes` (absent is unsized, not zero), `done`, `category`, `highlight`
  (one of the day's key tasks), `note`, and where it came from - `origin`
  (`template` with the template and block ids, `repeat`, or `manual`),
  `routineId` for a routine's task, `nightOf` for a night's (section 4.5).
- A **Template**: `name`, `blocks` (each with an optional `time`, `minutes`,
  `category` and the rest), `type` (`full`, `shift`, `night`, `rest`), a
  `sleepProfileId`, and `dayKind: { letter, order }` when it is a kind of day.
- A **Routine**: `title`, `minutes`, `weekdays` (0 is Sunday) and `times`, a
  time for each kind by the kind's template id.
- `settings.sleepProfiles`: named sleep schedules, each a `window` from
  bedtime (`start`) to waking (`end`).
- **Absent is a real value everywhere**, and an id that points at nothing -
  a deleted template, category or recipe - is read as absent. Never as an
  error.

## 4. The rota, in full

A rota of shifts - day shifts, nights, days off, in a pattern that repeats - is
the part of the app that is hardest to get right. docs/RESEARCH-SHIFTS.md has
every rule with the reason for it; this is the whole of it in order.

### 4.1 A kind of day is a template with a letter

Day shift, night shift, a day off, the day after nights - each is a day
template the person built, with its own blocks, its own day type and its own
sleep, and a letter: D, N, R, A. **An ordinary day is a kind too**: a date
with no kind gets no routines, so a day off is a kind of its own.

Which kind a date is, is which kind's template is stamped on it
(`DayPlan.templateId`). Nothing else holds it.

The day after the last night of a run is best a kind of its own - After
nights, with a sleep in the daytime: that is how its morning is asleep and its
gym comes later. The app does not turn a day into one by itself.

### 4.2 A routine is written once, with a time for each kind

The gym on Mondays, Wednesdays and Fridays is **one routine**: its weekdays,
its length, and a time on each kind - 17:00 on a day shift, 14:00 on a
night-shift date, 10:00 on a day off. So a gym day is always a gym day, and
its time follows the kind the date is:

- On its weekdays, on a date with a kind, it puts one task on the day, at that
  kind's time.
- A kind with no time for it: the task lands with no time, and the day says
  "Needs a time on Night shift". **The app never guesses a time.**
- A time that runs into the kind's blocks or into sleep - its own, last
  night's, or tonight's - lands with no time and says what it runs into:
  "Runs into On shift", "Runs into sleep".
- The night the clocks skip its time: no time, and the day says so.
- A routine's task moved, renamed or ticked by hand is the person's from then
  on; the rule never moves it back.

### 4.3 Meals are each kind's own

A meal is a block in the meals category on a kind's template, holding
recipes from Kitchen or the kind of meal. So "lunch" is not a rule the app
knows; it is a block on the day shift's template at noon, and the night
shift's template has none - it has a meal before the shift and one in the
night instead. Each date a meal block lands on takes the next recipe in its
list, by the date.

### 4.4 Midnight

**A block belongs to the date it starts on; a sleep belongs to the date it
wakes into.** A night shift from 22:00 to 07:00 is Monday's task, counted on
Monday, even though it ends on Tuesday. The sleep from Monday night into
Tuesday morning is Tuesday's, from Tuesday's kind's schedule - which is how
the evening before an early shift ends early: **tonight's bedtime is
tomorrow's**.

### 4.5 The night's own hours

A block on a template can be marked **Next day** (in the block's row; on a
phone, under the block's **Marks**): its time is on the next day's clock. A
night shift's template holds "Night meal, 01:00, next day" and "Drive home,
07:00, next day", and when a date is given the night shift:

- the date gets the shift, and **the date after gets the night meal and the
  drive home**, as its own tasks, each with `nightOf` set to the night's date;
- they happen on the date after, so it draws, ticks and counts them; the day
  marks them "last night" beside the night's letter, and draws them in the
  night's colour;
- changing the night's date to another kind takes them off the date after and
  gives it the new kind's;
- the date after's own kind never touches them.

### 4.6 The days around a date

A date is never planned alone. What a date's plan reads of its neighbours:

- **tonight's sleep** from the next date's kind (4.4);
- **last night's shift** still running this morning: busy time, drawn at the
  top of the morning, and the thing running at one in the morning;
- **last night's hours** as tasks (4.5);
- **a late routine** is measured against the next date's first blocks and its
  sleep, so the gym at 23:00 is not put across a shift at 00:30.

And the other way: **when a date's kind changes, the day before it and the two
after are measured again.** Their kind stays and nothing is stamped on them;
only a routine's task still as its rule left it moves - the gym at 07:15 on
the Tuesday after a Monday made a night shift loses its time and says it runs
into the drive home, 07:00 to 07:30.

### 4.7 How a rota reaches the dates

- **The roster** - Calendar, Month, Roster: a tap walks a date through the
  kinds, and a **cycle** (D D N N A R R R) fills a stretch in one press. It is
  a draft on the device until **Apply**, which first says, week by week, what
  it will do: the letters, the routines that need a time or run into
  something, the days changed by hand (each with Leave it), and the days next
  to the draft that follow it. Undo takes the whole of it back.
- **A kind stamped by hand** from the month or the day.
- **The weekday map** - which template each weekday starts from - on the
  first open of a date.

Every one of them composes a date the same way, through one function
(`composeDay` in [`src/lib/shiftDay.ts`](../src/lib/shiftDay.ts)).

### 4.8 What is never done without the person

- A date's kind is never changed by the app.
- A routine's time is never guessed.
- A day already behind today is never rewritten by the roster or the weekday
  map. A lived day says what it was.
- A date changed by hand - something ticked, moved or deleted - is named
  before Apply changes its kind, and what was written by hand stays on every
  day through every change.

### 4.9 Clock changes

A block's time and length are the clock face: a night shift from 22:00 to
07:00 ends at 07:00 whatever the clocks do. On the two nights a year they
change it is an hour longer or shorter, and the time it has left says so.

## 5. Reading one date

From `state.json` - [BACKUP-FORMAT.md](BACKUP-FORMAT.md) section 4 states the
same rules as the contract:

1. **Its kind**: the template `days[date].templateId` names, if it has a
   `dayKind`.
2. **Its tasks**: `days[date].tasks`, all of them its own to tick. Those with
   `nightOf` came from last night's kind; those with `routineId` are
   routines; `origin.type` says template, repeat or by hand.
3. **Last night, still running**: yesterday's timed tasks whose `time` plus
   `minutes` passes midnight, until where they end.
4. **Its sleep**: the date's own `sleepProfileId`, else its template's, else
   the first schedule - that is the sleep it wakes from. Tonight's is the next
   date's, read the same way.
5. **Why a routine has no time**: not stored. It is worked out when the day is
   drawn (`routineNotes` in shiftDay.ts): its kind has no time for it, its
   time runs into the kind's blocks or into sleep, or the clock skips its time.

### For a journal

A journal that reads the plan takes, for each date: its kind (a letter and a
name), what was planned and what was ticked (`tasks`, `done`), which of it
was last night's (`nightOf`), the routines and whether they kept their time,
and the words written on the day (`journal`). It reads; it never writes into
the backup's files (section 2). A date nobody has opened yet may be empty in
the file even where the weekday map will fill it.

## 6. Words the app uses

| Word | Means |
|---|---|
| Key | One of the day's three tasks that matter. |
| Core | A block that counts on a day that is not a full one. |
| Ongoing | A block that is simply running - never pushed, never asked to be ticked. |
| Stamp | Copy a template onto a date. |
| Push | Move a task to tomorrow; twice, then it asks. |
| Later | Something to do on no particular day. |
| Replan | Fitting the rest of a day around something that came up. |
| Low day | A day kept to its key tasks, at 40% of their length. |
| Kind of day | A day template with a letter - section 4.1. |
| Routine | Something on the same weekdays at each kind's own time - 4.2. |
| Next day | A template's block after its midnight - 4.5. |

## 7. Further reading

- [RESEARCH-SHIFTS.md](RESEARCH-SHIFTS.md) - the rota, every rule and why.
- [BACKUP-FORMAT.md](BACKUP-FORMAT.md) - the backup's format, field by field, and what a reader can rely on.
- [DAILY.md](DAILY.md) - how the app is used, day to day.
- [ARCHITECTURE.md](ARCHITECTURE.md) - where the code lives.
- [DECISIONS.md](DECISIONS.md) - why things are the way they are.
- [`src/lib/types.ts`](../src/lib/types.ts) - the data, field by field.

## 8. Rules for working on this repository

- **The repository is public.** Nothing the person writes - their North text,
  their plans, their tasks, their recipes, their list names - goes into it:
  not into a test, a fixture, a screenshot or an example. Invented, generic
  names only.
- No em-dashes anywhere; a plain hyphen.
- Every change passes the gates in [CONVENTIONS.md](CONVENTIONS.md), the
  privacy check (`npm run privacy`) among them.
