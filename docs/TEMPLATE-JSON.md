# Templates and roster as JSON

For somebody - or another agent - who writes a set of day templates and a
roster somewhere else, and hands them to Dienius as one text. Settings,
Templates as JSON: **Import** reads a text in this format, shows what it will
do, and does it on Apply; **Export** writes the templates and the roster the
app has, in the same format, so they can be taken out, changed and brought
back. Since v2.33.

What this format holds is the plan's shape - templates, and which kind of day
stands on which date. It is not a backup: the backup (Settings, Export
backup, and docs/BACKUP-FORMAT.md) holds everything. A person's own templates
live in their browser and their backup, never in this repository; every
example here is invented.

---

## 1. The file

One JSON object.

| Field | Required | Means |
|---|---|---|
| `format` | no | `"dienius-templates"`. Any other value, and the text is not read at all. |
| `version` | no | `1`. Any other number, and the text is not read at all. |
| `templates` | no | A list of day templates - section 2. |
| `routines` | no | A list of routines - section 4. |
| `roster` | no | Which kind of day stands on which date - section 5. |

A field the format does not have is left out and said in the preview. A text
that is not JSON, or not an object, is not read, and the preview says why.

## 2. A template

| Field | Required | Bounds | Means, and when it is missing |
|---|---|---|---|
| `name` | **yes** | 1 to 120 characters | The template's name, and its key: a template of the same name - the same words, whatever their case or spacing - is updated, never copied. Missing or empty, the template is skipped. A name given twice in one file: the later one is read, the earlier skipped. |
| `type` | no | `full`, `shift`, `night` or `rest` | What kind of day it makes - Full day, Shift day, Night, Rest. Missing: `full`. |
| `kind` | no | 1 or 2 characters, upper case | The letter the roster draws it by, which makes it a kind of day. Missing: an ordinary template, or on an update the letter it has. A letter another template already has is left out, and the template is imported without one. |
| `color` | no | `#rrggbb` | Missing: a new template takes the palette's next colour; an update keeps its own. |
| `sleep` | no | `{ "from": "HH:MM", "to": "HH:MM" }`, two different times | The sleep its days wake from. A sleep schedule with those hours is used, or made, named by its hours. Missing: the first schedule, or on an update the one it has. |
| `blocks` | no | a list | Its blocks, in order - section 3. Missing: a new template has none; an update keeps the ones it has. |

A template is a day template. A week template is neither read nor written.
A kind's place in the roster's cycle follows its place among the kinds in the
file; an update keeps its place.

## 3. A block

| Field | Required | Bounds | Means, and when it is missing |
|---|---|---|---|
| `time` | no | `HH:MM`, `00:00` to `23:59` | When it starts. Missing: a block with no time. |
| `title` | **yes** | 1 to 200 characters | What it is. Missing or empty, the block is skipped. |
| `minutes` | no | a whole number, 1 to 1440 | How long. Missing: no length. |
| `category` | no | a category's name or id | `Deep work`, `Routine`, `Health`, `Meals`, `Commute`, `Personal`, or one of the person's own. A name the app does not have is left out. |
| `core` | no | `true` or `false` | Counts on a day that is not a full one. |
| `key` | no | `true` or `false` | One of the day's key tasks. |
| `ongoing` | no | `true` or `false` | Ongoing - it runs beside what else happens. |
| `afterMidnight` | no | `true` or `false` | After the template's midnight: its time is on the next date's clock, and it lands on **the date after**, as the night's (the editor's **Next day**). Needs a `time`; without one it is left out. |
| `mealType` | no | `breakfast`, `lunch`, `dinner`, `pre-gym`, `post-gym`, `snack` | A meal's kind of meal, chosen on the day. |
| `followMeal` | no | `true` or `false` | With `mealType`: the block walks every recipe Kitchen has for that meal, the ones added later too. |
| `recipes` | no | a list of recipe names | The recipes the meal walks, a date at a time, **by name**: each is looked for in Kitchen - the same words, whatever their case or spacing. A name Kitchen does not have yet is said in the preview and **kept on the block**: it takes that recipe as soon as Kitchen has one of that name - pasted many at once, written one at a time, or renamed into it - and until then the block keeps its `mealType`. So a week may be pasted before its recipes are. Recipes win over `mealType` when both are given and found, and an export names the ones still waiting along with the ones found. |
| `note` | no | text | What the block says when it lands. |

On an update, a block with the same title as one the template has - the
first not yet matched - is that block: it keeps what this format does not
carry (its steps, the list it draws its title from), and the days stamped
from it stay its days.

A field with a wrong value - a length of -5, a time of 25:00 - is left out,
the rest of the block is read, and the preview says which.

## 4. A routine

A routine is one thing that happens on some weekdays, at a time each kind of
day gives it - the medication, the walk. It is not a block: a template's
blocks are that kind of day, and a routine crosses the kinds.

| Field | Required | Bounds | Means, and when it is missing |
|---|---|---|---|
| `title` | **yes** | 1 to 120 characters | Its name, and its key: a routine of the same title - the same words, whatever their case or spacing - is updated, never copied. Missing or empty, the routine is skipped. A title given twice in one file: the later one is read. |
| `minutes` | **yes** on a new one | 1 to 720, or an object of kind letters | How long it is. One number is its length on every kind; an object - `{ "D": 45, "N": 60 }` - is its length on each kind named, and its first is its length anywhere else. A letter no kind has is left out with a note. Missing on an update: the length it has. |
| `category` | no | a category's name | Which category its task takes, by name - the same words, whatever their case. A name no category has is left out with a note. |
| `core` | no | `true` or `false` | Whether it counts on a day that is not a full one - a shift, a night, a rest day - the way a block's `core` does. Missing: not core. |
| `weekdays` | **yes** on a new one | a list of 1 to 7, **1 is Monday** | The weekdays it is on. Written the way a person writes them, Monday first; the app keeps Sunday as 0 and the file never says 0. A number outside 1 to 7 is left out with a note; none left, and the routine is skipped. Missing on an update: the days it has. |
| `times` | no | `{ "<letter>": "HH:MM" }` | Its time on each kind of day, by the kind's letter. A kind with no time here **needs one**: the day says so rather than guessing a time. A letter no kind has, or a time that is not `HH:MM`, is left out with a note. Missing on an update: the times it has. |

