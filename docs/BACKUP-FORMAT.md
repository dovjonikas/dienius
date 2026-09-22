# The backup's format

For a program that reads what Dienius writes: the file **Export backup** saves
(Settings, Export and import), and `data/state.json` in the copy on GitHub. It
is one contract: what is in the file, what each field means, what a reader can
rely on from one version to the next, and how the plan's rules are read out of
it. How the app is used, and the rota above all, is
[AGENT-GUIDE.md](AGENT-GUIDE.md).

Every section headed with a shape's name below lists every field the app's own
guard (`src/lib/validate.ts`) knows on that shape. A test holds it
(`src/lib/backupContract.test.ts`): a field added to the guard and not written
down here fails the build. Fields new in v2.31 are marked **v2.31**.

## 1. Where, and what

- **The export** is `JSON.stringify(plan, null, 2)`: one object, two-space
  indents. Where the plan names photos, an `about` sentence is written first
  for whoever opens the file; it is not part of the plan and is dropped on the
  way in.
- **The GitHub copy** writes the same text, without `about`:
  - `data/state.json` - the latest copy: since v2.34 the merge of what the
    file held and what the device backing up holds, per entity, so it is
    never older than any device's last backup;
  - `data/history/YYYY-MM-DD.json` - that day's last copy, one file a day;
  - `data/sync.json` - sync's own machinery, not a plan.
- **When**: at most every ten minutes while something changed, when the
  evening closes, when a new day starts, and when "Back up now" is pressed.

## 2. What a reader can rely on

1. **One object, the plan.** Everything the app knows about the days is in it;
   what is not (the tokens, the device's own switches, a draft roster, the
   running timer) is on the device and in no backup.
2. **Nothing is ever re-typed.** A field keeps its type and its meaning for
   good. Everything added after the first version is optional or a new list,
   and **absent means the default** - a task with no `time` has no time, a
   block with no `afterMidnight` is on its own date, a plan with no
   `routines` has none.
3. **An unknown field rides along.** The app reads the fields it names and
   carries the rest untouched, which is how an older version keeps a newer
   file's data. A reader should do the same, and never refuse a file for a
   field it does not know.
4. **An id that points at nothing is absent.** A deleted template, category,
   recipe, list or sleep schedule leaves ids behind; each reads as "none",
   never as an error.
5. **A file is accepted or refused whole.** The app validates every value it
   names before anything is replaced; a file it would refuse is never half
   imported.
6. **A backup imported and exported again is the same file, byte for byte.**
   The test holds it on a backup recorded by the version before v2.31.
7. **Clock and calendar.** A date is a `YYYY-MM-DD` key on the person's own
   clock, and sorts as a string. A time is `HH:MM` on its date's clock,
   `00:00` to `23:59`. A length is whole minutes. An instant (`updatedAt`) is
   ISO 8601.

## 3. The shapes

### AppData

The file itself.

| Field | Means |
|---|---|
| `templates` | Every template: day templates, week templates, and the kinds of day - see Template. |
| `days` | The plan, by date key: `{ "2026-09-22": DayPlan }`. A date with no key has nothing on it yet. |
| `settings` | The person's settings. Two of them are the plan's: `sleepProfiles` (SleepProfile) and `weekdayTemplates`, which template each weekday starts from (`{ "6": templateId }`, 0 is Sunday). |
| `routines` | Rotating shifts' routines - see Routine. |
| `categories` | What a day is made of - see Category. |
| `recipes` | Kitchen's recipes - see Recipe. |
| `library` | Lists of books, films, courses, and their items. |
| `backlog` | Later: things to do on no particular day (its old wire name). |
| `scratch` | Notes, each a text and an instant. |
| `picture` | North: one text, `{ text }`. |
| `goals` | Retired in v2.28; kept for old files. |
| `ifThens` | Retired with goals; kept for old files. |
| `inbox` | Empty since v2.7; kept for old files. |

