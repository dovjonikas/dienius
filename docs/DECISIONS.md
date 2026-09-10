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
longer a streak" near the end of this file. The line this entry drew
between a number you can lose and a number you read did not hold, and the
paragraphs below stand as the record of why it was drawn.)

`dayScore` in `src/widgets/day-plan/score.ts` computes a score from one day's own tasks and
nothing else. Nothing on the day view, the calendar or the North card counts consecutive days,
nothing records a longest run, and no notice ever says a run has ended.

This is a considered omission, not an oversight. A streak turns a single bad day into a reason to
quit the whole system, because the thing being protected is no longer "did I get things done
today" but "did I keep the streak alive," and once a streak breaks there is nothing left to
protect. For a tool aimed at people whose days are already inconsistent by nature, that mechanic
punishes the exact pattern it should be accommodating. The cost of leaving it out is real: streaks
are a proven engagement lever, and this app is deliberately worse at pulling someone back in after
a gap. That is the point, not a gap in the feature set.

The one place a run of days is shown is the Review tab (`highlightStreak` in `src/lib/review.ts`):
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

(The strip went in v2.7 - see "The Year view goes" near the end of this
file. What follows is what it was meant to be, kept because it says how a
picture becomes a scoreboard without anybody deciding it should.)

The year strip (`src/widgets/year-strip/`) is the single feature in this codebase closest to
becoming the thing the app is defined against. A row of one cell per day, colored by template, is
one design decision away from a GitHub contribution graph - and a contribution graph is a streak
tracker with the streak counter hidden, not shown. The idiom itself trains a reader to see an empty
cell as a miss, because on GitHub it usually is one. Borrowing the idiom without also borrowing that
reading took more restraint than building the grid did.

The fix is that a cell only ever has two states worth telling apart, and there is nothing between
them. `buildYearCells` in `yearGrid.ts` colors a cell by its template the moment the day has one,
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
year strip's `yearGrid.ts` while it existed - has to treat a template lookup that comes back empty
as "no template" rather than assuming it always resolves. All of them already did, before this was
ever written down: a dangling `templateId` degrades to an uncolored, unlabeled day rather than
crashing, which is pinned by tests in `store.test.ts` and `DayView.test.tsx` (and was in
`yearGrid.test.ts` until the strip went in v2.7).

## Templates instead of recurring tasks - and the small repeat that came later

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
already writes `defaultData()` back to storage and reloads, and the very next read reports a first
run, for free.

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
"what am I doing now" in two seconds. Every rule already written is still there and `IfThenBoard` is
still the one place they are authored; only where they live moved. `IfThenDayRule` is kept, tested and
currently unmounted - parked for a design worth giving it, not deleted.

> **Superseded in v2.0.** The design worth giving it turned out not to be a placement at all: a rule
> belongs to the goal it protects, and both `IfThenBoard` and `IfThenDayRule` are gone. See "A rule
> with no goal is noise; under a goal it is armour", below.

---

## The calm pass: colour that means something, and a screen that says what is happening now

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
could itself go wrong. Pinned by a test that walks all eight deleted ids.

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
says "this day went by without a plan - that is allowed" rather than inviting a plan for a day that is
over. A future day is a plan: no now-line, nothing counting down, and its free gaps read as available
rather than as missed. Nothing is ever disabled on any of them - a day you cannot fix is a day whose
mistakes are permanent, and the entire push mechanic depends on being able to reach back.

**And the day that is finished says so.** When everything planned is done, the header replaces the running
task with "Day cleared". Without it, a finished day and a day nobody ever planned look the same in the one
place people glance at first, which is the single distinction this whole app turns on.

---

## The clock, the inbox and the nudges: nothing that is not the plan is ever a second place where work lives

Written when these four things shared a dock. They no longer do - the timer and stopwatch are a
popover behind the clock in the header and a small floating widget while one runs
(`widgets/clock/`), the inbox is one of the four shelves under the day (CONVENTIONS section 14),
and the one nudge became two: the interval nudge during focus work described below, and a nudge
before a timed task (`TaskReminder.tsx`), off by default, once per task per day, never while the
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

**Why not a second entity.** A `WeekTemplate` type would need its own place
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
and a taller row shows fewer hours. Each is in STATE section 5 with its
reason.

## Something came up is one sheet, for any day, and it proposes

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
beyond a quiet "...".

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
  there is no service worker and no push subscription. A reminder that
  arrives only when you are already there is not a reminder. Real ones are
  in STATE's "Asked for, not yet built".
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

**What the code keeps, and why.** `LaterItem` is the old `BacklogItem`
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
is gone, with `highlightStreak` and its seven tests. The calendar's month
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
leave the column" at the end of this file.

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

v2.18 asked one question about "61 days lived toward this": can it fall?

It cannot, and the reason is worth writing down because the answer is not
"we checked the screen". `goalAge` is arithmetic on two dates - the day the
goal was written and the day being asked about - and `createdAt` is written
once, by `addGoal` and by the Compose draft, and by nothing else in the
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
nobody's decision; a later change to `updateGoal` or `restoreGoal` that
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

v2.18 asked whether "61 days lived toward this" could fall, found that it
could not, and kept it: `goalAge` is arithmetic on two dates, `createdAt` is
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

So it is gone from the reading page, and `north.test.ts` now holds that
nothing on that page is a number at all - not the age, not a count, not a
digit. `goalAge` and `ageLabel` stay, because the archived fold inside
Compose still says how long a goal was carried before it was put away, and
the review's North line still says an age; both of those are records being
read rather than a page being lived on.

The v2.18 entry above is not wrong and is left standing. What it establishes
- that this figure is not a streak - is still true and is still the reason
nothing about it needed to be feared. It simply was not the whole question.

## A rule has no colour, because the colour did nothing

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
