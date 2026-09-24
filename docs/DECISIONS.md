# Decisions

Notes for anyone reviewing this repo rather than using the app. Each one explains a choice that
looks unusual next to a typical planner app, what it costs, and why the trade was made anyway.

## localStorage first, and every other copy a layer on top of it

Every write goes straight to `localStorage` through `src/lib/storage.ts`. `AppData` is one
JSON blob, validated on the way in and out by a deep type guard (`validate` in `validate.ts`)
so that a corrupted or hand-edited value falls back to an empty state instead of crashing the
app. The app has no infrastructure it needs: nothing to run, pay for or keep patched, and it works
fully offline the moment it is installed.

As first written, in v1.0, this section said there was no server, no sync and no API, and that
the only way to move data was the export/import round trip in Settings. That was true then and
the reasoning has held; what changed is that three copies were added on top, each optional, each
a layer, none a dependency: sync between your own devices through a server you host (v1.5), a
week of daily snapshots in IndexedDB (v1.3), and a copy of the plan in a private GitHub repo
(v1.11). ARCHITECTURE section 7 sets the three side by side. The decision that survives is the
shape: with all three off - the default - the app is exactly what this section first described,
and nothing anywhere waits on a network to answer. The cost that was named here is still the
cost of that default: one browser, one device, and clear site data and it is gone unless one of
the layers was turned on.

## No accounts

There is nothing to sign in to. `AppData` has no concept of a user. This falls directly out of the
localStorage decision above - without a backend there is nothing for an account to authenticate
against - but it is also a choice on its own: no password to lose, no email to collect, no consent
screen before the first task can be typed.

The cost is the same one as above, restated: no cross-device access and no recovery path beyond
what the person set up themselves - the sync server, the GitHub repo - and none of those is an
account with this app, they are the person's own machine and the person's own repo. A tool for
tracking ADHD time blindness that puts a login wall between a person and their plan has already
lost - the whole premise is that a plan needs to be visible with zero friction, and an account is
friction before the plan even loads.

## No streak on the day view - and one, described rather than kept, on the review

(The review's streak went too, in v2.7 - see "Review says facts, and no
longer a streak" further down this file. The line this entry drew
between a number you can lose and a number you read did not hold, and the
paragraphs below stand as the record of why it was drawn.)

`dayScore` in `src/widgets/day-plan/score.ts` computes a score from one day's own tasks and
nothing else. Nothing on the day view, the calendar or North counts consecutive days,
nothing records a longest run, and no notice ever says a run has ended.

This is a considered omission, not an oversight. A streak turns a single bad day into a reason to
quit the whole system, because the thing being protected is no longer "did I get things done
today" but "did I keep the streak alive," and once a streak breaks there is nothing left to
protect. For a tool aimed at people whose days are already inconsistent by nature, that mechanic
punishes the exact pattern it should be accommodating. The cost of leaving it out is real: streaks
are a proven engagement lever, and this app is deliberately worse at pulling someone back in after
a gap. That is the point, not a gap in the feature set.

The one place a run of days is shown is the Review tab (highlightStreak in `src/lib/review.ts`):
how many days in a row, counting back from the end of the range, at least one key task was
finished. It is computed from the days each time and never stored, so there is no record to
protect and no longest run to beat; it counts key tasks rather than any task, because "I did
something" is true of almost every day and says nothing; and it lives only on a screen somebody
opens to look back, never on the screen they plan on. The line this draws is the one the whole
review holds to: a number you read about your week is a description, a number you can lose while
living the day is a lever. This section used to say there was no streak counter anywhere in the
codebase, which stopped being true when the review shipped in v1.3 and was not corrected until
v1.11; the README said the same in three places and says this instead now.

## An unplanned day has no score

`dayScore` returns `{ planned: false }` for an empty task list rather than `{ done: 0, total: 0 }`.
`formatDayScore` turns that into `null`, not `"0/0"`. A day nobody planned is not a failed day; it
is a day with nothing to measure. The alternative - showing "0/0" - reads as a score of zero, which
punishes not having opened the app rather than describing anything that actually happened. The
cost is a small amount of extra branching in the score type and every place that renders it, in
exchange for not quietly guilt-tripping someone for a day they never engaged with.

## Four day types, one scoring rule

> **Superseded in v2.4, in part.** A low day is scored on its key tasks alone whatever its type, so the score asks whether the day is low before it asks whether it is full (`score.ts`) - see "A low day is the 40% doctrine as one press".

`Template.type` is `'full' | 'shift' | 'night' | 'rest'`, but `dayScore` only ever asks one
question: is the day full, or not. Shift, night and rest all count only tasks marked `core` and
ignore everything else, with no difference in behavior between them. A night shift and a day shift
plausibly deserve different treatment - a night shift arguably leaves even less room for anything
else - but nothing in the app yet knows what that difference should be, and inventing one without a
real case behind it would have been complexity standing in for a decision nobody had actually made.

Four values exist anyway because they name four kinds of day a person recognizes at a glance when
picking a template, and because the year strip that stood until v2.7 (coloured per day) wanted
exactly this distinction to color by. The type is there to hang a real scoring difference on if one
ever turns up; today it hangs a label and nothing else.

## A year strip with no in-between

(The strip went in v2.7 - see "The Year view goes" further down this
file. What follows is what it was meant to be, kept because it says how a
picture becomes a scoreboard without anybody deciding it should.)

The year strip (`src/widgets/year-strip/`) is the single feature in this codebase closest to
becoming the thing the app is defined against. A row of one cell per day, colored by template, is
one design decision away from a GitHub contribution graph - and a contribution graph is a streak
tracker with the streak counter hidden, not shown. The idiom itself trains a reader to see an empty
cell as a miss, because on GitHub it usually is one. Borrowing the idiom without also borrowing that
reading took more restraint than building the grid did.

The fix is that a cell only ever has two states worth telling apart, and there is nothing between
them. buildYearCells in yearGrid.ts colors a cell by its template the moment the day has one,
whether that day is freshly stamped and completely untouched or nine tasks out of ten done - both
look identical, a plain colored square. The only thing added on top is a thin ring, and only when
`dayScore` would call the day fully finished: every counted task done, the same completion `dayScore`
already uses everywhere else. A day that is attempted but not finished never gets graded any
differently from a day just planned and not yet started. Nothing on the grid tracks how much of a
day got done - only whether it got planned, and whether it got finished - because the moment a
partial score shows up on a cell, the grid stops describing texture and starts grading days against
each other, which is exactly a streak's own currency.

An unplanned day - no template, no hand-typed task, nothing - gets no color and no ring. It renders
as a flat tile in the same neutral tone the grid's borders already use, the same tone whether the
day is a single afternoon nobody used the app, or a three-week stretch it sat untouched entirely.
There is no darker shade for "more empty," no warning color, no hollow outline standing in for a
hole - the alternative most contribution-graph clones reach for, and the one that would have made an
unplanned week look like a wound in the middle of the year. A large gap is still visible, because a
gap is real information about the shape of a year and hiding it would defeat the point of the whole
feature - but it is visible as an absence of texture, not as a shape of its own that draws the eye
the way a bad color would.

No number appears anywhere on the strip. No total days planned, no completion percentage, no count
of how many were core-only shift days, no comparison of this year against last, no "best month."
Every one of those would have been easy to compute from data the strip already has, and every one
would have turned a picture into a scoreboard - a reason to feel behind that this app has spent
every other feature deliberately declining to hand anyone.

## Manual tasks are never core

A task typed into quick-add can never be marked core, on a shift, night, or rest day or any other.
Core is set only on a template block, before the day starts - there is no control anywhere in the
day view to mark an existing task core after the fact, and rolling a task forward to the next day
clears its core flag rather than carrying it along (`rolloverUnfinished` in `src/lib/store/days.ts`,
the same treatment `fromTemplate` already gets).

The reasoning is the same in both places: core is supposed to mean "known to be unavoidable ahead of
the day," not "urgent right now." Letting a task set on impulse, or one just pushed from yesterday,
count as core would open the score back up to exactly the kind of inflation the whole feature exists
to prevent - a bad day could turn any task into a "required" one just by typing it in.

The cost is real, not just theoretical: a task that turns out to genuinely matter - flagged only
after the day is already underway, or carried forward from an earlier one - has no way to register
as required, so it can sit undone without moving a shift day's score at all. That is a real
limitation of what "core" can express, not just a missing convenience, and it is tracked in
`BACKLOG.md` to revisit once a real month of shift days shows whether it matters in practice.

## A stamped day outlives its template

Deleting a template does not touch any day it was already stamped onto. `deleteTemplate` in
`src/lib/store/templates.ts` only removes the template from the list - `DayPlan.templateId` on a day stamped
from it is left exactly as it was, now pointing at a template that no longer exists.

This follows the same reasoning as `dayType` and `core`: both are copied onto the day at the moment
of stamping rather than looked up live, specifically so that editing or deleting a template later
cannot silently rewrite what already happened. Clearing `templateId` on delete would break that
consistency for no real gain - a stamped day is a fact about a date, not a live pointer that should
go stale-safe the moment its source is gone. The alternative once considered - clearing the
reference so nothing has to guard against it - was rejected because a stamped day earning a blank
slate on deletion, while its tasks, its color history, and its score all stay put, would be the odd
one out rather than the consistent choice.

The cost is that every place that reads `templateId` - `DayView`, `CalendarView`, and the
year strip's yearGrid.ts while it existed - has to treat a template lookup that comes back empty
as "no template" rather than assuming it always resolves. All of them already did, before this was
ever written down: a dangling `templateId` degrades to an uncolored, unlabeled day rather than
crashing, which is pinned by tests in `store.test.ts` and `DayView.test.tsx` (and was in
yearGrid.test.ts until the strip went in v2.7).

## Templates instead of recurring tasks - and the small repeat that came later

> **Superseded in v2.29, in part.** A rotating schedule is laid out in the month's roster - dates tapped, or a stretch filled with a cycle of kinds - and Apply stamps it in one commit, so it is still stamps and not a background rule; see "Rotating shifts: a kind is a template, the roster is the stamps, and a sleep belongs to the day it wakes into".

Most planners represent a repeating commitment as a recurring task: "every weekday, 09:00, standup."
Dienius was built without a recurrence engine. Instead, a `Template` is a named, coloured list of
time blocks that gets stamped onto specific calendar dates (`applyStamps` in
`src/lib/stamping.ts`), one date at a time, with the stamps staged in the calendar view until an
explicit save.

Since v1.3 a single task can also repeat - daily, weekdays or weekly, and nothing more
(`src/lib/repeats.ts`). That is deliberately the smallest repeat that exists: no "every other
Tuesday", no end date, no exceptions beyond deleting one instance (which writes a skip onto that
day) or the series. Instances are real tasks, made when a day is first opened, and "just this day"
against "every day it repeats" is a standing choice rather than a dialog. It exists for the one
thing a template is bad at - a single commitment that outlives whichever template a day happens to
wear - and it is kept small for exactly the reasons the next paragraph gives.

Recurrence rules are a small planning problem of their own - exceptions, skipped weeks, "every
other Tuesday," what happens when a recurring task is edited after some instances are already
checked off. A template sidesteps all of it by never claiming to predict the future: nothing exists
on a date until someone stamps it there, so there is no rule to reconcile when a real week doesn't
match the pattern. Re-stamping the same template onto a day that already carries it is handled
explicitly - `applyStamps` matches prior template tasks to the new blocks by title and time so a
completed task does not get silently reset - which is most of the complexity a recurrence engine
would have needed anyway, just scoped to one date at a time instead of an open-ended rule.

The cost is that stamping is a manual, visible action instead of a background rule: a template does
not fill in a whole month by itself, and a shift-worker's rotating schedule needs the calendar
painted by hand (or in a drag) rather than described once and forgotten. For a person who already
struggles with a plan that is not visible, that manual visibility is closer to a feature than a
tax, but it is still more clicking than a recurrence rule would ask for. The one concession, since
v1.3, is the weekday map in Settings: a template per weekday, applied the first time a day is
opened and never again for that day, with a stamp by hand always winning. It fills in the ordinary
week and leaves the rotating one to the calendar, which is where the manual visibility still earns
its keep.

## A hand-rolled service worker

`public/sw.js` is written by hand rather than generated by `vite-plugin-pwa` or a similar library.
`scripts/generate-sw.mjs` runs at the end of every production build - from a Vite plugin's
`closeBundle` hook in `vite.config.ts`, which is the moment `public/` has been copied and every
output file can be seen - hashes the built output, and writes a versioned cache name plus a full
precache list directly into the worker file.

The app is a small number of static files with one caching strategy - network-first for
navigations so an online visit always gets the latest build, cache-first for everything else - and
that did not seem to justify pulling in a library whose configuration surface is larger than the
problem. Writing it by hand means owning the two ways a service worker commonly goes wrong:
serving a stale app forever (handled by `skipWaiting` and `clients.claim()` in `install` and
`activate`, so a new deploy takes over immediately instead of waiting for every tab to close), and
caching a partial or broken response (handled by only caching complete, non-range, successful
responses). The cost is that those failure modes are now the project's own to get right and keep
right, instead of a maintained dependency's - a hand-rolled cache is exactly the kind of code that
quietly rots if nobody revisits it after a Vite upgrade changes how the build output looks.

## The push bound is a design choice, not a finding - and it has one exemption

`MAX_PUSHES` in `src/lib/pushRules.ts` is 2. Neither this file nor any commit that touched it ever
cited a reason for choosing two rather than one, three, or five, and `docs/RESEARCH-PUSH-RULE.md`
went looking for one and found nothing - the number was picked without a study behind it, and
should be described as a guess from here on, not as a result. It does not rest on the Zeigarnik
effect or on decision fatigue either, despite how naturally the copy around it ("closes an open
loop," "one less thing to decide") might suggest one of those - `docs/RESEARCH-ADHD.md` sections 6
and 9 found both mechanisms fail to replicate. What the bound can honestly rest on is narrower: the
four-item working-memory ceiling a list that never sheds a stalled item silently competes for
(section 7), and maintenance burden as a documented cause of planner abandonment (section 11). That
is real, but it argues for forcing a decision on a task that has stalled - not for treating every
task that survives two pushes as if it must have stalled.

That gap is what `Task.unbounded` closes. A task pushed to the bound already told the owner
something quick-add could never know at capture time: it survived two real days without being
finished or abandoned. That is exactly the evidence a person needs to tell "this stalled" apart
from "this is a standing thing I keep meaning to get to" - a task waiting on someone else, or one
that was never going to resolve in two days by its nature. So the bound's own do-or-delete moment,
which already exists and already interrupts the owner on exactly the tasks that reach it, gained a
third branch instead of a new screen or a second question: do it, let it go, or mark it ongoing.
Marking a task ongoing sets `unbounded`, which `isPushable` in `pushRules.ts` treats as an
unconditional yes regardless of `pushCount` - the task keeps moving day to day exactly like one
still under the bound, indefinitely, with no later, harder line waiting for it at five or ten
pushes. Lally et al. (2010) is the reason there is no such line: missing an occurrence did not
measurably disrupt habit formation in that study, so there is no evidence a later bound would be
any "safer" than the one already in place, and adding one would just relocate the exact problem
this feature exists to remove.

The flag is deliberately the opposite of `core` in one respect: `rolloverUnfinished` clears `core`
on every push because core is a promise a specific day's template made, not a property of the task
itself, but it leaves `unbounded` untouched, because being a standing task is a fact about the kind
of task it is, not about the day it happened to reach the bound on. It is also deliberately
reversible with no confirmation step, the same weight as changing a task's size - marking something
ongoing by mistake, or deciding later it was not standing after all, costs nothing to undo, through
the same quiet label that set it in the first place. And deliberately unmeasured: `pushCount` still
increments on an ongoing task, but nothing in the UI shows it once a task is marked ongoing, and
nothing tracks or surfaces how long a task has stood - a visible count would just be the guilt this
whole feature exists to remove, arriving through a side door. `TemplateBlock.unbounded` gives the
same exemption a way to start on day one, for a task the owner already knows, while building the
template, is not going to resolve inside the bound - copied onto `Task.unbounded` at stamp time
exactly the way `core` already is, and just as invisible at quick-add time, since template editing
was never part of the moment a day starts.

## Starter templates offer, they never install

> **Superseded in v2.24 and v2.36, in part.** A load writes one device-local moment, dienius:north-seen, for the window after sleep, and still not a byte of the plan; and Erase all data removes what the device holds and reloads rather than writing an empty plan back (see "An erase takes this device's keys with it").

The first-run experience (`docs/RESEARCH-ADHD.md` section 11: a median 70 percent of ADHD-tool users
discontinue within 100 days, sharpest right after acquisition, with confusing interfaces and setup
cost among the recurring causes) needed a fix without touching the app's oldest rule: it ships empty,
nothing pre-filled, no clutter the user did not ask for - see "No accounts" and every other decision
in this file that assumes an install starts as `defaultData()` and stays that way until a person
actually does something.

The fix is a genuine third option between "ship it empty" and "ship it with fake data to seed and
later wipe": an offer. `STARTER_TEMPLATES` in `src/lib/starterTemplates.ts` is inert data - three
realistic day shapes, each with its actual blocks, never written to storage on their own. Nothing
about loading the app, in any state, creates a single byte in `localStorage`. A person who clears
storage and never taps anything gets exactly the same empty `AppData` they always would have. The
templates only become real - a genuine, editable, deletable `Template` object indistinguishable from
one built by hand in `TemplatesView` - the instant a person taps "Use this template," through the
same `actions.addTemplate` the manual editor already calls. On the day view specifically, that same
tap also stamps the new template onto the date being viewed, through the same `actions.stamp` the
calendar's own stamp bar already calls - one tap, two ordinary store actions, no new code path either
one goes through that a hand-built template and a hand-drawn stamp would not have gone through
anyway.

This is why "offer without installing" is not a contradiction with the ships-empty decision but the
same decision applied one layer earlier: the rule was never "the user must build everything from
nothing," it was "nothing exists until the user asks for it." A tap is asking. The three starters are
themselves held to the same content bar the rest of the app's copy already keeps - a working day, a
rest day, and an overnight shift are written as an actual person's day (specific titles, real
times, a shift that runs a genuine eight hours) rather than a "Task 1, Task 2" scaffold, because this is
what a brand new person will assume the app is for. `docs/RESEARCH-ADHD.md` section 12 rules out a
guided multi-step flow and any coach marks or tour; nothing here is a flow. (The tour that came in
v1.7 is the exception that was argued for on its own terms: opt-in from an offer, nine steps that
each end on a real action in the real app rather than a slide about it, and "Start clean" at the
end - what section 12 was against was a wall of instruction before the first task, and that is
still not here.) A person can ignore the
offers entirely and start from quick-add exactly as before, or open Templates and build one from
scratch exactly as before - the offers are one more starting point sitting next to those two, not a
replacement for either, and once tapped once the whole section is gone from every screen it ever
appeared on, because the data that made it show has changed, not because a flag remembered a tour was
seen.

That last point is deliberate on its own: there is no `hasSeenOnboarding` flag anywhere.
`isFirstRun` in `src/lib/onboarding.ts` is a pure read of `AppData` - true only while there is no
template and no day holding a real task, false the moment either exists, true again the moment
neither does. A stored flag would have been simpler to write and wrong in exactly the way the brief
warned against: it is one more field to migrate forever, and a person who erases everything through
Settings' "Erase all data" would have landed on a blank screen instead of the state that actually
describes an empty install, since a boolean does not un-set itself just because the data it was
tracking got deleted. Computing it fresh means Settings' reset needed no special case at all - it
left the device empty and reloaded, and the very next read reported a first run, for free.

## An installed copy tells you when it updates, and asks before it reloads

An earlier version of the service worker registration reloaded the page the instant a new deploy
took control mid-session, silently. That closed the actual failure mode a hand-rolled worker exists
to avoid - nobody stuck on a stale build forever - but opened a smaller, real one: a reload with no
warning can land while someone is mid-keystroke, and "silently" also meant nobody who installed this
to their home screen would ever know a new version had shipped at all, or trust that it had, without
opening dev tools.

**What happens on deploy.** Nothing beyond the existing build step - see "A hand-rolled service
worker" above for the cache-versioning mechanics, unchanged by this. `scripts/generate-sw.mjs` still
hashes the built output and writes a fresh `CACHE_NAME` into `sw.js` on every build that actually
changed something; `install` still precaches under that name and calls `skipWaiting()`; `activate`
still purges every other cache and calls `clients.claim()`. A new worker always wins control the
moment it activates - there is no "waiting" state a person has to trigger by closing every tab, and
no version of this worker that pins a browser to a stale cache indefinitely.

**What changed is only what the open tab does with that moment.** `clients.claim()` firing is not
something the page can prevent or delay - by the time `src/pwa.ts` hears about it, the new worker
already controls every future request. What the page controls is whether *it* jumps to match right
then. It no longer does automatically. `registerServiceWorker` in `src/pwa.ts` listens for
`controllerchange` and, instead of calling `location.reload()`, raises a flag through a small
listener set (`onUpdateReady`/`notifyUpdateReady`) that has exactly one subscriber today:
`UpdateNotice`, mounted once at the bottom of `App.tsx`. The flag is raised at most once per page
life (the same reload-once guard the old code had, now guarding a notice instead of a reload) - and
never at all on the very first controller a browser ever claims for this app, which is a fresh
install taking charge for the first time, not an update to announce. `hadController`, captured at
module load before registration even starts, is what tells the two apart: if a controller already
existed when the page loaded, this browser has run the app before and any further `controllerchange`
is real news; if not, the page just installed its very first worker and there is nothing stale to
report.

**What the user sees.** A quiet fixed banner at the bottom of the screen: "An update is ready." and
one button, "Reload." No backdrop, no dismiss control beyond acting or not - ignoring it is a
complete, valid outcome, and the notice does not return, repeat, or expire once it has appeared. It
carries `role="status"` (an implicit polite, atomic live region), so a screen reader announces it
without interrupting whatever it was already reading and without anything pulling focus toward it -
a person reaches the Reload button on their own next Tab press, never because the app moved focus
there for them. It never intercepts a tap on the day view underneath it: `.update-notice` is a plain
fixed element with no scrim, and it deliberately shares no z-index range with the app's actual
sheets (`.gap-picker`, `.task-actions-sheet`) - it sits below both, so if a sheet happens to be open
when an update lands, the sheet's own backdrop simply covers the notice instead of the two competing
for attention, and the notice is exactly where it was once the sheet closes.

**What the user has to do.** Nothing, ever, if they choose not to. Reloading is the one action
available, and because reloading is now something a person does rather than something that happens
to them, it cannot land mid-edit by construction - there is no code path left that reloads the page
without a click on that specific button. This is also why the notice does not try to detect "is the
user typing" or "is a sheet open" the way an automatic-reload design would have needed to: making
the reload opt-in removes the entire class of problem rather than attempting to track it. The
existing quick-add draft preservation (`src/widgets/day-plan/draft.ts`, `sessionStorage`, read-and-
clear on mount) still matters here and is unchanged: it protects an in-progress quick-add across any
reload, voluntary or accidental, including a tap on this button.

**Copy is English**, matching every other string in the app and the repo-wide rule in this file's
own header - the owner's brief used "Atnaujinta" (Lithuanian for "updated") only as an example of
tone, not as a language requirement, and the app has no other Lithuanian anywhere to be consistent
with.

**Why a notice with an action, not a silent auto-reload with an after-the-fact acknowledgement.**
Both were weighed. An automatic reload that announces itself afterward ("Updated.") keeps the app
always current with no tap required, which reads as less friction on paper. But it only avoids
interrupting an edit if something first correctly detects that an edit is in progress everywhere one
can happen - typing in quick-add, a template title mid-edit, a settings field, an open sheet - and
this app has no single place that tracks "is anything unsaved right now" across all of those; adding
one just to gate a reload would be new, fragile state built solely to protect against a problem this
design does not otherwise have. A notice the user acts on needs none of that: the reload literally
cannot happen without the one click that means the person is not in the middle of anything else at
that instant. The cost is real - a person who never notices or never taps the banner keeps running
whatever build was active when they arrived, for that whole session, and only picks up the new one
on their next natural reload (closing and reopening the PWA, which every installed copy does
eventually). That is judged an acceptable trade against interrupting someone's actual work, especially
since the worker has already taken over in the background regardless - nothing is lost by staying on
the old page a while longer, and nothing is silently stuck forever the way the pre-existing risk this
whole feature was built to close would have allowed.

## Relatedness is a known cost

> **Superseded in v2.7, in part.** The year strip and its ring are gone (see "The Year view goes"), so the fraction and the capacity figures are what show real progress now.

Self-determination theory identifies three needs that sustain motivation, and is the best-evidenced
account of what motivates people with ADHD specifically (Morsink et al. 2022): autonomy, competence,
relatedness. This entry was written when the research was, on 2026-09-01, as "the motivator
local-first cannot serve"; the v2.7 brief asked for it under the name RESEARCH-ADHD section 14 uses,
a known cost, and the owner accepted that reading with the app's closing. Nothing below changed. Dienius serves the first two. Autonomy - the app never auto-schedules and never decides
for the person, see "No accounts" above and every decision in this file that assumes the person stays
in control of their own plan. Competence - the fraction, the capacity line, and the year strip's own
ring all show real progress honestly, against no invented target.

Relatedness it cannot serve at all. There is no account, no server, no way for one person's plan to be
visible to another - that falls directly out of "localStorage, no backend" and "No accounts" above, not
a separate gap. This was weighed and accepted, not missed: a social layer, a shared plan, a body
double, anything that puts another person's presence in the app, would need exactly the account and
server this app exists to avoid, for evidence that does not currently earn that cost - the closest
research on body doubling is a null group-level EEG result and a virtual-reality study of twelve
people. The instruction that follows from that is explicit and standing: never build a social layer.
If the evidence for body doubling ever gets meaningfully stronger, that is a decision for a different
app, not a quiet addition to this one.

## The timeline grid changes how the day feels, not how much gets done

No study compares a proportional-height time grid against the same information written as plain
duration text, in ADHD populations or otherwise. The design is consistent with Barkley's
externalisation principle - information has to be present at the point of performance, not filed
somewhere to be remembered - and with the general cognitive-science literature on shared magnitude
representations of time and space, but the specific claim that a proportional grid beats a labelled
list is unstudied. Said plainly so it is never mistaken for something it is not.

The closest real evidence is adjacent, not direct: Hallez and Vallier (2025), a controlled study of 44
children, found visible timers significantly reduced anticipatory anxiety and inattentive behaviour -
but task accuracy did not improve. Making time visible plausibly changes how a day feels. There is no
evidence, from that study or any other, that it makes anyone finish more.

The grid stays in the app on that basis, and no stronger one: it changes how the day feels, not how
much gets done, and that is a good enough reason to have built it.

## Standing rule: one element dominates the day view

Visual working memory holds roughly four integrated objects (Luck and Vogel 1997; Cowan 2001), and in
ADHD the visuospatial working-memory deficit is roughly twice the size of the verbal one (Martinussen
et al. 2005) - the deficit lands hardest in exactly the channel a visual interface substitutes for. A
screen with a dozen equally loud elements is not showing a dozen things, it is showing noise with
about four things in it. Density itself is not the problem; ungrouped density is (Moacdieh and Sarter
2015) - a well-organised dense screen outperforms a poorly organised sparse one.

That is now a standing rule for the day view, not a one-off judgment made once and forgotten: one
element dominates, and everything else supports it. If the timeline grid, or anything added after it,
ever competes with the task list for attention, the task list wins - the grid is a secondary, quiet
layer under the task list, never a peer to it.

The rule exists because it was already broken once and had to be walked back. The timeline grid, at
full height by default, ran 58 percent of the viewport at 375x812 with a realistic day on screen,
pushing the task list - the thing the owner actually opens the app to act on - below the fold; see
`docs/TIMELINE.md`'s note on the grid's disclosure. The fix was collapsing it behind a toggle, off by
default. Any future addition to the day view - a second grid, a bigger capacity line, a wider if-then
rule - answers to this rule before it ships, not after a review catches the same problem a second
time.

## Eight confirmations - built as documented, kept as built

> **Superseded, in part.** The if-then time bands and the if-then line went with the day view's rule line in v2.0, and rules were retired with goals in v2.28; a float is no longer dragged onto the grid - selecting one for the gap offers is what opens a collapsed grid (`useTaskSelection.ts`); and since v2.7 the first-run screen names no themes, offering the tour, the sample week and the starters instead.

A handful of judgment calls made along the way, confirmed rather than reopened. Each already has its
full reasoning where the feature itself is documented; this is the short record of the decision.

- **The grid's outer padding stays air, not a labelled gap.** The hour before the first anchor and
  after the last is breathing room for the eye, not a free-time gap a person could place a float
  into - the spec's own gap examples are all between anchors, never at the window's outer edge.
- **A placed float lands at the gap's own start.** The plainest, most predictable answer - it is how
  a person reads a gap top to bottom, and it needs no second decision about where within the gap.
  `handlePlace` in `TimelineGrid.tsx` is the one place this could change if it ever needs to.
- **The if-then time bands split the day at noon and 18:00.** A coarse, fixed default, not a
  personalised read of the owner's actual shifts - provisional as of September 2026, worth revisiting
  once an evening or morning rule has actually been written and seen firing at the wrong end of a
  shift.
- **Dragging a float while the grid is collapsed auto-expands it.** Functionally identical to tapping
  "Show timeline" first, triggered by the one gesture that actually needs the grid open, and it does
  not turn the toggle into a per-day decision.
- **Theme discovery gets one onboarding line, not a moved gallery.** The themes (eleven then, three since) stay under
  Settings; the first-run state adds one sentence naming them, at the exact moment a new person is
  deciding whether the app is worth their time. No tour, no second onboarding surface.
- **A starter tapped on the day view stamps the date on screen, not always today.** Consistent with
  how every other action on the day view already treats its date - quick-add, rollover, and every
  task action act on whichever date is open, never assuming "today."
- **The update banner is in English.** Matches every other string in the app - the owner's
  "Atnaujinta" was given as an example of tone, not a request for Lithuanian, and the app has no other
  Lithuanian anywhere to be consistent with.
- **The if-then line shows nothing when nothing is eligible today.** Matches the posture the capacity
  line and the timeline toggle already take elsewhere: a day with genuinely nothing to say says
  nothing, rather than manufacturing a placeholder.

## Sleep is a named list of schedules, greyed on the grid, chosen per day

> **Superseded, in part.** The sleep band is drawn `SLEEP_BAND_MIN_MINUTES` (90) deep, and only when the nearest anchor is within `SLEEP_BAND_BRIDGE_CAP_MINUTES` (120) of the boundary (`timelineLayout.ts`); the constant named below is gone.

The fixed 07:00-23:00 waking window in `capacity.ts` was never configured per day, but it was also
never visible - hours outside it were simply absent from the timeline grid, so neither the free-time
figure nor its own shape on screen said why. `Settings.sleepProfiles` replaces the hardcoded constants
with a named list that is never empty: one schedule, a bedtime/wake-time pair, defaulting to the exact
inverse of the window it replaces - an existing install that never opens Settings computes and draws
identically to before.

**A list somebody writes, not a pair of slots the app decided on.** The first version of this setting
shipped two fields: an ordinary window and a second one labelled "night shift", selected automatically
by `dayType === 'night'`. Both halves of that were wrong. It assumed that everybody who works unusual
hours works *nights*, and that everybody who works nights works the same ones - and it charged the
concept to every single install, including the overwhelming majority who have one set of hours and will
never have another. A list fixes both: most people see one schedule and never learn there could be a
second, and the person who genuinely lives two lives names them and says which is which. The picker on
the day header and in the template editor appears only once a second schedule exists, so until then the
app never says the word "schedule" at all.

**A day points at a schedule by id, and inherits its template's until it does.** `DayPlan.sleepProfileId`
and `Template.sleepProfileId` are both optional and both mean "the first one" when absent, so nothing
has to be backfilled. An id that names nothing - the schedule was deleted - resolves to the first
schedule rather than throwing or emptying the day: see `sleepProfileWindow`. Deleting a schedule also
clears it off every day and template that referenced it, so a day never sits on a dangling id waiting to
be surprised by a later one that reuses it.

**The migration only hands out a second schedule to somebody who was actually using one.** Every install
that ever existed carries a `nightSleepWindow`, because it was a field rather than a choice. Carrying
all of them forward would give a second schedule to people who never worked a night in their lives, so
`migrateSleepProfiles` creates one only when that window was both changed from the shipped default *and*
some template or day was actually typed as a night.