Two more ride along at the top without the guard naming them: `settingsUpdatedAt`
and `tombstones`, sync's record of what changed when and what was deleted.

### DayPlan

One date's plan.

| Field | Means |
|---|---|
| `date` | Its date key. |
| `tasks` | Everything on the date - see Task. |
| `templateId` | The template stamped on it. Where that template has a `dayKind`, this is the date's kind of day on the roster. |
| `dayType` | The day type the template gave when it was stamped: `full`, `shift`, `night` or `rest`. Absent is `full`. |
| `sleepProfileId` | A sleep schedule chosen for this date by hand, over its template's. |
| `journal` | The date's journal text. |
| `autoApplied` | The date has been opened, and what the weekday map and repeats give it has been given. |
| `repeatSkips` | Repeats taken off this date by hand, so they do not come back. |
| `routineSkips` | Routines taken off this date by hand, so they do not come back. |
| `away` | `HH:MM` the person went away from the plan, while they are away. |
| `bestMoment` | Retired with the three-question journal; kept for old files. |
| `replannedOn` | The date key a replan of this date was accepted on. |
| `lowDay` | The date was kept to its key tasks. |

### Task

One thing on a date. Its date is the date it is filed under: **a task belongs
to the date it starts on** (section 4).

| Field | Means |
|---|---|
| `id` | Unique. |
| `title` | What it is. |
| `done` | Ticked. |
| `time` | `HH:MM` on its date's clock. Absent: no time - it floats on the day. |
| `minutes` | How long it is planned to take. Absent is unsized, not zero. |
| `actualMinutes` | How long it took, where somebody measured it. |
| `category` | A category id. |
| `highlight` | One of the day's key tasks. |
| `core` | Counts on a day that is not a full one. |
| `unbounded` | Ongoing: never pushed, never asked to be finished. |
| `note` | Its note. |
| `templateNote` | The note its block last gave it, to tell a note written on the day from the block's. |
| `noteExpanded` | The note shows open. |
| `subtasks` | Its steps: `{ id, title, done, minutes? }`. |
| `link` | A web address. |
| `origin` | Where it came from - see TaskOrigin. Absent: written by hand, or older than origins. |
| `fromTemplate` | Stamped by a template and still the template's; cleared when a push carries it to another date. |
| `fromBlock` | What its block gave it when stamped - see Task.fromBlock. |
| `routineId` | The routine it is the date's instance of. |
| `fromRoutine` | What the routine's rule gave it - see Task.fromRoutine. |
| `nightOf` | **v2.31.** The date whose night put it here - always the date before. A night shift's meal at 01:00 is the morning after's task, and this names the night. Absent: the date's own. |
| `recipeId` | A meal's recipe. |
| `mealType` | A meal's kind of meal, where no recipe is chosen: `breakfast`, `lunch`, `dinner`, `pre-gym`, `post-gym` or `snack`. |
| `libraryRef` | The library item it is a session of: `{ listId, itemId }`. |
| `repeat` | On a repeat's source: `daily`, `weekdays` or `weekly`. |
| `repeatOf` | On a repeat's instance: its source's id. |
| `pushCount` | How many times it has been pushed to the next day. |
| `setAside` | Waiting aside, off the clock. |
| `missed` | **v2.35.** A block that ends by itself - ongoing, or of a category that ends by itself - that did not happen. Not done, and the clock does not mark it done. |
| `latest` | `HH:MM`, the latest it is worth starting at. |
| `fromNote` | The id of the note it was made from. |
| `tourCreated` | Made by the first-run tour. |

### TaskOrigin

| Field | Means |
|---|---|
| `type` | `template`, `repeat` or `manual`. |
| `sourceId` | The template, or the repeat's source task. |
| `blockId` | The template's block. The pair `sourceId` and `blockId` is a task's identity across dates: a date never holds two of one block. |

### Task.fromBlock

What the block gave the task at its last stamp. A field that still equals it
has not been changed on the day.

