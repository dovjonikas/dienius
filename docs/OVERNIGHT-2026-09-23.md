# The night of 2026-09-23

The owner slept; this is what was done, what was found, and what is left,
with the proof beside each. Every claim here has a test or a gate behind
it, and the last section is the ten minutes of checking only the owner can
do.

## What was broken, and what was fixed

| # | What the owner saw or asked for | What was wrong | Fixed in | Proof |
|---|---|---|---|---|
| 1 | A free day by the roster, a shift put on it by hand: sometimes both days' blocks, or the free day's not gone. | Two things. An ordinary template put over a kind left the kind's routines behind at the kind's time. And two devices composing a date apart - the roster applied on both before either had pulled - left every block twice, and nothing ever folded them. | v2.38 | `src/lib/handStamp.test.ts` (14 rules, each broken on purpose and caught), `e2e/hand-stamp.e2e.ts` on a desktop and a phone |
| 2 | The templates file with routines in it: import, export, bad lines. | Nothing broken once v2.37 landed. The real file reads with no note but the recipes Kitchen has not got yet, which wait on their blocks; the gym is on each kind at that kind time and length, core, and not on a Sunday; a routine that runs into sleep or a block is said, never guessed; export and import round trip unchanged; a file of bad lines - a letter no kind has, a time that is not HH:MM, weekdays 0 and 8, an empty title, a title said twice - each said with its note and nothing broken. | v2.37 | `src/lib/ownersFile.test.ts` (the real file, read where it is), `templateJson.test.ts` |
| 3 | A week lived day by day. | Nothing broken: the real roster pasted and walked on a desktop and a phone - each date opened, a block ticked, a hand-written line pushed, a block moved by hand, a day shift made a night and a day again in mid-week, the shift done by itself a minute after its end and not before, the night shift done on the night own date, a night meal walking two recipes on two nights, every date whole at the end. | - | `e2e/owners-week.e2e.ts` (read where the file lives) |
| 4 | Two devices, an older copy never over a newer one; a backup restore that does not undo a sync. | Ten paths, fixed in v2.34; walked again here on the real clock. | v2.34, v2.38 | `src/lib/syncTwoDevices.test.ts` "on the real clock" |
| 5 | "Erase all data" left the plan coming back. | The sync switch and the token stayed behind, and the plan walked back in from GitHub. | v2.36 | `eraseDevice.test.ts`, `e2e/data.e2e.ts` |

## What was added

- Routines in the templates file (v2.37): a length per kind, a core mark,
  weekdays 1 to 7, a time per kind. docs/TEMPLATE-JSON.md section 4.
- Blocks that end by themselves (v2.35): an ongoing block and a commute are
  done once their end has passed, unless said not to have happened.
- Kitchen's starting map of meal words, and recipes a block waits for by
  name (v2.36).
- An erase that takes the device's keys with it (v2.36).
- A date opened again holds each block and each routine once (v2.38).

## What is left, with a recommendation

- **The Library pasted at once, and North replaced at once** - part 4 of the
  four-part brief of the evening. Drafted (a parser for "A title - An author"
  lines under a list in capitals, a page like Kitchen's paste, a Replace
  text panel on North that says how many headings and which tags it found)
  and not landed: the overnight brief's six stages came first, and a feature
  landed at four in the morning without its own gates is the kind of thing
  this night was for undoing. Recommendation: land it next, with the full
  gates, as v2.39.
- **The real-file tests run only on this machine.** The deploy's runner
  skips them, since the file is the owner's and the repo is public
  (docs/OPEN-QUESTIONS.md). Recommendation: keep it so; a private fixture
  fetched with the backup's token is the honest way to run them on every
  deploy, if that is wanted.
- **iOS Safari** could not be run here for the push as a page closes
  (docs/SYNC.md); nothing depends on it, and the next open sends what is
  owed. Recommendation: the ten minutes below on the real phone, and A1 in
  docs/CHECKS-BY-HAND.md when there is an evening for it.
