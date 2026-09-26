# Open questions

> Things that need the owner's decision, parked here during work rather than guessed at.
> Each one has a recommendation. Nothing here is blocking - work continues around all of it.

Two, from the last evening before the freeze (2026-09-26), when the owner's
own week was lived on the real templates file in a browser
(`e2e/owners-freeze-week.e2e.ts`, docs/SHIFT-2026-09-25.md, "The last
evening before the freeze"). Neither is a fault in the app; both are the
owner's to decide.

## 1. The roster stops at the second night

The file's roster names the dates up to and including the second night. The
day after the nights is not in it, and the app cannot know what kind it is:
on that date it shows the night's hours after midnight and nothing else - no
kind, no blocks of its own, no gym - and the second night has no close card,
since a night closes half an hour before the sleep that ends it, which is the
next date's, and a date with no kind has none. The walk holds exactly this
for a roster that ends at a night.

**Recommendation:** the journal that writes the file names every date at
least a day ahead, the day after the nights included - as the free day's
letter, which the app reads as the day after nights after a night, or as
that kind's own letter. With the date named, the walk shows the day after the
nights whole: its blocks, its gym at the kind's time, and the second night
closing at eight on its page. One more thing worth knowing: the last date in
the roster closes half an hour before the bedtime of the first sleep schedule
in Settings, because the date after it has no kind of its own; a roster kept
a day ahead never reaches that fallback.

## 2. The next meal on the phone's first screen

The shift's report held that opening today shows the next meal on the first
screen at 375px, nothing scrolled. Measured against the bar at the foot of
the phone's screen, which stands over the page (the first screen ends at
759px of 812), that holds on the generic day the report was measured on -
the meal's name at 747px, its card's recipe row under the bar - and not on
the owner's own kinds at waking, where the morning's notice, the day's kind
and sleep, the running line, the capacity sentence and the quick-add tools
put the running card at 706px and the next meal's name at 813px, one flick
down. Where the night's own meal is the first card, at half past two, its
name ends at 739-757px, above the bar. The report's walk measured the whole
card against the window's foot, and the numbers above are this computer's
fonts: the deploy's Linux runner draws text taller, and there the generic
day's meal name is 35px under the bar too. Both walks hold the meal as the
card after the running one, and the whole card on a desktop's first screen;
on a phone they measure the fold and write it to the report.

**Recommendation:** leave it for the freeze. The running card says what is
happening, and the meal is one flick down. The change that would put the
meal's name above the bar - the quick-add's time, length and swatch rows
folded under the field until it is focused, about 85px - is a phone layout
change with the sweep, the keyboard pass and both walks behind it, and is
parked in BACKLOG with that cost.

---

Before these, empty as of 2026-09-25, three days before the freeze.

The four questions parked here by the overnight of 2026-09-23, the freeze
preparation and the shift of 2026-09-25 were answered by the owner on
2026-09-25: the tests of the real templates file stay outside the repo as
built; the history is not rewritten, neither for the file's path in two
commits nor for the reading plan; and a free day's evening ends before a
day shift's bedtime in the owner's own file, so the month walk now allows
no block in any sleep. They are DECISIONS now, under "Four questions
answered before the freeze".

Before them, empty as of 2026-09-07, the day the app closed with v2.7.

The two items that stood here since v2.0 - the mini calendar's 33px cells and the task title's 29px
target - carried a recommendation to leave both as built, and the owner accepted it with the closing
brief. They are DECISIONS now, under "The mini calendar's cells stay at 33px" and "A task's title is
a 29px target, on purpose", with their reasons and the two honest fixes should real hardware ever
say otherwise. The thirteen before them were answered on 2026-09-01 and are in DECISIONS too.

The standing note that the app had never been touched by a real finger is answered by what comes
next rather than by a decision: the owner lives in the app for a week, on the phone it was written
for, and the week is the first touch test. Anything asked for since waits in the Parked section of
BACKLOG.md, and from the freeze of 2026-09-28 that is where every new request goes (STATE, first
section).
