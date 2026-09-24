# The archive's format

For a program that reads the progress Dienius keeps - the journal that
writes the templates file, or anything else: the files the app writes under
`archive/` in the private GitHub repo the backup uses. Since v2.43. Every
example here is invented.

## 1. Where, and when

- **`archive/days/YYYY/MM/YYYY-MM-DD.json`** - one lived day, in the shape of
  section 3. Written once the day is over: on the first open of a new day,
  after every backup, and on Settings, Backup, **Archive now**. Written again
  only when the day changes afterwards - a block ticked late, a note written
  the morning after. Nothing else ever touches it: a recipe retold or a
  category renamed afterwards leaves the file as it was written, with the
  numbers and the names of that day.
- **`archive/weekly/YYYY-MM-DD.json`** - the whole plan once a week, named by
  the week's Monday and written on the first run of that week. It is the
  file Export backup writes (docs/BACKUP-FORMAT.md), so Settings, Export and
  import takes it back. **Never written over.**
- **Nothing is ever deleted.** The files are small, and the history is the
  point.

The same repo and the same token as the backup, and on whenever the backup
is: there is nothing else to set up. Settings, Backup says how far it
reaches - "Archived until September 23." - and, on the same line, what went
wrong when something did: a token GitHub refused, a repo it cannot find, no
connection. What was not written waits for the next run; nothing is lost
for being late.

A date is a lived day once it is behind today on the device's clock, and it
is archived when anything is on it: a task, a journal line, a note.

## 2. What a reader can rely on

1. **One object a file**, `"format": "dienius-day"` and `"version": 1`. A
   field is added in a later version, never re-typed; a reader should carry
   on past a field it does not know, never refuse the file for it.
2. **The same day is the same text.** Fields in the order of section 3 and
   4, each written only where the day says it, two spaces of indent, a line
   at the end. A file that has not changed has not changed.
3. **Clock and calendar** as the backup has them (BACKUP-FORMAT section 2.7):
   a date is `YYYY-MM-DD` on the owner's own clock, a time `HH:MM` on its
   date's clock, a length whole minutes, an instant ISO 8601.
4. **The file is the latest any device wrote.** `changedAt` is the newest
   change to anything in the day; a device holding an older copy of the day
   leaves a newer file alone, and one holding a later change writes it.

## 3. The day

| Field | Means |
|---|---|
| `format` | `"dienius-day"`. |
| `version` | `1`. |
| `date` | The day, `YYYY-MM-DD`. |
| `kind` | The kind of day the roster put on it: `{ "letter": "D", "name": "Day shift" }`. `null` on a date with no kind. |
| `template` | The name of the template stamped on it, or `null`. |
| `dayType` | `full`, `shift`, `night` or `rest` - what the score counts by. |
| `lowDay` | `true` on a day kept to its key tasks. Absent otherwise. |
| `score` | The day's score as the app shows it: `{ "done": 7, "of": 9, "counts": "core" }`. `counts` is `everything` on a full day, `core` on a shift, night or rest day - only its blocks marked core are counted - and `key` on a low day. Absent on a day with nothing to count: nothing planned is not a zero. |
| `tasks` | Everything that was on the day, in its order: by time, the untimed after - section 4. |
| `journal` | The day's journal, as written. Absent when there was none. |
| `notes` | The notes written that day: `[{ "at": "<instant>", "text": "..." }]`. Absent when there were none. |
| `changedAt` | The newest change to anything in the day, an instant; `null` on a day nothing ever stamped. |

## 4. A task

| Field | Means |
|---|---|
| `title` | What it was. A reading block's is the book. |
| `time` | When it started, `HH:MM`. Absent: it had no time. |
| `minutes` | How long it was planned for. |
| `category` | The category's name, as Settings shows it. |
| `from` | Where it came from: `template` (a block of the day's template), `routine` (a routine - its title is the routine's), `repeat` (a repeating task), `night` (the hours after midnight of the night before) or `hand` (written by hand). |
| `night` | On a night's hours, the date of the night they came with. |
| `done` | Whether it was ticked. |
| `doneAt` | When it was ticked, an instant: the moment a hand ticked it, or the end of a block the clock marked done. Absent where the app did not know - a tick from before v2.43. |
| `missed` | `true`: a block that ends by itself was said not to have happened. |
| `setAside` | `true`: set aside that day, and not done. |
| `core` | `true`: counted on a day that is not a full one. |
| `key` | `true`: one of the day's key tasks. |
| `recipe` | A meal's recipe: `{ "title": "...", "kcal": 450, "protein": 30, "carbs": 60, "fat": 8 }`, each number where the recipe has it, per serving. The app never adds them up; a reader may. |
| `meal` | The kind of meal, where no recipe was chosen: `breakfast`, `lunch`, `dinner`, `pre-gym`, `post-gym` or `snack`. |
| `library` | A reading block's list and book: `{ "list": "Main", "item": "A first book" }`. |
| `note` | The task's note, as written. |

## 5. An example

```json
{
  "format": "dienius-day",
  "version": 1,
  "date": "2030-01-07",
  "kind": {
    "letter": "D",
    "name": "Day shift"
  },
  "template": "Day shift",
  "dayType": "shift",
  "score": {
    "done": 1,
    "of": 2,
    "counts": "core"
  },
  "tasks": [
    {
      "title": "Shift",
      "time": "07:00",
      "minutes": 720,
      "from": "template",
      "done": true,
      "doneAt": "2030-01-07T17:00:00.000Z",
      "core": true
    },
    {
      "title": "Lunch",
      "time": "12:00",
      "minutes": 30,
      "category": "Meals",
      "from": "template",
      "done": false,
      "core": true,
      "recipe": {
        "title": "A lentil soup",
        "kcal": 450,
        "protein": 30
      }
    },
    {
      "title": "Walk",
      "time": "19:45",
      "minutes": 30,
      "from": "routine",
      "done": true,
      "doneAt": "2030-01-07T18:20:00.000Z"
    }
  ],
  "journal": "A quiet one.",
  "changedAt": "2030-01-07T20:00:00.000Z"
}
```

## 6. Reading progress out of it

- **A routine kept**: over a month's files, the tasks `from: "routine"` of
  its title, and how many are `done`.
- **What was eaten**: the `recipe` of each `done` task, with its numbers.
- **How the days went**: each day's `score`, read with its `counts` - seven of
  nine on a full day and three of three core blocks on a shift are not the
  same kind of number, and the app never puts the two side by side.
- **A day as it was, whole**: the week's file under `archive/weekly/` holds
  the entire plan as it stood that Monday, templates and all.