| Field | Means |
|---|---|
| `title` | The block's title. |
| `time` | The block's time. |
| `minutes` | The block's length. |
| `category` | The block's category. |
| `recipeId` | The recipe the block gave this date. |
| `mealType` | The kind of meal the block gave. |

### Task.fromRoutine

What the routine's rule gave the task. A field that still equals it follows the
rule; one changed on the day is the person's.

| Field | Means |
|---|---|
| `title` | The routine's title. |
| `time` | The time its rule placed it at; absent where it placed it with no time. |
| `minutes` | The routine's length on that kind of day. |
| `category` | The routine's category. |
| `core` | **v2.37.** The routine's core mark. |

### Template

| Field | Means |
|---|---|
| `id` | Unique. |
| `name` | Its name. |
| `color` | `#rrggbb`. |
| `blocks` | What it puts on a date - see TemplateBlock. |
| `type` | The day type it gives: `full`, `shift`, `night` or `rest`. Absent is `full`. |
| `kind` | `week` for a week template; absent is a day template. |
| `weekDays` | On a week template, each weekday's own type and sleep - see WeekDayOverride. |
| `sleepProfileId` | The sleep schedule the dates it is stamped on wake from. |
| `dayKind` | Makes a day template a kind of day on the roster - see DayKindMark. |
| `tourCreated` | Made by the first-run tour. |

### TemplateBlock

| Field | Means |
|---|---|
| `id` | Unique within its template; a stamped task names it in `origin.blockId`. |
| `title` | What it is. |
| `time` | `HH:MM` on the clock of the date it lands on. |
| `minutes` | Its length. |
| `category` | A category id. |
| `core` | Counts on a day that is not a full one. |
| `highlight` | One of the day's key tasks. |
| `unbounded` | Ongoing. |
| `note` | What it says when it lands. |
| `noteExpanded` | Its note shows open. |
| `steps` | Its steps, `{ id, title, minutes? }`, copied as subtasks. |
| `libraryListId` | Draws its title from the next unfinished item in a library list. |
| `recipeIds` | A meal's recipes, walked a date at a time. |
| `recipeId` | The first of `recipeIds`, for versions before the walk. |
| `mealType` | A meal's kind of meal. |
| `followMeal` | **v2.32.** With `mealType`: the block walks every recipe Kitchen has for that meal, in the order of their names, worked out when a date is stamped. Absent: its list, or its meal to choose on the day. |
| `waitingRecipes` | **v2.36.** Recipes this block named in a templates file before Kitchen had them, by name. The block takes each as soon as Kitchen has a recipe of that name, and the name leaves this list. |
| `weekday` | On a week template: its weekday, 0 is Sunday. |
| `groupId` | On a week template: blocks added to several weekdays together. |
| `afterMidnight` | **v2.31.** After the template's midnight: its time is on the next date's clock, and a stamp puts it on **the date after** the template's date, as a task with `nightOf`. Shown in the editor as **Next day**. Absent: on the template's own date. |

### DayKindMark

| Field | Means |
|---|---|
| `letter` | One or two characters, drawn on every date the kind is stamped on. |
| `order` | Its place in the order a tap on the roster walks the kinds. |

### WeekDayOverride

| Field | Means |
|---|---|
| `type` | That weekday's day type. |
| `sleepProfileId` | That weekday's sleep schedule. |

### Routine

| Field | Means |
|---|---|
| `id` | Unique; a routine's task names it in `routineId`. |
| `title` | What it is. |
| `category` | A category id. |
| `minutes` | Its length, 1 to 720, on every kind that has none of its own. |
| `kindMinutes` | **v2.37.** Its length on one kind of day, by the kind's template id: `{ "day": 30, "rest": 60 }`. A kind with none: `minutes`. |
| `core` | **v2.37.** Its task counts on a day that is not a full one, the way a block's `core` does. |
| `weekdays` | The weekdays it is on, 0 is Sunday. |
| `times` | Its time on each kind of day, by the kind's template id: `{ "day": "17:00", "night": "14:00" }`. A kind with none: the routine lands on it with no time. |

