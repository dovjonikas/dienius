# The freeze

One page for the owner and for whoever picks the app up next. The freeze
begins on Monday 2026-09-28, on the tree tagged `v2.45-freeze`; the last
version with anything new in it is v2.45. From then on the app gets fixes,
data safety and documents, and nothing else.

## What the app does on Monday 28 September

The owner's first night shift under the freeze, by screen:

- **Today** opens on the night's day: its kind chip (the letter and the
  name), its blocks in order, the gym of that weekday at the time the kind
  gives it, the reading block named by the book on the list the templates
  file names, and every meal saying its kind of meal with "choose" beside
  it. Choose opens every recipe in Kitchen of that meal, each with its kcal
  and protein; one press puts one on, and "another" changes it. The grey
  band at the top ends at the hour the kind wakes. At half past two the
  page is the morning after: the night's own hours after midnight stand at
  the top of the list, the night's shift still running. The close card
  comes half an hour before the sleep that ends the day - for a night, at
  eight the morning after, on the morning's page, saying "That was the
  night"; never while a shift runs.
- **Calendar** shows the month with each date's letter from the roster,
  and the week as three columns on a phone. Roster lays kinds on dates,
  Apply says what it will do first.
- **Templates** holds the five kinds and the routines with a time per
  kind; the file in Settings, Templates as JSON, is the way they are
  changed, with a preview before Apply.
- **Library** holds the shelf the reading blocks read from; the block on the
  day names the book, and a finished book hands the block the next.
- **Kitchen** holds the recipes by meal; Paste many takes a whole text of
  them, and a name that starts with a meal's word is for that meal.
- **Review** reads the week and the month from the days themselves.
- **North** is the owner's own text, one line of it on the day.
- **Settings** keeps the backup and the archive on GitHub (Backup: "Archived
  until ..." and Archive now), sync between the devices, and the templates
  file.

The templates file's roster names the dates up to the second night. The day
after the nights has to be named too, at least a day ahead, or that date
holds only the night's hours - docs/OPEN-QUESTIONS.md, question 1.

## How to report a bug

On the phone or the computer, the moment something is wrong: press Notes in
the header, type a line that starts with `#bug` and says what happened and
on which screen, and press Enter. It is saved as you type; nothing else is
asked. A screenshot goes into the same note through Open notes, with the +
button. docs/WEEKEND.md says the rest of it.

To hand the bugs over: open Search (Ctrl-K, or Search in the header), type
`#bug`, and every note with it is listed; or open Notes, Open notes, and
read the stream newest first. Copy the lines into wherever the work is
being talked about. A backup exported from Settings, General carries every
note as well.

## What is allowed during the freeze

STATE.md, its first section, is the rule. In short:

- **A bug fix** - the app doing something other than what it already says,
  or failing to do it. Every fix comes with a test that fails without it.
- **Data safety** - storage, backups and their formats, migrations, sync,
  erasing, the privacy guard. A new shape of the plan leaves its own backup
  file (CONVENTIONS 7).
- **Docs** - the files under docs/, the guides, comments in the code.

**Not allowed:** a new feature - a new screen, a new setting, a new kind of
data, a control that is not there. Asked for anyway, it is written into the
Parked section of docs/BACKLOG.md with who asked, why it waits and what it
would take.

**The line between the two:** if the change needs a new sentence in STATE's
section 2, it is a feature; if it makes an existing sentence there true
again, it is a fix.

**Every change, still:** every gate green, one at a time (CONVENTIONS 10),
STATE and DECISIONS where they are touched, a commit in English without an
apostrophe and with the trailer, a push, and a green deploy - `gh run list`
after the push.

## Where things wait

- **Parked requests:** docs/BACKLOG.md, the Parked section - one row each,
  with the date, who asked, why it waits and what it would take.
- **Questions for the owner:** docs/OPEN-QUESTIONS.md, each with a
  recommendation.
- **What only the owner can check:** docs/CHECKS-BY-HAND.md, and the
  by-hand tables at the end of docs/SHIFT-2026-09-25.md.
- **Where the app is, and how it got here:** docs/STATE.md, then
  docs/HISTORY.md.
