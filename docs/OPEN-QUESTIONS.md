# Open questions

> Things that need the owner's decision, parked here during work rather than guessed at.
> Each one has a recommendation. Nothing here is blocking - work continues around all of it.

Empty as of 2026-09-07, the day the app closed with v2.7.

The two items that stood here since v2.0 - the mini calendar's 33px cells and the task title's 29px
target - carried a recommendation to leave both as built, and the owner accepted it with the closing
brief. They are DECISIONS now, under "The mini calendar's cells stay at 33px" and "A task's title is
a 29px target, on purpose", with their reasons and the two honest fixes should real hardware ever
say otherwise. The thirteen before them were answered on 2026-09-01 and are in DECISIONS too.

The standing note that the app had never been touched by a real finger is answered by what comes
next rather than by a decision: the owner lives in the app for a week, on the phone it was written
for, and the week is the first touch test. Anything that week turns up goes to STATE's "Asked for,
not yet built" and waits there - see the done contract in STATE section 4.

## 2026-09-23, overnight: the owner's own templates file and the public repo

The overnight brief asks for the owner's real templates file to be used in
the tests rather than an invented example. The standing rule is that the
repo is public and carries none of the owner's own words - every example
generic, the owner's templates living only in their browser and their
backup.

**What was done:** the tests that read the real file read it where it is,
outside the repo (`src/lib/ownersFile.test.ts`, `e2e/owners-week.e2e.ts`),
and are skipped wherever it is not - the deploy's runner, another machine.
Nothing in them names what the file says: every title they check is read
out of the file at run time. The generic tests beside them hold the same
rules for the deploy.

**Recommendation:** keep it so. A copy of the file in the repo, even under a
generic name, would be the owner's rota and meals on a public site for good;
a test that runs on the owner's machine and is skipped elsewhere gives the
real file its proof without that. If a run of the real-file tests is wanted
on every deploy, the honest way is a private fixture the runner fetches
from the owner's own repo with the backup's token - which is a small piece
of work, and the owner's to ask for.