A routine lands on a date that has a kind - the roster's dates, and any date
stamped with a kind - on its weekdays, at its time for that kind. Where its
time runs into the day's blocks or into sleep, or the clock skips it that
night, the day says so and gives it no time: see docs/RESEARCH-SHIFTS.md.

## 5. The roster

An object from dates to kinds of day.

    "roster": { "2030-01-07": "D", "2030-01-08": "Rest day", "2030-01-09": null }

| Key | Value |
|---|---|
| a date, `YYYY-MM-DD` | A kind's letter, or a kind template's name - one in the file or one the app has. `null` takes the date's kind off. |

- A date before today is skipped: a lived day keeps what it was.
- A letter or a name no kind has, or a template that is not a kind, is
  skipped, and the preview says which.
- A date not in the file is left as it is.

It is laid on the plan the way the Roster's Apply lays it: each date is
composed with its kind's blocks, its routines and its sleep; a night's hours
after midnight land on the morning after; and the dates around a date whose
kind changed are composed again, and the preview counts them.

## 6. Import

Paste the text, press Preview, read what it will do, press Apply.

- **Preview** lists every template - new, updated, unchanged, or skipped and
  why - every routine and every date of the roster the same way, and every
  note: a field left out, a recipe not in Kitchen yet, a letter already
  taken.
- **One bad entry never stops the rest.** A template, a block, a field or a
  date that cannot be read is skipped, with its note; everything else is
  read.
- **Apply** writes it all in one step, and one undo takes it all back.
- The same text imported twice changes nothing the second time.

## 7. Export

The templates and the roster the app has, in this format:

- `format` and `version` first, then the templates - the kinds in their
  roster order, then the other day templates by name - then the routines in
  the order they are kept, then the roster from today on, by date.
- A routine's length is one number, or one for every kind when it has a
  length of its own on any of them; its weekdays are 1 to 7 with Monday
  first; its times are by the kinds' letters, in the roster's order.
- A field is written only when it says something: no `type` for a full day,
  no `sleep` for a template on the first schedule, no `false`.
- Two spaces of indent, one block to a line.

Exported, imported and exported again, the text is the same, character for
character.

## 8. A whole example

Three kinds of day - a day shift, a rest day, and a night shift whose meal
and journey home are after midnight - two routines, one of them a different
length on each kind, and six dates of a roster. Every name here is invented.
Imported into an app with a recipe called "A lentil soup", it reads with no
notes, and exports as itself.

```json
{
  "format": "dienius-templates",
  "version": 1,
  "templates": [
    {
      "name": "Day shift",
      "type": "shift",
      "kind": "D",
      "color": "#a7c4f5",
      "sleep": { "from": "22:00", "to": "05:30" },
      "blocks": [
        { "time": "06:00", "title": "Travel in", "minutes": 45, "category": "Commute" },
        { "time": "07:00", "title": "Shift", "minutes": 720, "category": "Deep work", "core": true, "ongoing": true },
        { "time": "12:00", "title": "Lunch", "minutes": 30, "category": "Meals", "recipes": ["A lentil soup"] },
        { "time": "19:30", "title": "Travel home", "minutes": 45, "category": "Commute" }
      ]
    },
    {
      "name": "Rest day",
      "type": "rest",
      "kind": "R",
      "color": "#a7e3bd",
      "blocks": [
        { "time": "09:00", "title": "Long breakfast", "minutes": 45, "category": "Meals", "mealType": "breakfast" },
        { "time": "11:00", "title": "Something outside", "minutes": 90, "category": "Health" }
      ]
    },
    {
      "name": "Night shift",
      "type": "night",
      "kind": "N",
      "color": "#c9b3f0",
      "sleep": { "from": "08:30", "to": "15:30" },
      "blocks": [
        { "time": "18:00", "title": "Travel in", "minutes": 45, "category": "Commute" },
        { "time": "19:00", "title": "Shift", "minutes": 720, "category": "Deep work", "core": true, "ongoing": true },
        { "time": "01:00", "title": "Night meal", "minutes": 30, "category": "Meals", "afterMidnight": true, "mealType": "dinner" },
        { "time": "07:15", "title": "Travel home", "minutes": 45, "category": "Commute", "afterMidnight": true }
      ]
    }
  ],
  "routines": [
    { "title": "Medication", "minutes": 5, "category": "Health", "core": true, "weekdays": [1, 2, 3, 4, 5, 6, 7], "times": { "D": "06:15", "R": "09:30", "N": "17:30" } },
    { "title": "Walk", "minutes": { "D": 30, "R": 60, "N": 30 }, "category": "Health", "weekdays": [1, 3, 5], "times": { "D": "20:10", "R": "11:00" } }
  ],
  "roster": {
    "2030-01-07": "D",
    "2030-01-08": "D",
    "2030-01-09": "N",
    "2030-01-10": "N",
    "2030-01-11": "R",
    "2030-01-12": "R"
  }
}
```

The Night meal on 9 January lands on 10 January at 01:00, marked as the
night's, and the night of the 10th brings its meal and its journey home to
the morning of the 11th, a rest day.