- **A list a paste makes counts in chapters** until its editor says
  otherwise - only once part 4 lands. Recommendation: leave it, one press.

## Ten minutes in the morning, by hand

In the style of docs/CHECKS-BY-HAND.md: do the thing, read what the screen
says, write down what actually happened beside the line.

| # | Do | Expect |
| --- | --- | --- |
| 1 | On the computer, open the app. | It opens on today with the plan as you left it; Settings, Sync says a pull just now and nothing waiting. If it asks which plan this device keeps, press Merge on the computer. |
| 2 | On the phone, open the app. | The same plan. If it asks which plan this device keeps, press Take from GitHub. |
| 3 | Settings, Templates as JSON: paste your templates file, press Preview. | Three templates, three routines and seven dates listed; every recipe Kitchen has not got yet says it waits for it; nothing skipped. Press Apply. |
| 4 | Calendar, Month, Roster. | Every date of the week carries its letter. |
| 5 | Open Wednesday 23 (L). | The free day blocks, the gym at 11:30 for 90 minutes, and nothing doubled. |
| 6 | Open Monday 28 (N) and Tuesday 29. | The night blocks on Monday; on Tuesday morning the night meal and the journey home marked last night, once each, beside Tuesday own night. |
| 7 | On Today, put a day shift on a free day by the chip beside the day, press Replace. | Only the shift blocks and the gym at 20:10. Put the free day back the same way: only the free day blocks, the gym at 11:30. |
| 8 | Tick a block, then press Undo. | The tick comes off and nothing else moves. |
| 9 | Kitchen, Paste many: paste the recipes the file names. | Every meal block that was waiting names its recipe the next time its day is opened. |
| 10 | Settings, Sync on both devices after the above. | Both say a pull just now and nothing waiting; the phone shows what the computer did. |

## The commits of the night

| Commit | What |
|---|---|
| v2.37 | Routines in the templates file. |
| v2.38 | A kind put on a date by hand holds that kind only; a date opened again holds each block once. Stage 1. |
| Stage 2 | The templates file read against the real copy. |
| Stage 3 | A week of the roster lived in the browser. |
| Stage 4 | Two devices on the real clock. |
| Stage 5 | Every gate from zero on the final tree. The result: tsc clean; vitest 222 files, 3414 tests, all passed, the real-file tests among them; Playwright 134 passed on a desktop and a phone, 16 skipped by design (the ones that need a real GitHub); the sweep 0 findings on a desktop and 0 with the phone; keys, precision, text scale and the privacy guard 0 findings. The first desktop sweep of the run had one timeout while the machine slept and was run again alone, clean. |
| Stage 6 | This document, STATE.md, OPEN-QUESTIONS.md, and the runner's fix below. The version stays v2.38: stages 2 to 5 added proof, not behaviour, and the next number is part 4's. |

One message of the night - stage 2 - carries an apostrophe the brief asked
to leave out; it was noticed after the push, and history was not rewritten
for it. Every later one has none.

**One thing the night got wrong, and caught:** the first versions of the two
real-file tests wrote the path of the file into the repo, and the path names
a folder of the owner. The privacy guard caught it on the full run, after two
commits had been pushed. The path now lives in owners-file.local, which git
ignores, and the guard is clean; the two commits that carried it are in the
history, and docs/OPEN-QUESTIONS.md says how to take them out and why that
was left to the owner.

**A second, smaller one:** the deploy of those commits went red twice on
GitHub - first on the guard, then, once the path was out, because the two
tests found owners-file.local through `__dirname`, which the runner has not
got: it loads the e2e files as ES modules. The e2e now starts from its own
`import.meta.url`; the vitest one keeps `__dirname`, like every other test
that reads a file, because under jsdom `import.meta.url` is the page's.
Both were run with the pointer hidden - they skip, as the runner will - and
with it back. The stage 6 deploy is the one to read as green.