### SleepProfile

| Field | Means |
|---|---|
| `id` | Unique; the first in the list is the default. |
| `name` | Its name. |
| `window` | When it sleeps - see SleepWindow. |

### SleepWindow

| Field | Means |
|---|---|
| `start` | Bedtime, `HH:MM`. |
| `end` | Waking, `HH:MM`. A window whose end is before its start runs over midnight. |

### Category

| Field | Means |
|---|---|
| `id` | Unique. |
| `label` | Its name. |
| `color` | `#rrggbb` where one was chosen; absent is the built-in pair for its id. |
| `endsItself` | **v2.35.** Its blocks are done once their end has passed, like an ongoing block's. Absent: yes for `commute`, no for every other. |

### Recipe

| Field | Means |
|---|---|
| `id` | Unique. |
| `title` | Its name. |
| `text` | The recipe as written. |
| `mealTypes` | The meals it is for. |
| `kcal` | Energy, per serving. |
| `protein` | Grams, per serving. |
| `carbs` | Grams, per serving. |
| `fat` | Grams, per serving. |
| `servings` | How many it makes. |
| `minutes` | How long it takes. |
| `cooked` | Kept from before v2.30; shown by nothing. |

## 4. Reading the plan's rules out of it

The file holds the plan; a few of its meanings are rules rather than fields.
docs/RESEARCH-SHIFTS.md has each with its reason.

- **A date's kind of day** is the template `templateId` names, where that
  template has a `dayKind`. Nothing else holds it.
- **A task belongs to the date it starts on; a sleep to the date it wakes
  into.** A night shift at 21:00 for 600 minutes is filed on its evening's
  date and runs until 07:00 the next morning. The next morning's first hours
  are busy with it though no task there says so: read it from the date
  before - a timed task whose `time` plus `minutes` passes midnight.
- **A night's own hours** (v2.31): a task with `nightOf` is the date's to do
  and to tick, and it belongs to the night before - its template's block with
  `afterMidnight`. It goes when that night's template changes.
- **A date's sleep**: the date's own `sleepProfileId`, else its template's
  (a week template's weekday first), else the first schedule - that is the
  sleep the date wakes from. The sleep that ends its evening is the next
  date's, read the same way.
- **A routine's task with no time** has one of three reasons, none stored: its
  kind has no time for it, its time runs into the kind's blocks or into
  sleep, or the clock skips its time that night. The app works it out when the
  day is drawn (`routineNotes` in `src/lib/shiftDay.ts`).
- **The weekday map** (`settings.weekdayTemplates`) fills a date the first time
  it is opened, today or ahead; a date nobody has opened may be empty in the
  file and full on the screen.

## 5. What each version added

| Version | Added |
|---|---|
| v2.27 | `recipes`; `recipeId` and `mealType` on a task and a block. |
| v2.28 | `picture` is North's one text; `goals` and `ifThens` retired and kept. |
| v2.29 | `dayKind` on a template, `routines`, `routineId` and `fromRoutine` on a task, `routineSkips` on a day. |
| v2.30 | `recipeIds` on a block. |
| v2.31 | `afterMidnight` on a block, `nightOf` on a task. |
| v2.32 | `followMeal` on a block; `mealWords` in the settings - `[{ word, meals }]`, the words a recipe's name starts with and the meals each says, read past anything malformed rather than refused. |
| v2.35 | `missed` on a task, `endsItself` on a category: an ongoing block, and a block of a category that ends by itself, is marked done by the app once its end has passed, unless it was said not to have happened. |
| v2.36 | `waitingRecipes` on a block: a recipe named by a templates file before Kitchen had it, taken when a recipe of that name arrives. |
| v2.37 | `kindMinutes` and `core` on a routine, and `core` on what its rule gave a task: a routine may be a different length on each kind of day, and may count on a day that is not a full one. |