**The grid greys the sleep window rather than cropping to it.** `TimelineGrid`'s own display window
(anchor-buffered, independent of the capacity window - see `docs/TIMELINE.md` section 5's original
reasoning) is pulled back toward the sleep boundary on either side, but only up to
`SLEEP_BAND_EXTEND_MINUTES` (60, the same figure as the anchor buffer's own `DISPLAY_BUFFER_MINUTES`) -
enough to make the wake/bedtime line legible with a real peek of grey behind it, never enough to redraw
the whole night. Drawing the full sleep span was considered and rejected: on the phone it would add
hours of dead pixels to a grid that already has to fit its floors; on a wide screen it would thin the
`chooseWidePxPerMinute` density fed by the same window's total width, compressing the real anchors and
gaps the grid exists to show clearly. The bounded peek gives the boundary without either cost.

**A screen reader hears the boundary once, in plain text, not the band.** The greyed rectangle is
decorative - `aria-hidden`, inside the grid's existing decorative layer - but the sleep window itself is
real information, so one visually-hidden sentence states it plainly every time the grid renders,
regardless of how much of the band today's anchors happen to leave room to show.

---

## One screen, zero scroll - the day view rebuilt around what a glance has to answer

> **Superseded in v1.11, v2.28 and one look, in part.** The gap floor follows the pointer - 44px under a finger, 28px under a mouse; every view, not Today alone, is the window's height from 1024px up, each page scrolling inside its own body (see "It fits: the shell is the window's height on every view"); and rules no longer belong to goals, which were retired with them (see "North is one text, goals retired").

The day view worked and was not worth opening. Everything it knew was on the page, and finding any one
thing meant scrolling past the rest of it. The rebuild is not new features; it is the same day, arranged
so that opening the app answers "where am I in this" without a single scroll.

**The day view is a fixed-height shell at the wide breakpoint, not a document.** `.app:has(.main-day)`
is exactly `100dvh`, a flex column, and every level below it restates `min-height: 0` so it can actually
shrink to that. This is what turns "the day fits on one screen" from something that happened to be true
for a particular day into something structural: no column can push the page taller than the window,
because no column is allowed to be taller than its share. Scoped to the Today tab alone - Calendar,
Templates and Settings are lists with no natural length limit, and pinning them to the viewport would
mean inventing a scroll container inside each one for nothing.

**The grid is drawn at whatever density makes today fit, including thinner than the phone.**
`chooseWidePxPerMinute` only ever answered how much of a *surplus* of room to spend; it floored at the
phone's own density, so a day needing more pixels than the screen had simply overflowed. That was the
honest answer while the grid sat in page flow. `fitPxPerMinute` replaces it at the wide breakpoint,
solved by bisection because `computeVerticalLayout`'s per-segment floors make total height piecewise
linear in density rather than proportional. The floors themselves did not move: a gap is still at least
44px, an anchor still at least 32px, so compression buys room out of empty time and never out of a tap
target. Where the floors alone exceed the room available, the grid draws at its floors and something
scrolls - a day that genuinely does not fit on a real screen, said out loud rather than papered over.

**Hour labels thin out under compression; hour rules never do.** A compressed day can put whole hours
closer together than a line of type is tall, and this app has a standing rule that its text is always
readable. `legibleHourLabels` keeps the number only where there is room to print it. The rules stay at
every hour: position within the day is what the eye reads off a grid, and a rule with no number beside
it still says an hour passed here.

**Checking a task off is the interaction the whole screen is built around.** The store write happens on
the click; only where the row is drawn waits. For `DONE_LEAVE_MS` the card stays in the open list
playing a shrink-and-fade, then moves into a collapsed `Done (n)` fold at the bottom, while the same
task's block in the grid goes muted and struck through and the header's bar moves. Doing the move
instantly makes the card vanish, which reads as "did I just delete that?"; holding it for a beat turns
the same state change into something watched. The payoff compounds: the open list only ever gets
shorter, so by evening the screen is nearly empty and the bar is nearly full, which is the shape of the
whole day with no counting.

**The Done fold is collapsed in CSS, not unmounted.** This app's usual choice for a disclosure is to
unmount the panel, and that is right where the hidden thing is expensive or confusing to leave in the
page. Neither applies here: these rows are already rendered work, and `display: none` removes them from
the accessibility tree exactly as completely as unmounting would, while keeping the whole day in the
document for find-on-page and anything else that reasonably expects a finished task not to vanish from
it.

**A card, not a row.** The title now leads on its own line at a clear step above everything under it,
and the time, size, core mark and push state gather in one quiet line beneath. The old row put six
things side by side at nearly one size, which is six things to read before knowing what the task is -
see `docs/RESEARCH-ADHD.md` section 7 on what has to be visibly first.

**On a short wide screen the cards spend less on padding, keyed on viewport height rather than measured
in JavaScript.** A measured version would re-run on every task added or finished and would make how a
card looks depend on how many there are, which is a worse thing to explain than "short screen, tighter
cards." The type hierarchy is untouched; only the air around it moves. One rule inside that block needs
a second condition: a card there is as tall as the 44px actions button inside it, and 44px is a
fingertip - so it comes down to 40px only under `(pointer: fine)`, where there is no fingertip to hold
it for. A touch screen at the same size (an iPad in landscape is 1024x768) keeps the full target and a
long enough day scrolls its task column, which is the correct trade.

**If-then rules moved to Settings, unchanged.** They surfaced as a line on the day view, and on a day
with no eligible rule that line was an empty prompt occupying the part of the screen that has to answer
"what am I doing now" in two seconds. Every rule already written is still there and IfThenBoard is
still the one place they are authored; only where they live moved. IfThenDayRule is kept, tested and
currently unmounted - parked for a design worth giving it, not deleted.

> **Superseded in v2.0.** The design worth giving it turned out not to be a placement at all: a rule
> belongs to the goal it protects, and both IfThenBoard and IfThenDayRule are gone. See "A rule
> with no goal is noise; under a goal it is armour", below.

---

## The calm pass: colour that means something, and a screen that says what is happening now

> **Superseded, in part, by what came after.** Categories are the owner's own list since v2.0 - six defaults, no cap, a default's colour a dark and light pair in the stylesheet (`categories.ts`); a ring's gap is drawn in `--ground` (see "The pixel standard"); the edge is 4px on block and card alike; since v2.12 `--mark` also draws a key block's edge; since v2.24 the now line carries a marker that says the minute; a short gap keeps 44px under a finger and 28px under a mouse; and the rollover is a quiet button with an arrow, not a link.

Everything on the day view was the same blue. A timeline where every block is one colour is a timeline
that only tells you *when*, never *what*, and the eye has to read every label to learn anything. This
pass gives the day a small vocabulary of colour, marks the one moment that is actually now, and takes a
line off almost everything else.

**Six categories, not more.** `src/lib/categories.ts`: Focus, Routine, Health, Meals, Commute,
Personal. The number is the whole design. A colour system earns its place only if a day can be taken in
without reading it - roughly how much of today is work, whether anything was left for the body, whether
meals got planned at all - and past about six hues nobody holds the meanings at once and it becomes a
legend to look up. Fixed hex values rather than theme tokens, exactly as `Template.color` already is: a
category means the same thing in all eleven presets, and the same day would read differently in each if
these followed the theme.

**One ring, for every colour that can be chosen.** There are four round colour
swatches in this app - the accent row in Appearance, the six categories under
quick-add and in the template editor, a template's own colour, a library
list's dot - and until v2.0.1 they said "this one is chosen" four different
ways: a clean outer ring on one, an 18-to-24px size jump plus a doubled
same-hue ring on another, and a `border-color: var(--text)` drawn inside the
fill on the other two. They share one rule now: the fill, a two-pixel gap in
`--surface`, then a two-pixel ring in the swatch's own colour, drawn as a
box-shadow so choosing one never moves the row. The gap is the whole of why it
reads as a ring rather than a thicker edge. Four ways to say one thing is the
kind of small wrongness that reads as carelessness long before anybody can
name it, which is exactly how it was reported.

**A wash on the block, an edge on the card.** The timeline draws about a fifth of the colour mixed
against the surface, with full strength kept for a 3px left edge; the card in the list gets only the
edge. That asymmetry is deliberate. On the grid a colour is a *quantity* - the area it covers is how
much of the day it took - so it has to fill. In the list it is only an *identity*, so it gets the
smallest mark that still pairs the two, and a column of nine cards stays one calm column instead of six
competing ones. Every category also carries its name in the meta line: colour is never the only signal.

**Nothing already on disk is recoloured.** A task with no category - written before this existed, or
restored from an older backup - draws exactly as it always did, in the day's own template colour. The
category arrives from the template block it was stamped from, or from the swatch row under quick-add;
the starter templates all carry them, so a first-run day is coloured from the first tap rather than
teaching that the colours mean nothing.

**"Now" is the theme's highlighter, not the accent.** The current-time line used to be `--accent`, with
a comment explaining why it must never be a hardcoded red. Both halves of that reasoning still hold and
the conclusion changed anyway: categories put a blue almost exactly the accent's own hue on every Focus
block, and an indicator the colour of the blocks it crosses is not an indicator. `--mark` is the
highlighter every preset already defines, warm and loud in all of them, and nothing else on the grid
uses it - so "now" is the one thing on the day drawn in that colour, which is also what it means. The
line carried the clock time on a filled chip in the gutter until v2.6, because it lands wherever the
minute falls, often straight on top of an hour label; the chip was the header's own clock said a second
time, so the header says the minute now and the hour label the line crosses is dropped rather than
covered - see "Once and only once", below.

**One task is current, and three places say so.** `activeTask` in `capacity.ts` picks it: timed, sized,
not done, containing the clock, later start wins where two overlap. Its block gets a ring in the now
colour over whatever category colour it already had - "current" and "what kind" are two signals that
never overwrite each other - its card gets the same ring (and, until v2.6, a countdown beside the
header's own; see "Once and only once"), and the header states it in plain text:
`15:21 · Meetings · 39 min left`. Deliberately narrow about all three conditions: an unsized
task has no known end, so claiming it is still running would be an invention, and a finished task is
not what you are doing whatever the clock says.

**Focus is a countdown, not a pomodoro.** `FocusView.tsx` is one task, the time left on its own planned
block, a ring, and a way out. There is no length to choose and no timer to start, which is the entire
difference: a pomodoro asks you to decide how long to work and then contradicts the plan you already
made. It also means closing it loses nothing - there is no timer state, only a screen. When the planned
time runs out the ring completes and the number stops; nothing flashes and nothing is marked. Overrunning
a block is ordinary, and a planner that treats it as failure is one people stop opening - see
`docs/RESEARCH-ADHD.md` section 12.

**Fewer lines, and the ones left mean something.** The grid lost its container border - a box already
told apart by its own surface colour does not need an outline as well - the hour rules dropped to 62% of
`--border` and the half-hours to 28%, and a gap is transparent at rest instead of a filled panel, since
drawing empty time as a block made it look like a third kind of content between the real ones. A gap
under thirty minutes keeps its full 44px target and loses its label: half an hour is roughly the
smallest stretch a real task fits in, which makes it the line between "free time" and "the space between
things", and labelling every ten-minute hole buries the two or three usable ones among a dozen that are
not.

**The dot menu fades in on hover, and this is not the bug this repo already fixed.** That bug made a
control unreachable on touch, where there is no hover state at all. The rule is gated on
`(hover: hover) and (pointer: fine)`, so a phone or tablet gets exactly what it always got - the button,
visible, always - and it is opacity rather than display, so the button keeps its box, its place in the
tab order and its focus behaviour on a mouse-driven window too. Only the column of nine identical
dot-menus goes quiet.

**The rollover stopped being the loudest suggestion on screen.** A full-width dashed button at the
bottom read as the day's conclusion - the thing you are meant to press - when what it actually does is
give up on nine tasks. It is now a quiet underlined link, still exactly as reachable.

**Settings is a settings screen.** A section list down one side, and rows of name, description and
control down the other, so every switch in the app reads the same way instead of each inventing its own
arrangement of label, paragraph and button. One scrolling document rather than four swappable panels:
find-on-page reaches every setting, nothing has to be remembered as "behind the other tab", and someone
looking for one switch sees what else exists on the way to it.

---

## Three themes, and why eight good ones had to go

Dienius shipped eleven presets: Sketchbook, Graph, Legal pad, Moleskine, Blueprint, Terminal, Newsprint,
Receipt, Ink and wash, plus Slate and Midnight. Every one worked, every one passed its contrast gate, and
several were genuinely nice. They were still the wrong thing to ship. A theme picker with eleven rooms in
it says the app is a demonstration of what surfaces are possible rather than a tool somebody opens every
morning, and nine of the eleven were choices nobody keeps past the first afternoon. What is left is the
choice people actually make: dark, light, or darker.

The ruled paper, the grain, the vignette and the margin rule went with them. The machinery that draws all
four survives, because it is generic and shared with the pre-paint script, and every shipped theme simply
sets it to nothing - removing it would have meant gutting the token model and forty tests for no
user-visible gain.

**Nothing migrates, and that is by design.** findPreset has always fallen back for an unknown id, so a
stored presetId of sketchbook renders as Dark from the next load onward without a migration step that
could itself go wrong. Pinned by a test that walks all ten deleted ids.

**Dark is a material, not an absence.** #121417, a dark grey with a trace of warmth, not #000. On a pure
black page every surface above it reads as a hole punched in the screen. Cards sit six percent lighter
and anything covering a card six percent lighter again - depth carried by a third surface step rather
than by shadow, because a shadow on a dark ground is just a darker dark. That third step is a new token,
surfaceRaised, and it is the one structural change the token model needed.

**Text is not pure white either.** Full white on near-black vibrates and is tiring to read at length. The
three inks are the opaque equivalents of white at 87, 60 and 38 percent over each theme's own card
surface - so the ratios are exactly what those opacities give, while staying real colours, which every
piece of contrast arithmetic in this codebase needs them to be. The third, faint, is deliberately below
the AA threshold and used only where text is present but not meant to be read.

**Light inverts what white is for.** The page is #f6f5f2 and cards are pure white, so white stops being
the background and becomes the elevation - a card reads as a card without a border loud enough to see.
Ink is #2a2d31, never black: maximum contrast is not the same thing as maximum readability, and the
difference between them is exactly the glare.

**Colour is quieter in the dark, and the categories know it.** The six category colours moved out of
categories.ts and into two blocks in styles.css - one dark, one light, keyed on the resolved mode.
categoryColor() now hands out a var() reference rather than a hex, so the cascade answers the question
and nothing in JavaScript has to know which theme is in force. A gallery preview card overrides the same
six variables inside its own subtree, which is how a card previewing Light shows light category colours
while sitting on a dark page.

**Light or dark stopped being a mode.** With three fixed themes it is the choice itself, so every theme
ships exactly one mode and the Light / Dark / System control is gone. What survives is the only part of
it that was ever a preference rather than a restatement of the gallery: whether to follow the device.
That now swaps the whole theme, and only ever in one direction - toward Light when the system asks for
light and the chosen theme has none. Somebody who picked Midnight picked it for their screen, not for the
time of day, and switching them to Dark every evening would quietly undo that.

**Adjust this theme became three settings instead of twenty-one.** The old panel let a person set any
theme token to any value they could type, which is a theming engine rather than a setting: it could
produce text the same colour as the paper, needed a live contrast warning and a Reset button to dig out
of, and nobody used it twice. It is replaced by Accent (eight curated colours, every one pre-checked
against all three surfaces, which is why the contrast warning is gone rather than hidden), Density
(Comfortable / Compact) and Text size (S / M / L). Accent is stored as a per-theme override patch, the
same mechanism as before, so coral on Dark and default on Light are remembered separately. Density and
text size are not: they are facts about the screen and the eyes in front of it, and it would be strange
for either to change when the sun goes down.

Both of those last two work by overriding the spacing and type scales at their source - six declarations
each, and nothing anywhere else in the app knows either setting exists. That is the entire payoff for
having built the scales in the first place.

**Measured, not eyeballed.** A probe walks the composited background behind every piece of text on the
day view - through gradients, translucent bands and opacity, which is where the naive version of this
check goes wrong - and computes the real ratio. Twenty-five text-on-surface pairs, all three themes, all
at or above AA. Two failures it caught: a finished block's title at 4.3:1 in Light, and the Sleep band
label at 4.14:1. Both are fixed rather than excused - being done is not a licence to make text
unreadable, only quiet.

---

## Making it feel like something: motion, feedback, and the three kinds of day

> **Superseded in v2.25, in part.** The tick is one path through a mask, drawn on by a clip-path, with no registered properties (see "The day's masthead lies on its columns, and a layer's fills are its own").

**One curve, two durations, everywhere.** Every control in the app now answers the pointer at the same
speed on the same easing, taken from the motion tokens. That single fact is most of what separates
software that feels like one piece from software that feels like several - and it is entirely invisible
until it is missing. Nothing animated here touches layout: transform, opacity, colour and shadow only, so
hovering across a busy grid never reflows anything and never moves the block being aimed at. (Since v2.6
transform is off the hover list as well: a block that rises a pixel under the mouse moves nothing else
and still moves - see "Nothing moves on hover", below.)

**The checkmark is drawn, not faded in.** Two registered custom properties animate the tick's two strokes
in sequence - the short one, then the long one - which is the order a hand draws a tick in, and is why it
reads as a mark being made rather than an image appearing. `@property` is not universal, and where it is
missing the properties are not animatable, so the keyframe cannot interpolate and the tick would never
appear at all. That fails worse than not animating, so a feature query hands those browsers the finished
mark statically.

**Blocks can be moved and resized on the grid.** Dragging a block moves it in time; pulling the strip
along its bottom edge changes how long it is. Both snap to five minutes, because that is the granularity
a plan is actually made at - nobody means 14:23, and letting a drag produce it turns a tidy day into a
list of times that look like measurements. Snapping also makes the gesture forgiving: the block lands
where it was clearly aimed rather than exactly where the finger stopped.

The grid publishes its own pixel-to-clock mapping upward rather than the drag guessing at one. `DayView`
owns the gesture - it already has the document-level listeners, the Escape handling and the tray
detection - but the mapping depends on the density the grid measured and the piecewise floors it laid out
with, so it comes from the component that actually drew it. The mapping object is created once and reads
through a ref, so the parent never re-subscribes as the clock ticks.

**`data-tray-zone` moved, and that was a real bug.** It sat on the whole day view, which made every pixel
of the screen the tray. That was harmless while releasing a block could only ever un-anchor it, and wrong
the instant a drag could also move it: the first move committed and was then immediately overridden by an
un-anchor, because the drop point was inside the tray by definition. It is now the task column, which is
what the gesture was always described as - drag it back to the list.

**One undo, for five seconds.** Long enough to notice a mistake and reach for it, short enough to be gone
before it becomes furniture, and it dismisses itself: a bar that needs dismissing is a second thing to do
after the thing you were already doing. Only ever one offer - an undo stack for a gesture this forgiving
is more machinery than the mistake is worth, and a second level is a thing nobody finds anyway.

**Quick-add shows its work.** The field accepts a leading time and a trailing duration inside ordinary
prose, which is fast to type and impossible to be sure of. The parse now runs on every keystroke and the
result appears as chips under the input, so nobody has to press Enter to find out how the line was read.
The duration is anchored to the end of the string for a specific reason: "Read 20 pages" is a real task,
and reading its 20 as a length would be worse than not supporting durations at all.

**A day has three tenses and they no longer look identical.** Today has a clock, a now-line and a
countdown. A past day is a record: the same layout at a lower voice, no rollover button, and an empty one
says "Nothing planned" and "This day went by without a plan." rather than inviting a plan for a day
that is over. A future day is a plan: no now-line, nothing counting down, and its free gaps read as available
rather than as missed. Nothing is ever disabled on any of them - a day you cannot fix is a day whose
mistakes are permanent, and the entire push mechanic depends on being able to reach back.

**And the day that is finished says so.** When everything planned is done, the header replaces the running
task with "Day cleared". Without it, a finished day and a day nobody ever planned look the same in the one
place people glance at first, which is the single distinction this whole app turns on.

---

## The clock, the inbox and the nudges: nothing that is not the plan is ever a second place where work lives

> **Superseded, in part.** Both nudges went in v2.5 (see "A setting has to earn its place") and the inbox became Later in v2.7, one of the three shelves of CONVENTIONS section 14 (see "Later, where two shelves were"); the sound is one engine with four profiles since v2.15 (`chime.ts`); and in Later mode the line is parsed like a task, a typed time dropped.

Written when these four things shared a dock. They no longer do - the timer and stopwatch are a
popover behind the clock in the header and a small floating widget while one runs
(`widgets/clock/`), the inbox is one of the four shelves under the day (CONVENTIONS section 14),
and the one nudge became two: the interval nudge during focus work described below, and a nudge
before a timed task (TaskReminder.tsx), off by default, once per task per day, never while the
app is closed. The rule they share is unchanged and is what this section is really about: each is
either invisible or one tap away, and none of them is ever a second place where work lives.

**The timer stores an instant and a length, never a countdown.** A running timer keeps only when it
started and how long it is; the number on screen is derived on every tick. That is what makes it survive
a refresh, a backgrounded tab that stops getting frames, a phone that sleeps, and the service worker
reloading the page mid-session - all of which quietly desynchronise a stored "seconds remaining" that
something has to keep decrementing. It is also why opening the app after a timer already ran out can say
"finished 8 minutes ago" instead of finding a stale zero.

**It lives under its own storage key, not in the backup.** Everything in `dienius:data` is a plan -
something written down and worth getting back from an export. A timer with ninety seconds left on it is
neither, and importing one from last Tuesday would be strange. Both paths that erase everything now clear
it too, so "erase all data" still means all of it.

**One timer and one stopwatch, deliberately.** Concurrent timers is a feature request with a real cost:
every surface showing one has to become a list, and the floating widget stops being glanceable. There is
no version of a day plan where two countdowns at once is the simple answer.

**The widget moves by tapping, not by dragging.** A drag has to be told apart from a scroll, has to work
with a finger and a mouse, and has to decide what happens when it is dropped between two corners. One tap
that walks it round the four corners does the same job - getting it off whatever it is covering - with
none of that, and behaves identically on both inputs.

**The sound is synthesised, not loaded.** Two sine tones a fifth apart, gain ramped to silence rather
than cut, because an abruptly-ended tone clicks. No audio file to bundle, cache, or have go missing
offline. Every part of it is wrapped: `AudioContext` does not exist everywhere and a browser that has not
seen a user gesture will refuse to start one, and a missing chime is not a failure worth surfacing when
the widget is already saying the same thing on screen.

**Only the tab that watched it run out makes a noise.** The stored `rungOut` flag is what a reload reads
to know the difference between a timer still counting and one waiting to be acknowledged - so the app
opened an hour later shows the finished state silently instead of alarming about something long past.

**Notification permission is asked at the first Start, not on load.** A prompt on page load is a prompt
about nothing and gets denied on reflex; a prompt at the moment somebody starts a fifteen-minute timer
explains itself. Nothing is blocked on the answer - the widget and the sound are the primary signal, and
the notification is only what reaches somebody who has switched tabs.

**Sleep shows up in the header four hours out, and not before.** Before that it is a number about
nothing, and a number about nothing displayed all day teaches people to stop reading the header. Under
thirty minutes it stops being information and takes the accent. Measured against the same waking window
the grid greys and the capacity line counts against, so the three can never disagree about when the day
ends.

**The inbox is a mode on the field that is already there.** (The inbox became Later in v2.7 - see "Later,
where two shelves were" - and the mode is Later now; the reasoning below is why it is a mode.) One input with one cursor, and a toggle that
says where the next Enter goes - capturing costs a tap once rather than a decision every time about which
box to aim at. The text goes in exactly as typed, with no parsing: an inbox item is not a task yet, and a
time inside it is part of the note somebody wrote to themselves.

Two ways out and no more: put it on this day, or delete it. Which day, what time, how long and what kind
are all decisions the inbox exists to let somebody postpone, and asking any of them here would put the
friction straight back in. Once it is a task, every one of those questions already has a control on the
card.

**The nudge can only speak during work somebody already called work.** Off by default, and the condition
is the whole design. An app that interrupts on a fixed schedule interrupts during dinner and gets turned
off inside a week. This one fires only while a task the owner themselves marked as Focus is running, on
today, which is exactly the situation where losing an hour without moving is a real thing that happens -
and the only situation where an interruption is doing somebody a favour. It counts from the start of the
task rather than from when the feature was switched on, so the first one lands inside the work rather
than twenty minutes after the app happened to be opened.

**And a duration is never typed into a bare number input.** `MinuteStepInput` is a sibling of the existing
time field with the same manners - type freely, or step with the arrow keys and the two buttons - kept
separate rather than folded in as a mode, because that component's whole behaviour is about clock times
and none of it means anything for a length.

---

## v1.0: the seams between three waves of work

Three passes had been built largely independently - the interface polish, the theme rebuild, and the
utility dock - and the point of this one was to find where they did not meet. Fourteen seams, all of the
same shape: something written for one screen that broke the moment it appeared on another.

**Six definitions of what a text field looks like.** `.template-editor input`, `.block-add input`,
`.if-then-form input`, `.quick-add`, `.setting-text-input` and `.task-size-input`, each written for the
screen it first appeared on, agreeing by accident and diverging in the details. None of them reached a
component reused elsewhere - which is why the minute field in the new timer popover rendered as a bare
white browser input on a dark page. Now styled once, by type, with the five non-text input types
excluded by name, so a field added later is styled by default and has to opt out on purpose.

**The stepper was a field with two buttons parked beside it.** Field and buttons now share a border and
sit flush, and the steps stack the way a spinner does - the side-by-side pair needed 88px of a row that
never had it. The triangle glyphs printed as text became chevrons drawn from borders, like every other
mark in the app.

**The floating timer sat half its own width off its corner**, because it reused the undo bar's entrance
keyframe - which is centred and carries a permanent `translateX(-50%)` under fill-mode `both`. Far
enough at the left-hand corners that the move button appeared to do nothing.

**Nineteen orphaned CSS rules** for the deleted override panel, plus four comments still describing it,
and two more pointing readers at it for reasoning that had moved.

**Forty-six spacing declarations off the scale** - 9px, 10px, 13px, 14px, 20px, 28px - left over from
before the scale existed. Rounded onto it, ties tighter.

**The evening hole.** The sleep-band bridge measured its allowance from the already-buffered edge of the
window rather than from the last real anchor, so it spent that allowance twice: an hour of buffer plus
ninety minutes of bridge plus ninety of band gave a quarter of the grid to a stretch with nothing in it.
That is exactly the wall of empty rows the cap exists to prevent, produced by the cap itself.

**Finished blocks had drained past quiet into invisible** - the opacity was tuned before the themes were
rebuilt, and against the new surfaces two hours of finished work rendered at almost exactly the panel
colour.

**The Done fold and the Inbox fold were two different components** doing the same job, one with a count
in parentheses and one with a pill.

**The first run pushed the page past the shell.** Three full template cards are taller than the column,
and unlike the task list nothing told them to scroll - so the very first screen a new person saw was the
one screen that did not fit. The day column also collapses on a first run, because there is no day to
draw there yet and the invitation was stranded beside an empty third of the screen.

**The clock button wrapped to a row of its own on a phone**, landing alone under the tabs with a hole
above the day.

**Stale copy**: the first-run note still offered "eleven color themes".

**And three more from the visual rounds** - a progress bar that was either a 420px loading bar or a 30px
stub depending on the length of the day name, gap labels that had become the loudest small text in the
panel, and cards blank down their right side.

**What was checked rather than assumed.** A full export/import round trip is byte-identical and keeps
the theme with its per-theme accent, density, text scale, the reminder, the inbox, the if-thens and
every task category. A backup written before any of these three waves imports cleanly, with every field
added since filled in at its default. Seven corrupt or hostile payloads are refused, including a `url()`
beacon inside an accent override and an out-of-range reminder interval. Corrupt storage loads as a clean
default rather than a white screen. And a day with twelve anchors and twenty cards re-measures and
re-renders eight times in 0.7 milliseconds, which is what makes a clock that ticks every thirty seconds
free.

## A rule with no goal is noise; under a goal it is armour

> **Superseded in v2.28.** Goals and rules were retired and North is one text; old goals and rules stay in the data but nothing shows them (see "North is one text, goals retired").

If-then rules shipped in v1.2 as their own board and stayed unread for eight
versions. The board moved to Settings; one rule at a time was surfaced onto the
day view, chosen by day type and time of day; that was unmounted again because
on a day with no eligible rule the line was an empty prompt in the one part of
the screen that has to answer "what am I doing now" in two seconds. Three
placements, and every one of them was a different answer to the same wrong
question - **how hard should a rule be surfaced?**

The right question was what a rule is *for*. An implementation intention is not
a reminder and not a task. It is a decision made in advance about a moment that
has not happened yet, and the reason it works is that when the moment arrives
there is nothing left to decide. That only holds if the person can remember why
they made the decision. A rule filed under a heading called "Rules" is a chore
somebody set themselves, and a chore somebody set themselves is the first thing
to go on a bad week - which is exactly the week it was written for.

So in v2.0 a rule belongs to a goal, and it lives under that goal in a window
of its own:

- **North is a view**, beside Calendar and Library, reached from the nav, from
  the North line under the day, and from the palette. It was a settings page
  and one line of watermark text, and neither of those is somewhere a person
  goes.
- **Each goal is what it already was**: what, why, who it makes you, an age,
  and nothing that measures anything. ARCHITECTURE section 6 governs the whole
  card and none of it moved.
- **Under it, "What pulls me off this"** - at most five lines, in the person's
  own second person: "If I catch myself scrolling at 23:00 -> phone in the
  kitchen, book in hand."
- **Two limits, both refusing rather than evicting**: four goals, five rules
  each. A cap that silently drops the newest entry is a cap nobody can see and
  a sentence somebody thinks they wrote down.
- **A rule appears in exactly two places** - the North window, and under the
  why on the card that comes forward after a slow day, introduced as "here is
  what you wrote yourself". Nowhere else, ever. Not in a gap, not as a nudge,
  not on the day view.
- **Nothing about a rule is measured.** No count of how often it fired, no
  done flag, no last-shown date. `lastSurfaced` existed for the rotation and
  went with it; the one rule the slack card shows is arithmetic on the date,
  which needs no memory. RESEARCH-ADHD section 12 rules out measuring these
  and this is the version of the feature that finally has nothing to measure.

**The migration is a question, not a guess.** `goalId` is optional, nothing on
load tries to work out which goal a sentence belongs under, and every rule
written before the change appears in the North window in its own group with
the goals offered beside it. A rule may sit there indefinitely: noticing what
pulls you off course is worth writing down the moment you notice it, and which
goal it belongs under is not always obvious then. The same group catches a rule
whose goal was deleted, because a dangling id degrades everywhere in this app
and degrading here means the sentence is still yours.

**What was given up.** Day-type and time-of-day scoping, the tag filter over a
flat list, and the rotation. All three existed to serve the surfacing that is
gone. The fields ride along untouched in a payload written before v2.0 - the
tables in `validate.ts` name what the app reads, not everything a stored object
may hold - so a backup from v1.11 restores whole and simply stops being
interpreted by machinery that no longer exists.

**Found on the way**: the demo's own rules had "If" and "then" inside the
strings, and every place that drew one put its own "If" in front, so the sample
data read "If If I open the laptop" wherever a rule was shown. It had been
that way since the demo was written.

## A week is a template, not seven of them

Building "my week" meant seven day templates, seven entries in the weekday
map, and seven places to edit when the gym rotation changed - which is six
more than anybody keeps up with. What it produced in practice was one
template called "Workday" stamped onto five different days and a Wednesday
that was quietly wrong, because the shape of a real week is not one day
repeated: the gym alternates, Thursday is short, and Saturday starts late.

So a template can be a week. The two kinds are **one entity**, and that is
the decision the rest follows from:

- `Template.kind` is `'day' | 'week'`, and **absent means a day**. Every
  template ever saved loads unchanged and stamps unchanged.
- A week template's blocks carry a `weekday`. Stamping a date takes that
  weekday's column and nothing else - `columnFor` in `stamping.ts` is the
  whole of the difference, and everything after it (matching by block id,
  keeping what a day earned, not duplicating a pushed task) is the same code
  for both kinds.
- `Template.weekDays` holds a per-weekday day type and sleep schedule.
  Absent means the template's own answer stands, which is what makes a week
  template that overrides nothing behave exactly like a day one.

**Why not a second entity.** A WeekTemplate type would need its own place
in `AppData`, its own table in `validate`, its own sync diff, its own
stamping path, its own editor and its own answer everywhere a template id is
resolved - and the thing it would be modelling differently is one filter.
Two entities that are 90% the same drift, and the 10% that differs is not
where the drift happens.

**The three things that make it not a chore.** Most of a week is the same on
several days, so "Add to" puts a block on several days in one press. Blocks
made together share a `groupId`, so the next edit can ask "this day, or
everywhere?" - and it asks it the way a repeating task already does, as a
standing choice above the columns rather than a dialog per press, because a
confirmation that appears every time you touch something is a confirmation
people learn to dismiss without reading. "Copy to" is the same idea for a
column somebody has already built, and a drag is for a block on the wrong
day.

**"Add to" was four named answers until v2.12, and real use overturned it.**
Written v2.0 and overturned 2026-09-09. The original argument, kept here
because it was not wrong about what it was looking at:

> Three named scopes and one picked day are four things to understand, and a
> chip for every combination is thirty-one. So: this day, the weekdays, the
> weekend, all seven - and a rotation is added a day at a time.

The owner then built a real 74-block week. Their training rotation is
Mon/Thu, Tue/Fri, Wed/Sat - three pairs, none of which has a name - so every
one of those blocks had to be added twice, once per day, and the count of
"eleven presses" in DAILY was a count of the easy week rather than theirs.

What the argument missed is that a chip per combination is not the only
alternative to a chip per name. **The days themselves are seven controls,
not thirty-one**, and seven switches say all thirty-one combinations
including the ones nobody would name. So the seven weekdays are the control
now, each turned on and off on its own, and the three names survive as
presets over them: Weekdays sets Monday to Friday, Weekend sets Saturday and
Sunday, All days sets all seven. Pressing one shows what it set rather than
lighting a chip, so the switches stay the only place the answer is kept -
CONVENTIONS section 23.

Two things make it hold. A line under the switches says what one press will
do - "Adds to Mon, Thu" - so nobody counts squares with their eyes, and it
turns into a count past four days because at that width the number is what
somebody wants. And the combination survives the add, so a rotation is set
once and three blocks are three titles. Grouping did not change at all:
blocks made together still share a `groupId`, and the standing "this day /
every day it is on" question is the same question.

**A week template fills the whole weekday map.** Choosing one for Monday sets
all seven, and clearing one of its days clears all seven. A week template's
Monday is not a template somebody could sensibly put on Wednesday, so a map
holding it on one weekday and something else on another would describe a week
that does not exist.

**Its card shows its shape.** Seven small bars, one per day. A day template's
card says its first four titles, which is the whole of what there is to say
about one; "23 blocks" says nothing at all about a week, and three heavy days
with a hollow Thursday is a fact you can read at that size.

**And it can start from a day.** Most weeks are one shape with three
differences in it, and typing the shape seven times to get at the differences
is the work this exists to remove. "Start a week from a day you already have"
copies rather than converting: the day template is untouched and still
stampable, because somebody trying this out should not lose the thing that
already worked.
## North is built once and left in peace

> **Superseded in v2.28.** North is one text written in one field - the picture, headings with their lines, and a signature after `---` - with no goals, rules, Compose, Monday card or goal switch (see "North is a text" and "North is one text, goals retired").

Until v2.1 a goal was written in Settings and read in North, on an argument
ARCHITECTURE section 6 has carried since v1.4: something you can rewrite from
the screen you look at every morning is something you will rewrite on a bad
morning, and a goal rewritten on bad mornings is a mood. The argument was
right and the placement was wrong. It was right about the *day view* -
nothing there edits a goal, and nothing ever will - and wrong about North,
which is not a screen anybody lands on by accident: it is the sixth icon and
the `6` key, and a person who is there has gone there. What Settings
actually did was make writing the goals feel like configuring the app, and a
direction filed between Sleep and Nudges reads as a preference.

The owner's brief, in their words: North is our goals, what we want and how
we get there - what we want and what we have to do to deserve it - how we want
to look and what that version of us does. The point is that we build that
version once and it stays in peace; we just live by it and always see,
somewhere, what pushes us forward - so that when you see it, it hits.

So in v2.1 North is written where it is read, and the shape of the writing is
what answers the old worry:

- **Four layers, one page.** The picture - who I am becoming, first person, a
  few lines - over the goals; under each goal what I do to deserve it, two to
  four concrete things done most days; under that what pulls me off it, the
  rules v2.0 built. Read from the top it is one text about one person, and
  that is the whole design: a page somebody reads on a Tuesday and recognises
  themselves in, not a list of targets. The typography does the work - the
  picture set like a preface, larger and looser than anything under it, a
  goal as a chapter, the deserve lines at body size, the rules a size down -
  and there are no boxes, because every box is a form field waiting to
  happen.
- **Built once.** The empty window asks for one line of the picture and
  nothing else. Everything after that is behind one quiet Compose in the
  corner, which edits every layer at once and saves in one press. That is the
  shape of sitting down to rewrite the page - a thing done rarely, on a good
  morning, with the whole of it in view - and not the shape of fixing one
  goal, which is the thing done on bad mornings. There is no Edit on a card
  and no Add beside a heading. The distance the old rule wanted is still
  there; it is a decision now rather than a tab.
- **Nothing measures anything, still.** The deserve lines are the closest
  this window has ever come to a checklist, and they are a plain list with
  nothing to tick, because the moment one of them could be checked off the
  heading above it would stop being true and the page would be a scoreboard.
  The Monday card repeats one of them for the week - "This week. train four
  times" - the same line from Monday to Sunday, and never asks whether last
  week's happened. RESEARCH-ADHD sections 7 and 12 are unchanged by this and
  are the reason it is a list and not a tracker.

**What Settings keeps.** Two switches - whether a goal may come forward after
a slow day, and on a Monday - because those are about when the app speaks,
which is a nudge, and they sit with the other nudges. The North section and
the Rules section are gone; one row in Nudges points at the window.

**The picture is one entity, not a settings field.** CONVENTIONS section 7
puts everything a person authors at the top level of `AppData`, because a
settings field is one sync entity and two devices editing two things in it
fight over one key. The picture is one thing, so one entity is exactly its
grain: `picture:north`, the singleton case of the rule rather than an
exception to it. The alternative, a string in settings, would have failed on
the erase - a blank body wins a merge and comes back, while an absent entity
is a tombstone and stays gone - and `syncMerge.test.ts` holds exactly that.

**What was given up.** The three-field goal form in Settings, the goal list
there with its Archive fold (Compose has the fold now), and the tour step that
walked into Settings to write a goal - it walks into North, picture first,
and ends where it always did, on the line under the day's title.

**Found on the way.** The North card's tests read the real clock, and the
card has a Monday version that says something different: the slack-card
tests passed six days a week since v1.4 and would have failed on the seventh.
They are pinned to a Wednesday now, with a Monday test of their own.
## The phone is walked, not only measured

> **Superseded in v2.7, in part.** The year's cells went with the Year view (see "The Year view goes").

The measuring pass had said for two versions that the phone was "two
controls": the quarter-hour arrows at 22px and the focus bar's exit at 30px.
Both are fixed in v2.1 and the pass reads zero on the phone. The walk that
followed - every screen at 390x844 in both themes with a full day, and then a
day lived in the app from a stamped morning to the evening close at three
sizes - found what a pass that is told what to look for cannot:

- **The quick-add panels were painted behind the task list**, on every
  viewport, since v2.0. Not a phone bug; a bug the phone walk was the first
  to open a panel in front of. The rule it became is in CONVENTIONS section
  4.
- **Ten surfaces dropped focus on close.** Escape on the task menu, the
  detail panel, replan, the gap picker, the shortcut card, the palette,
  scratch, the clock popover, the focus view and the gap offers all left a
  keyboard user at the top of the document. One hook, ten call sites.
- **A month grid was forty-two tab stops.** The day view's mini calendar
  and the calendar's month were both in the tab order cell by cell, and
  quick-add was the sixtieth Tab from the top of the page. Both are one
  stop now, with the arrows walking the grid and turning the month.
- **The floating timer covered the rollover line** at both desktop sizes,
  and sat on the navigation bar on a phone. The shell ends above it now.
- **The week's agenda reading was 30px rows and 19px date headings**, all
  of them buttons, and the template editor's remove cross was 23px wide -
  the smallest targets a finger was asked to hit anywhere in the app,
  neither of them on a screen the measuring pass opens.
- **A timer that ran out while the app was closed rang before any gesture**
  on the next open, and Chrome said so on the console. The chime waits for
  `navigator.userActivation` now; the widget and the notification carry that
  case.

**Why a stepper changes shape rather than growing.** The 44px overlay every
small control uses is a transparent square centred on the control, and two
of them stacked in one 44px column land on top of each other: the upper
half's overlay reaches into the lower half's box and back. There is no hit
area that fixes a stacked pair. So on a coarse pointer the pair is a row -
up beside down, 44px each - and every stepper in the app does it, not only
the one on the daily path, because a thumb is the same size on the template
editor as on the day.

**What the walk did not change.** The week view's blocks stay as tall as
their duration (a documented exception since v1.6); the year's cells stay
10px marks; the reorder grips stay 32px wide at 44px tall; the duration
chips stay 40px wide at 44px tall, because widening six of them wraps the
row; the time picker's rows stay 30px, because it is a scrolling column
and a taller row shows fewer hours. Each was in the phone checklist of the
time with its reason (HISTORY.md).

## Something came up is one sheet, for any day, and it proposes

> **Superseded, in part.** The calendar's door is the day card a press on a date opens (v2.8); nothing an interruption touches leaves the day - a routine block stays and the summary says "The routine stays", a one-off let go is set aside, "Set aside, waiting" (v2.5, see "Set aside, not deleted"); and the phone's bar is the seven views and Settings (v2.27).

Replan v1 answered one situation: a block that starts now, on the day being
looked at. The situation that actually happens is a phone call about another
day - "tomorrow at ten I need a hand", "Thursday afternoon" - taken with one
hand, with the caller waiting. v2.2 rebuilt the first door around that call,
and these are the calls made on the way.

**The sheet moved to the root.** It lived inside the day view because it was
about today. It is about any day now, and the week, the calendar's day
preview, the palette and a key all open it without leaving what they were
showing. `replanState` carries the day; the sheet reads everything else
from the store, and the other three doors stay about today whatever day was
asked for, because "everything from now" has no meaning on Thursday.

**Chips before words, and shapes before times.** A call rarely names a
length. "The afternoon" is what gets said, and asking for 13:00 and 300
minutes at that moment is asking somebody to translate. So the sheet's first
two rows are chips - when, and what is gone - and the shapes cut the waking
window at one and at six, because "after lunch" and "after work" are what
the words mean to the person saying them. A time and a length are still
there, one chip further along, for the call that did name one.

**Proposed, not asked.** Choosing when shows the plan at once, and a row is
pressed only to say otherwise. The proposal's one judgment is the one the
rescue already made in v1.9: a routine block - a template's or a repeat's -
is skipped for the day rather than moved, because the template makes it
again and a commute at nine in the evening is not a plan; a one-off is
fitted into a gap, key tasks first, or sent on. The summary says "Skipped"
for the first and "Dropped" for a one-off the person let go of, because the
first is not a loss and one word for both would have hidden that.

**The gaps after the interruption first.** With a day that has not started,
the morning is a real gap for a task the afternoon lost - v1 could only look
after a block that starts now. But given room on both sides, what the
afternoon lost goes into the evening: "I will do it after" is the reading a
person gives it, and lunch moved to eight in the morning is arithmetic
nobody believes.

**A chosen day is opened, not previewed.** The plan said the sheet would
preview a future day through the pure half of `ensureDay` without writing.
The first store test found the routine blocks it had skipped still sitting
at their times: a preview stamps its own copy of the template with its own
task ids, and a plan made against that copy names tasks the committed day
does not have. So choosing a day runs `actions.ensureDay` for it, exactly
as looking at it would - idempotent, and what the weekday map promised for
that day anyway - and `applyReplan` keeps its own ensure as the belt to that
pair of braces.

**Seven days from today, not Monday to Sunday.** A chip for a day that has
passed is a chip nobody can press, and "Thursday" said on a Sunday means the
one coming. A typed weekday means the next one and never today, the rule the
palette's date parsing already kept.

**The line and the chips are one truth.** A typed line that names a day, a
time or a shape wins and the chips redraw; a pressed chip takes that kind of
word out of the line. Rewriting the line to match the chip - quick-add's way
- would mean rewriting it in one of two languages, and taking the word out
costs nothing and cannot disagree.

**The free line lives before Accept, and not in the toast.** "Free tomorrow:
15:30-17:00, after 19:30" is the smallest thing in the feature and the most
useful: it is what gets said into the phone, and the moment it is needed is
before Accept, with the phone still at the ear. It was going to ride in the
undo toast as well. A five-window line wrapped the toast into a column seven
lines tall on a phone, and the toast went back to two words.

**A table of words, not a language library.** "ryt 10-13 tetis", "pn ryte",
"ketvirtadienį 14:00 dantistas 30min" are read by a list of the words that
get said about a day in either language - the weekdays and their short
forms, today and tomorrow and the day after, the four parts of a day, a
time, a range, a length. Every other word is the name, which is the safe
failure. Two of the Lithuanian short forms are English words, and each has a
guard: "an" before a vowel or an h is the article, and "St." is a saint. A
bare number is never a time.

**No door in the phone's bar.** The bar along the bottom is the six views,
Scratch and Settings, and an eighth icon at 390px is 48px each. The phone's
doors are the day header on today and any later day, the month through the
day, and the palette; the week's door shares the Grid / Agenda row rather
than costing the grid a fourth row of bar.

## A journal that never counts

> **Superseded in v2.5.** Everything below about the *shape* is gone - the
> three fields, the morning line, the two questions on the closing card,
> the best moment beside them, and `DayPlan.journal` as an object. It is
> one string per day now, written into one box that asks nothing. The half
> that survived is the half this entry was named for: it still never
> counts. See "A journal, not a form", below, and read this one as the
> record of how the app got there.

v2.3 added three lines a day: "Today: ..." under the North line in the
morning, and two questions on the evening close card - "What was real
today?" and "What do I want to tell myself tomorrow?". Plain text, optional,
no length. What it deliberately is not is the thing a journal feature
usually becomes.

**It never counts.** No streak of days written, no count of days not, no
badge, no reminder to write, no empty-state that says the week has nothing
in it. A journal that keeps score of itself is the report card the evening
card was built to refuse (CONVENTIONS section 15), arriving through a side
door. A skipped day costs nothing and shows nothing, anywhere: the agenda
shows a day's lines when it has them and nothing when it does not, and the
copy lists only the days with words.

**It lives on the day.** `DayPlan.journal` is one optional object with
three optional fields, and a field is absent when it is blank - the store
trims and drops on the way in. (One optional string since v2.5, with
`mergeOldJournal` folding the three old answers and the best moment into
it on load.) So a day nobody wrote on carries no key,
takes no bytes and changes no sync entity, and sync, the backup and the
snapshots carry the lines the way they carry the tasks without any of them
knowing the journal exists. No migration: three optional fields.

**The morning line saves when you are done, not as you type.** A controlled
field bound straight to a store that trims what it keeps eats the space
being typed. The draft is committed on blur, on Enter, and on leaving the
day - to the day it was typed on, which is the one detail worth naming,
because the cleanup that writes it runs after the screen has already moved
to the next day.

**The two questions sit under the best moment and do not replace it.** The
best moment has its own switch and its own place in the month's tooltips;
the journal has no switch of its own, because the owner asked for the
questions and a plain empty field is not a nudge. Three fields on one card
was measured on a phone rather than argued about: the questions and Close
the day sit inside a 390x844 viewport with nothing scrolled, and the
browser test holds it.

**The only way out is a copy.** Markdown, to paste into another chat: a
heading for the stretch, a section per day with words, the lines as a
list. Not an export format and not a sync target - the plan already has
three copies, and the journal is on it. The button is under the week and
under Review's arrows rather than in the calendar's bar, which on a phone
is three rows already and was kept to three in v2.2; greyed rather than
hidden when the stretch has nothing, because a control that only appears
once the feature has been used is a control nobody finds.

## The rail opens on intent only

> **Superseded in v2.6, in part.** Scratch's pen left the rail for the header, so the case below is focus handed back to any rail button after Escape (`NavRail.test.tsx`).

Since v2.0 the navigation rail unfolded to its labels two ways: a mouse
arriving on it, and any focus landing inside it. Both were argued for at
the time and both were wrong in the same way - they read a signal the
browser sends for its own reasons as a person reaching for the rail.

The owner watched it happen every day. Open or close Discord on the other
screen, or come back to the window, and the rail was out over the mini
calendar with nobody having gone near it. The cause is what a browser does
when a window gets its focus back: it fires focus again on whatever element
had it, and after a click on a rail item that element is the item. React's
`onFocus` is `focusin`, so the nav heard it, took it for a keyboard
arriving, and opened. A mouse arrival is the same shape of false signal:
the browser sends boundary events under a pointer that has not moved
whenever what is under it changes, so an enter alone says nothing about a
hand.

**Three ways in, each of them somebody meaning it.** A mouse that comes in
and moves, and is still inside `RAIL_OPEN_DWELL_MS` (150ms) after it came
in; a Tab that brings the focus in; and the pin. A move that reports the
arrival's own coordinates is the browser's, not the hand's, and is ignored;
a cursor crossing the rail on its way to the left column never opens it,
which was a small annoyance of its own. Only a Tab counts as a keyboard
reaching the rail, bracketed by its keydown and keyup: a focus that arrives
any other way - the window coming back, Escape handing focus back to the
pen that opened Scratch - is not a person arriving.

**An opening needs an arrival.** A press on an item, the pointer leaving,
or the window losing focus all end the visit, and a mouse that is still in
the rail after any of those does not reopen it by staying there. That is
what makes "never from the window's focus or blur" hold with the pointer
resting on the rail's edge: the blur closes it, the focus opens nothing,
and the next real movement in it is a new arrival.

**What it costs.** The labels come out 150 milliseconds later than they
did, and a keyboard user who reaches the rail by any road other than Tab
sees the icons with their tooltips rather than the labels. Both are the
right trade against a sidebar that opens on its own several times a day.

The six cases are in `NavRail.test.tsx`: the dwell and not a moment before,
a still pointer, a crossing pointer, the window coming back with the focus
on the item last pressed, the window losing focus with the rail open, and
Escape handing the focus to the pen.

## A low day is the 40% doctrine as one press

> **Corrected at the freeze.** RESEARCH-ADHD.md no longer states a 40% rule - it was rewritten on 2026-09-01, and its only 40% is a figure it debunks - so the number below is this app's own rule rather than the research's: the key tasks at 40% of their length, and the day scored on them.

RESEARCH-ADHD.md's 40% rule has been in the docs since v1.0 and in the
evening close's "enough" threshold since v1.9, and until v2.4 nothing let
a person act on it in the morning. The plan written for a good day sat
there on a bad one, nine blocks deep, and the honest answer - do the two
that matter, at a size you can face, and let the rest wait - was eight
edits away. That is exactly the arithmetic the brain answers with "the
whole day is gone", which is the failure every replan door exists to
prevent.

**One press, proposed first.** Low day, beside Replan under the date, opens
the same sheet the other doors use and shows what it would do before
anything moves: the key tasks stay at 40% of their length, on the
five-minute grid a plan is made at and never under fifteen minutes; the
routine blocks - a template's, a repeat's - stay exactly where they are,
because the shape of the day is not the problem; everything else that is
not done goes to tomorrow at the time it had. Accept is one commit with
one undo. Nothing is asked, because on the day this is for a question is
a cost.

**The day is scored on its key tasks alone.** That is the whole of what the
40% rule means and the part the score has to keep: fifty minutes of the
thing that mattered is a day that went well, and a score that counted the
routine beside it, or the tasks that waited, would be a report card about
a day the person had already decided the shape of. A low day with no key
task has nothing required on it and reports no plan, by the same rule as a
shift day with no core task. The mark is a quiet pill under the date and
the calendar's measure of the day keeps the same count; nothing anywhere
counts how many days were low.

**Key wins over routine.** A standup marked key is the standup that matters
today and is kept and cut like any other key task; a routine block that is
not key is left alone rather than cut, because cutting a commute makes no
sense and cutting lunch is not a plan.

## A step can carry a timer

> **Superseded in v2.13.** Steps are gone - each became a line of the note beside it (`stepsToNote.ts`) - and nothing starts the timer from a line; it is started from the clock or the palette.

The owner's morning is one block with four steps - water, ten minutes of
meditation, gratitude, a page of Pressfield - and until v2.4 the one step
with a length had no way to be timed except by opening the clock, typing
ten, and remembering which step it was for. Four blocks on the grid would
have timed it and would have been wrong: a ritual is one thing you do, and
the grid's job is to say when the day's things happen, not to list the
parts of one of them.

**A step's length is read off its line.** "Meditation 10 min" is a step
called Meditation that takes ten minutes, through the same trailing-length
grammar quick-add reads a task with - and the same refusal: "Read 20
pages" keeps its twenty. Nothing new to learn and no second field.

**It starts the timer the app already has.** There is one timer,
deliberately (see the clock's own section above), and this does not add a
second: a tap on the minutes beside a step starts that one for that long,
with the step attached as a pointer - the date, the task, the step - the
way a focus session points at a task. The widget says which step it is
running for, and a reload in between keeps the pointer.

**The bell ticks the step.** The tab that watches the timer run out sets
the step done, through an action that only ever sets it and never toggles
it, so a step ticked by hand while the timer ran stays ticked, and a step
or a task gone by then is nothing to tick. The chime is the timer's own,
quiet one.

## The pixel standard

> **Superseded in v2.5, in part.** The self-check counts its shapes rather than stating a number, and checks eleven now (see "A tool that cannot see a thing will say it is fine").

The owner's sentence, from the v2.4 brief: text that looks even slightly
off, a gap too wide or too narrow, is a defect, not taste. This is what
that means in practice, because "looks right" is not something a test can
be written against and every one of these can.

**A size is a token or it is a defect.** Two scales, in CONVENTIONS
section 5, and `scale.test.ts` reads the stylesheet and fails on anything
else. It reads whole lines since v2.4, not first columns, which found
twenty more literals hiding inside one-line rules.

**Four sizes on a screen.** Not counting the input floor, which exists so
iOS does not zoom a field, and the glyph size, which is an icon drawn in a
font. A fifth size is a screen with no hierarchy. The browser's own 16px
is not on the scale, so the body says its size and a button inherits it -
until v2.4 every unsized button, a template card's name and a step's title
fell through to 16 and were that fifth size on four screens.

**What is painted under a thing is part of the thing.** A ring's gap is
drawn in `--ground`, which the body sets to the page and each surface sets
to itself, because a gap in the card colour on a row that sits on the page
is a halo, and the owner saw it as a ring that was not clean.

**A box-shadow needs its room.** It is drawn outside the box, so a
scroller between it and the page clips it. The first swatch under
quick-add lost the left of its ring for one commit, to a flush left edge
that read better in the stylesheet than on the screen.

**The measure is the sweep, and the sweep is measured.** `npm run sweep`
walks every screen at every promised size in both themes and reports text
cut off, text over text, a control covered, anything past the right edge,
a screen that should fit and does not, text under AA against what is
actually painted under it, and since v2.4 a chosen swatch's ring cut off
or drawn on the wrong ground. `--self-check` plants one of each and fails
if the pass has gone blind: seven of seven. Zero findings is the expected
state, on the desktop and on the phone.

**Reading a colour is part of reading the screen.** Chrome hands a
`color-mix()` back as `color(srgb ...)`, which the audit's parser read as
no colour at all, so every wash in the app was invisible to it. Five
strings had been sitting under AA behind that: the month cell's "+", the
scratch timestamp, the week's finished blocks in the light theme, the
palette's detail line on the selected row.

## Notes are notes

Scratch had #tags from v1.8: a word with a # in front of it was a filter,
a row of chips sat above the stream, and the #bug ones could be copied out
as a markdown list for a bugfix prompt. All of it worked. The owner never
used any of it, and said so plainly - the tags come out.

**Why it was worth removing rather than leaving alone.** An unused feature
is not free here. This layer exists for one moment: the second between
noticing something and losing it. A tag is a small question at exactly
that moment - which word, is there one already, does this belong with
those - and a question at that moment is the thing scratch was built to
not have. The chips above the stream said the question was there even on
the days nothing was tagged, which is a cost paid every time the box is
opened by a feature used none of the time.

**The text is now the text.** Nothing is parsed and nothing is coloured.
A note reads back exactly as it was typed, which is also what makes the
next thing possible: a photograph in a note is an attachment, and an
attachment on top of a parser is two kinds of structure in a layer whose
whole promise is none.

**Old notes are not touched.** A # written when it meant something stays
in the sentence as a character. No migration, no rewrite, nothing to
explain the next time an old note is read: it says what it said.

**What is left is the way out, which was never a question.** A leading
"!" or the Note/Task marker sends a line to the inbox (Later, since v2.7) instead, and it is
decided before Enter rather than after. That is not structure asked for
at the moment of writing; it is the same one keystroke either way.

## A photograph stays on the device it was taken on

A note can hold pictures since v2.5, because a screenshot is a note taken
with a camera instead of a keyboard: a meal plan, a receipt, a whiteboard,
the error the app just put on the screen. Where they are kept was the whole
of the decision.

**Not localStorage.** The plan lives under one key with about five
megabytes for all of it. One photograph eats that, and the failure would
not be a picture that did not save - it would be the next `saveData`
throwing with a day's edits in hand, sync stopping, the backup refusing.
The blobs are in IndexedDB in a store of their own, and the note holds an
id and two numbers.

**The two numbers are the picture's shape**, and they are the reason a row
of thumbnails does not jump about as three blobs come back from the
database at three different moments. Two numbers on a note is a cheap price
for a row that is still while it is read.

**Not in the sync payload.** Sync moves entities as JSON through a small
server on the owner's own machine. A base64 photograph is a hundred times
the size of everything else that ever crosses it, and the merge has no use
for the bytes: a note is a note whether or not this device can show the
picture. So the id travels and the picture does not.

**Not in the backup either.** The backup is a file the owner is meant to be
able to open and read on the day something has gone wrong; that is what it
is for. Base64 turns it into a wall of characters and takes a two-hundred
kilobyte document into the tens of megabytes. The exported file names the
pictures and says, in a sentence at the top, that they stayed where they
were.

**So the other device says so, in words.** Opening a note written on the
phone shows "Kept on another device" in the space the picture would fill.
Not a broken frame, not a spinner that never ends, not an error: the design
working, stated. The owner is told the same thing in DAILY.md, so it is
never a surprise.

**What this costs, said plainly.** A screenshot taken on the phone is not on
the laptop, and never will be. That is a real loss and it is the right
trade: the alternative is a sync payload and a backup that both break at the
size of one photograph, which loses everything rather than one picture. If
it ever wants solving properly it wants a blob store of its own beside the
sync server, which is a different feature with a different brief.

**And nothing is left behind.** Deleting a note deletes its pictures; undoing
that delete puts both back, because the undo is holding the blobs it just
took out. A sweep on every open deletes any blob no note points at, for the
delete that was interrupted by a closed tab and for the device that synced a
note's deletion without ever having had the picture.

## Set aside, not deleted

The owner's scenario, in their own words: you replan an evening without
knowing how long it will take - "something this evening" - and something
comes off the day. That something must not disappear. It stays, faded, and
one press puts it back when you get home.

Until v2.5 a block an interruption took off was deleted, and a repeat
instance had its series id written into the day's skip list so the rollover
would not put it back. Both of those are decisions the app made on
somebody's behalf at the worst possible moment: during an interruption,
about a thing they had not decided to give up. Nobody presses "drop"
meaning "delete this for ever"; they press it meaning "not now".

**So nothing leaves the day.** A block taken off gets `setAside` and stays
where it is in the data. `isAnchor` is the one gate that decides whether a
task is on the clock, so one line there takes a waiting block out of the
timeline, the capacity line, the gaps a replan packs into and the conflicts
an interruption can have - all at once, with nothing to remember in five
places. No skips are written any more, because there is nothing for a skip
to prevent.

**The shelf is the quietest thing on the screen.** A label, a dashed chip
per block with its length, and nothing else - no count, no clock, no
colour. A block waiting is not a failure and the strip must never read as a
list of them.

**Coming back is proposed, not asked.** One press shows where it would go
and how long it would be; a second takes it. The first free stretch from
now that holds it whole, or the nearest one worth using with the block cut
to fit - and it says which, in one line, without ever counting what was
missed.

**Two floors, and both are about what the block is.** Never under fifteen
minutes, because under that it is not a sitting; and never under half of
what it was, because forty minutes of a two-hour deep work block is not
that block shortened, it is a smaller thing wearing its name. Under either,
the answer is tomorrow at the time it had.

**It closes after midnight, without a word.** A day that is over has
nothing to bring anything back into, and a shelf that survived the night
would be a list of yesterday's leftovers waiting on the next morning -
which is exactly the counting CONVENTIONS section 12 forbids.

**And an interruption nobody could put a length on leaves the day away.**
That is what `away` already means, so the header offers "Back" without
anything new being invented, and the rescue recomputes from the moment it
is pressed rather than from a length nobody had at the time.

## A journal, not a form

v2.3 built a journal as three questions on a schedule: a line under the
North line in the morning ("Today: ..."), and two on the evening close card
- what was real today, and what to tell yourself tomorrow. A best moment
sat beside them on its own switch. All of it worked, and all of it is gone.

The owner's verdict, in their own words: a journal that opens by the timer
and the notes, showing the day, free roam, write what you want - and of
everything else, "fuck it, too much".

**A form asks on a schedule; a journal waits.** The difference is not the
number of boxes, it is who decides there is something to say. Three empty
fields appearing every evening is a question asked whether or not anybody
has an answer, and the honest reply on most evenings is nothing - which
turns into skipping the card, and then into dreading it. That is the exact
failure this app exists to avoid, built into the one place meant to be kind.

**So: a day, and whatever you wanted to say on it.** One free text field per
day, on its own button in the header beside Notes, reachable from anywhere
with `J`. It saves while you type and there is no Save button, because
there is nothing to decide. No questions, no fields, no length, no prompt
beyond a quiet "Whatever today was".

It was the clock panel's fourth tab when it was built, on the reasoning
that the clock is the one control on screen from every tab. The reasoning
held; the shape did not. A timer and a stopwatch are the same kind of thing
at different moments, which is what tabs are for - a note and a journal
entry are not that, and neither of them is a clock, so reaching a line
somebody wanted to write meant pressing a picture of a clock and reading
four labels to find the one that was not about time.

**And nothing counts.** No streak, no run of days, no mark for a day with
nothing on it, no "you missed a day". Most days have nothing on them. The
full view shows a month with a quiet dot on the days that have something,
and a dot is a mark rather than a score.

**Notes and the journal are different things, and the difference has to
stay obvious**, or they are two of the same box in two places. A note is a
thought caught on the way past: short, undated in any way that matters, and
it turns into a task. A journal entry is a day: dated, kept, turned into
nothing, read back later. Notes is for doing; the journal is for
remembering. The panel says so where it is easiest to confuse them.

**Nothing anybody wrote is lost.** `mergeOldJournal` folds the three old
answers, and the best moment beside them, into one entry for that day - in
the order the day said them, one per line, with the labels dropped. The
words are what was kept; the questions they were answers to are the thing
being removed. It runs in `normalizeLoaded`, so it happens once on load,
a v2.3 backup still restores, and nothing downstream ever sees two shapes.

**The way out is a copy, and the month is the one that matters.** A day, a
week or a month as markdown, days with nothing skipped. The owner's use is
a month of writing pasted into a conversation in one press. The day sits
beside it for the narrower thing - what was written this morning and
nothing else - and the week already had its own button under the week view
and in Review.

**And the calendar in that view carries no template wash.** The day view's
month colours a day by the template stamped on it, which is the right
answer to the question that calendar is asked. Here the question is which
days have writing, the answer is a quiet dot, and a month of blue and green
squares with two small dots in it reads as a month of templates. So
`MiniCalendar` drops the tone whenever it is given marks - the journal is
its only caller that marks - because two answers at once means the louder
one wins.

## A setting has to earn its place

> **Superseded in v2.28, in part.** The one switch for the goal card went with the card, and `afterASlowDay` is still written for older devices while nothing reads it (see "North is one text, goals retired").

Settings accumulate. Every one of them was a good idea on the day it went
in, and none of them ever comes out on its own, so a settings screen is a
museum of every question the app has ever wanted to ask. This one had grown
to five sections and a Nudges list of four switches, most of which had never
been touched.

**The rule, written into CONVENTIONS section 21:** a setting stays only if
the owner would actually change it from the default **and** the app cannot
decide correctly itself. Both, not either. A preference nobody would change
is clutter even when the app genuinely cannot guess it. A preference
somebody would change is still clutter if the app can simply be right.

**What went, and why each failed:**

- **"Nudge during focus work"** and **"Before a timed task"**: both could
  only fire while the app was already open and being looked at, because
  the service worker has no push handler and there is no push
  subscription. A reminder that arrives only when you are already there is
  not a reminder. Real ones are parked in BACKLOG.md.
- **"And on a Monday"**: the Monday goal card and the slow-day goal card
  are the same card in two moments. Nobody has ever wanted one without the
  other. One switch now carries both.
- **"Ask for the best moment"**: the journal covers it, and asks nothing.
  Existing best-moment answers were merged into that day's journal entry by
  `mergeOldJournal`, and the calendar's dot now means "there is writing on
  this day". See "A journal, not a form".
- **The whole "North" section**: it said what the North tab says, which is
  the sixth icon and the 6 key.
- **`enabledWidgets`**: a stored list of which day-view widgets to render,
  on a registry that has held one widget since v1.2, with no control
  anywhere that could change it. It failed rule 1 absolutely - there was no
  default to change it from - and had been carried in types, validation,
  sync and every backup for three versions.

**What survived, and why.** Everything under General is an action rather
than a preference: exporting, importing, installing, restoring a snapshot,
replaying the tour, erasing. An action has no default to change from, so
the rule does not reach it. Calendars, Backup and Sync are the owner's data
and the ways out of this app. Sleep profiles, Categories and the week's
template map are named in the rule itself as never removable. Theme, accent,
density and text size are all rule 2 in its purest form: the app cannot know
which room somebody is in or how good their eyesight is, and text size in
particular has no fallback, because the type scale is in pixels and a
standalone PWA on iOS has no browser zoom to lean on.

**Removing a setting means removing the code.** The field goes from
`types.ts`, `validate.ts`, `syncEntities.ts` and the backup. Migration is
silent: settings normalise by spreading what was stored and then correcting
it - the fix for an older bug where an optional field added later was lost
on every load - so a removed field left unnamed would ride along untouched
and be written back out forever. `REMOVED_SETTINGS` in `storage.ts` names
each one and deletes it on load, and that list only ever grows. Validation
is deliberately not tightened against a field this app used to write: an old
backup has to keep opening, which is the one promise a local-first app's
backups may never break.

## A tool that cannot see a thing will say it is fine

This app has a measuring pass because looking at screenshots does not
scale: `npm run sweep` walks thirty-odd screens at three widths in two
themes and reports sideways scroll, clipped text, text over text, covered
controls, broken focus rings and anything under AA. It has been reporting
zero for three versions.

It was wrong about a whole category, and the way it was wrong is the part
worth keeping.

**Opacity.** The contrast pass read an element's `color` and the surface
under it. It never read `opacity`, so an element faded to 0.45 was measured
as though it were fully painted. Every fade in the app - and fading is how
half this interface draws its hierarchy - was invisible. Once the pass
multiplied the colour's alpha by the painted share, 858 strings came back
under the line, from a stylesheet that had reported clean since v2.2.

**A field's text.** The same walk collected child text nodes. An input has
none: what it shows is its value. So no field's contents had ever been
checked, and every time picker in the app - Settings' evening and both
sleep windows, the task detail, the template editor - had been painted pure
black on a dark surface at 1.14:1 since the stepper fix earlier in this
same wave excluded `.time-input` from the base input rule and took its
colour with it.

**The clock.** The sweep ran at whatever hour somebody ran it. Half of what
this app draws depends on the hour, and a run at midnight has no running
task, no now line, and nothing greyed out to look at. The replan door's
"Morning gone" at 2.4:1 was found by looking at a phone screenshot, because
the sweep that had just passed had run at one in the morning when nothing
was disabled.

**And the self-check had the same disease.** It plants six defects and
checks the pass still sees each shape. It read its baseline while the app
was still fading its first screen in, counted fourteen mid-animation
strings, and then declared the contrast pass blind because planting one
more defect did not raise a number that had been inflated by animation. A
measurement taken during an animation is not a measurement.

**And a fifth, found by asking the question the other four taught.** A
chosen control drawn exactly like the ones beside it. The owner reported
this shape twice - the category swatch whose ring was clipped, and the week
template editor's "Add to" row where all four chips carried the same border
- and both times the fix was a stylesheet line and a unit test asserting a
class. Neither could catch it happening somewhere else: `aria-pressed` is a
string in the DOM and a test asserting it passes whether or not anything is
drawn, and the contrast pass reads one element at a time with no opinion
about two of them looking alike. The sweep compares a set control against
an unset sibling now, on six properties, and the self-check plants the
owner's own bug to prove it still sees it.

**The shape, and it is the thing to remember.** Each of these is the same
mistake: *the tool could only see what it had been told to look at, and
silence was read as absence.* A clean report means "nothing was found",
never "nothing is there", and the difference is exactly the size of what
the tool cannot see. Every one of these four was found by a person looking
at a picture, not by the tool, which is the whole argument for still
looking.

So the pass now reads the painted share, reads a field's value, walks a
pinned afternoon with `--hour=` for the others, settles a page before
reading it, and checks that a chosen thing looks chosen. The shape count in
the self-check is counted rather than written down, because a hardcoded
seven is a line that starts lying the first time the list grows - which it
did, the same day. What it found is written up in CONVENTIONS section 22: push
something back once, never below 3:1, one `--faded` token, and a filled
button that stops being filled rather than fading.

## Once and only once

> **Superseded in v2.24, in part.** The now line carries a small marker in the hour column that says the minute, because the grid's hours are not evenly spaced.

The owner's brief for v2.6 opened with two lines under Today's header:
"Timed tasks: 6h40. Free: 9h20 across 8 gaps." and "Sleep 23:00-07:00 (8h)
is not counted as free." - useless, in their word, because every number in
them was in the rail's card two inches to the left. The principle they
drew from it governs the whole wave and is CONVENTIONS section 23:
information appears exactly once, and the same number in two places means
one of them is not needed.

**What went, and where each thing now lives.** The capacity sentence is
not drawn at the wide breakpoint; the card carries the two facts it did
not - "8 gaps" beside Free, "not counted" beside Sleep - as small grey
notes, and somebody else's calendar as a Calendar row on the days that
have one. The card's ring and its Done row went with it: the header's bar and
fraction already say how far the day has come, and a ring saying it again
a hand's width away was the same number three times on the one screen the
app is opened to. The now line lost its clock chip, the running card its
countdown, the empty stream one of its two empty states, and six tooltips
that only repeated the visible text were removed rather than converted.
The closing card's lead lost its "sleep in 1h", which the header says in
the same hour; Review's count lost the percentage beside it; and while a
focus session runs on the running task, the header keeps the clock alone
and leaves the task and the countdown to the strip that is already saying
them with the session's own controls.

**What stayed, and why.** The timeline and the task list say the same day
twice on purpose: a calendar and a list are two readings of one day, and
the two side by side is the whole of the wide layout. Up next in the rail
was kept as a pointer rather than a figure. A time on the hour scale
beside the same time on a card is a coincidence.

**What it cost.** The ring was the one shape in the rail; the card is four
rows of type now, and the rail is quieter for it. The now line is a line
and a dot, and a person reading the minute reads it off the header. Both
are the trade the principle asks for, and both were checked on the screen
before being kept.

## Nothing moves on hover

> **Superseded, in part.** The North line has no peek - it is one line of North's own text and a press opens North (v2.28); there is no Monday card (v2.28); and the single pane grows to 1336px, the shell's 1600 with the rail (v2.7).

The owner's words: a pointer resting on something may show something, but
may not push anything that is already drawn; a layout shift under the mouse
is a defect, not a style. It came from the North line, whose peek - the
why and the identity under the goal - opened in the flow and slid the
whole day down two lines every time the cursor crossed it, which on a line
the width of the header it does on the way to almost anything. CONVENTIONS
section 24 holds it; this is what it changed.

**The peek is a bubble, and the row is one height.** Positioned under the
line with an arrow, in the explanation bubble's own surface; the row is
exactly one line of the title's type whatever the goal says; the only
thing that changes in the line itself is its ink.

**Every tooltip sits under its control.** Native `title` tooltips land
wherever the browser puts them - on the words, as often as not - so they
are gone. The words moved to `data-tip` and one element at the root draws
them in the window, under the control with an arrow, above it when there
is no room, beside it in the rail, 400ms after a mouse rests and at once
for a keyboard. In the window rather than inside the control's box, because
the rail is 56px wide with overflow hidden and a bubble inside it was a
bubble nobody saw. Found on the way: the rail scrolls itself a pixel when
a control in it is brought into view, and the first version cancelled
every pending tooltip on any scroll.

**Seven hovers stopped moving.** The accent swatch grew by twelve percent;
the theme card rose two pixels; the category chip, the day arrows, the
timer presets, the rollover button and every draggable block rose one.
None shifted anything else, which is why they survived the v2.0 rule about
hover and layout. Each keeps its colour, edge or shadow change and loses
the transform, and `hoverStillness.test.ts` reads the stylesheet so no
hover rule can set a moving property again.

**The Monday card is a sheet.** The same rule from the other side: a card
that arrives in the flow above the day and leaves again moves the day
twice, and on a 768px screen it took a fifth of the day away while it
stood. It is a sheet with the task sheet's backdrop and rise - a moment,
shown once and read once - and Ok, Escape and the backdrop are the same
read. The evening close stays in the flow on purpose: it arrives at a set
time while somebody may be typing, and a sheet that lands mid-sentence is
worse than a card that pushes.

**One pane fills its width.** Not a hover, but the same family of
complaint - the content not where the eye expects it. Pressing Calendar or
Tasks centred the rail and a 760px pane in a 1568px row and left 272px of
nothing either side, with the header at the row's edge over content that
started a hand's width in. The rail and the pane are one block now,
centred by its own max-width, header included; the pane grows to 1080px,
which leaves no band over 120px at 1920 and fills the row at 1366 and 1600.
The v2.4 worry about a thousand-pixel block was about the two-pane layout,
where the task list was paying for it; alone on a screen, a timeline is
allowed the width a calendar takes.

## The arrows come back, and the date stops moving

> **Superseded in v2.9.** On a wide screen both arrows stand together at the left of a block the month's width, with the day's word beside them and the date under it, and the hidden ghost is gone (see "Both arrows stand inside the month they point at").

The arrows either side of the date came off the wide header after v2.5
because they overflowed: the owner saw them out where they should not be,
and the month in the rail had its own pair, so they went. The v2.7 brief
reversed that with a rule worth keeping: the answer to a control that
overflows is not to remove the control but to make overflow impossible.

So the header carries them again at every width, 44px squares as they are
on the phone, and the date sits in a box that cannot change size: a hidden
copy of "Wednesday, September 30" - the longest title the app can print,
in the title's own type - is stacked under the visible title, so the box is
always that wide and the right arrow stands at one x on every day of the
year. The arrows and the title are one flex item that does not wrap, so
the row cannot break between them. Measured at 1366x768 with the fullest
header Today draws - a running task, a key count, Replan and Low day - the
long name fits with room, so the shorter form the brief allowed ("Wed, 30
Sep") was not needed and is not built; below the wide breakpoint the ghost
is not laid out at all, because a 360px phone cannot spare a 240px box and
its title was always allowed to shrink between the arrows.

The rest of the row followed. The two zones of the fullest header - a
running task, a key count, Replan, Low day and now the arrows - need about
1530px, so at 1366 the right zone goes down a line whole, as v2.6 decided,
and it cannot do otherwise in 1004px. From 1500, where the masthead spans
the rail, the zone is given a flex basis of zero, so the row never breaks
on the zone's content width and what gives is the running task's title,
which ends in an ellipsis: 132px of it at 1500, most of it at 1600, all of
it at 1920. And the single pane grows from 1080 to 1336px, which with the
rail is the shell's own 1600 - the width the calendar takes - because at
1080 the toggle stood under the chip in the Calendar and Tasks views on the
owner's own 2000px desktop, the two views the brief said to check.

The chip beside them, which said which template the day came from, sat at
its own height - a 24px pill in a row of 36px controls - and the toggle
that says which panes are showing and the toggle that says what Enter does
were two different heights and two different type sizes. They are one
control drawn three times now: the same box, the same type, the same
baseline, and the field's toggle takes the header toggle's tinted fill
rather than the solid accent the rest of the app's segments use, because
what is in force is a fact and not the loudest thing on the screen.

## The chip asks before it replaces

Every press on a template chip in the rail used to stamp the open day
again, with an undo. A press on the template already there rebuilt its
blocks and snapped any block that had been moved back to the template's
time; a press on another template replaced the day's blocks with no
question asked. Three cases, three answers now, and only in the rail - the
week's column menu, the calendar's staged stamp and the weekday map keep
their own doors as they were:

- **The template already on the day** does nothing and says so, in one
  line under the chips: "Already on this day". No commit, no undo offer,
  and the line leaves on the next press or after three seconds. This is
  rule 11 of section 12 made visible: twice is once.
- **Another template** asks one question in the same place: "Replace
  Working day with Rest day? Blocks you added by hand stay." with Replace
  and Cancel. A hand-added block - anything without `fromTemplate` - was
  always kept by the stamp; the sentence says so because the person about
  to press does not know it. The question clears on Cancel, on any other
  press and when the day changes.
- **An empty day** is stamped at once, as it always was.

The question is asked in the rail rather than in a sheet because a modal
for a one-line question is a second surface for one decision, and the
press was made here.

## Three arguments the docs do not make

RESEARCH-ADHD section 14 named three things the research refuses that the
app's own reasoning might have leaned on, and the owner accepted all three
when the app closed. Before rewriting anything, every living doc - this
file, CONVENTIONS, ARCHITECTURE, DAILY, README, and the copy in
`explain.ts` and `tour.ts` - was searched for "Zeigarnik", "decision
fatigue", "ego depletion" and "evidence shows". The terms occur only in the
research documents, where they are named in order to be refused, and in
"The push bound is a design choice" above, which refuses them. So nothing
had to be taken out. What follows is what each of the three rests on
instead, written once so the next person does not reach for the popular
version.

**Capture does not rest on the Zeigarnik effect.** The famous claim - an
unfinished task occupies the mind until it is written down - does not
survive meta-analysis (section 6: the recall ratio pools to about 0.99).
Scratch, Later and the field that writes to either rest on two narrower
things. One study, without an independent replication, found that writing
a specific plan removed the intrusion of an unfinished goal even though the
goal stayed unfinished (Masicampo and Baumeister 2011); it is plausible and
evidenced once, and that is the strength it is given. The other is the
maintenance burden: a thing that has to be written down in the next second
is lost if the app asks a question first, and an app that loses what
people bring to it is one they stop bringing things to (section 11). The
features stay; the reason is that one.

**The no-new-decisions rule does not rest on decision fatigue.** The rule
- no change may add a question before the day can start, and no feature
may cost one more decision a day - is CONVENTIONS section 25 now, and it
was never argued from a battery that each choice drains: ego depletion, the
theory under that picture, came out at d = 0.04 across twenty three
laboratories (section 9). The reason that holds is the planner-abandonment
literature (section 11): the time cost of upkeep is a leading cause of
people quitting a tool, a median of seventy percent inside a hundred days,
and a planner whose upkeep needs the executive function it exists to lend
is self-defeating. Every extra step is another place to leave.

**The proportional grid is not evidence-backed, and says so.** "The
timeline grid changes how the day feels, not how much gets done" above
already states it: no study compares a proportional-height grid against the
same day written as text, in any population. The grid is a reasoned design
choice consistent with Barkley's point of performance - information present
where the behaviour happens - with no direct study behind it, and nothing
in these docs says "the evidence shows" about it. The one adjacent result
(Hallez and Vallier 2025) found a visible timer changed anxiety and
attention, not accuracy, which is the claim the app makes and the only one.

## The mini calendar's cells stay at 33px

`MiniCalendar.tsx` in the day view's rail draws a seven-column month inside
a rail that is `minmax(200px, 240px)` wide, which comes out at 33px cells at
every width from 1280 to 1920 because the rail's own cap holds it there.
Every other control the app draws holds the 44px touch target, and this one
was built under it on purpose rather than by silently narrowing the rule
for one control: `.mini-cell` in `styles.css` says so beside the number.
It sat in OPEN-QUESTIONS from v2.0 to v2.7 with a recommendation to leave
it, and the owner accepted the recommendation when the app closed.

The reason it stays: the mini calendar is a way to another day, not a
surface anybody spends the day tapping - it fires once per navigation and
never per task - and it is the desktop's control; the phone has no rail
and its header carries the day arrows at 44px instead. The two honest
fixes were both visible trades and neither was worth making: widening the
rail past 240px takes about 320px to clear 44px and every one of those
pixels comes out of the day pane or the task pane, which were sized to fit
1024px together; and thinning the grid to fewer weeks or a list would make
it a worse calendar to save a target the finger does not use. If a real
tablet ever shows it matters, those are the two changes, in
`MiniCalendar.tsx` and `.mini-cell`, and nowhere else.

## A task's title is a 29px target, on purpose

`.task-title-select` is the title of a float - a task on the day with no
time - and doubles as the control that selects it for the gap offers. It
escapes the 44px floor: holding 44px there made a float's card sixteen
pixels taller than an anchor's, measured at 66px against 50px in the same
column, because this button is the tallest thing in the title row, and a
list whose rows change height by whether a task happens to have a time is
a list that is harder to scan - which is the only job that list has. The
padding gives the control a hit area 29px tall running the full width of
the title, and a negative margin keeps that area out of layout so the card
stays the height of its content.

It stays as built, with the owner's word. A target 29px tall and 200px
wide is a different thing from a 29px square - the dimension a thumb
misses on is the one this keeps generous - and the same card's actions
menu sits at the full 44px and reaches the same placement, so nothing here
is the only way to anything.

**The thing this entry said to check turned out to be true.** The hit area
was four pixels above the words and four below, and the four below hung
over the meta line under them: at 1600x900 the closing sweep read the
bottom of the title and the size chip as two pieces of text painted over
each other, which by four pixels they were, and had been since the negative
margin was written. All of the room is above the words now - the same 29px,
out of layout the same way, and above a title is the card's own padding
rather than anybody's text. The target did not shrink and the entry stands;
only the direction the box grows in changed. If real hardware ever says otherwise, the fix
is a fixed content height on the label row with the hit area extended on
both axes by the same padding-and-negative-margin, and then a check that
the selected state's outline does not cross the meta line under it, which
is why it was not done that way first.

## Later, where two shelves were

Until v2.7 a task that was not for today could be in an Inbox - a line
nobody had decided about, kept exactly as typed, newest first - or in a
Backlog - a decided task with no day, in the order you would pull it, with
a size and a category if you gave it one. Two shelves, two folds under the
day's list, two words on the field's toggle, two ways out of Notes. The
v2.7 brief set one test for the pair: a sentence, from the owner's side,
that tells an Inbox line from a Backlog item. If it could be written the
two would stay; if not, they would merge.

The honest sentence was "by which fold it is under". The rows looked the
same. Both had the same two ways out - this day, or gone. And "decided",
the word the Backlog was built on, was never visible on a row: a line sent
on from the Inbox with one press arrived in the Backlog with no size and
no category, while a line typed in Backlog mode arrived with both, so the
only thing the word ever tracked was which button had been pressed. That
sentence fails the test, and the two are one list called Later.

**What Later keeps from each.** The Backlog's mechanics: an order that is
the array's own, a grip and the arrow keys to change it, one press onto
the day at the next free slot that holds the item, its size and colour
carried, no age recorded, a plain count in `--faint` on the fold and on the
week. The Inbox's cheap way in: Later on the field asks for no time, and a
note that starts with `!` goes straight there without a second question.
A new item lands at the end, as it did in the Backlog, because the order is
the owner's and nothing in this app sorts a list for them.

**What the code keeps, and why.** `LaterItem` is the old BacklogItem
shape; the storage field is still `backlog` and the sync kind is still
`'backlog'`, because those are the wire, and a device on an older build
carries tombstones keyed `backlog:<id>` that have to keep matching. Every
name a person reads says Later. On load, `normalizeLoaded` folds whatever
an `inbox` holds into the top of Later in its own order - newest first, as
the Inbox kept it - then the Backlog after it in its order, once, writing a
tombstone for each folded line so a device that still has the old list
deletes its copy on the next merge; the merge runs the same fold on its
result before committing, so a payload from an older device is folded as
soon as it arrives. `AppData.inbox` stays declared and empty for as long
as such a payload can turn up.

**What it cost.** A line typed in the field with no thought given to it
now has a size and a category on it from the moment it lands, because the
field's Later mode keeps the duration and category controls the Backlog
mode had. That is a default, not a question - both controls open holding
an answer, section 16 - and the alternative was a third mode on the toggle,
which is the state this decision removed.

## The Year view goes

Calendar had three readings: Month, Week and Year, the last a strip of one
cell per day coloured by template and, since v1.4, shaded by how much of
the day got done. The v2.7 brief asked one question of it: will the owner
ever open it? If its only purpose was that it was easy to build, it goes
with its code; if it shows something Month does not, it stays and the
reason is written down.

It did show something Month does not: a whole year on one screen, which
kinds of day fell where, a gap of weeks as an absence of texture. That is
a picture the owner would open at most once a year. And what the strip had
become was the thing "A year strip with no in-between" above said it must
never be - a fullness heatmap in three tones, grading days against each
other, which is a streak's own currency. Nobody noticed for five versions
because nobody opened it: its legend described a ring the stylesheet no
longer drew distinctly, one of its rules was dead, and nothing routed to it
but the segment button - no key, no palette entry, no tour step, no
screenshot, no browser test. A view nothing points at and nothing checks
is a view whose purpose was that it was easy to build.

So it is gone, with `widgets/year-strip/`, its 42 tests, its 150 lines of
stylesheet, its sweep screen and its seed. Month and Week are the calendar.
The entry above stays as the record of what the strip was meant to be and
of how a picture becomes a scoreboard without anybody deciding it should.

## Review says facts, and no longer a streak

> **Superseded, in part.** The month's summary line went in v2.20, since the grid under it draws every day; and Review shows no North and no ages, which went with goals in v2.28.

RESEARCH-ADHD section 8 settled the refusal of streaks with a better
reason than the app had: Lally et al. found a missed day does not
measurably disrupt habit formation, so a counter that resets to zero
encodes a rule the psychology does not support. "No streak on the day view
- and one, described rather than kept, on the review" above drew a line
between a number you can lose while living the day and a number you read
about a week afterwards. The v2.7 brief read Review against section 8
again and the line did not hold: "Streak: 3 days with a key task done" was
still the one figure in the app that resets to zero, and a described
streak is a streak the moment the number is smaller than last week's. It
is gone, with highlightStreak and its seven tests. The calendar's month
line, which said "62% done - 14 active days - longest run 5", said the
same two figures on a second screen; it says how many days had a plan and
nothing else.

What Review still says, and why each survives the same reading: Done as a
count of done over planned, because a count is a fact and the percentage
beside it went in v2.6; Deep work as hours; Key tasks as a count against
the day's own cap; the two charts, because the bars are the shape of what
happened and carry one colour at every height; North as ages, which cannot
be earned or lost; and what was read and watched, in each list's own unit.
Nothing compares a week with the week before, nothing is called best, and
nothing in the tab is coloured by a value. The month cell's bar keeps its
three tones from the v2.4 month decision; it is the day's own ratio drawn
once, and it is the owner's to revisit after the week in the app.

## Where the plan and the week disagreed

> **Superseded in v2.28, in part.** Review has no North section, so the reading sits under the charts and above the block counts and Read and watched.

The one thing v2.7 added, and it is built for the week after the app
closed: the owner lives in it for a week, and the next brief comes out of
what the week said rather than out of a feeling. It is a reading, not a
game. In Review, on a week, under the charts and above North: for every
block of every template the week's finished days were stamped from, on how
many of those days it happened at its time, how many times it moved and by
how much on average, how many times it was set aside, and how many times
it was not done. One line per block, in this form and no other:

    Deep work 09:00 - happened at its time 2 of 5 days, moved later 3 times (avg +1h10)

Sorted with the largest disagreement on top. No percentage, no colour, no
good or bad, no streak. One Copy, which puts the same lines on the
clipboard as markdown, grouped under the template's name, so a week can be
pasted into a conversation about what to change.

**It is defined from what exists, and nothing new is stored.** The app
records no timestamp of a tick and this did not add one: a block happened
at its time when its task is done and its time still equals the block's;
it moved when its task is on the day at another time, done or not, and the
distance is the difference between the two clock times; it was set aside
when the task carries the flag; and otherwise it was not done - unticked at
its time, or gone from the day, which a hand delete and a push absorbed by
tomorrow's stamp both leave looking the same. Only days before today count,
so the current week reads its Monday to yesterday and an empty week shows
nothing at all. The block's time is the template's time now, not the time
it had when the day was stamped, because the stamped task keeps no copy of
it; edit a template mid-week and the reading for that week says so
honestly by disagreeing more.

**Why Review and not the week view.** Review is the one screen that
already looks back at a finished Monday-to-Sunday week and already has a
Copy control beside it; the week view is built to fit its columns without
a scroll, shows three days on a phone, and a second status region under
it would sit ahead of the one it already has.

**What it must never become.** A verdict. The words "missed", "skipped"
and "failed" are not in it and `ReviewView.test.tsx` refuses them; the
lines are sorted by size of disagreement, not by anything called good; and
if a later wave ever wants to colour a line, that is the streak coming
back through a side door and the answer is no.

## The day card opens, and the hover peek goes

> **Superseded in v2.18, in part.** A hover peek is back, read-only and never over its own day (`DayPeek.tsx`), and a press still opens this card (see "The month says what is on a day again, and this time nothing on it can be pressed").

The owner, on the month: the cell shows the whole day when the pointer rests
on it, and the pointer cannot then travel to what it shows - the card closes
on the way. A thing that can be read and not used is not a control, and
CONVENTIONS section 25's rule for a state reaches it: it never earned its
place beside a cell that already says what is on the day.

So the peek is gone, with its four-hundred-millisecond delay, its timer and
its two pointer handlers, and pressing a day opens a card that stays until it
is closed. What was a glance is a place: the day and its template, its tasks
with their times and colours each tickable where it stands, and the ways on -
open the day, its journal, its notes, something came up, and clear it.
Escape closes it, a press outside closes it, and focus goes back to the cell
it came from, which is the contract every sheet in this app keeps.

**It is anchored, not floated.** The card touches its own cell with no gap,
because the gap was the whole defect, and it is bounded by the grid rather
than the window, so it never hangs off the calendar. That is its own module
(`views/dayCardPlacement.ts`) rather than the tour's, which promises the
opposite of both: the tour's card must never cover what it points at, and
this one may cover its own cell, which is the one thing on the screen it is a
longer copy of. The single escape is a screen too small to hold it either
way - a phone's month is 358x284 - where the window becomes the bound on that
axis, because "inside the grid" exists to keep the card reachable and a card
past the bottom of the screen is not reachable at all.

**Stamp came off it.** A template in hand turns every cell into a brush, so
the press that used to open a peek now stamps, and the card cannot be open
while one is held. Open day and Something came up both still mean something
from a cell and stayed.

## Two marks, because there are two things to open

A month cell whose day carries writing says so in its corner: 5px, `--muted`,
filled for the journal and the same circle left open for a note. Two marks
rather than one with two states, because the card behind the cell offers two
buttons and the corner is what says which of them has anything behind it -
one mark could not say "both". One shape and one ink so they read as a pair
rather than as two facts, and no number anywhere: the mark says something is
written here and nothing about how much, which is the same refusal the scratch
count and the day's score already make.

**Reading a day's notes is honest; writing into one is not.** A note carries
the date it was written on, so the stream can be read at a day. A line typed
now is dated now, though, so on any day but today the box is not drawn at all
and the card's sentence stands in its place; on today it is there as usual.
The three instant ways in - the key, the palette, the header - pass no date
and are unchanged.

## A cleared day stays cleared

The owner's case: a week template put in mid-week leaves the days behind it
holding a plan they never had. So a day can be cleared, from its card and
from the week column's own head, and the two ask the same one sentence with
the count and the day - "Clear 9 tasks from Wednesday?" - with Undo for five
seconds after, like every other expensive press.

What makes it stick is the rule the app already had for a different reason:
deleting what arrived leaves it deleted. The clear writes `autoApplied` and a
repeat skip for every instance it removes, so opening the day again does not
bring the weekday template's blocks or the day's own repeats back. What it
keeps is what the day itself knows rather than what a template gave it: the
journal, the away mark, the sleep profile. What goes with the tasks is the
template id, the day type copied from it, and the replan mark, because none
of the three is true of an empty day.

## A template never fills a day that is behind you

"If you put it in mid-week, then the week template should start from the day
you put it in, and not put anything on the days already past." Two things
were doing the opposite, and only one of them was the one asked about.

**Stamp week** filled every mapped day of the week, including the days behind
the press. It fills from the day it is pressed on now, that day included, and
a week wholly in the past offers no button at all rather than a disabled one:
there is nothing it could honestly do.

**And opening a past day stamped it.** The weekday map materialises a day on
first open, which is right for a day still ahead and wrong for one that is
gone: it invented a plan for a Friday nobody lived, which the month then drew
a ratio for and Review counted in where the plan and the week disagreed.
`ensuredDay` takes the day it is working from and refuses to stamp behind it.
Repeats are deliberately untouched: a series that was running was running,
which is a fact about the day rather than an invention.

Both take that day as a parameter with today as the default, which is the
shape this repo already uses, and it is what lets every test say which day it
means instead of reading the clock - a test that hardcodes a date is a test
that passes all morning and fails at noon, which this repo learned the hard
way in v2.7.

## The focus screen was five pixels off, and the scrollbar was holding them

The owner said the focus screen did not look centred, and the guess in the
brief was the navigation rail: that focus draws over the page while the rail
keeps a higher stacking order, so the content centres in the window and looks
pushed inside what is left. Measured, that is not it - the rail is z-index 40
and the focus screen 60, so the rail is covered - and the content is centred
exactly, in a box that is not the window.

`html` carries `scrollbar-gutter: stable`, which reserves the classic
scrollbar's width whether or not the page scrolls, so a `position: fixed`
element is laid out in an initial containing block ten pixels narrower than
the window. The focus screen is that element. Its content centred at 995 in a
2000px window: five pixels left of where the eye measures from, which is the
window's own edges, because the ten pixels it stops short of are painted in
the same background colour and cannot be seen. Five pixels is under the
threshold for most things and over it for one big ring with nothing beside
it.

The fix gives those pixels back rather than moving the content: the screen's
own left padding carries `100vw - 100%`, the gutter's width where there is
one and zero where the scrollbar floats over the page, as it does on a phone.
Measured after: at 1920, 1600 and 1366 the ring's centre and the window's
centre are the same pixel, and `centring.test.ts` holds the declaration,
because jsdom has no layout and cannot measure a centre.

**Nine other overlays sit five pixels left for the same reason and are left
alone.** Each of them is a card with its own visible edges on a scrim, and a
card's edges are what an eye lines a card up by; the focus screen is the one
surface in this app that is a single block on a bare ground, with nothing to
line it up against but the window.

## The month's name was moving the arrow

> **Superseded in v2.9, in part.** The day header no longer uses a hidden ghost, so the month's hidden "September" is the only one left.

"Those arrows above the calendar, one has randomly flown out." Neither arrow
had moved: the name between them sizes the row, so September's is sixty
pixels wider than May's and the arrow after it stands sixty pixels further
right, once a month, for no reason a person can see.

The name sits in a box the longest month fills - a hidden "September" in the
heading's own type, stacked under the real one and never read out, which is
the technique the day header's own date already uses. Both arrows are 44px,
the left one flush with the grid's edge, and neither moves all year.

## What is taken is visible while a time is chosen

The owner: "It is very awkward to change the time by scrolling ... if we get
up at 7, start from there, so there is nothing to scroll past; and once we
have a block from 9 to 10, we should see what is free and what is not, by
colour."

**The column opens at the day.** The value the field holds, else the end of
the last block on that day, else the waking time from its sleep profile - and
waking is a floor on the second, so one stray block at two in the morning
cannot drag the column back into a night nobody plans in. Night is still
there, one scroll away; it is only not where the column starts.

**Superseded in v2.9**, in the paragraph on colour below: the wash and the
bar came out of the column and the candidate went into the timeline. What
held is the rest of it - the column still opens at the day, still blocks
nothing, and still says in words what it says in marks. See "The colours
leave the column, and the candidate goes into the timeline" further down
this file.

**An hour a block covers carries that block's colour**, in the same wash the
timeline paints, with a bar along the bottom as wide as the share of the hour
that is gone. The bar grows sideways rather than filling from the top,
because the column's own axis runs down: a fill from the top reads as a claim
about *which* part of the hour is taken, and two blocks in one hour - a
quarter past nine and twenty to ten - make that claim unanswerable. The
amount is what is knowable, so the amount is what is drawn, and the numeral
always sits on one ground, so there is one contrast to check rather than two.
Worst measured: 7.81:1.

**Nothing is blocked.** An overlap was always allowed and still is; it is
simply visible before the choice instead of after it. A screen reader hears
the words rather than the colour - "09, taken by Deep work", "12, 30 min
taken by Meals" - because a colour alone is a fact only some people get.

**One component, three sources.** The day's blocks and its external calendars
where there is a day, the template's own blocks in both editors, and nothing
at all where there is no day, so Settings' sleep fields keep the plain
columns they always had. The arithmetic is a pure module, because it is
arithmetic; the component draws what it is handed and never reaches for the
store.

## Both arrows stand inside the month they point at

The owner, on the day's header: that arrow after the date cannot leave the
calendar underneath it. Measured, the left arrow sat exactly on the month's
left edge and the right one 113 pixels past its right edge, out in the middle
of the row - from about 1500px up, which is the width the owner works at and
where the header spans both columns and stands over the rail.

The arrows bracketed the day's name, which is why. The longest day this app
prints is "Wednesday, September 30" at 250px, each arrow is 44, so a bracket
is 353px wide standing over a month that is 240. The name cannot give those
pixels back without abbreviating a word - "Wed, 30 Sep" fits and is not what
this app sounds like - and the arrows cannot give them back at all: 44px is
the touch target, and v2.7 already settled that a control which overflows is
fixed by making overflow impossible rather than by removing the control.

So the name came out from between them. The two arrows are a pair at the
row's left edge now and the day's name follows, which puts both inside the
month's width with 144px to spare, reads as one control, and means moving a
few days back and forth no longer crosses the row. The bracket stays on the
phone, where the row is the width of the screen and each arrow sits at an
edge a thumb can reach.

Two smaller things came with it. The title kept its hidden ghost even though
nothing after it moved, because the chip and the doors still sat after the
name and would otherwise walk a hundred pixels every time the day changed.
And the reordering was CSS `order` rather than markup, so the two controls
keep their document order: tab reaches previous and then next, which is also
how they read left to right.

### Then the owner looked again, and it was the same cause twice

"The date text should not leave the calendar's bounds, and Working day and
Replan and all the rest are somehow at random gaps." Measured: the date ran
55 pixels past the calendar's right edge, and the ghost left 58 pixels of
dead space between the date and the template chip. Moving the arrows had
fixed the arrows and left the two halves of the same problem standing.

So the block is the month's own width - 240px, the rail's own column, its
left edge and its right edge the calendar's - and it holds two rows: the
arrows and the day's word on the first, the date across the whole block on
the second. The chip after it starts at 332, which is where the timeline
starts, so the header's three groups sit over the three the day is made of.

**The word is never the whole date.** "Wednesday, September 30" is 250px in
the heading's type and the cell beside the arrows is 136, so the heading
carries "Today" or the weekday and the line under it carries the rest. The
two halves print the same day the phone's one line does, and `dates.test.ts`
holds them to it.

**The date takes the whole row rather than the cell beside the arrows.** That
cell is 136px and the longest date in that type is 153. Taking the row is
also what makes it safe at a larger text size: a longer date wraps inside the
block instead of pushing out of it.

**And the ghost went.** It existed to stop the chip moving as the day's name
changed length; the block is one width because the column is one width, which
answers the same question without a hidden copy of a string in the markup.
That hidden copy was also the dead space the owner was reading as a random
gap: what was left of the box after a short day's name.

## The day type says its answer and folds its question away

The template editor opened on four buttons - Full day, Shift, Overnight, Rest
- above the timeline, above the blocks, the largest question on a screen that
exists to hold a day's worth of blocks. The answer is Full day on all but a
handful of templates anybody builds.

Nothing about the mechanism moved. All four values still exist, still save,
still stamp, and still decide what `dayScore` counts; shift and night are
still separate values for the reason `types.ts` gives. What changed is the
room the question takes before it is asked: one quiet line under the name -
the value, and the word "change" - and the four buttons one press behind it.
The week editor's seven columns did the same, where the word each of them was
showing was "Week default". CONVENTIONS section 25 is a state has to earn its
place; this is that rule applied to a control.

**The value stays on screen and the choosing is what hides.** A template that
carries Overnight says Overnight on the line, closed. What is folded away is
the offer, not the fact.

**The four explanations say what changes rather than what a day is.** They
read "Everything on the list counts toward the day" and "Only blocks marked
Core count toward the day", which is the whole of what a day type does. The
owner's brief said "key tasks"; the app's mark for this is Core, and "key" is
already the star on a task that a low day is scored against, so using it here
would have named the wrong mark. The word on the toggle and the word in the
sentence are the same word.

**And one line for what it does not change.** Free time is measured against
the sleep schedule the template points at - `computeCapacity` takes a profile
id and no day type at all - so the panel says so, where there is a second
schedule for it to mean anything. Written because the question the four
buttons raise is worth an answer, even when the answer is "not this".

## The colours leave the column, and the candidate goes into the timeline

v2.8 painted the hour column of the time picker with the categories of
whatever held each hour. The owner, living in it, found what that could not
do: an hour is a box of sixty minutes, so a block from 09:05 to 10:05 painted
nine and ten exactly alike. A column that looked precise was rounding in both
directions, a picked hour was carrying two meanings at once - what is chosen
and what is taken - and the same fact was on the screen twice, drawn properly
in the timeline and approximately in the picker. CONVENTIONS section 23 has
one answer for a fact said twice: say it where it can be said properly.

**The column is back to one meaning.** What is left of the old paint is a 2px
rule down the edge of an hour that has something on it, in the border's own
grey, with no category colour anywhere. It answers "is this empty" and
stops.

**The candidate is drawn on the timeline instead**, live, as the hours and
minutes are moved through: a dashed, half-there block in the category colour
it would carry, with its length on it, at the minute, on the day's own scale.
The place, the length and the overlap are the real ones because it is the
same picture the day is drawn in. Where it crosses a block, both wear the
border two overlapping blocks already wear - nothing is refused, the clash is
just seen before the choice rather than after it.

**The window grows rather than clamping.** A candidate outside the drawn day
would otherwise be pinned to the edge of it, claiming a place it does not
have; the window widens to hold it and shrinks back when the pointer moves
somewhere the day already covers. And where the column does scroll, it
scrolls to bring the candidate into view, with a margin, only when it is
actually out of sight.

**Quick-add and the task sheet draw on that day's own timeline.** The channel
between them is one small module on the shape `replanState` already uses -
the picker is three components away from the grid in every direction, and the
alternative was a preview prop threaded through the day view, the task sheet,
quick-add and both template editors. Each timeline answers to a name: a date
for the day, 'template' for the day editor, one per weekday for the week
editor's columns, so a time picked for Wednesday is drawn on Wednesday and
nowhere else. A field with no picture behind it - Settings' sleep window, the
library's own time - publishes nothing and draws nothing.

**The words kept the amount the marks gave up.** A screen reader still hears
"09, 55 min taken by Deep work", because it can be said exactly there and
taking it away to match a deliberately quieter drawing would leave somebody
who is not looking at the screen with less than the screen holds. Levelling
down is the wrong direction to even that up in.

## One link, and nothing that goes to the network

> **Superseded in v2.19 and v2.21, in part.** A library item's link field says one sentence when an address is in a scheme it cannot open (`linkRefusal` in `link.ts`), while a half-typed word and a task's link field stay silent; and a file picked on this computer is a third kind of door, with a tab opened without `noopener` on purpose - see "A file on this computer is pointed at once, not copied and not served".

The owner: "at the details you could put a link in, say if you take a book
out - if it is Spanish learning, then you see easy, where up next you can
press and it throws you straight there, but so it throws you into a new tab
so that Dienius does not close."

A library item and a task each carry one optional address. The task's own
wins; without one it shows the address on the library item it is bound to,
so a reading block does not repeat what the book already knows - the same
way `pace` already rides along. It appears in four places, all of them
places you are already looking: the library row, the day's task card, Up
next, and the focus screen. Up next is the one the owner named, and it is
the one this is for.

**It is a separate target and never changes what pressing the card does.**
Rows in this app already mean something when pressed - open the task, open
the book, tick it - and a control whose meaning depends on where inside it
the pointer landed is worse than no control. So the anchor stops the press
reaching what is under it, and it carries the app's own 44px.

**A new tab, always, with `rel="noopener noreferrer"`.** The first because
the whole point is that the planner is still there when the lesson is
finished. The second two because a page opened this way can otherwise reach
back through `window.opener`, and because a referrer is this app telling
somebody else's server what its owner is doing at nine on a Tuesday.

**Two icons, because there are two kinds of place.** A machine of your own -
localhost, a private LAN address, a Tailscale name or its 100.64.0.0/10
range - reads differently from a website: it works on one network and not
another, and it is yours. Two drawings rather than one in two colours, since
colour alone is a fact only some people get, and the address itself is in the
app's own bubble under the control, never on it (CONVENTIONS section 24).

**Nothing here touches the network.** No reachability check, no favicon, no
title fetch, no preview, no list of links and nothing to search. Whether an
address answers is between the owner and their own machine, and a planner
that quietly asks the internet about the contents of somebody's day is a
different kind of program from this one. The one thing that is checked is
that a string looks like an address at all, and only http and https survive
- `javascript:` is not a link to anywhere, it is a way to run code inside
this app.

**A refusal says nothing.** Type something that is not an address and it is
not saved; there is no error, no red and no message. There is nothing to
correct, and a planner that scolds is the thing this app is built not to be.
The field is forgiving on the way in - "localhost:8080/spanish" and
"example.com/x" both work, and the scheme is filled in, http for a machine of
your own because that is what those actually serve.

**It goes when the item goes.** A finished book's address is not something to
keep a list of, and there is no list to keep it in.

## The opener is read while the surface renders, not after it

Found by crossing every screen with nothing but a keyboard, which is a thing
this repo had never done end to end.

Every sheet, panel and popover in this app hands focus back to whatever had
it when the surface opened - `useRestoreFocus`, since v2.1, because Escape
landing on the body means the next Tab starts again from the navigation rail
and the walk back is thirty controls long. Two surfaces were not doing it.

**The Notes and Journal popovers captured themselves.** The hook read
`document.activeElement` in an effect, and being first in the component was
enough only while every surface took focus in an effect of its own: React
runs a child's effects before its parent's, so by the time the popover asked
who had focus, the note field inside it had already taken it. The restore
then had nothing to give focus back to, because the field left with the
panel. Reading during render fixes it - render happens before any effect,
and asking which element has focus is a question rather than a change.

**And the detail sheet captured a button that was leaving.** Pressing Details
on a task's actions sheet closes that sheet and opens the detail sheet in the
same commit, so the opener it captured was about to go with the menu it sat
in. Nothing to restore to, and Escape landed on the body again - the same
defect one step along. So the openers are kept in a short list, pruned of
anything that has left the page, and a restore that finds its own gone takes
the newest one still there: the menu button the whole chain started from.

The first version of that list took its own entry out on the way down, which
put the bug straight back - the menu's cleanup removed the very button the
detail sheet was about to need. Nothing is removed when a surface closes,
only when the element has left the page.

Both are held by tests in `useRestoreFocus.test.tsx`, each of which fails
against the old hook.

## The age on a goal was read against the streak rule, and stays

> **Superseded in v2.19 and v2.28.** The age left North's page in v2.19 and goals were retired in v2.28, so nothing computes or shows a goal's age any more, and `Goal` is kept only as data - see "The count of days is gone, one version after it was kept" and "North is one text, goals retired".

v2.18 asked one question about "61 days lived toward this": can it fall?

It cannot, and the reason is worth writing down because the answer is not
"we checked the screen". goalAge is arithmetic on two dates - the day the
goal was written and the day being asked about - and `createdAt` is written
once, by addGoal and by the Compose draft, and by nothing else in the
store. Editing a goal does not restamp it. Archiving does not, deliberately,
so an archived goal still knows how long it was carried. Restoring does not.
There is no missed-day arm to break and no zero to reset to: a week nobody
opened the app in reads exactly the same as a week they did.

So it is not a streak with the word filed off. It stays, and it stays where
"Review says facts, and no longer a streak" already put it - "North as ages,
which cannot be earned or lost" - drawn at the smallest size the page has, in
`--faint`, with no icon and no colour of its own, which is the whole of what
it earns.

What is new is `north.test.ts`, "nothing a person does to a goal can make its
age smaller": it walks one goal through edit, archive and restore and holds
the number against each. The property was true by construction and true by
nobody's decision; a later change to updateGoal or restoreGoal that
starts stamping a date now has somewhere to fail.

## The month says what is on a day again, and this time nothing on it can be pressed

v2.8 removed a hover preview from the month and was right to. It opened the
real day card after 400ms and closed the moment the pointer left the cell, so
the pointer could never get to it: everything on it was readable and nothing
on it was reachable, and the owner's words are on the record - *"we cannot
move the mouse down onto that list"*. CONVENTIONS section 25 does not keep a
state nobody can act on.

The v2.18 brief asked for hovering to say what is on a day again, and the
reason that is not a reversal is the one difference that matters: **there is
nothing here to reach.** No button, no box to tick, no link, `pointer-events:
none` on the whole layer. A surface that asks nothing of the pointer cannot
be a surface the pointer fails to arrive at. The card still opens on a press
and is still the only thing that acts, and the two are never drawn at once.

What it carries is what the brief named: which day, which template, how many
tasks and how many of those are key, the key ones by name, and whether
anything was written that day. It is `aria-hidden`, because the cell's own
`aria-label` already says the same facts and a second copy would be the day
announced twice.

Four rules it keeps, each of which is a way it could have gone wrong:

- **It never moves anything.** Fixed, out of the flow. CONVENTIONS 24 is
  about layout shifting under a pointer; a layer arriving over the top is not
  that, and it arrives on a fade.
- **It never covers the day it is about.** `placeDayCard` places it, and that
  function's last resort - covering the cell - is refused here rather than
  taken. If the only place it fits is over its own subject it does not appear.
- **Crossing the month shows nothing.** A quarter second of rest opens it, and
  every cell entered restarts that wait, so what decides it is the dwell on
  one day rather than how long the sweep takes.
- **Moving between two days swaps it in place.** No close, no second wait. The
  hide is instant and it is the only thing that is, which is why the leave
  handler is on the grid and not on a cell.

The keyboard gets it on focus, without the wait, because focus is deliberate.
A phone does not get it at all - a press already opens the day there - and
that is gated on the device having a fine pointer as well as on the event
saying a mouse moved, because a touch screen driven by mouse-shaped events
has the second without the first.

`e2e/calendar-peek.e2e.ts` holds all of it, and the way it does is worth
copying. Asserting a locator's count after a pointer move proves nothing here:
the layer is absent for a quarter second by design, so "not there yet" always
passes, and `toHaveCount` retries until it is there, so "there eventually"
always passes too. It counts how many times the layer is *added to the page*
instead - and that is what caught the first version keyed on the date, which
unmounted and remounted on every step across the month, producing exactly the
flicker the whole design is against.

## The count of days is gone, one version after it was kept

> **Superseded in v2.28.** The goal's age and its label, Compose's archived fold and Review's goal ages went with goals - see "North is one text, goals retired".

v2.18 asked whether "61 days lived toward this" could fall, found that it
could not, and kept it: goalAge is arithmetic on two dates, `createdAt` is
stamped once and never restamped, and there is no missed-day arm to break.
That reasoning was correct and it answered the wrong question.

The owner read the window a version later and said it felt like Notion -
*"where I would just get a notepad and write it down instead"* - and named
that line as the most Notion-like thing on the screen. Which it is. The test
it passed was "is this a streak", and the test it fails is a different one:
**a figure that counts something is a spreadsheet's idea of a page, whatever
the figure can and cannot do to you.** North is where somebody comes to
remember why, not to check a number, and a number on it invites the check
whether or not anything hangs on the answer.

So it is gone from the reading page, and `NorthView.test.tsx` now holds that
nothing on that page is a number at all - not the age, not a count, not a
digit. goalAge and ageLabel stay, because the archived fold inside
Compose still says how long a goal was carried before it was put away, and
the review's North line still says an age; both of those are records being
read rather than a page being lived on.

The v2.18 entry above is not wrong and is left standing. What it establishes
- that this figure is not a streak - is still true and is still the reason
nothing about it needed to be feared. It simply was not the whole question.

## A rule has no colour, because the colour did nothing

> **Superseded in v2.28.** If-then rules are no longer shown or written anywhere, and `IfThenEntry` is kept only as data, a stored colour riding along unread - see "North is one text, goals retired".

The owner asked what the nine swatches under an if-then rule were for. The
honest answer, found by following the value rather than by remembering what
it was meant to do: `IfThenEntry.color` was read in exactly one place, and
painted a two-pixel edge down the left of that one sentence on the North
page. Nothing else touched it. The card that brings a rule forward on a bad
morning never read it. Nothing sorted, grouped or filtered by it. It did not
bind a rule to a category - it drew from the generic palette, so its values
were "Blue" and "Green" rather than the names of anything the owner owns.

So it was nine controls offering a choice with no consequence, on a form that
asks for two sentences. CONVENTIONS section 25 asks a state to earn its
place; this one had nothing to earn it with, and the test it fails is the one
the owner applied: *if the colour changes nothing and is visible nowhere
else, remove it.*

**What went**: the swatch row, the field on the type, its line in the
validator, the `borderLeftColor` on the sentence, the hidden "Tagged Blue."
for screen readers, and the `.swatch-none` rule that drew the "no tag" cross.

**What stays**: a stored rule that already carries a colour keeps it and
loads fine. Unnamed fields ride along untouched rather than failing a payload
- the same contract that carries `dayTypes`, `when` and `lastSurfaced` from
before v2.0, and the reason the tables in `validate.ts` name what the app
reads rather than everything a stored object may hold.

**One thing worth knowing about that trade.** The colour was validated as a
hex because the value reached a stylesheet, so a `url()` in a stored file was
a beacon a payload could fire. It is not checked any more, and that is safe
only for as long as nothing paints with it: it is a key nothing reads.
`storage.test.ts` holds both halves of that in one test, so the day somebody
paints with it again they find a test saying the check went out with the
painting.

## A goal is three sentences until somebody looks at it

> **Superseded in v2.28.** Goals are retired and North is one text, so there is no goal card to fold and no goal screen in the sweep - see "North is one text, goals retired".

Four goals with everything on them is about forty lines of text, and the
owner's word for the result was a pile. Their ask was to see everything from
a card on hover, without having to read a heap.

What a person opens this window for is the top of each goal: what it is, why
it matters, who having it makes them. What is under that is the operational
half - the things done most days, the things never done, and the moments that
pull them off it. So the operational half folds away, and comes back when the
pointer rests on that goal or a keyboard reaches it.

**It unfolds downward over the page rather than pushing anything.** The
folded half is placed absolutely against the card's own bottom edge, on the
card's own surface, with the card's bottom corners squared while it is open -
so the card appears to grow and nothing beneath it moves by a pixel.
Measured: hovering any of the four moves zero cards and changes the
document's height by nothing. CONVENTIONS 24 is about layout shifting under a
pointer, and a layer arriving over the top is not that; the card below is
covered while the pointer is on this one, which is what a card growing does.

**Where there is no pointer, it does not fold.** A phone has no hover and the
whole goal is on the page there, which is the right answer on a screen that
shows one goal at a time anyway. The card takes a tab stop so a keyboard can
open what a pointer opens - it is a reading surface with nothing on it to
press, so it claims no role and makes no promise, and the alternative was
half of this page being unreachable without a mouse.

**And the measuring pass follows it.** Everything that folds is now painted
only in the open state, so `North` no longer sees the lines, the never lines
or the rules at all. `North (goal open)` is a screen of its own, marked
pointer-only because on a phone the same content is measured by `North`
itself.

## Three corner steps, not two, and the reason is an 18px checkbox

> **Superseded in one look, stage 2.** Every corner is the one 8px `--r`; the step names all point at it, only `--r-round` is another shape, and a preset no longer reaches any corner (DESIGN.md, "Corners").

The night brief asked for two border radii in the whole app: one small for
buttons and fields, one larger for cards and modals, on the rule that a
corner says whether a thing is a control or an area rather than decorating
it. That rule is right and the count of two is not reachable, which is worth
writing down rather than quietly ignoring.

A checkbox is 18px and a button is 38px. At the button's 10px corner the
checkbox is very nearly a circle, and a circle is what this app draws for a
radio. So the corner cannot go by role alone: **it goes by the size of the
thing**, and there are three sizes of thing.

  --r-mark     6px  the smallest corner drawn - a bar, a week block, a
                    calendar cell, a checkbox, anything under about 20px
  --r-control  the theme's --radius  a button, a field, a chip
  --r-card     the theme's --edge    a card, a sheet, a panel

Plus two shapes that are not sizes at all: `--r-pill` is a capsule whatever
it holds, `--r-round` is a circle.

What did get fixed is the drift the brief was actually pointing at. The
smallest step was called `--r-chip` and twelve of its users are not chips, so
it is `--r-mark` now and the stylesheet says what each step is for. And ten
corners were bare literals - `1px` on five bars, `3px` on four blocks - which
is a corner a theme cannot reach: `--r-control` and `--r-card` are the
preset's own tokens, so a preset shipping the hand-drawn edge from THEMES
section 5 would have changed every card and left those nine square. There is
not one literal corner left, and `scale.test.ts` fails on the next one.

## Two durations for movement, and one that is not movement

The night pass counted eleven durations in the stylesheet: two tokens, and
nine numbers written at the point of use - 220ms, 240ms, 260ms, 0.25s, 0.35s,
0.42s, 500ms, 1s, 1.6s. No two alike, and not one of them a decision anybody
had made twice.

Seven of the nine are movement and are now `--dur`, which is the value they
were all approximating. One comment argued for its own 350ms on the day's
progress bar; it moves when a task is ticked, and 200ms reads as the day
filling up just as well as 350 does, which is the sort of claim that is only
worth a bespoke number if somebody has compared them.

`--dur-sweep` is the third value and is deliberately not one of the two. It
is how long a ring takes to reach the number under it, and that number
changes once a second: without it a countdown ring steps instead of
sweeping. It is a property of the clock rather than of the interface. The two
rings that use it were on 1s and 500ms, which is the same fact told twice at
different speeds, and the floating clock's was also missing the
reduced-motion guard the focus ring has had since it was drawn.

**And the pulse is gone.** `.floating-clock.is-up` ran an infinite pulse -
the only infinite animation in the app. An animation that never ends is not
saying something happened; it is asking to be looked at, once every second
and a half, for as long as the clock sits there. The same state already turns
the border to `--mark`, which says it without moving.

## A file on this computer is pointed at once, not copied and not served

The owner put `file://` and a path to a PDF into a link field and nothing
happened. `linkRefusal` had already been added to say why - a page cannot
open a file on the reader's own disk, at any price, in any browser, and
Chromium answers a click on one with "Not allowed to load local resource" -
and the sentence it said was "serve the folder at an address".

That was an answer to a question they had not asked. The reply was that the
PDF is on this machine, it is read on this machine, and no other device needs
it. Running a web server to open a file that is forty pixels away in
Explorer is not a plan; it is a workaround for a limitation that has had a
proper answer since the File System Access API.

**So: pick the file once, keep the handle, press the link afterwards.**
`showOpenFilePicker` returns a `FileSystemFileHandle`, a handle survives in
IndexedDB across reloads and restarts, and the file is read through it on
each press. Checked rather than remembered, twice: a handle stored, a reload,
and the contents read back; then the whole path through the real UI, where
the door opened a tab at a `blob:` URL showing the file from disk.

Three alternatives, and why not:

- **Store the bytes**, the way `photos.ts` stores a photograph. It would work
  on an iPhone too. But those bytes stay on the device that stored them, as
  a photograph's do, so the other device would still not have the file, and
  the owner's case is a file that is already on the disk and
  is going to stay there. A copy that goes stale is worse than a reference.
- **Serve the folder at an address.** Still the right answer for two devices,
  and still what the refusal says where there is no picker. It is the wrong
  answer for one.
- **A second field on the item.** The `link` field is already carried to all
  four places a door is drawn - the library row, the task card, Up next and
  the focus screen - plus the validator, the backup and sync. A file is a
  door. It goes in the field that is already a door, under a scheme this app
  owns, `ondevice:<id>/<name>`.

**It stays on the device it was picked on**, which is the same rule as "A
photograph stays on the device it was taken on" above and for a harder
reason: a handle is a reference to one disk, and carrying it elsewhere would
carry a promise the other machine cannot keep. The id and the name travel, so
another device says which file is meant instead of showing a broken door.

**And it is absent rather than broken where the browser has no picker**,
which is Safari, Firefox, and therefore every iPhone. The button is not
drawn there at all, and the refusal keeps its other sentence.

**Three sentences for three failures**, because they are different problems
and only one is the owner's to fix: the file was picked on another computer,
the browser did not give access, or the file has moved since. A door onto
nothing is the thing this whole feature exists to stop being.

One thing found by the browser that a test had said was fine: the tab is
opened *before* anything is awaited, because a browser lets a page open one
on the strength of a press and that does not survive every await - and it is
opened **without** `noopener`, because `window.open` returns null when that
is passed, and the reference is the entire point. There is nothing to protect
against: the tab holds a blob this app made, on this app's own origin.

## Two devices meet in the repo, because it is already there

> **Superseded in v2.34, in part.** The backup no longer writes this device's state over its file: `writeMerged` in `cloudBackup.ts` merges into what the file holds and reads and merges again once on a refusal; and a push through the repo waits eight seconds on a computer and three on a phone, one that cannot leave with the page sent first on the next open - see "An older copy is never written over a newer one".

The owner: how do the computer and the phone see the same plan, without
pressing much, and knowing when you move from one to the other.

Most of that was already built and nobody had said so. Sync pulls when a tab
comes back and when the network returns, and pushes a few seconds after every
change - so "it knows when you pick up the phone" needed nothing. What it
wanted was a **server**: a box to own, keep awake, and reach over Tailscale.
That is the part worth removing, not the syncing.

And there was already a second thing in the app writing the whole state
somewhere both devices can see: the GitHub backup, into a private repo, with
a token that lives on the device and is kept out of exports and out of sync.

So the repo is a transport for the sync that already exists. Not a second
sync: everything that decides *what to keep* is `syncMerge.ts` and did not
move. `githubSync.ts` is a read and a write, and the client picks between it
and the server by one setting.

**One repo, one token, two files.** The backup owns `data/state.json` and a
file per day under `data/history/`, written a few times a day and meant to be
opened and read by a person. Sync writes far more often and is machinery, so
it gets `data/sync.json`. They share the repo and the token; a device joins by
having those two, which it needs for the backup anyway.

**It will not write over what it did not read, and this is the one thing the
repo does better than a server.** A read comes back with the file's `sha` and
the write carries it. If the other device wrote in between, GitHub refuses,
and the round trip starts again - pull, merge, write - rather than writing a
state that was merged against a plan the other device has already moved past.
Deliberately not `writeFile`'s retry from cloudBackup.ts, which reads the new
sha and writes anyway: that is right for a backup, where what is in hand is
the whole truth of this device, and it is data loss for a sync. Twice, then it
waits for the next round trip, because a conflict is not an error - it is both
devices being used - and a loop that will not give up is a device writing to
somebody's repo as fast as it can.

**Thirty seconds, not two and a half.** Every push through the repo is a
commit. A server can be written to whenever there is something to say; a repo
keeps what it is told forever and shows it to a person as a list, so the
server's debounce would turn a morning's planning into four hundred lines of
history. The wait is never felt where it matters, because of the next part.

**It pushes as the device is put down.** `visibilitychange` to hidden, and
`pagehide` for the phones that discard a tab rather than hide it - both only
when something is actually owed. That is the other half of the owner's
question: the computer says what it did as it is set aside, so the phone's own
pull on opening already has it.

**What the owner still does once per device:** paste the repo and a
fine-grained token with Contents read and write on that one repo. There is no
way around that one and it is not worth pretending otherwise.

## The base field rule weighs nothing, and four fields look the way their rules asked

`input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='range']):not([type='color']):not(.time-input):not(.task-library-input)`
scored 0,7,1, and every class in the stylesheet scores 0,1,0. So a class on
a field could not change the field. `.palette-input` asked for an underline
and no box and drew a box; `.task-detail-title` asked for no border and drew
one; the page field on a card came out sixteen pixels taller than the mark
it stood in for, and it took three measurements to find out why. The backlog
had it as "worth doing, and worth doing as its own change with the sweep run
either side". This is that change.

The same seven exclusions sit inside one `:where()` now, where they weigh
nothing, and the rule is 0,0,1. Every class that had been losing to it
started winning, which is the point and also the risk - so what changed on
screen was measured field by field, before and after, at the computed style
and in a screenshot, rather than trusted to be what the rules said.

| field | before | after | verdict |
| --- | --- | --- | --- |
| command palette's search line | boxed, 8/12 padding, 10px radius, accent border while focused | one line with an underline, 16px padding, no box, and its own quiet focus look | what `.palette-input` and `.palette-input:focus` had asked for since they were written |
| a task's title in its detail sheet | boxed like any field | no border, no ground, larger type - reads as a heading that can be edited | what `.task-detail-title` asked for |
| a sleep schedule's name in Settings | boxed, 38px tall | a tinted pill, 4/8 padding, 30px tall on a fine pointer; still 44 on a finger from the coarse-pointer rule | what `.setting-name-input` asked for |
| the size field on a card | 8/12 padding | 8 all round, same height | a few pixels; fine |
| the date field in Replan | not reached in the demo | its rule adds only a floor and a padding | unverified by eye, and low stakes |

Four of five are the looks somebody wrote and never got. None was a
surprise in the bad direction, and the sweep on the far side of the change
is the check that contrast and targets survived them.

`notSpecificity.test.ts` allowed this one rule past its line, with a comment
saying why; it allows nothing now. Two things in the test itself turned out
to be wrong while taking the allowance away, and are fixed: it split
selector lists on every comma, so a `:where(.a, .b)` inside a selector was
cut into fragments, and the fragment it then examined had no closing bracket
at all - which is how the add row's generic rule had been passing the
weighted-`:not()` count by accident rather than by reading. It splits on the
commas between selectors only, and it understands a `:where()` wrapping a
whole chain as well as one wrapping each exclusion.

## The template's picture can be moved by hand, through the day's own drag

The template editor has drawn the day its blocks make since v2.5, and it
only drew it: to move a block you retyped its time in the list underneath,
and to make it longer you opened its size. The day view has had the two
gestures since v2.0 - a block dragged to another hour, its bottom edge
pulled to another length - on the same grid the picture draws with. The
plan's line was that the machinery already built should be reused rather
than written a second time, and that is what happened.

**The drag hook knows nothing about days now.** `useDayDrag` was the gesture
and its meaning in one hook, bound to a date and to the store. The gesture
is `useTimelineDrag` - pointer capture, the grid's geometry, the eight-pixel
threshold, the snap, Escape, the announcement - and what a drag *means* is
the host's: `reshape`, and where the host has them, `unanchor` for a tray
and `offerUndo` for a way back. `useDayDrag` is the day's binding, one
screen long, and every drag test the day had passes unchanged through it.
The template's binding is in `TemplateTimeline` behind an `onReshape` prop:
absent, the picture is exactly what it was.

**No tray and no undo, on purpose.** A day's tray is where a dropped block
loses its time; a template has no tray, so a drop anywhere off the grid is
a drop on the grid. And the editor's own Cancel is the way back from
anything done to a draft, so the drag offers no toast of its own - two ways
back from one change would be one too many.

**A block that has not been saved has a name for the picture.** A draft
block carries an id only once saved, and `blocksAsTasks` invented an index
of its own for the rest, counted after the weekday filter, which is not the
number the draft counts by. `drawable` gives an unsaved block `draft-N` for
its place in the draft, so the patch the picture sends back can find it
again; `save()` still mints a fresh id for it, because the picture's name
never reaches the draft.

**The week editor was left alone.** It does not draw with `TemplateTimeline`
- it draws seven columns of its own and already drags a block between days
- so this is the day-template editor's change only.

## The palette has a door a finger can press

Ctrl K opened the command palette from the day it was built, and nothing
else did. On a desktop that is the chord every other app with a palette
uses, and it stays. On a phone there is no Ctrl, so the palette - the one
place that searches every task, list and note, jumps to any date, and runs
Something came up - was a feature the phone did not have. CONVENTIONS 17
already said so in general: a feature reached only by a key nobody has
been told about is a feature they do not have.

The door is a `Search` button in the header, beside Notes and Journal,
which is where the other two things that had been key-only got their
buttons in v2.7 and for the same reason. It carries the chord on its tip
the way they carry theirs, and the palette already gives focus back to
whatever opened it, so Escape lands on the button again and the keyboard
walk stays clean. Nothing about the palette itself changed: one more way
in, not a second palette.

## The book's file, on the phone too

A file picked on the computer is a handle in that computer's IndexedDB, and
the phone has no picker at all. "A file on this computer" said so and
stopped there: the phone says which file is meant and where. The owner
reads on both, so that was half an answer. What the phone can open is an
address - the same PDF in a cloud drive, or a folder served at home - and
since v2.21 the item can carry that address beside the handle.

**Inside the one link, not a second field.** The link is `ondevice:<id>/
<name>`, and the address rides after a `?`, which an encoded name never
contains. So the validator, the backup, sync and every place a door is
drawn see what they always saw - a string - and a link written before
there were addresses reads exactly as it did. `OnDeviceFile` gained
`also`; nothing else learned anything.

**The door decides before the press.** `LinkOut` asks the handle store once
whether this device holds the file. Where it does, the door is the file's.
Where it does not and there is an address, the door is the ordinary anchor
to it - the same icon and bubble any address gets, so the phone's bubble
reads the drive address and the computer's reads the file's name. Where it
does not and there is no address, the door is what it was: the file's, with
the sentence that says to pick it again here. Decided on mount rather than
at the press, so nothing is opened and closed again on the way to finding
out, and only asked when there is an address to go to instead.

**Typed in the detail, on either device.** An `Also at` field under the
file's row, on the phone as well, since the phone is where the address is
often to hand. On the phone the file's own `Change` is gone, because there
is no picker to change with and a button that does nothing is worse than
none; `Remove` stays, since it only takes the link off. A `file:` path
typed as the address gets its own refusal, because the one sentence about
`file:` would be wrong on both counts there - the file is already picked,
and the address is for the device that cannot open a path on this disk at
all.

## The pictures, looked at

The owner's brief for the next wave was one sentence: nothing that looks
unprofessional, nothing that makes you think, and the app is going to be one
of the main things in the day. That is not a feature brief, and the feature
list already covers what a calendar does for one person - feeds from a work
calendar, repeats, a week that drags between days, a line that parses "14:00
Meal 45min", a palette, keys, offline, sync - so the wave is a quality one.
It starts with the thing every hole in the measuring passes had in common:
every one of them was found by a person looking at a picture, and nobody had
looked at the pictures since the passes were written.

**The sweep leaves pictures now.** `npm run sweep -- --shots=DIR` writes a
PNG of every screen it reaches, on the same seed, at the same minute, by the
same route as the measuring, and `--width=1366` walks one desktop size while
working. Sixty-four pictures at 1366 and fifty-eight on the phone were read
one at a time. What they showed, in the order it mattered:

**Every picture had an empty navigation rail, and the pass had said
nothing.** A test driver's click scrolls an `overflow: hidden` box sideways
to bring a 160px item into a 56px rail, and every icon was sitting at
x = -95 with no way back. A real click and the keyboard never did that, but a
find-in-page or a `scrollIntoView` from anywhere could, and the fix is not
in the driver: the rail's items are the rail's width now, the label sits out
of flow beside the icon, and the rail clips rather than hides, so nothing in
it is wider than it and nothing can scroll it. The pass looks past the left
edge as well as the right, and its first version of that check was blind to
its own plant - the walk it used is filtered by what can be seen, and a thing
wholly past the edge cannot be - so it walks the document for that one.

**Two of the sweep's screens were pictures of the wrong thing.** "Clock:
notes" and "Clock: journal" opened the clock and pressed a name inside it,
which since v2.7 is nowhere; for fourteen versions the two most-used
popovers in the app were measured as the timer. They are opened from the
header now, and the timer is a screen of its own.

**The phone had lost its field floor to C5, and the check either side of C5
was desktop-only.** The 44px floor for a field on a finger was written on the
base rule's own chain and went weightless with it; `.time-picker
.time-input`'s desktop 38px then beat it, and every time field on the phone
shrank to 38. The floor names the field types it means and hangs each off
`:root` - two classes' worth of weight and no `:not()` chain for
`notSpecificity.test.ts` to count - and it says in its own comment why it is
weighted when the rule above it is not: that one is a look, this one is a
size. The progress chip on a card had been promised the 44px overlay by its
own comment and never had it; it does now, as does the file picker's link.

**Then the ordinary findings**, each of which a person sees in a second and
no pass measures. Settings had two things called Backup, one a file and one
a repo, and the file's line said everything lived in the browser and nowhere
else, which stopped being true the day sync was switched on; it is "Export
and import" now, and says where the other copy is. The week template
editor's seven column feet each said "Week default", for a question most
weeks never answer; the type shows under the column in hand and under any
column whose type is its own, and Copy to sits first so the seven feet line
up on it. The library's loud card said "Next on Reading, Reading" for two
templates with a block of the same name. The low day's one sentence was four
lines of bold at heading size and read as a warning; it is regular weight. An
open goal on North lay over the neighbour below it with nothing to say which
was which in a dark theme, and the neighbour's identity line, showing under
the open half, read as a card with nothing else on it; the open goal carried
an inset edge on three sides, until goals were retired in v2.28. The rollover's aside said "tomorrow has it
anyway"; it says "tomorrow already has it". And the Return hint, a desktop
keyboard's word, is not shown on a finger, where at 390px it had cost the
block editor's title field a third of its width.

**What the rule is from here.** The sweep runs with `--phone` before and
after any change to a base rule, and the pictures are read after every
wave, on the two devices the owner uses. A clean report from a pass is
still what it always was: nothing was found, not nothing is there.

## North is a text

> **Superseded in v2.24, v2.26 and v2.28, in part.** The text is written in one textarea with Save and Cancel and nothing is saved while typing, though leaving the page with the field open saves it; Edit stands at the right of the page's name; the page is the picture with every blank line kept, heading cards and the signature, goals are retired, and the morning brings the picture in a window after sleep rather than opening this page - see "North is one text, goals retired".

The owner asked for one thing in North, in one paragraph: a personal text
they see every morning. A dozen or so short lines, in blocks, a blank line
between blocks. No headings, no bullets, no "when I want to give up"
fields. Just text they type themselves. And the repo is public, so not a
word of it is the app's: it starts empty, the placeholder says where to
write and nothing else, and every line in a test is a generic one.

**It was already there, as the picture.** North had carried a first-person
text over its goals since v2.18, called the picture, written in Compose
behind a label and a hint that suggested what to write. So the model did
not change - one entity, validated, synced under its own key, in every
backup - and the name `picture` stays in the data for the sake of every
backup and repo already holding it. What changed is everything the person
meets: the text is the page.

**Written on the page, saved on its own.** A plain textarea, opened by
Edit under the text or by an empty North, saving half a second after the
last keystroke and whatever is still pending on Done and on the way out.
What is typed is kept as typed; the store trims the two ends of the whole
text and nothing inside it. Compose lost its copy of the field: two ways
to one text is one too many, and the hint under it - first person, present
tense, what you do in the morning - was the app suggesting content, which
the brief forbids. The "picture" explainer went with the word.

**Read as blocks.** A blank line in the text is the gap between two
blocks, two blank lines are still one gap, and each block is the person's
own lines at the largest size on the screen, on a loose line, with nothing
over or around them. Seventy characters of measure, set on the block at
the block's own size - set on the wrapper at the body's size it came to
490px and folded every line of the seed's text in two, which the picture
showed and nothing else did.

**The goals wait under it.** Behind one quiet line: open where there are
goals, since they are the person's words too and the day's North line
draws on them, and closed over the offer where there are none, so a text
with nothing under it is a text with nothing under it. No count on the
line - nothing on this page counts anything, and a number beside the word
would have been the first.

**The morning is the reason it hits.** A page one press away is a page
seen when somebody remembers to press, which on the mornings it is for is
never. So the first open of the app on a new day opens on North, and the
page ends in Start the day: past the words, not above them, so the way on
is the far side of reading. The day it was read is a device fact under its
own key, outside the plan and outside sync, the same reasoning as the
library's open lists: each screen the owner meets that day meets them
with it once, and written to the plan it would have been a commit a day
in a synced repo, for nothing. Never in the demo - a stranger opening the
sample fortnight should meet the day - and never without a text, since
an empty North is an editor, not a morning.

What the research on this kind of text agrees on is small and the design
leans on all of it: the words are the person's own and in their voice
(the app suggests none); they are met at a fixed moment rather than
looked for (the morning opening); they are read whole and in order (the
way on is at the end); and nothing about them is scored, so reading them
never becomes a task with a streak.


## Every press has an answer, and every screen has one thing to do

The rest of the quality wave, parts two to six, in one entry because they
were done in one sitting and share one rule: nothing on the screen may cost
a thought it does not pay for.

**One voice.** Four verbs for making a thing - Make a category, Make a list,
Create a template, Compose - are one now: New category, New list, New
template, and the goals' button said Edit goals until goals were retired in v2.28, since beside the text's own
Edit the word Compose read as a second verb for the same thing. Every button
label on every screen was collected into one list and read as a vocabulary,
which is the only way a vocabulary can be checked, and these four were the
whole of the disagreement.

**An answer to every press.** Every button on every screen was hovered under
a script and its computed style read back, and eleven kinds of control said
nothing at all to the pointer: the segments, the note toggles, the week's
day headers, a scratch row's actions, the core toggle, the seven day
switches, the week's template pickers, the block remove, the library's rows
and folds, North's fold. Each has a hover now, in the one register the rest
of the app uses - colour, edge or ground, never movement - and a segment or a
switch already chosen still says nothing more, because it has nothing more
to say. The transition list was extended to match, so the answer arrives at
the same speed everywhere.

**The first minute.** A fresh open had four filled buttons on it, the tour's
and three starter templates', and a Replan and a Low day for a today with
nothing on it - doors onto nothing. The starters are secondary, the one
sentence that says what to do sits directly above them, and Replan and Low
day appear only on a day that has something to replan; a day ahead keeps
Something came up, which is how a thing gets onto it.

**One clear action per row.** Three templates listed meant three red Delete
buttons before anybody had pressed anything, the loudest thing on a page
whose one job is New template. Deleting is rarer than opening by a hundred
to one, and the place a person is sure which template they mean is inside
it; so the row keeps Edit, and Delete sits at the left end of the editor's
last row, in the danger ink with no edge until armed and filled once armed. The category list in
Settings did the same thing with six rows and does the same thing now: Edit
on the row, Delete inside the editor, then the panel that says what uses the
category and where that goes. A scratch note carried five controls in a row,
To task, Open, To Later, Pin and Delete; the two pressed daily stay in the
row, and the three pressed rarely are behind More, a menu that closes on a
choice, on Escape and on a press outside, and hands focus back to the button
that opened it.

**Settings in plain words.** Read as a document, in the pictures, the
settings page had three faults. Five of the nine sections hid their headings
on an argument that only held on a desktop - the list beside the panel
already named the section - while the four sections written as components
showed theirs, so Week's rows ran straight into a heading that said
Categories and the page read as four sections with loose rows between them.
Every section shows its heading now; on the phone, where the list is a strip
that has scrolled away by the second section, the heading is the only thing
that says where you are. The descriptions had been written as prose about
the app rather than sentences to a person - "every one is a theme somebody
would keep", "for hours that are genuinely a different life", "a backup that
travels the same wire as the thing it is backing up is not a backup" - and
were cut to what a setting does: the theme's line is "The whole app takes
its colours from the one you pick", text size is "Scales all text
together", and Sync's closing aphorism is gone, since Backup's own last line
already says what the three copies are for. The repo paths a person would
look for in the backup repo moved from the paragraph above the fields, where
they were read before the token was, to that last line, which is where
somebody wonders what is in there. Nothing was removed from Settings and no
switch was hidden: every row on it is one the owner presses, and what "fewer
switches" turned out to mean was fewer words in front of each one.

**What was not done.** The morning digest, the second half of part seven,
stays where STATE leaves it: the honest shape is a push that arrives at a
time the owner chooses, and GitHub's cron cannot promise a time. A1, the
sync check against the real GitHub, is the owner's to run, and its checklist
is in CHECKS-BY-HAND.

## A line in capitals is a heading

> **Superseded in v2.24, v2.26 and v2.28, in part.** A heading owns every line to the next heading, North's page is open with nothing on a hover, goals are retired, and on the day the headings stand in the rail with a card of their lines (`NorthDay.tsx`) - see "North is one text, goals retired".

Five things in one message, with a rule over all of them: nothing reworked,
DECISIONS and CONVENTIONS kept, and North's own law - goals are not
measured, there is no streak, and nothing is red. An hour before it, a
message had asked for the goals to go altogether and North to be one text
and nothing else; the owner's second thought kept them and asked for the
form to be lighter instead, and nothing of the removal reached the repo.
What did:

**A heading is a line in capitals.** The lines under it, up to the next
blank line or the next heading, are its text; a line before the first
heading, or after a section's blank line, is free and always shown. There is
no control for any of it and no syntax: the capitals are the formatting,
which is the one kind of formatting a person cannot get wrong and a text
cannot half-carry. Only the reading side knows the rule
(`lib/northSections.ts`): the text is stored as the one string typed and
parsed each time it is drawn, so a backup, an export and a sync carry the
words and nothing the app made of them, and a text with no capitals-only
line reads exactly as it did before there were headings.

**The lines under a heading come when asked, and the page never moves for a
pointer.** On the page at rest only the headings show, at the block's size
and the page's heaviest weight. With a pointer that can rest, the lines
appear under the heading on a hover, over the page, on the page's own ground
- the answer the goal card gives and CONVENTIONS 24's rule - and the layer
takes no pointer: the sweep found the alternative, an open layer standing on
the Edit under it with no way to the button but round the layer. With a
finger the lines open in the flow of the page on a tap and close on the
next, and a keyboard opens one the way a finger does. A heading with nothing
under it is a heading and not a control.

**A goal is a What until more is written.** The form opened six boxes for a
sentence, and the owner called it too heavy. It opens on What and one line,
Add more; the why, the who, the two lists and the rules come when the line
is pressed, the cursor lands in the first of them, and they stay open. A
goal that already carries any of them opens with them showing, since a field
with words in it is never hidden. Nothing about the goal changed: the store
has always saved one with a title alone.

**North's headings on the day.** The day is the one place, the owner said; a
page in the rail is a press away, and a press away is where a text goes
unread. So the headings stand in a row under the North line, in its
register, and a press on one opens its lines under the row, in the flow of
the header. A press and not a hover, on both devices, because the row sits on
the busiest screen in the app and a hover that opened text over the task
list would open it on the way to a task; and in the flow rather than in a
bubble, because the bubble - the first shape, the line's own peek - stood on
the buttons under it, the yesterday banner's on the phone and the calendar's
arrows at 1920, and the sweep said so. A press may move the page; CONVENTIONS
24 is about the pointer. The row is an index and never the text: the free lines stay on
the page. A switch under Nudges turns it off, and only off is ever carried
in the plan - absent is on - so every plan from before the row existed reads
as on without a migration.

**A count instead of a streak.** Beside each block a template put on the
days, Review says how many of the last seven and the last thirty days it was
done on. A count and nothing else - no percentage, no target, no colour, no
word about it - and no streak, so a day a block did not happen changes
nothing but the number, because there is nothing else to change. A block
happened on a day when the task standing for it is done, matched the way the
plan reading matches; the day has to have been stamped from the block's
template, the reading's own rule; a block that stood on no day in the thirty
is not listed. Computed from the days as they are, every time, like
everything on Review, so nothing can drift from the days it describes.

**What the gates found on the way.** A library row's hover was a tint of
ink under the row, and at five percent and again at three the tint took the
count beside a title under 4.5:1 on the light theme; it is an edge now. The
sweep's Compose screen was pressing a button the voice pass had renamed, so
eight pictures could not be reached: a screen name is a test, and a rename
is a change to it. The audit's hit test cannot see a layer that takes no
pointer, so the lines North opens over the page read as text behind the
Edit they stand on; a layer that paints an opaque ground and takes no
pointer is a surface over what it covers now, the reading
`coveredBySurface` already gave a layer the pointer can reach. And the keys
pass measured a stop by its offset in the document, which does not move
when a box scrolls - right for the page, wrong for a list that scrolls
inside a column: the day the header grew a line, the demo's last task
overflowed its list and Tab from it to the Done fold under the list read as
a climb. It measures where a stop is on the screen once focus has brought it
into view, plus the page's own scroll.

## The signature stays on the day, the introduction comes after sleep, and now says its minute

> **Superseded in v2.28, in part.** Goals are retired, the page is a picture, heading cards and a signature, and on the day the signature stands under the day's line only from 21:00 while the rail carries the headings alone - see "North is one text, goals retired".

One message replaced everything asked the same day about North, the day's
timeline and Review's counts, in nine stages, over the rules that hold
everywhere: DECISIONS and CONVENTIONS kept, goals never measured, no streak,
nothing red, no verdict, none of the owner's words in the repo, and every
line in a test a generic one. Where it met what an earlier message had
already built, the earlier work was read first and kept.

**A heading owns everything to the next heading.** v2.23 ended a heading's
text at its first blank line, which cut a heading with two paragraphs in
half and showed the second as a free line. A heading's text is now every
line to the next heading, blank lines and all, and the lines before the
first heading are the introduction, always shown. Capitals stay the only
formatting there is.

**Three hyphens end the headings.** A line of only `---` starts the
signature: everything after it, and nothing after it is a heading, in
capitals or not. A mark rather than a word, because a word would be a
keyword in one language and a line of the text in another, and three
hyphens are what a person already types to close a letter off. The text is
still the one string typed, parsed each time it is drawn, and a backup
carries it back character for character - a test holds that.

**One page, and one field for the text.** North is one column: the goals
as quiet lines at the top, each edited where it stands, a title enough to
save one and the rest behind More; then the introduction, the headings and
the signature at the foot, a little larger with more air above it. The
text is written in one plain textarea with Save and Cancel. Its heading
lines and the mark are drawn heavier as they are typed, by a drawing under
the field that the field's own text is laid over transparently, so the
keyboard, undo, paste, the phone's keyboard and every other thing a real
field does are the browser's own.

**The day carries the signature and the headings, and never the
introduction.** The introduction is read, and the day is glanced at: a
page of it beside the task list would be a page nobody reads twice. The
signature is one line that can stand there all day, and the headings are
an index a press or a resting pointer opens. Where there is a rail they
stand in it, between the templates and the day's numbers, because at the
rail's foot a 768px window needed a scroll to reach them; where there is
no rail they are one line under the day's title. A switch turns it off,
and only off is stored.

**The introduction opens once after sleep, and the clock that says so is
the gap.** The window opens the first time the app is in view after five
hours out of view, and never twice in twelve. Not the sleep schedules:
those say when somebody means to sleep, and the nights this is for are the
ones that did not go to plan. Five hours because a meal or a meeting away
is not a night; twelve because a nap is not a morning. The two moments are
a fact about this screen and live on the device, outside the plan and
outside sync, so each device opens it once. It closes when it is closed -
its button, Escape or a press outside - and never by a timer. It replaces
the morning's opening of the whole North page, which put a page between
the person and a day with work waiting on it.

**The hours and the blocks are one scale, and the scale is not even.**
Measured in a browser, every block and every hour line comes from the same
map of its minute, and CONVENTIONS 4 is why an hour can be anywhere from
nothing to seventy pixels tall. What read as a block drawn at the wrong
hour was an hour's number standing beside a block's body; an hour inside a
block is not labelled now, and the block says its own times.

**Now says its minute, the running block says when it ends, and what is
behind steps back.** The now line is a hairline with a small marker in the
hour column saying the time. CONVENTIONS 23 said the line carries no clock
because the header's clock is the minute; on a grid whose hours are uneven
a line between two labels does not say where between them it is, so the
marker is the grid's scale at now, and 23 says so. The running block says
"ends in 25 min" and, while nothing runs, the next block says "starts in 10
min". Running is the day's own rule, the one the header names: a block
ticked done is not running whatever the clock says, and one ticked done
ahead of its time is not what starts next. Said once: on a wide screen,
where the grid stands beside them, the header names the running task
without its time left and the rail's Up next leaves a start the grid is
already saying; with the grid put away, or on a phone, they say it. What
has ended loses some of its colour and fades its time once, and keeps its
title's ink - three stronger shapes failed the contrast pass first. Free
labels start at half an hour, at the blocks' left, quieter rather than
smaller, since 11px is already the smallest size Today uses. Sleep is one
quiet ground with no rules across it.

**On a phone the day does not scroll itself to now.** The wide grid scrolls
inside its own column and opens with now a third of the way down. On a
phone the grid is part of the page, under the header, and a page that
scrolled itself on open would take the day's title, the running line and
North off the screen to show it.

**Review's counts are a number under each window.** "2 in the last 7 days,
3 in the last 30" was one phrase said again for every block, and on a phone
it broke mid-phrase on most lines. The windows are named once over two
columns, the cells hold digits and nothing else, and the table is never
wider than a line of reading. Nothing about the counts is kept: a test
reads what a tick saves and finds the plan and the tick.

**What the phone found.** Two presses whose 44px targets reached the middle
of a neighbour's: the folded North line two pixels under the goal's line,
and the goal lines at the top of North, which with the list half scrolled
under the top of the screen gave a press on one line to the next. Both were
given room rather than smaller targets.

## North is written on a page, and a textarea decides what the page can show

> **Superseded in v2.26, v2.28 and one look, in part.** The field writes at 16px while the page reads the picture a step larger on a plate, the headings on cards with no tracking and the signature with no rule, so pressing Edit changes the picture's size - see "North is one text, goals retired".

The v2.25 design pass, stage 7, from two messages: the pass's own brief for
North, and a longer one about the editor that the owner queued for after
the pass - a writing place like iA Writer or Bear rather than a form.

**The field is the page.** No edge, no ground, no padding and no halo on
focus: the words stand where the reading page puts them, at 17px and a
leading of 1.7, and pressing Edit moves no line of the introduction. The
caret is the field's focus. The empty field asks "Write who you are." and
shows nobody's words; the example of the shape it used to show is gone,
because a page that suggests sentences is a page that suggests a self.

**Formatting is drawn under the field, and only what cannot move a caret.**
A textarea draws every line in one face, size and leading, so the text is
drawn a second time under it, line for line, and the field's own ink is
transparent - the keyboard, undo, copy and paste and a phone's keyboard stay
the browser's own. That drawing may change anything about a line except
where its letters fall. So while typing: a heading is heavier by a stroke
round its letters, a line of `---` is a thin faint rule across the page in
its own line's height, and the signature's lines are the quieter ink. The
brief also asked for a heading a little tracked and with more room over it.
Both would move every caret after the heading - one letter wider, one line
lower - and a caret a pixel away from its letter is the defect a writing
surface cannot have, so both are the reading page's alone: there a heading
is tracked, and the blank line the person typed is the room. The two
drawings are measured against each other in a browser, not by eye.

**Save is never a broken button.** It waits quiet, in its place and in
the shape a button has when it cannot be pressed yet, until the text is
different - hidden, it left Cancel standing beside a hole - and Cancel is
always beside it. Ctrl or Cmd with Enter is Save; with nothing changed it
closes the field. Escape is Cancel. The rule is one grey line under the
field in sentence case: "Capital lines become headings. A line of ---
starts your signature."

**The page reads the way it was written.** The introduction, a heading's
words and the signature are the writing's size and leading; a heading is
the same size at the strong weight; the air between parts is one line, the
blank line typed there; the signature follows a thin rule and is the
quieter ink. The page's name, North, is smaller and quieter than the words
under it. Going between reading and writing is a fade of about 150ms.

## The day's masthead lies on its columns, and a layer's fills are its own

> **Superseded in v2.26 and one look, in part.** The masthead's parts stand in the day's own grid, its first row running across the rail's column too, and its second row carries a line of North's text rather than a goal's.

The v2.25 design pass, stage 10, and four messages the owner sent while it
ran. Two were about Today on a wide screen: the right-hand side was
cramped, the day arrows in it were not needed with the month beside the
day, the chip, the doors and the progress should start where the task
column starts, the clock should not stand alone on a row of its own, and
the quick add's three boxes should be one line. One was about a status and
the buttons under it, and one about check boxes.

**The arrows leave the wide header again.** They came off after v2.5
because they overflowed and came back in v2.7 under the rule that an
overflowing control is fixed by making overflow impossible, which still
stands. They go now for a different reason: at every wide width the month
in the rail is beside the masthead, with its own pair of arrows and a day
to click, and in a masthead laid on the task column the day arrows were the
one thing that doubled something already on the screen. The phone keeps
them, having no month; the left and right keys and T work at every width.

**The masthead is a subgrid of the day's column and the task column.** Its
right half starts on the task column's left edge and ends on its right edge
whatever the window, and the space between the halves is the space between
the columns. First row: the day's name, its date and the time on one line
over the day, and over the tasks what the day came from at the left edge
and its doors at the right. Second row: the goal's line over the day, and
over the tasks the progress starting on the column's edge and the view
toggle ending on the other. It is 40px shorter than the three rows it
replaced. Where the day's column is too narrow for the running task's name
beside the time, the name goes - the running block on the timeline says it
- and at the task column's floor the bar goes and the fraction says it.
With one pane showing, the right half keeps the task column's floor, so the
chip, the doors and the toggle stay about where they were.

**The task column's floor grows with the window.** `clamp(320px, 30vw,
440px)`: at 1366 the day had 660px and the tasks 320, where every longer
title wrapped and the masthead's right half - 364px of progress, fraction
and toggle - could not stand in the column it heads. It is 410 now and the
day 570. 1024 keeps 320, and from about 1600 nothing changes, the day having
reached its 760 first.

**The quick add is one line of three.** The time, the words and the length
touch: one ground, a hairline of the column's ground between them, only the
outer corners rounded, and one halo round the whole line while any part of
it has the focus. The words' field lost the surface and padding that made it
a card beside two fills.

**A layer mixes its fills over its own ground.** The dark themes' fills are
5% and 10% of the text over the card's ground, and on the raised ground
every sheet, popover and menu stands on, 5% came out the colour of the layer
itself - 1.001:1. Every field, chip, row and secondary button in the task's
sheet, Replan, the gap offers, the journal panel and quick notes had no
shape in the dark, and the light theme's, mixed over the page, always did.
Every element on the raised ground re-mixes the same two steps over it, and
the chosen segment's ground with them; the contrast test holds them in both
dark presets, and fails when something new is painted on the raised ground
without being in the list.

**A status and its actions share a row**, from a third message during the
stage: the owner pointed at a pasted list's count over a separate row of
Add and Cancel, with a gap to the right of the count. The count, a colour's
name in a template's sheet and the calendar's staged days now stand at the
left edge of the row their buttons are on, Cancel and the action at the
right; too short, the buttons wrap under the line. A sentence longer than a
line keeps its band - squeezed beside two buttons it only grows. Every
Cancel that was filled or came after its action is quiet and first, and the
last underlined links are buttons.

**One tick for every check box**, from a fourth: the timer's box looked as
if its tick left the box. The tick was two borders of a rotated rectangle,
placed by numbers for the 24px box and corrected by hand twice for the 18px
ones, and its stroke still sat on the smaller box's edge. It is one path
through a mask now, centred by whatever box it is in.

**Two phone defects the last look found.** The month in the whole journal
had no styles below 1024px - its rules sat in the wide breakpoint from when
the month was only in the rail - and the weighted 44px floor for fields on a
finger undercut the four writing boxes that ask for more, so the journal's
page, a pasted list, a note and quick notes were one finger tall.

**And what was left of the old styles.** The three sheets that were bottom
sheets on a desktop as well - a gap's offers, a task's actions, a gap's
picker - are the centred card from 600px up. The last tracked capitals are
sentence-case labels, every weight is one of the three, every line height
but the smallest boxes' is one of the three, and the retired steps and
tokens are no longer declared. Buttons that were outlined - the Focus
screen's way out, the timer's Try, the floating clock's, Later's, the task
sheet's link to its note - are the kinds; boxes that had an edge - the
evening's card, a calendar's and a restore's rows in Settings, the colour
and library sheets in a template's block row, and the day peek - do not. What is kept, and why, is at the end of docs/DESIGN-AUDIT.md.

## North holds the eye: a line of its words on the day, and a page that is open

> **Superseded in v2.28, in part.** Where the text has nothing for the day nothing stands in its place, and the tour's North step ends on Save; the rail holds a small North and the headings only, and the page is the picture on a plate, the headings on cards and the signature at its foot - see "North is one text, goals retired".

v2.26, from one brief: North worked and held nobody. Under the date the day
showed a goal's name, cut off; the rail's headings read like a menu; the
page opened folded. Five stages, the North editor's last two inside them.

**The day's top is one line of the text, not the goal.** A line from under
a heading - never a heading, a blank line, the introduction or the
signature - whole, wrapping when it is long, with the signature under it in
the quieter ink, and a press on either opens North. A goal's name is a
label; a line somebody wrote to themselves is the thing the page exists
for, and cut off it said nothing. The goal's name stays only where the text
has nothing to give the day: no text, or an introduction alone. The tour,
which writes one line and a goal, ends on the goal as it did.

**Which line is the date's to decide.** The lines for the part of the day,
in the order they were written, one a day by the date's day number. No
random pick, nothing stored and nothing synced: the same date gives the same
line on every device, the next date the next line, and a text of forty lines
is read end to end in forty days. A line changing with each open would be a
slot machine, and one kept in storage would be a second copy of the text to
disagree with.

**Two tags, read and never shown.** A heading ending on `[morning]` gives
its lines to the three hours after waking, one ending on `[evening]` to the
hours from 21:00, and the rest of the day takes the headings with neither.
A suffix in brackets rather than a setting, because the text stays the one
string typed and a backup carries the tags in it; a word the owner named
rather than a symbol, in either case. Waking is the break the window after
sleep already reads - the first time the app is in view after five hours
out of view - written on the device, since it is a fact about this screen.
The morning wins over the evening, so a morning that starts late at night
is still a morning. 21:00 is the hour the brief named, not the evening
setting under Nudges, which asks when the day wants closing: a different
question with its own answer. A part of the day with no lines of its own
takes the untagged ones, and with none of those the signature stands alone.
The tags are only ever seen in the field they are written in, drawn in the
quiet ink there.

**A heading's lines come on a card beside it, and nothing moves.** In the
rail the headings are written as typed, in the reading ink with no
tracking, under a small North and over the signature. A resting pointer or
the focus shows a small card of the heading's lines beside it, its first
line level with the heading, on a layer fixed to the window; leaving takes
it away, a press keeps it, and a press elsewhere or Escape puts it away. The
rail's old way - laying the words over what followed and fading it - moved
the eye even when it moved no box. On a phone the headings fold into the
word North with the caret every fold carries, and a tap on a heading opens
the same card. The group ends with a step of air under it, because flush on
the next notice the word North read as that notice's label.

**The page is for reading, so it is open.** No fold, no hover preview and
no heading that is a control: the introduction in the text's ink and size,
every heading a step larger and heavier with 48px over it and 8px under it,
so it opens what follows rather than closing what came before, and the
signature a step larger again after 72px, the ending the window after sleep
has. v2.25 tracked a heading on the page and drew the signature quieter
after a rule; both went, the first because a heading written as typed is
the rail's rule too, the second because a signature that ends the page is
not an aside. Edit is the page's action and stands where every page keeps
its action, at the right of the title's row, its word on the column's edge;
the row keeps its height while the field is open, so going from reading to
writing still moves no line of the introduction.

## Kitchen: recipes are their own, read by North's rule, and never added up

> **Superseded in v2.30, in part.** Recipes lie on cards by meal, Cook and its count are gone, a meal block walks a list of recipes by the date (`recipeIds`, with `recipeId` kept as the first), and a meal's recipe is chosen in a small Kitchen rather than a select - see "Kitchen, as it was meant".

v2.27, from one brief queued during the design pass: a recipe library that
looks and feels like the Library with data of its own, recipes read the way
North's text is read, a way to cook from one, and meal blocks that point at
recipes. Seven stages. docs/RESEARCH-KITCHEN.md has the evidence behind the
parts that have any.

**A recipe is an entity, not a library list.** The Library is built on units
counted through - a total, a position, a pace - and a recipe has none of
them. `Recipe` is a top-level list in `AppData` by CONVENTIONS 7: one sync
entity per recipe at `recipe:<id>`, a table in the guard, carried whole by a
backup, and absent from every file written before it, which loads as an
empty Kitchen. What it shares with the Library is the look - the page, the
chips, one card of quiet rows, the empty state - built from the Library's
own classes, with nothing of the Library's changed.

**A name and one text.** Ingredients and steps are not fields: a recipe
arrives pasted, and a form of rows is a form nobody fills twice. The
structure comes from North's rule, which now lives in `lib/headings.ts` as
the one parser both texts go through - North passes its two tags and its
signature in, a recipe passes nothing and reads two headings on top:
INGREDIENTS as a list and STEPS as numbered steps, known as the whole
heading with or without a colon, so SAUCE INGREDIENTS stays a heading over
its paragraphs rather than a guess. Nothing parses an amount out of a line.

**The numbers are information on a recipe.** Kcal, protein, carbs and fat
for a serving, servings and minutes, each optional and absent rather than
nought. No day, week or goal reads them; there are no targets, totals, bars
or colours - calorie tracking is associated with eating disorder symptoms,
and this app refuses scores anyway. A row shows kcal and protein, the two a
choice for after the gym is made on; the page shows all four.

**Kitchen is the seventh view, at the end of the rail.** Its own key, 7, so
every key a hand knows still reaches what it did. Eight items in the phone's
bar ran off a 320px screen at 44px each; under 376px each keeps its height
and gives up a few pixels of width.

**Cook is larger, tickable and awake, and forgets.** Over everything like
Focus, a step larger, each ingredient and step a line to tick - a mark on
the place in the recipe, which is what a kitchen full of interruptions takes
from the head - with the screen kept awake through the Screen Wake Lock API
where the browser has it and silently not where it does not. The ticks live
in the screen and go with it: stored, they would be a half-cooked recipe
waiting next time. Done adds one to times cooked, with no date beside it, so
nothing can say how long ago or keep a streak; Close counts nothing.

**A meal points at a recipe, or leaves a kind of meal open.** `recipeId` or
`mealType` on a template block and a task, read only in the built-in Meals
category, by its id - a category the owner made for food is theirs, and a
rule that guessed from a name would guess wrong. The card names the recipe
and a press opens it, or says "Lunch recipes" and opens Kitchen on lunch.
Stamping copies both like the category and echoes them in `fromBlock`, so a
recipe chosen on the day survives the day being opened and a block given a
recipe later reaches the days still holding what it gave. A recipe removed
on another device degrades to the kind of meal, or to nothing. Choosing a
recipe in Kitchen does not write back to the day: the brief asked for the
choosing, and a second way to set a meal's recipe would be a second door.

**One question, asked where it fits.** The same select everywhere a meal is
set up: no recipe, a kind of meal, or a recipe by name. In a template's add
row it replaces the library question for a meal - a meal does not read
through a list, and the two together pushed Add a block onto a line of its
own - unless a list is already chosen, which stays in sight. On a meal
block's row it stands on a line of its own under the row: inside it, it was
one more control on the meals' rows only, and every column of those rows
stood left of the same column on the rows around them.

## One joined line wherever a thing is written in parts

After v2.27, from the owner's screenshots: a template editor's time, words
and length stood as three boxes with gaps between them, where Today's
quick-add had been one line since the design pass, and a Cancel stood alone
on a row under a card with room for it above.

**The line is one set of rules.** Quick-add's joined line became
`.joined-line`, worn by quick-add, both template editors' add rows and the
Library's add line: the parts touch with a hairline of the ground between
them, only the outer corners are rounded, and one halo stands round the whole
line while any part has the focus. Three boxes with gaps read as three forms
to fill in; a task, a block and a book are each one thing being written. A
fourth composite line wears the class rather than copying the rules.

**On a phone it is one block of two rows**, the words across the top and the
controls across the row under them to the same right edge, the four outer
corners rounded and none inside. A wrapped line with its inner corners round
reads as parts that fell apart.

**A lone action joins the row of what it acts on.** The kind question's
Cancel stands at the end of the question's row - the row the card always
has - the rule a status and its actions already keep.

## North is one text, goals retired

v2.28, the owner's final North model, replacing every North brief before
it: goals come out, and North is one text in the three parts the shared
parser already reads - the picture before the first heading, the headings
with their lines, and the signature after `---`.

**Why one text.** Since v2.22 North has been the person's own text, and
since v2.26 the day's top reads it; the goals over it were a second way of
saying the same things, in fields. A goal's title and why are the picture:
who somebody is and where they are going. Its "what I do to deserve this",
its "what I do not" and the rules under it are lines under a heading, which
is where a person writes them when nothing is asking for them field by
field. Two sources meant two editors, a card and a line that had to agree
with a page, and a form that had grown to five fields and a rules list on
the one screen that is not meant to be a form. One text is one editor, one
thing synced, and one thing every surface reads.

**Nothing is lost.** The data stays: `Goal` and `IfThenEntry`, their tables
in `validate.ts` and their sync kinds, so a backup or an older device keeps
every goal and every rule, and they load, merge and export as before.
`afterASlowDay` is still written, required, because an older device's check
refuses a plan without it, and `northDismissedOn` still syncs; nothing reads
either. Where a plan has active goals and its text has no picture part - no
text, or a text that starts with a heading or its signature - the goals'
titles and whys become the picture, one paragraph a goal in the order they
were written, over whatever the text already holds. Title and why only,
because those are the picture-shaped part and the brief named them; the
lists and rules stay in the file. A text that already has a picture is left
exactly as it is: it is the person's own, and goals stacked over it would be
a second picture.

**Once, at every door.** `retireGoals` in north.ts runs in `normalizeLoaded`,
so on every open and every import, and after every sync merge, which never
passes through the load step - the inbox fold's two doors. It archives every
active goal, dated today, whether or not their words moved: an archived goal
is what makes it happen once, so a picture part deleted months later does
not bring the goals back. What it changed is stamped now, like the fold's
tombstones, or a device still holding the goals active would win the next
merge with the older stamps and the move would undo and redo on every round
trip. A plan with no active goal comes back as the same object, so an
ordinary open costs one pass over a short list and re-saves nothing.

**Every reader, replaced or gone.** The day's top shows nothing where the
text has nothing for the day: the goal's name that filled the gap was a
placeholder, and an empty line is not one. The card that brought a goal
forward on a Monday and after a day that got away is gone with its switch:
the window after sleep brings the picture every morning, and a second card
over the day would say it again. The evening close ends on the signature
where it ended on the first goal's name, and on nothing when there is none.
Review's goals and their ages went - an age was a goal's fact, and a text
has none. North's page is the text alone. The tour's North step ends on
Save, its caption pointing at the words kept rather than at a goal's line on
the day. The demo and the sample day carry a text and no goals. The deserve
explanation went; the palette, the shortcut card and North's explanation say
what the text is. The restore summary counts North's lines where it counted
goals, because the text is what a restore could now take away. Two store
areas, four components, a card, their tests and some eighteen thousand
characters of stylesheet went with them, and a test reads the source so that
no screen says goal again and nothing outside the data layer reads one.

**The page reads in three voices, inside the five sizes.** The picture is the
first thing on it, at the page title's step in the text's ink and the
reading weight - larger than the lines under the headings, and still prose
rather than a title. A heading takes the same step in the strong weight: the
scale has had five sizes since one look, and the one over it is the display
size the timer's numerals use, and a
heading is always in capitals, which at the same step in the strong weight
reads as the larger of the two. Its lines are a step smaller, at the reading
size. The signature ends the page a step over those lines, in the quieter
ink so it reads calm, after twice the air a heading has over it.

**The picture keeps its blank lines.** It is drawn as one block of the lines
as typed, so two blank lines are two; the paragraphs the parser makes, where
several blank lines are one break, still serve the headings, the day and
the rail. The field stays one size: a textarea cannot set one line larger
than another without every caret after it landing in the wrong place, so
pressing Edit shows the picture at the writing size, and the lines under the
headings are where reading and writing still stand on the same lines.

**The morning opens on the picture, the evening ends on the signature.** The
window after sleep holds the picture as typed and the signature, the two
parts written to be read whole. The day's top is the day's line and nothing
more until 21:00; from then the signature stands under it, the way it ends
the evening close. The evening is the one the day's line already reads, so a
night shift woken at 20:00 is still in its morning at 21:30 and gets no
signature under its morning line, and a text with no signature leaves
nothing where one would stand. Until v2.28 the signature stood under the
line all day, which put the words a day ends on at its start.

**The rail's North is an index, and it gives way first.** A small North and
the headings, one line each in the small type, a long one cut with an
ellipsis - a wrapped heading doubled its row and pushed what is next and the
day's numbers under the fold of the window. Its lines come on the card they
already came on, and the card opens with the heading whole where the rail
cut it. The signature left the rail: the day's top says it in the evening
and the evening close ends on it, and a third copy beside the day all day
was the weight the rail did not need. The word North folds the headings on
both screens, remembered on the device and never in the plan, because a
phone and a laptop are allowed to disagree about what is folded. Where
nobody has chosen, the rail measures itself once before it is drawn: with
room, North is open; without, North starts folded, since the month, the
templates, what is next and the day's numbers are the day itself and the
headings are an index to a page one press away. Measured once and not on
every change, because a section that folded itself as a plan grew would be
the rail moving under somebody's hand. The whole rail fits a 1920 by 1080
window with five templates and eight headings.

**North is cards on one screen, asked for after the brief.** Once the single
column stood, the owner asked for North to fit one screen with nothing
scrolled, on clean cards with a small shadow, premium and dark - which
replaces the brief's 640px column with no cards. A column cannot fit one
screen: a picture and eight headings of two lines each run to twice the
height of a 1080p window when every part stands under the one before. So the
picture stands on a plate across the top, the first thing seen; the headings
stand on cards in a grid under it, which is what turns a tall page into a
wide one; and the signature ends the page on no card, because a card would
make the words the day ends on one more box to read. The page takes the
frame's whole width, like every page since one look, and the grid
fits as many cards as keep 17rem each, with fewer cards than fit sharing the
whole width so no row stops short of the plate's edge and the columns line
up from row to row.

The cards break one rule of the design on purpose: nothing else resting on
the page casts a shadow, save Kitchen's cards since v2.30. Here each card has the lift a
popover has, a hairline ring and a soft fall of dark, because the owner asked
for it and because on North the cards are the page rather than furniture on
it. In a dark theme a card is matte metal, its top lit a few percent and a
hair of light along its upper edge; a light theme's card is flat, since light
from above on a white card is no light at all. No accent, no border, no
number: the dark is carried by the ground, the plate and the type. Writing
is the one field on a card of its own at the page width, so a typed line
stays a line that can be read across.

## Rotating shifts: a kind is a template, the roster is the stamps, and a sleep belongs to the day it wakes into

v2.29, stage 1, from the owner's brief for rotating factory shifts - the
hardest thing asked of the app, and asked to be right rather than quick.
docs/RESEARCH-SHIFTS.md holds the whole design and the test plan; this is
what was decided and why.

**A day kind is a day template with a letter.** Rest, day shift, night shift
and after nights each already have everything a template has - blocks, a day
type, a sleep schedule, a colour, a name - so a kind is one optional field on
a template, a letter and a place in the tap cycle. A DayKind entity would
name, colour and order a template a second time. After nights is not a fifth
day type: a new value there would fail an older device's validation, and the
type only drives the score, which rest or shift already answers.

**The roster is the stamps.** A date's kind is the kind template stamped on
it, and nothing else holds it, so one kind per date is structural and the
roster already syncs, backs up, restores and outranks the weekday map. A
roster map beside the days would be a second answer to "what is this day",
right until it disagreed with the first. Past dates are drawn and never
changed, the rule every stamp that acts on a stretch already keeps.

**A routine is written once, with a time per kind.** A top-level list; on a
date with a kind it puts one real task on the day - at its kind's time when
that time is free, and with no time otherwise, saying whether it needs a time
or what it runs into. It never guesses a time. Its identity is its routine id
on the task, not a new task origin, for the same reason as the day type: an
older device must still be able to read everything this version writes.

**One rule for midnight: a date owns its waking day.** A block belongs to the
date it starts on - the night shift from 22:00 to 06:00 is Tuesday's - and a
sleep to the date it ends on, the day you wake into. The second half is the
owner's own rotation answered: owned by the day it starts, the night before a
first day shift would come from the rest day's schedule and end an hour after
the shift began, and the night after the after-nights day would have no sleep
at all. Owned by the day it ends, both are right, and a kind's sleep means what
a person means - "on a day shift I get up at five". On a plan where two days
share a schedule, which is every plan today, nothing changes.

**A block is on the wall clock; its real length is computed.** The night shift
ends at 06:00 whatever the clocks do, so a block's time and length are its
start and its end on the clock face, and the time that really passes - nine
hours from 22:00 on 24 October 2026, seven from 22:00 on 28 March 2026 - comes
from the device's time zone wherever an amount is meant. A routine at a time
the clock skips needs a time rather than being moved to one.

**Apply is one commit, idempotent, previewed, and asks about hand edits.** A
change of kind on a date somebody changed by hand - something done, moved,
deleted or placed by hand - names what would go and asks, the way replan asks;
what was added by hand always stays.

**Composing a date never stamps its own kind again** (stage 3). A stamp puts
every block back where its template has it, so a shift moved or deleted by hand
would come back every time a roster was applied; only a change of kind stamps.
A routine's task follows its rule only in the fields it still carries from the
rule. A task that leaves its date by hand - deleted, moved, pushed, sent on -
leaves a skip, so nothing a person took away comes back, and lands with no echo,
so nothing a person put somewhere is moved.

**Busy time reaches past midnight both ways** (stage 3). What still runs in from
the night before is busy time on the day after, and what a routine late in the
evening could run into after midnight, the next date's first blocks and its
sleep, is busy time for that routine. Without the second half a session at 23:30
could be placed across a shift starting at 00:30, which is the kind of case the
property tests exist to rule out.

**One resolver for a day's sleep, and the evening is tomorrow's** (stage 4).
Every reader of a date's sleep asks `sleepOn`, which a test keeps the only
place that works it out - four readers had disagreed about a week template's
column. The bedtime that closes a day is the next date's schedule's, which is
the midnight rule read at the evening end; on a plan where two days share a
schedule nothing changes. A reader's function kept its signature: the next
date's schedule travels in the sleep settings it was already handed, so a
template, which has no next date, reads its own on both sides.

**24:00 is the end of a day, never a time in one** (stage 4). A time past
midnight is written on the next day's clock with "(next day)" wherever a range
ends, and nothing is saved to start at 24:00 - the last start is 23:59. The time
pickers' arrows still wrap round the clock: a documented choice, and the field
shows what happened.

**What runs past midnight is still happening after it** (stage 4). At 00:30 last
night's shift is the running task, its session counts on its own date's clock,
it is busy time for a slot, and it is not "unfinished yesterday" until it ends;
`away` set at 22:00 is still away at 00:30 - until the day wakes, when a new
waking day has begun. Drawing its continuation on the next day is the views'
stage.

**Four defects the audit found were fixed first**, each with a test: taking a
template off a day wiped the day; a task moved onto a day was dropped by a
stamp of another template; Review's month skipped the month after a short one;
the cloud backup read the day of its last copy in UTC. The first two are paths
the roster walks on its first day.

## A night's hours land on the morning after, and a kind reaches the dates around it

After v2.29, at the owner's word: a gym day is always its weekday, at the time
the kind of day gives it; the same with food, because on a night shift lunch
is not lunch; and all of it automatic, with the hardest part named - a date's
kind has to take into account the days that come after it.
docs/RESEARCH-SHIFTS.md section 10 has the whole of it.

A review of every door first. Most of it held: a routine is its weekdays at
each kind's time through every door a kind arrives by; meals are blocks on each
kind's template, with their recipes walking by the date; tonight's sleep is
tomorrow's kind's; last night's shift is this morning's busy time. Two things
did not hold, and both were about the days after.

**A template can hold the hours after its midnight.** A block marked after
midnight is written where it belongs - a night meal at one in the morning, in
the night shift - and a stamp puts it on the date after, as that date's task,
marked with the night it came from (`Task.nightOf`). It happens on the date
after, so it is drawn, ticked and counted there. A stamp of that date keeps it,
the way it keeps what was written by hand; a change of the night's own template
takes it off with the rest of that template's tasks; ticking or moving it is a
hand edit of the night's date, so changing that date's kind asks first; carried
to another date by hand it is that date's own. Before this, a rota of two days
and two nights had no way to say "the night shift eats at one": written in the
night shift, the meal landed at one in the morning before the shift; written in
the kinds that follow a night, it landed after a day shift as well, since the
first night of a run follows one.

Rejected: **a time past 24:00 on a block**, "25:00". Every reader of a time
reads a clock of twenty-four hours, and section 3.4 already settled that a
block's time is on its own date's clock. Rejected: **the night's tasks kept on
the night's own date and drawn on the next one as its continuation**. The meal
at one in the morning is ticked at one in the morning, on the day that is open
then, and a continuation is drawn to be read, not pressed. Rejected: **the app
turning the day after a night into an after-nights day by itself**. What that
day is, is the owner's rota and the owner's kind of day (section 2.1); the app
never changes a date's kind unasked.

**A kind reaches the dates around it.** Composition always measured a date
against its neighbours, but only a date being composed was measured, so a date
given a kind by itself left the days around it as they were: a gym at six on
the Tuesday after a Monday made a night shift kept its six o'clock under the
shift's last hour, and said nothing, since a routine's task with a time says
nothing about where it went. Now, when a date's kind changes - by the roster, a
kind stamped by hand, the weekday map, or an ordinary template stamped over a
kind - the day before and the two after are composed again with the kinds
they have: nothing is stamped on them, and only a routine's task still carrying
what its rule gave follows it, in exactly those fields. Those three because
they are what a date's composition reads of its neighbours: the day before's
evening ends in its sleep, and a night's blocks run into the two mornings
after. A date behind today is not touched. The preview names the days that
follow, and it is read from the same function Apply is (`rosterApplied`), so
the two cannot say different things.

**The weekday map opens the night first.** A date the map is about to give a
template with hours after its midnight is given it when the date after is
opened, if nobody has opened it yet - otherwise the morning after a night would
have its night only once the night itself had been looked at. One date back,
today or ahead, and no further.

The data is two optional fields, `TemplateBlock.afterMidnight` and
`Task.nightOf`, which every older device carries untouched. The first and
second stages the section planned are one: two fields nothing writes are not a
stage anyone could see.

**Stage 3, the editor and the day.** "Next day" is a toggle like Core and
Ongoing, with nothing to read beside it, at the owner's word. The template's
picture is its own day and says the night's hours in the line under it rather
than drawing them at one in the morning, which would draw exactly the mistake
the section fixed. On a phone the four marks, the note and the cross are more
than a line, and the wrapped row left Note and the cross on a line of their
own: the marks stand behind one word there, naming the ones that are on, and
open as a line of their own. The day marks a night's task "last night" beside
the night's letter, and draws its block in the night's colour. And a false
"5h 30 min free" the morning's grid offered inside last night's shift, once the
night's meal was on the morning, is gone: last night's hours are busy time in
the grid's gaps.

**Stage 4, and the first month walked.** Another agent gets a guide
(docs/AGENT-GUIDE.md) and a program reading the backup gets a contract
(docs/BACKUP-FORMAT.md) that a test holds to the guard field by field, so the
contract cannot fall behind a field the backup gains. The first real month,
walked as a dry run, found three things, fixed at once: the cycle now fills
to the end of the month on screen keeping its place, since filling only the
month it started in left every later month to be worked out by hand; the grid
does not offer free time across a sleep; and a template card's separator no
longer stands in front of nothing. The first night of a run waking from an
ordinary night is the owner's to say with a kind of its own - a kind whose
sleep followed the kind before it would be a new feature, and the freeze is
three days away.

## A phone's week keeps a line an hour, and scrolls inside itself

After v2.29, at the owner's word: fix the phone week under a Focus bar. The
week on a phone was fitted to whatever height the page left it, and a Focus
session's bar left seventeen hours about a hundred pixels - every block drawn
under the next, every hour label on the one after it. A floor of room per hour
had been tried in stage 9 and taken out, because it made the page scroll, which
the week is built never to do.

Both hold now. Every hour keeps 16px, a line's room, and the shell is the
window's height on the grid, so where there is not room for the hours at that
the grid scrolls inside itself with its day names held at the top, and the page
stays still - the rule the wide day's grid already had. On a 390x844 phone the
week has the room and nothing changes; on a smaller one the week reads better
than it did, its last hours a scroll away. The agenda is a list and scrolls
the page as before. The phone's week still keeps its waking axis rather than
opening at midnight for last night's shift: opened at midnight, the scroll
would open on the night.

## The morning after a night shift, and a kind by its letter

> **Superseded after v2.29, in part.** On a phone every hour of the week keeps 16px and the grid scrolls inside itself while the page stays still - see "A phone's week keeps a line an hour, and scrolls inside itself".

v2.29 stage 9, from docs/RESEARCH-SHIFTS.md sections 3.3 and 5.

**Last night's shift is yesterday's, and the morning shows what it is still
doing.** A block belongs to the date it starts on, so the day after draws the
shift's last hours at the top of its grid as a band named for yesterday, never
as a block of today's: there is nothing on it to tick, push or drag, because
none of that is today's to do. The week does the same in the next column.

**The band keeps a block's room.** A wide day is fitted to one screen, and a
full one is drawn at nought pixels a minute where only a block's floor keeps a
block on the page; the band was drawn from the minutes and disappeared on the
first full day it met. It is measured with the day's blocks now, and has their
floor.

**The drawn day opens at midnight.** Both on the day and in the week, whenever
something is carried - the same stretch a 05:00 flight already gets. A week of
day shifts with one night in it is drawn over the whole clock, which is what
that week is.

**A phone's week keeps its waking axis.** Three columns fitted to a phone
gave the whole clock nine pixels an hour: the phone's sweep found twenty-four
blocks drawn under the one before them and two hour labels on top of each
other. A floor of room per hour was tried and taken out again - it made the
ordinary week scroll on a small phone, which the week is built never to do.
On a phone the week opens at midnight for nothing, draws what of a
continuation its waking axis reaches, and leaves the rest to the day, which
draws all of it.

**A kind is its letter everywhere its date is drawn.** The roster lays a
month out as letters; the day, the week and the month drew the same dates as a
template's dot and name, so a rota came back as colours. The letter stands
where the dot stood, and in the month right after the date.

**The app does not guess, so it says why.** A routine that lands with no time
says why in the time's place, in the time's register - it needs one on this
kind, or its time runs into a block or into sleep, or the clock skips it that
night. That is the whole of what section 5's conflicts show on a day.

**The evening close pushes only what is behind it.** From half past nine on a
night-shift day the shift has not begun; a block running now has not ended.
Both are tonight's, and the close leaves them where they are.

## Every start corner lines up with another

Between the eighth and the ninth stage of rotating shifts, three messages from
the owner, each with a picture. The week editor's add form: the dots, the
library list and the day switches under their three labels stood at three
different edges, and Add a block and the editor's Cancel and Save took a line
each at the foot of it; the owner asked for everything clean, every corner
matched, everywhere - at the least, every start corner on another start
corner. Then the empty pages, gone through as somebody new would: North's name
was a caption with Write under its line, where the empty Kitchen beside it in
the rail had a title with New recipe at its right, and began 160px further in.
Then the Library's form for a new list: a caption inside the first row and
three labels over boxes of three widths, which the owner called scattered.

**A form of several questions has one label column.** The label's width is the
form's, every answer starts on one edge after it, a sentence's field runs to
the right edge where the form's last button ends, and a field for four letters
is as wide as four letters. On a phone every answer goes under its label, all
of them - the dots and the switches already had to, and one answer beside its
label made two edges again. The new list's form takes the item panel's column,
the one on the same page.

**The colours stand on the edge, and a chosen one's ring outside it.** The
dots were inset by their ring's width so that a chosen first dot's ring stood
on the edge; the owner read the colours, and the colours stood a ring's width
in. A ring outside the edge is what a focus ring already is. Where the edge is
a scroller's, which cuts what crosses it - the quick add on the day - the ring
still stands on it.

**What a press will do stands on the press's row.** The week form's "Adds to
Wed" and Add a block share its last line, the sentence on the answers' edge
and the button on the form's right edge: a line less at the foot, and the
editor's Cancel and Save come up with it.

**An empty page is framed as a full one.** The same title, the page's action
at the right of it, the same column, so nothing moves when the first thing
arrives. Kitchen with no recipes takes the shelf's width. North with no words
has a page's title and Write where Edit will stand; its quiet name stays, and
only over the words it was made quiet for. The Library shows New list on an
empty page too, and Something else - the same form under another name, the
third of its starters - is gone. Every title row is one control tall, so
every title stands at one height: the calendar's arrows keep their 44px target
and hang it outside the row.

**A quiet button at the end of a row stands its word on the edge.** It has no
ground, so its word is its edge to the eye. North's Edit and Kitchen's Back
already stood that way; the Library's Edit, every template's Edit, three
Deletes at the start of a form's last row and the roster's Throw it away did
not.

**Measured, not looked at.** npm run precision has three checks more - a
form's answers on one edge, a quiet word at a row's end, and the frame across
every page empty and full - and eight screens more. Each was run against its
own defect put back, and caught it.

## A template's sleep is set over its picture, and written with the template

v2.29 stage 8, from docs/RESEARCH-SHIFTS.md section 7.

**Where the sleep is seen is where it is set.** A kind of day is its shape and
its sleep together - a night shift is not a day shift moved - and the picture
already drew both; asking for the sleep in Settings, four screens away, was
asking somebody to hold one half in their head while they built the other.

**It stays the schedule's, and says who else it belongs to.** Other templates
may sleep on the same schedule, so the row names them. Copying the window into
the template instead would have been a second answer to when this day sleeps.

**Nothing is written until Save.** The picture moves at once, and Cancel is the
way back, the editor's one rule for everything else in it.

## Applying a roster says what it will do, and every door composes

v2.29 stage 7, from docs/RESEARCH-SHIFTS.md sections 6.1 to 6.4.

**Apply previews, and the preview leaves out what does not change.** A month
of letters rewrites days that already hold something, so Apply says first:
week by week, the letter each date takes and what it costs - routines with no
time, routines that run into a shift or sleep, days changed by hand. Dates
that would not change are counted in one line rather than listed, because a
list of thirty unchanged days hides the three that matter.

**A day changed by hand is asked about rather than protected or overwritten.**
Silently skipping it would leave a hole in the rota; silently rewriting it
would take away an evening somebody had already moved. The question names
what was changed, Leave it answers it for that date, and the date stays in the
draft afterwards.

**Every door that stamps a kind composes it.** A kind can reach a date from
the month's brush, the rail's chip, a week at a time or the weekday map, and a
kind that arrives with its blocks and none of its routines is half a day that
looks whole. The one difference between a hand and the roster: a hand may
stamp a day that is over, because somebody is looking at that date while they
press it.

**A routine's new rule is offered, never taken.** The days ahead were made
from the old rule and may have been looked at since. The offer stands once,
after the save that changed the rule; it moves only what still says what the
rule said, and it has its own undo.

## The roster is a mode of the month, and its draft is the device's

v2.29 stage 6, from docs/RESEARCH-SHIFTS.md section 2.5.

**A rota is read as a month, so it is laid out on one.** It arrives as eight
rows of letters on a photograph from an employer, and the month is the one
screen already shaped like that. A tap walks a date through the kinds, so a
week is seven taps with nothing to choose first, and Clear is the other
gesture rather than a second meaning for the same one.

**In the roster a cell says its kind and nothing else.** The three lines of
what is on a day are what the date will be made of once the draft is applied;
while the rota is being typed in they are in the way of the one thing being
decided, and a cell is 52px tall.

**The draft is on the device, not in the plan.** A half-built month is one
device's scratch of a rota nobody has decided yet: syncing it, backing it up or
exporting it would all be wrong, and a draft inside the plan would be a second
answer to what kind a date is for as long as it sat there. It still has to
outlive a reload, because a month is typed in with the phone in the other hand,
so it lives under its own key and is read defensively - what does not read as a
draft reads as no draft.

## Where a kind of day and a routine are written

v2.29 stage 5, from docs/RESEARCH-SHIFTS.md sections 2.1 and 2.3.

**The letter is the mark.** A template is a kind of day when it has a letter
to draw on a date, so one field says both things and there is no second
switch to disagree with it. Emptying the field is how a kind stops being one.

**Both live on the Templates tab.** A kind of day is a day template, and a
routine is timed per kind: the times a routine is asked for are the templates
in the list above it, read in the same breath. A tab of its own for one list
would be a tab nobody opens, and Settings is for what is decided once.

**Routines are not drawn until a kind exists.** A routine does nothing on a
date with no kind, so with nothing marked there is nothing to show and nothing
to explain - the offer appears the moment a template is marked, which is the
same "offer without installing" this app follows everywhere else.

**Where kinds come in the cycle is the roster's question, not the editor's.**
A kind takes its place at the end when it is first marked. The order only
means anything where a tap walks through the kinds, and that is the month.

## Kitchen, as it was meant

v2.30, from the owner using Kitchen: there will be a lot of recipes, they
should be easy to find and lie on cards like North's, the Cook button is not
needed, recipes should go into a template's meal block the way books go into a
reading block, and numbers typed into a recipe should fill its fields.
docs/RESEARCH-KITCHEN.md section 6 has each part; this is what was decided.

**Cook goes, and what only it did.** The mode, the screen kept awake and the
times-cooked count went with the button: the count had one source, and a number
that can never move again is a false fact on every recipe. The field stays in
the data, because backups and older devices carry it.

**A name alone is a recipe.** A breakfast and its numbers are worth keeping
before anybody types the method. The empty text is the empty string, which the
guard - and v2.28's frozen copy - has always taken, so nothing an older device
reads changed.

**Numbers are read from the text, never from the ingredients or the steps.**
"450 kcal" beside its word fills the kcal field, in English or Lithuanian, and
the field and the text are one truth by CONVENTIONS 16. "30 g protein powder"
under INGREDIENTS is an ingredient, so the lists are never read: the rule that
amounts in a line stay words still holds where it was made.

**Sections by meal, a recipe under every meal it is for.** With many recipes a
flat list is a list read top to bottom. A cookbook's index lists a dish in each
chapter it belongs to, and a breakfast that is also a snack is looked for under
either, so a recipe for two meals has two cards rather than one chosen place.

**Cards with North's shadow, and the Meals colour as Kitchen's own mark.** The
second exception to "nothing on the page casts a shadow", asked for. What makes
them Kitchen's rather than North's is the mark a meal already has on the day:
the Meals category's colour down the edge and a breath of it in the ground. No
colour says anything about a number, which section 3 of the research forbids.

**A meal block walks its recipes by the date.** A reading block reads the next
book because a list remembers where it is. A walk of dinners needs nothing
remembered if the date decides - consecutive dates take consecutive recipes -
so every device gives a date the same meal and nothing new is stored or synced.
`recipeId` is still written, as the first, so a device on v2.29 stamps a meal
rather than none.

**Recipes or a kind of meal, never both.** A block holding both would ask two
questions of one meal. Choosing one takes the other away, and a block that came
in holding both keeps its recipes, the more particular answer.

**Kitchen in small, not a select.** A select listing every recipe by name is a
long scroll through names once there are many. The field opens Kitchen's own
sections and a search. It is not boxed into a height to scroll: a shelf cut at
its foot read as a section with nothing in it, and on a phone it was a scroll
inside a scroll. On a day's details it has no Done of its own, because the
sheet's Done stands under it.

**Add to template makes a new block only on a day template.** On a week a block
belongs to a weekday, and the week's editor is where that is said; a week with
no meal block says so.

## Many recipes at once, and a name that says its meals

> **Superseded in v2.36, in part.** A new device starts with a starting map of meal words and then every meal's own name (`mealWords.ts`), which Settings, Kitchen still rewrites - see "The words a name opens with, and the recipes a block waits for".

Kitchen v2.32, docs/RESEARCH-KITCHEN.md section 7. Three choices here look
unusual.

**The same name is the same recipe.** An import never makes a second recipe of
a name Kitchen has - compared without case, accents or spacing - and writes
over the one there, keeping its id. The alternative, a copy for every paste,
is what an importer usually does, and with thirty recipes pasted twice it is
sixty to clean up by hand. The cost is that two different dishes cannot share a
name; a name is how a person finds a recipe, so two that share one were already
a problem. Written over, a recipe keeps what the text does not say - a number
typed by hand, a meal given on its card - so a second paste is never a loss.

**The words a name starts with are Settings', and start as the meals' own
names.** The brief gave a list of its own - which words say two meals, which
say none. That list is how one person names their food, and the repo is
public, so it is not a default: the app starts with the six meals' names, and
the owner writes their own words in Settings once. The cost is a minute of
typing, once, on one device; the list travels with the settings.

**A block that follows its meal is worked out when a day is stamped, not kept
as a list.** Writing the meal's recipes onto every following block whenever a
recipe changed would give an older device a list to walk, but every recipe
added would rewrite templates on every device, and two devices adding recipes
at once would argue through sync about a list neither person wrote. Worked out
from Kitchen at the stamp, it needs nothing kept in step. The cost: an older
device reads the block as a meal to choose on the day. Nobody is on one for
long, since the app updates itself.

Kitchen went before the rest of the one-look pass. It came in as a brief of its
own, with thirty recipes waiting, and it is a feature - features stop at the
freeze on 2026-09-28, where the look can still be finished as the pass it is.

## Templates and a roster as JSON, by names

v2.33, docs/TEMPLATE-JSON.md. The owner's other agent writes templates and a
rota; the owner pastes them into Settings. Three choices look unusual.

**Names, not ids.** A template is found by its name, a recipe by its name, a
category by its name, a kind by its letter, a sleep by its hours. An id is
the app's own bookkeeping - a string nobody can type, that differs on every
device - and a file written by somebody else cannot know it. The cost: a name
is the key, so two templates of one name cannot both be in a file, and a
renamed template is a new one to the file.

**The roster goes through the Roster's own Apply.** A file's dates are laid
on the plan by `rosterApplied`, the function behind the Roster's Apply and
its preview, so an imported date is composed exactly as a tapped one is - its
routines, its sleep, its night's hours on the morning after, the dates around
it following. A second way onto the dates would be a second set of rules to
drift apart from the first.

**The export is written by hand, not by JSON.stringify.** One block to a
line and a fixed order of fields, so the text reads like the contract's own
example and a person or an agent can change it by eye; and the same plan is
the same text every time, so exported, imported and exported again it is
equal character for character - which the contract's example itself is held
to by a test.

## An older copy is never written over a newer one

v2.34, docs/SYNC-AUDIT.md and docs/SYNC.md. The owner's report: the phone
sometimes wrote its old copy over the desktop's. Nine paths were found, and
each has a test that failed before its fix. The choices worth writing down:

**The first connection asks, and "Take from GitHub" is always the
recommended answer.** A device with nothing of its own takes the shared plan
whole without asking; one with a plan of its own is asked before anything
is written. The recommendation could have followed the facts - recommend
Merge where this device changed something more recently - and it would have
been wrong exactly where it matters: a phone opened this morning has
stamped this morning's day, so it always looks newer. The owner's rule is
that the desktop is the main device and the phone takes; the question
describes both sides, and the desktop answers Merge. Devices that synced
before v2.34 are asked once, because nothing recorded which of them joined
first.

**The backup merges into its file and never into the plan.** A backup that
also brought the file's changes into the device would be a second sync with
none of sync's care - no first-connection question, no waiting for the day.
So the merge goes one way: the file ends up with at least what every device
sent it, and a device's own plan is only changed by sync. What the file held
that this device had never seen is noted and, with sync off here, said in
red.

**Stamps from a clock that is never behind what it has seen.** A hybrid
logical clock rather than a server's: GitHub will not say what time it is
except in the commit it makes, so that is used where it comes - to correct a
device more than two seconds out - and the floor does the rest. A stamp
more than a day ahead of now is not taken as a floor, so one device with its
date a year out cannot drag every stamp after it a year out too.

**The day waits for the first pull, at most five seconds.** Deterministic
task ids for a stamped template would have let two devices stamp the same
day into the same tasks - and then the one opened later, with nothing
ticked, would have won over the one with everything ticked, since its stamp
is newer. Waiting for the pull is what keeps the phone from stamping a day
the desktop already has, and five seconds is a ceiling nobody should meet:
a pull takes about one.

**Three seconds on a phone, eight on a computer.** Thirty kept the repo's
history short and let a change sit unsent for half a minute on a device that
is put away seconds after the last tap. The push on leaving goes with
`keepalive` where the plan fits the 64 KB a browser allows; the rest is
remembered and sent first on the next open. `sendBeacon` was not an option:
it cannot carry the token GitHub needs, nor make a PUT.

**Restore brings back first, and replaces second.** Replacing everything is
still there, armed, and still stamped now - a roll-back that the next sync
undid would be no roll-back - but it is no longer the first press, and it
says that it replaces every device.

## A block that is simply running ends by itself

v2.35, the owner's brief of 2026-09-22, part 1. An ongoing block - a
twelve-hour shift - and a Commute block are done once their end has passed,
quietly, and count as done in the day's score. Ticked by hand before that,
it is done and stays so; said not to have happened, it is not done and the
clock never changes it. Any category can be told in Settings that its blocks
end by themselves; Commute's do until it is told otherwise.

**Written, not worked out on reading.** Done is read in a dozen places - the
score, the review, the evening card, the push offer, the Done fold - and a
second meaning kept beside the stored one would be a dozen chances to read
the wrong one. So the app writes `done` itself: on open, every minute, and
straight after anything else is written, which is what makes a day stamped
at ten open with its eight o'clock commute already done. It is a write the
app makes on its own, so it waits for the page's first pull like the day's
own stamping (v2.34): a block the other device said did not happen is read
before this one decides it did.

**Unticking an ended block says it did not happen.** Otherwise the clock
would tick it back a minute later, and a person who took the tick off would
find it on again. A tick said again takes it back.

**A week back, not the whole history.** The first open after this version
closes the last seven days' shifts and commutes; older days are left as
they were lived, so a month of the review does not change under anybody.

**No length or no time, no end.** "Being at a place" with no hours has no
moment to be over at, and is left for a person to tick.

## The words a name opens with, and the recipes a block waits for

v2.36, the owner's brief of 2026-09-22, part 2.

**The starting map is in the app now.** Kitchen's list of words started as
the six meals' own names, each for itself, and the note beside it said the
rest was somebody's own way of naming their food and belonged in their
Settings rather than in a public repo. The brief asked twice for the map
itself - Breakfast; Lunch, which is lunch and dinner; Pre-gym; After, for
after the gym and dinner; Pack, a packed lunch or a snack; Evening, a snack;
Side, which says none - so it is what a new device starts with, with the
meals it does not name after it. It is a first answer, not a fact about
anybody: no plan, no day and no recipe is in it, every press changes it, and
Settings, Kitchen rewrites the whole list in a minute.

**A name outlives its absence.** A templates file names its recipes, and is
pasted before them as often as after: the week first, the cooking later. A
name Kitchen does not have was dropped with a note, so the block kept only
its meal type and somebody had to go back and put the recipes in by hand.
Now the name waits on the block (`TemplateBlock.waitingRecipes`) and the
block takes the recipe the moment Kitchen has one of that name - pasted,
written, or renamed into it - found by the same comparison an import uses.
An export names the ones still waiting beside the ones found, so a file
written before its recipes still says what it meant.

## An erase takes this device's keys with it

v2.36, the owner's report of 2026-09-22: everything erased on the computer,
and a second later the day was back and the screen had flickered from
"nothing here" to the plan it was supposed to have forgotten.

"Erase all data" removed the plan, the timer, the snapshots and the cached
calendars - and left the sync switch on, with the repo and the token beside
it. So the next load pulled the shared plan straight back in. An erase that
undoes itself is not an erase, and a token left behind on a machine somebody
is handing on is worse than an untidy one.

It now takes every key this app wrote here - by their `dienius:` prefix, so
a key added next year goes too - and says so where it is pressed. **What is
on GitHub stays**: this is a device, not an account. Setting the repo and the
token again brings the plan back, which is exactly how a new device joins.

The crash screen's own reset is deliberately not this. It exists to get past
a state the app cannot render, and sync pulling the plan back afterwards is
the recovery, not the bug.

**And the databases, since the freeze (2026-09-24).** The prefix reached
every key and none of the three IndexedDB databases beside them: the daily
snapshots were cleared by a call of their own, and the photographs in the
notes and the files picked for the Library stayed where they were - a
note's pictures on a machine being handed on, after an erase that said it
removed everything. An erase now deletes all three by name, and a test reads
the code for every database it opens and fails if one is not on the list.
The databases go first and the keys last, and the page reloads as soon as
they are gone, so nothing can write a key back in between; a database that
does not answer in two seconds is not waited for.

## Routines in the templates file

v2.37, the owner's brief of 2026-09-22, part 3, and section 4 of
docs/TEMPLATE-JSON.md. A file could write the kinds of day and the roster,
and not the routines that cross them - so a plan written somewhere else
arrived with half of itself missing and the rest typed in by hand.

**A weekday is 1 to 7, Monday first.** The app keeps 0 for Sunday because
that is what `Date` gives, and a file written by a person or by another
agent should not have to know that. The file never says 0, and the reader
turns 7 into it.

**A length may be one number or one for each kind.** An hour's walk on a
rest day and half of one after a twelve-hour shift is the same routine, not
two - the owner writes one title and a length per kind
(`Routine.kindMinutes`). The file writes one number where there is one, and
a length for every kind where there is any, so the text a plan exports is
the text it reads back.

**A routine may be core.** A shift day counts only what had to happen, and
the medication is exactly that. It is the same mark a block carries, read by
the same score, and it travels with the routine rather than being set on
each day's task.

**Matched by title, like a template by name.** Ids are the app's own
bookkeeping and no file can know them; a routine of the same title is
updated, and what the file does not say is left as it was.

## A kind put on a date by hand, and a date opened again

v2.38, the owner's report of 2026-09-23: a free day by the roster, a shift
put on it by hand, and sometimes both days' blocks on the date, or the free
day's not gone. Every door by which a kind reaches a date by hand - the
rail's chip, the month's stamp bar, the week's chip - was walked in
`handStamp.test.ts`, each rule broken on purpose to see its test go red,
and two things were found.

**An ordinary template over a kind left the kind's routines behind.** The
kind's blocks went and the plain template's came, but the gym stayed at the
kind's time on a date that was no kind any more. A date that leaves its kind
is composed once more with no kind, the way a roster taking a kind off
leaves a date: a routine's task still as its rule left it goes, one ticked
or moved stays.

**Two devices composing a date apart leave it with two of everything.** The
roster applied on both before either had pulled the other's copy - which
sync's own bug made likely (v2.34) - merged into a date with every block
twice and the gym twice, under two sets of ids, one of each ticked. Nothing
stamped such a date again while its kind stayed, so the twins stayed until
they were deleted by hand. Opening a date now folds them (`onceEach`): of
the tasks standing for one block, or for one routine, the ticked one is
kept, else the one moved by hand, else the first. A task written by hand
stands for nothing and is never touched. This is the repair that runs on
every open, beside the one that carries a block's edits to its days.

## A whole shelf pasted at once, and North replaced at once

v2.39, the owner's brief of 2026-09-22, part 4 - the last of "everything in
one paste": the recipes went into Kitchen in v2.32, the templates, the
roster and the routines into Settings in v2.33 and v2.37, and this is the
books and the North text.

**A line in capitals is a list.** A shelf written somewhere else is written
as a list under a name, and the plainest way to say "this is a name, not a
book" in a text with no other marks is to write it in capitals - MAIN, SIDE.
The lines under it go into that list, and a list the library does not have
is made, counting in chapters until its editor says otherwise. The lines
before the first capitals line go into the list the screen is pointed at,
which is offered beside the field. Paste many stands on the empty page as
well as the full one: a shelf written elsewhere is the likeliest first
thing on a fresh device, and the paste makes the lists it names.

**"A title - An author", on the last dash.** A title with a dash in it -
"A book - and its subtitle" - keeps it: the author is what follows the last
dash with spaces around it. A line with no such dash is a title alone. The
author is a field on the item now (`LibraryItem.author`), on the row and in
the item's own fields, because a paste that read it and then threw it away
would be reading for nothing.

**A title the list already has is updated, never doubled** - the same rule a
pasted recipe follows - and it keeps its place, its progress and its id,
which every block bound to it holds.

**North is replaced, not merged.** A text is one thing, and a paste of it
means "this, instead of that": Edit changes lines in place; Replace text
puts a whole text written elsewhere in the old one's place. What it will
make is read as it is typed - how many headings, which are for the morning
and which for the evening, an introduction, a signature - so a text pasted
in the wrong shape says so before the press rather than after. One undo.

## A kind names the kind it is after a night

v2.40, the owner's question of 2026-09-23: two nights, then a free day, and
the free day after a night is another day than the free day after a day
shift - so is a day shift after a night. The separate "after nights"
template was already the model (RESEARCH-SHIFTS 2.1); what the owner named
as the risk was remembering its letter on every run of nights.

**One field on the kind, resolved at every door.** `DayKindMark.afterNight`
names the kind this one is on a date after a night (a kind whose day type
is night). The roster carries `N N L L`; `rosterApplied`, which is the one
function behind the Roster's Apply, the templates file and a kind put on a
date by hand, stamps the first `L` as the after-nights kind and says so in
the preview. The stamp is the kind - nothing is resolved on read, and the
export writes what stands.

**The date after follows.** When the kind before a date changes - a night
arrives by hand, or goes - the date is read again: a rest day becomes the
after-nights kind, an after-nights day becomes a rest day, on down the dates
as far as the change reaches and never behind today. The way back is taken
only where exactly one kind names this one, and never for a kind somebody
wrote on a date themselves: an after-nights day written after a day shift is
what was written.

**Why not a map by the night's letter.** Two night kinds are both nights,
and the day type already says so; one field reads in the editor as one
select, "After a night, this day is". RESEARCH-SHIFTS 2.6 has the rest.

## It fits: the shell is the window's height on every view

One look, stage 4 - rule 6 of the owner's brief of 2026-09-22: on a desktop
no page scrolls, what is long scrolls inside its own box. Today and the
week's grid had been built that way since the wide-screen day
(LAYOUT-WIDE.md) and the week; Templates, Library, Kitchen, Settings and
the week's agenda were "ordinary documents that scroll as documents do",
which the day view's own note called the right thing for a list with no
length limit. The brief says otherwise, and it is right for this app: the
page's name and its action are the frame, and a frame that scrolls away
is not one.

**The shell, not each page.** The fixed height moved from
`.app:has(.main-day)` and `.app:has(.week-grid)` to `.app` at 1024px and
up; `main` became a column; and every page is a head and a `.page-body` -
one class, `flex: 1 1 auto; min-height: 0; overflow-y: auto` - so the
change is one rule and seven wrappers, not seven arrangements. Settings'
body is its layout, with the section list sticky inside it as before; the
two pastes' forms are their own bodies, since a form of thirty rows is the
box. The head is the edge the body scrolls under; no line is drawn for it.

**No gutter is kept.** The first cut reserved the scrollbar's room on every
body (`scrollbar-gutter: stable`), so a card's right edge would not move
between a page that scrolls and one that does not. It put every body's
content nine pixels short of its head on every page, scrolled or not -
North's column no longer ended under Edit's word, and its own walk said
so. The frame the brief holds still is the head's: the title, the action
and the first card's edge, none of which the gutter touches. A body that
scrolls shows its bar at its own edge and is a bar narrower; that is where
a scrollbar stands on any page, and it is not the frame.

**The phone is not touched.** Below 1024px none of it matches, and the
page scrolls where its content is long by nature; the report's list of
those screens gained the editor with its palette open, which is the
editor's page, and the month with its roster, whose rows are a month's.
`e2e/one-look-fits.e2e.ts` holds both sizes.

## A row stays a row: three shapes, never a wrap

One look, stage 5 - rule 5 of the owner's brief of 2026-09-22: a row of
controls that does not fit is made again and never left to wrap. The
measure (`scripts/unify.js`, `wrapped`) found 181 rows wrapping on a
375px phone or at 1920, most of them `flex-wrap: wrap` rows that broke
where the width happened to break them - the quick-add's time and length
under its line one day and beside it the next, the calendar's bar in two
or three rows depending on the month's name.

**Every wrapping row became one of three things**, and the stylesheet's
last section says which for each:

- **A strip** - `flex-wrap: nowrap; overflow-x: auto` - for a row of
  chips: the meals, the lengths, the week editor's presets and day
  toggles, the month's stamp bar, the roster's legend, the marks row and
  its category picker, a segmented control with more choices than a
  phone's width. The row scrolls sideways inside its own box, the way the
  Library's list chips have since v2.19; the page never does.
- **A second row by design** - a grid with a row for each part, in the
  place of a flex row that wrapped into the same shape by luck: the
  quick-add (the line, then the time and the length), the Library's add
  line, the calendar's bar (the arrows and the name; Today and Something
  came up; how to read the week and the mode), the review's nav, the
  editor's last row (Delete on its own, Cancel and Save under it), a
  routine's row, the template's sleep, the roster's bar (its tools, then
  its legend as a strip of its own), a meal block's recipes (the word and
  the summary, then the panel it opens), and the editor's block row. A
  grid is not a wrap: each part has a place, and the place does not move
  with the width.
- **One line that gives up its tail** - `nowrap` with an ellipsis on the
  long part - for the task's meta line on a phone, where the pace's
  sentence ends in three dots rather than pushing the count under the
  time.

**Two rows were made lists.** The Today rail's templates are a column of
chips now, one a line, rather than chips wrapping onto three lines in a
240px rail; the palette is a grid of swatches.

**The editor's block row on a desktop** is a grid too: one line - the
grip, the time, the title giving up its tail, the length, the marks, what
it draws from, the note and the cross, each in a column - with the note
panel and the binding line as rows of their own under it. Before, the row
wrapped for those two by design and the measure counted it.

**A strip is never wider than its row.** The first cut let a strip keep
its content's width (a flex item's minimum is its content), and on a 390px
phone the template editor's marks row pushed the whole page 115px
sideways - the one thing rule 6 says never happens. A strip is
`min-width: 0; max-width: 100%`, and what is in it keeps its size and its
one line, so it scrolls inside its box and nothing else moves.

**What stayed a wrap and why: nothing.** The measure skips a grid, a
column and a nowrap row, so a row that passes it is one of the three
shapes above and says so in the stylesheet; there is no exception list.

**Two things the new rows brought out.** A task's sheet held a meal's
recipes in a body that could not be shorter than its content, so the
sheet grew past the window and its foot stood over the last chips; the
body scrolls now (`min-height: 0`) and the foot stays. And the sweep's
"control covered" asked what stands at the middle of the part of a
control that is on screen - a chip with one pixel left at the edge of a
box it scrolls in was "under" the sheet's foot; a control mostly scrolled
out of its box is further down the box, not covered, and is not asked.

## Nothing stretched: one limit, and the joined line as wide as its parts

One look, stage 6 - rule 4 of the owner's brief of 2026-09-22, the first
thing the owner named: the template's name field stretched across the whole
width with its colour dot left outside it. The measure found 43 fields
wider than 400px on a 1920 screen, the name at 1506, a block's words at
1362, the Library's new-list fields at 1440.

**One limit, `--field-w`, 24rem.** 384px holds a long title, a URL, a
search, a token, and it is the answer's column of a form rather than the
page's width. Every field that reached a page's or a card's width is held
to it at 1024px and up; on a phone every field is narrower anyway.

**A joined line is as wide as its parts.** The block's time, words and
length, and the book's words, amount and Add, are one line of touching
parts. Capping the words alone left the line's box across the card, its
focus ring drawn round an empty tail; the line is `width: fit-content` now,
with its words one field wide, so the parts and the ring end together.

**The colour stands after the name.** The name row is the name, one field
wide, and its colour right after it - the accessory in the field's row,
where the brief put it, rather than at the far edge of the card.

**A narrow dialog's own line is not stretched.** The palette's search is
the palette (560px), a link's field is a task sheet's width (460 less its
room): each is the dialog's line, and the dialog, no wider than the reading
width, is the limit there. The measure says so rather than an exception
list: a field inside a dialog no wider than 640px is not asked.

## One left line, as the eye reads it

One look, stage 7 - rule 2 of the owner's brief of 2026-09-22: in a card
or a form every row starts on one edge; in the owner's other words, every
start corner stands on another. The measure found 79 cards whose rows
started at more than one place. Read one by one, most were the measure's,
not the screens':

- **It counted a row's parts as rows.** The focus bar - its word, its
  task, its presses on one line - was "four rows starting at 54, 94, 142
  and 287". The measure reads a card a line at a time now: things side by
  side are one row, starting where the first of them does.
- **It read a quiet word by its reaching ground.** Delete, More, a list's
  Edit stand their words on the card's edge while the ground under the
  pointer reaches out past it (an edge taken back, DESIGN.md); the measure
  put those rows at 0. A control that paints nothing is read by its words,
  one that paints - a field, a filled button - by its box.
- **It read a key cap by its letter.** A word on a painted ground starts
  where the ground does; a box to tick and a mark (a category's edge, a
  colour's dot) start a row too; a strip scrolled along starts where the
  strip does, not where its first chip went.
- **It asked a row of presses for the left edge.** Cancel and Save, Apply,
  Done, at the right of a form, stand on the card's right edge - the quiet
  words on a row's edge the owner asked for - and are not asked for the left.
- **It asked a line under a title to start at the card's edge.** A row
  whose start stands on a corner of the row directly above it - within a
  pixel - is on an edge, the corner it stands on.

**What was real, and fixed.** A list's "Used by" line was indented to stand
under the list's name and missed it by two pixels (32 where the name is at
6 + 8 + 8 + 8); it is exactly under the name now, from the caret's and the
dot's widths. And when the list's settings opened, the form came between
the name and that line, which then stood indented under a form: the line
is above the settings now, under the name whatever is open. A routine's
row on a phone was three rows, its two presses alone on the last; it is
its name and its presses on one row, the way a status and its actions
stand, and what it is on the row under them.

## One height in a row, and a measure that was proved before it was believed

One look, stage 8 - rule 3 of the owner's brief of 2026-09-22: the
controls in a row are one height and stand on one centre line. The measure
found 366 rows whose controls differed, almost all of them one of a dozen
shapes repeated down a list.

**A press beside a field is the field's height.** A book's minus and plus
were 24px dots either side of a 36px page field; a list's round "new list"
a 20px dot beside a 36px select; the cross by a task sheet's title 36 beside
a 41px title (a padding worked out from a line height the field does not
use). Each is the field's height now - 36 on a mouse, 44 on a finger - and
the round one a circle of that height rather than a dot stretched into a
pill.

**A row's quiet presses are one control tall.** A book's grip was 36 and
the book's own press 21; a list's head 21 beside its Edit at 36; the words'
Delete 24 beside its field; the focus bar's cross 30 beside Expand and
Done. The grip takes the row's height, and each quiet press is a control
tall at least. The presses in a task's meta line - the note, the length,
the book's count, the recipe - are one small box each.

**On a finger the add and the edit are a block's category dots' size**,
20px as on a mouse, each with the 44px ring past it the dots have. They
were 28 on a phone. The other way round - dots of 28 - was tried and
undone: "six enormous dots" is what the targets' rule was written to
avoid, and the row, 28 a dot, no longer fitted its strip on a 390px
phone.

**A writing area is not a control of the row's height.** Scratch's note
field is as tall as what is written in it and grows with it; the presses
beside it stand on its first line, which precision holds. The measure
leaves a textarea out of a row's heights.

**The measure was proved before it was believed.** With rule 2 at nothing,
an 8px indent was planted on a phone's library rows - and not found. Two
blind spots: a row whose every word is inside one wide press (a list's
head, a book's row) was taken for "a row of presses on the right edge" and
left out, and a fold's 6px caret was too small to count as a start. The
exemption is now for a row laid out to stand at the right (justified to
the end, pushed there, or clear of the left line by its own width), and
what the eye sees is read whatever a reader is told (an hour's label kept
from a screen reader still starts the week's picture), a painted shape of
any width starts a row (a chart's first bar), and a field's words are a
corner (the day type's words stand under the name typed above). Fixed, the
measure found the phone's books 8px right of the one being read (a phone's
own indent, gone) and the week template's hours 6px in from the card's line
(they stand on it now), and the plant is found.

**The frame is compared by its centre line, down from main.** Every page's
title stood at one centre line all along; the report grouped by the top of
the title's box, so North's quieter name and Settings' taller heading read
as five places, and a focus session's bar left over from one screen to the
next moved the agenda's by 64px. Measured from main's top and by its centre
line, the title stands in one place per size.

## One screen fails, not the app

The freeze's point 2, 2026-09-23. The owner's brief: a store that cannot be
read, a field nobody expected, an empty template, a date without a kind, a
roster without days, a recipe without a name - none may bring the whole app
down; a clear message in that place, and the other screens working.

**Every page, sheet and panel sits in its own boundary**
(`src/ScreenBoundary.tsx`). The app-wide one in `main.tsx` was the only one:
a page that threw took the header, the rail and every other page with it,
and its one way on - reload - opened the same page into the same throw. Now
a page that cannot draw keeps the page's frame - its name where every
title stands, a card that says the page could not be shown, that nothing
is lost, the error in one line, Try again and Export backup - and the rail
goes everywhere else. A sheet (Focus, the journal, Scratch, replan, the
palette, the shortcuts, the tour, North after sleep) is one line over the
page with Close; a panel of the header or a strip under it is one line in
its place. The page's boundary is keyed by the page, so going to another
page and back draws it afresh. Both carry the sync line's danger mark, the
app's one way of saying something went wrong - not a drawn edge, which the
design pass is retiring.

**None of the six needs the boundary, and a test walks every page to
prove it** (`src/resilience.test.tsx`): each case is written into this
browser's storage and the app's modules are loaded fresh, the way a real
open reads them, and a crash planted in Kitchen was seen before the walk
was believed. The boundary is the net, not the answer.

**A recipe or a template with no name is called what it is on the screen**
- "Untitled recipe", "Untitled template" (`lib/names.ts`) - and stays empty
in the plan. The app never makes one (both editors want a name, a
templates file and a pasted shelf skip a line without one), but a backup
edited by hand can hold one, and the guard lets it in: refusing a whole
file for one blank name would lose everything else in it. Before this, a
nameless recipe was a blank button in Kitchen with no name to read or to
hear.

## A plan that cannot be read is kept, and said

Also point 2. A stored plan that did not parse, or did not pass the guard,
opened as an empty app without a word - and the first thing saved wrote the
empty plan over it. The only copy of somebody's month could be gone
because one byte was wrong, with nothing on the screen to say so.

Now `loadData` keeps the text it could not read under `dienius:unreadable`,
as it was, before anything can be saved over it (`lib/unreadable.ts`); a
line over every page says so ("The plan saved in this browser could not be
read, so Dienius opened without it. It is kept, as it was.") and its What to
do opens Settings, where the row beside Export and import saves it as a
file or, on a second press, forgets it. The line stands until one of those
is chosen.

- **One copy at a time.** A second unreadable plan replaces a first one
  kept, which nobody saved or forgot while a line over every page asked
  them to. The same plan found on the next open keeps the time it was
  first found.
- **Where the copy cannot be written** - storage full, which only a plan
  big enough to fill half of it could cause - it stays where it is, and
  nothing is saved over it until it has been forgotten; the row says why.
  Saving fails the way it does when storage is full, and Settings says so.
- **The plan's own key only.** The demo's and the tour's copies are thrown
  away by design, and a line about a lost plan over a sample would be a
  lie.
- **Not repaired.** A plan the guard refuses is not half-read - a file is
  accepted or refused whole (BACKUP-FORMAT section 2). What cannot be read
  is kept for a person, or another agent, to look at.

Rejected: holding every save while the app runs on an empty plan until the
person chooses. Everything done in the meantime would be lost on the next
reload, which is a second loss to prevent the first.

## A strip in a column keeps its height

Found while looking at point 2's pictures, 2026-09-23: Kitchen's meals -
All, Breakfast, Lunch and the rest - were a 4px band under the page's title
on every desktop, and had been since one look's stage 5 made the row a
strip that scrolls sideways. On a desktop a page's body is a column of fixed
height that scrolls; a strip that scrolls has no height of its own to hold
on to in a column (its least height is nothing), so it gave all of it up to
a shelf of cards longer than the window. The "after" pictures of one look
show it, and no pass saw it: the strip scrolls, so it was not text cut off,
and the chips inside it were clipped by it, so they were not on screen to be
counted.

- **What is in a page's body keeps its own height** (`.review-body > *`,
  `.library-body > *`, `.kitchen-body > *`): the body scrolls, its parts do
  not give way to it. The Library's jump bar over its lists is the same
  kind of strip and had gone the same way on three of its screens - a book's
  panel open, a new list, a list's settings - where the lists grew longer
  than the window.
- **What the pictures show was counted, before and after.** Every control
  and heading that scrolling reaches, on every screen at both sizes, was
  listed at v2.40 and again after this fix and compared: nothing that was
  there before one look is missing now. The same count at stage 8 found the
  meals and the jump bar missing, and nothing else - the proof the count
  sees a loss.
- **Words stay whole in a choice.** The same count, taken with how many
  lines each label runs to, found ten that were one line at v2.40 and break
  now. Two were real losses: the Library's quick starts, a grid of 128px
  cells since stage 5 where "Three reading lanes" broke into three lines
  with room to spare, and a book's Counted in on a phone, where "seasons and
  episodes" broke the same way. Both are strips now, as Kitchen's meals are:
  every choice whole on one line, the strip scrolling sideways where a
  phone is narrower than all of them. The rest are the replan's cells,
  which stage 5 chose to line up and let a long choice take two lines, a
  long press on a phone's Today, and two measures of the count itself.
- **The sweep sees a box squeezed shut** (`scripts/audit.js`): a box that
  hides or scrolls its overflow, less than a control in one direction,
  holding something a control's size more than itself. It reads every box
  that is drawn, not only those with a size to see - the planted one in the
  self-check went to 0px, and a pass reading only what is on screen never
  met it.

## The phone with no network, and a deploy that takes over

The freeze's point 3, 2026-09-23: the production build on the path it is
deployed at, a 375px phone and a desktop, the service worker - the app opens
with no network, the day and the roster work, a backup is saved as a file,
the same when the network goes in the middle of a session, and a deploy
takes over without anybody pressing anything. Checked end to end in
`e2e/offline.e2e.ts` and `e2e/deploy.e2e.ts`, which serves a copy of the
build the way GitHub Pages does and writes a new version over it.

**Found: the app opened offline as an empty page** under a server that
answers `Vary: Origin`, which vite's preview does. The page's own request
for its script carries an Origin the precaching request did not, so every
precached script and stylesheet was a miss. GitHub Pages answers `Vary:
Accept-Encoding` today and the live site was spared by that alone. Every
lookup in the worker ignores Vary now (`public/sw.js`): the cache holds one
build of one origin, and a URL is the whole of what a response is.

**Found: after every deploy the first open said "An update is ready"** over
a page that already was the update. The page is fetched from the network
first and names the new files; the new worker takes charge a moment later,
before its activate step has cleared the old build's cache, and a lookup
across every cache found the old build's page first. The worker answers from
its own build's cache before any other, and a takeover is announced only
when the page running is not the build now in charge (`servesThisPage` in
`pwa.ts`, comparing the script and stylesheets each page names).

**Added: a page left open asks for a newer version when it comes back into
view.** A browser looks for a new worker when a page is opened, and a phone
keeps an installed app alive in the background for days without opening it
again. Now the question is asked each time the app is looked at again, and
the answer is the usual quiet line.

**Kept: no reload the person did not ask for.** Opening the app is enough
to get the new version - on a phone that is most opens - and "Reload" is
there for somebody who wants it sooner. A page in use is never reloaded
under them: a template being built or a recipe being written lives in
memory until it is saved, and a reload at a moment of the app's choosing
would take it. That is what "without anybody pressing anything" means here.

## The page behind a sheet is out of reach

The freeze's point 4, 2026-09-24: every screen passable by keyboard alone,
focus visible. The keyboard pass (`scripts/keys.mjs`) walked the pages; it
walks the sheets and panels over them now too - a task's detail, replan,
the low day, the timer, the header's notes and journal, the journal's page,
the palette, Scratch, the shortcuts, Focus, a template being edited, a
book's panel, a list's settings, North being written.

**Found: Tab ran off the end of a sheet into the page under its scrim.**
Most sheets were marked `aria-modal`, which tells a screen reader the page
behind is not there; nothing told the keyboard, and replan, Scratch and the
journal's page were not even marked. Now every sheet that covers the page
is `aria-modal`, and while one is open everything outside it is `inert`
(`lib/modalInert.ts`, watching the page from App): not focusable, not
pressable, not read. Kept in reach: the sheet's own scrim, which is how a
press beside a sheet closes it, and the tour, which asks for a task's sheet
to be opened and then for Next on its own card (`data-over-sheets`). A
header's panel is not a sheet - it covers nothing and closes on any press
outside it - and leaves the page in reach.

**Three writing surfaces show their focus by the caret**: North's text, the
palette's box and Scratch's note, each the only field of its sheet, drawn
without a halo on purpose (the reason is beside each in the stylesheet).
They say so with `data-focus="caret"`, and the pass takes that as their
ring - declared rather than guessed, so a field that merely lost its ring
is still a finding.

**The pass counts the layers a press opens**, rather than looking for one:
a layer already standing read as this press opening it and Escape failing
to shut it, and one slow close on a template being edited became ten
findings after it.

## A control is named by the words on it

Also point 4: Lighthouse's accessibility audit found the duration control's
button showing "45min" - one word to a screen reader and to somebody
speaking to the screen - and named "45 min long. Change how long.", a name
that does not hold what it shows (WCAG 2.5.3). The minutes carry a space of
their own now, which the flex box they sit in does not draw, and the name
is made of the same words: "45 min", "1h", "1h30". The chips are named "15
min" and so on, where they were "15min". The empty day's three starters
showed "Use this template" and were named "Use the Working day template":
they are "Use this template: Working day" now - the words on the button
first, then whose template it is.

## Eight defects and a reading plan, before the freeze

The freeze preparation, 2026-09-24, after point 5. The rotating-shifts
audit (RESEARCH-SHIFTS.md section 1.3) had found eight things that were not
that feature's and left them for their own time. Each was checked in the
code again before the freeze, all eight still held, and all eight are bugs
under the freeze's own line - the app doing other than it says - so they
are fixed now, each with a test that failed first.

**A week's column scores again.** A column typed shift, night or rest
counts only its Core blocks, and the week editor had no way to mark one:
such a day scored nothing however much of it was done, while the Day type
explanation said the mark appears the moment one of the three is chosen.
The open block's header carries Core beside Key now, on those columns and
not on a full one - the day editor's rule, per column.

**A deleted thing leaves nothing pointing at it.** Deleting a sleep
schedule clears it off a week's own days as well as off days and
templates. Deleting a template takes it off the weekday map; and a map
that still names a deleted template - a plan saved before this, or a map
synced from an older device - counts as unmapped wherever it is read
(`lib/weekdayMap.ts`). Before, Stamp week said it had stamped days it
could not, and the push left today's tasks behind for a tomorrow the map
promised them to and would never give them. A stamped day still keeps the
id of the template it came from ("A stamped day outlives its template").

**The Library puts a list on a day template only.** A week gives a date
only its own weekday's blocks, and the Library's form has no weekday to
give: a block added to a week was on no day and in no column, and the next
try said the week already had one. A week's list block is made in the
week's own editor, and the store refuses the rest.

**A calendar event is cut where it ends on each date.** A length stated as
a duration ran past midnight where the same length stated as an end was
cut there; a repeat written in another zone was cut where the first
occurrence was, so a night shift in UTC was half an hour long all summer;
and an all-day event over three days showed on the first. Each occurrence
is cut at its own midnight now, and an all-day event is on every date it
covers, the ones inside the window only.

**The worker says why.** A file that is neither cached nor reachable
cannot be served either way, but the worker handed the browser an empty
answer and threw the network's own error away. It passes the error on.

**The reading plan is out of the app.** lib/librarySeed.ts was the
owner's own reading plan, and "Load my reading plan" in the palette put it
into anybody's Library - the fix of v1.10 made it wait to be asked, and
left it one command away for every visitor. Nothing of the owner's belongs
in a public repo; the owner's devices have the lists already, by sync. The
command, the seed and their tests are gone, and the test that an ordinary
open writes no library at all stays. The titles remain in the history of
the repo, which only a rewrite of it could take out - the owner's call,
beside the two older commits in OPEN-QUESTIONS.

**And what nothing called.** Six store actions went, with their tests
where a test kept one alive (a behaviour worth holding moved onto the path
the app really takes), and twenty classes the stylesheet kept for screens
that are gone - the reminder toast, the morning line, the month's summary,
the Library's old schedule buttons - with the comments that explained them.

## Sync turned on again asks again, and the right plan can be kept

The owner's report of 2026-09-24: everything set up on the computer and
backed up, sync switched on on the phone - and the phone did not take the
computer's plan. It joined the two, and whatever the phone already held
stayed in beside it.

Three things made that, and none of them was a person doing it wrong.

**A backup does not join.** Backup and sync share a repo and a token, and a
backup writes `data/state.json`, which sync never reads: backing up on the
computer put nothing where the phone's sync looks. The Sync section said
"put the same repo and token into Backup on your other device and it
joins", which read as though it did. It says now that a backup alone does
not join the other device, and that sync goes on first on the device whose
plan is the right one.

**A device that had joined once never asked again.** The first connection
asks a device with a plan of its own which to keep - "An older copy is
never written over a newer one" - but only the first: the record that it
had joined outlived the switch, so a phone switched off, used, and switched
back on merged whatever it held, without a word. A device that was off may
have gone its own way in between; switching it back on is joining again,
and it is asked again. The cost is one question on a device that was only
off for a minute, and it is the right question anyway.

**The right plan had no answer that kept it.** The question offered Take,
which puts the shared plan here, and Merge, which keeps both. On the phone
that is enough. On the computer, when GitHub already held another plan - an
older one, or the phone's, there first - neither was the answer: Take lost
the computer's plan and Merge kept the other. **Keep this one** is the
third: this device's plan in place of the shared one, here and on the other
devices at their next sync, with what only they had taken off them. It is
built from what the app already does - what a merge would hold goes in
unstamped and this device's plan is committed over it, so the difference is
stamped deleted and this device's versions stamped now, the way Replace
everything stamps a backup - and a change made on another device after it
still wins over it. It deletes, so it asks twice.

"(recommended)" came off Take, which it was only on the phone: the same
question can now be asked of the computer, where Take is the wrong answer.
Each answer says instead which device it is for.

## A reading block names its list in the templates file

v2.41, the extra stage of the owner's shift brief of 2026-09-25. A block
could read from a Library list since v1.1 - the day names the list's
current book - but only a block made in the app's own editor: the
templates file had no field for it, so the owner's journal, which writes
the file, could not say that the evening's Read reads from the main shelf.
It had started writing `"library": "MAIN"` on its reading blocks anyway,
and every one came back as a field left out.

**By the list's name, the way a recipe is named.** The same words,
whatever their case or spacing (`sameName`), because the file is written
by a person or an agent that cannot know an id - and because a shelf
pasted into the Library makes "MAIN" into Main.

**A list not there yet waits on the block** (`TemplateBlock.waitingLibrary`,
lib/waitingList.ts), as a recipe not in Kitchen yet does: a file is pasted
before its shelf as often as after it, and a name dropped with a note would
have to be put back by hand. The block reads from the list the moment the
Library has one of that name - pasted, made by hand, or renamed into it -
and an export names the list still waited for, so a file written before
its shelf still says what it meant.

**Missing keeps, `null` takes it off.** A file that says nothing about a
list does not take one away from a block that has it: before this field
every file said nothing, and a binding made in the editor must survive the
next paste. This is `afterNight`'s rule, not `recipes`'s - a recipe list is
the block's own content, and a file that leaves it out means a meal
without one.

**The preview says the book, not only the list.** "Read reads from Main:
A first book" - which book tonight is, is the one thing a person pasting a
week wants to see before Apply, and it is not a note, because nothing is
left out.

**Nothing new decides which book.** The day asks what it always asked: the
list's first book not finished, bound at the stamp and asked again each
time a date from today on is opened (`refreshFromTemplate`); a ticked
sitting and a date behind today keep the book they had.

## A templates file pasted again brings today and the dates ahead along

v2.42, the owner's shift brief of 2026-09-25, stage 2. The owner's journal
writes the templates file, and the owner pastes it again whenever the rota
or a day changes - many times a month - and asked never to have to erase a
date to import it again: today and what is ahead follow the file by
themselves, and what is behind stays as it was lived, so the progress can
be read back.

Until now a paste changed the templates and the roster's kinds, and a date
whose kind stayed was never stamped again ("Composing a date never stamps
its own kind again", v2.29): a block renamed, added or taken away in the
file reached a date only if somebody cleared it or put another kind on it
and back. Opening a date brought a block's time, title, length, recipe and
note along where the day still held what the block gave it
(`refreshFromTemplate`), and nothing more.

**What follows the file, and what does not** (lib/reimport.ts). A date
behind today is left as it was lived. Today and the dates ahead stamped
with a template the file changes follow it wherever they still hold what
it gave them: a changed field arrives field by field, as on an open; a
block the file took away goes; a block the file added arrives. The file
finds a block by its title, so a renamed block is the old one going and the
new one arriving - which on a date nobody touched is the rename. Nothing a
person did is undone: a ticked block stays as it was, even when the file
took its block away; a block moved by hand keeps its time, while its other
fields still follow; a note written on the day stays; a task written by
hand stands for no block and is never touched. A block that was there and
has no task on a date was taken off by hand and stays off: only a block new
in the file arrives.

**Today is cut at now.** The brief asked the one question with no answer
yet - today's unticked blocks whose time is still ahead, and those whose
time has passed - and recommended the answer taken: a block still ahead, or
still running, follows the file; one that has ended is the day as it was
lived and stays, ticked or not; a block the file adds arrives only where it
has not ended. Ended is the block's end on the clock face, its start and its
length, so the shift running now is still today's to change. The same cut
holds for an open now: a template changed in the editor no longer rewrites
the part of today that has ended (`refreshFromTemplate`'s `now`). And a file
that changes today's kind keeps what today has lived - the old kind's ended
and ticked blocks stay beside the new kind's, which arrive where they have
not ended (`keepTodayAsLived`): the Roster's Apply asks first about a date
changed by hand, and a paste has nowhere to ask.

**The preview says it**, in the sentence it already had: "5 dates ahead
refreshed, 12 past dates untouched, 2 ticked blocks kept." - the dates
ahead that will change, the dates behind that carry a template the file
changes and are left as they were, and the ticked blocks whose block the
file changed or took away.

Rejected: stamping every date ahead from the file again. A stamp puts every
block back at its template's time and takes away what has no block, which
is the hand's work this has to keep. Rejected: asking about each changed
date, as the Roster does. A file pasted many times a month that asks every
time is a file that stops being pasted.

## An archive of every lived day, beside the backup

v2.43, the owner's shift brief of 2026-09-25, stage 3 - a new feature, asked
for before the freeze of 2026-09-28. The backup keeps the plan as it is now
and a day's last copy; the snapshots keep a week of one device. Neither
keeps what a day was in a shape the owner's journal can read a month later
to see the progress, and the owner asked for exactly that: everything
archived on GitHub, with dates, with nothing new to set up.

**In the backup's repo, through its token** (lib/archive.ts,
docs/ARCHIVE-FORMAT.md): a file for every lived day under
`archive/days/YYYY/MM/`, and the whole plan once a week under
`archive/weekly/`, named by the week's Monday. On whenever the backup is:
a second repo, or a second token, would be a second thing to set up for
something nobody would think of as separate.

**A day's own shape, not a backup of it.** A reader wants what happened -
the kind, the blocks, what was ticked and when, the meals with their
recipe and numbers, the notes, the score - and not the ids and stamps that
let a plan merge. So a day file names things: a category by its name, a
recipe by its title with its kcal and protein, a book by its list and its
title. The numbers are never added up, as Kitchen never adds them; the
week's file is the whole plan for anything a day file leaves out.

**When it was ticked is kept now** (`Task.doneAt`). A tick said nothing of
its time before; the archive's first reader asked for it. A hand's tick
keeps its moment, and a block the clock marks done keeps its end rather
than the moment the app was next opened - the shift was over at seven,
whoever looked at nine.

**Written once, again only when changed, and never deleted.** The day is
written when it is over - the first open of a new day, after every backup,
or Archive now - and again only when it changes afterwards, which is a hand
coming back to it. The week's file is never written over, whatever changes:
it is the plan as it stood that Monday, and a copy that could be replaced
would not be one. Nothing is deleted by the app: the files are small, and
the history is the point.

**Two devices, one archive.** A day's path is its date, so two devices
never make two files of it. Which copy stands is the sync rule, read off
the day itself: `changedAt`, the newest stamp in the day, and a device
holding an older copy leaves a newer file alone. What this device has
written is kept as a mark of each day's own state (`dienius:archive`) - its
newest stamp, and how many tasks and notes it holds - so a run reads the
repo only for a day that changed, and a device without the record reads
the repo and writes nothing it finds there already. A day changes when the
day does: a recipe retold or a category renamed afterwards leaves the days
that had them as they were written, which is what "nothing else touches
it" means.

**Said, never silent.** One line in Settings, Backup: "Archived until
September 23.", and on the same line what went wrong - a refused token, a
repo not found, no connection - in the danger ink where it failed. A
failure marks nothing, so what waited goes on the next run. Archive now is
beside it.

Rejected: writing the archive into `data/history/`, the backup's one file a
day. That file is a plan, merged from every device that backed up that day,
and the next backup writes over it; an archive has to be a record of the
day, written for a reader, that stays.

## A tick is never lost to a change of kind

The owner's shift brief of 2026-09-25, stage 4: six weeks of the owner's own
rota lived in a test, then changed by hand in the middle - a night added, a
night taken off, a day shift made a night - and the dates after it have to
follow while nothing ticked is lost. The dates followed. The ticks did not:
a kind put on a date - by hand, by the roster, or by a night arriving
before it and turning a free day into the day after nights - stamped the
new kind and took every task of the old one away, ticked or not. A stamp
had kept a tick only when the same template was stamped again.

**A ticked task stays through any stamp** (`applyStamps` and the night's
hours in `stampNight`): the old kind's blocks that were ticked stay on the
date beside the new kind's, and so does a ticked task whose block the
template no longer has. It is what the day did, and the day's score, the
archive and the review read it. What was not ticked goes with its kind, as
before; the Roster's question still names a date changed by hand, since a
move or a block taken off by hand is still what a new kind replaces.

Three tests held the old rule and say the new one now: a removed block's
tick dropped on a re-stamp (`stamping.test.ts`), a free day laid over a
ticked shift leaving no shift (`handStamp.test.ts`), and the night's-hours
property, which now asks every task of a night that is not ticked to stand
for a block of the night as it is (`shiftDay.property.test.ts`).

## Two tabs take in what the other saved

Found in the free hunt of the owner's shift brief of 2026-09-25, stage 7,
by looking where nobody had: two tabs of the app open at once on one
device - the installed app and a browser tab, or two browser tabs. Each
keeps the plan in memory and saves it whole, and nothing told a tab that
another had saved. So a tab left open behind the other saved its older
copy over the other's change the next time anything was written in it: a
tick made in one tab was gone after a tick in the other.

**A tab takes in what another saved** (`takeFromOtherTab` in
`store/core.ts`, hearing the browser's `storage` event, which reaches every
tab but the one that wrote). One entity at a time, the way sync takes in
another device - the later stamp wins, a deletion sticks - and nothing is
stamped, since both sides' stamps already say which is later. The result
is written back only where this tab holds something the other's copy did
not, so two tabs settle in one exchange instead of answering each other
for ever; a copy with nothing new is taken in and not written again. A
write to another key - the demo's sample, the tour's sandbox - is not this
tab's plan, and a text that does not read as a plan is left alone.

Rejected: one tab at a time, the second told to close. The installed app
and a tab left open from yesterday are how people use a planner, and a
second tab that refuses to work is a worse surprise than one that agrees.

**An erase in one tab is followed by the other.** The same hunt, one step
on: Settings, Erase all data in one tab took the plan out of storage, and
the other tab, still holding it in memory, put it back with the next thing
it saved - a block ending by itself a minute later was enough. An erase
that undoes itself is no erase ("An erase takes this device's keys with
it"). A tab that hears its plan taken away, or the whole storage cleared,
writes nothing more and starts afresh, as the tab that erased did. It is a
reload nobody pressed in that tab, which this app otherwise never does;
here the person asked for this device to forget everything, and a tab of
the device is the device.
