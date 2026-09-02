# Decisions

Notes for anyone reviewing this repo rather than using the app. Each one explains a choice that
looks unusual next to a typical planner app, what it costs, and why the trade was made anyway.

## localStorage, no backend

Every write goes straight to `localStorage` through `src/lib/storage.ts`. There is no server, no
sync, no API. `AppData` is one JSON blob, validated on the way in and out by a set of type guards
(`validate` in `storage.ts`) so that a corrupted or hand-edited value falls back to an empty state
instead of crashing the app.

The upside is that the app has no infrastructure to run, pay for, or keep patched, and it works
fully offline the moment it is installed. The cost is real: data lives in one browser, on one
device. Clear site data and it is gone. There is no sync between a phone and a laptop. The only
way to move data is the export/import JSON round trip in Settings, which is a deliberate manual
step rather than an automatic one - it means a backup only exists when the person actually took
it. For a single-user day planner that trade reads as acceptable; it would not for anything meant
to be shared or relied on across devices without that habit.

## No accounts

There is nothing to sign in to. `AppData` has no concept of a user. This falls directly out of the
localStorage decision above - without a backend there is nothing for an account to authenticate
against - but it is also a choice on its own: no password to lose, no email to collect, no consent
screen before the first task can be typed.

The cost is the same one as above, restated: no cross-device access, and no recovery path if local
storage is cleared beyond the export file the person remembered to make. A tool for tracking ADHD
time blindness that puts a login wall between a person and their plan has already lost - the whole
premise is that a plan needs to be visible with zero friction, and an account is friction before
the plan even loads.

## No streaks

`dayScore` in `src/widgets/day-plan/score.ts` computes a score from one day's own tasks and
nothing else. There is no streak counter anywhere in the codebase, no longest-streak record, no
weekly summary that rewards consecutive good days.

This is a considered omission, not an oversight. A streak turns a single bad day into a reason to
quit the whole system, because the thing being protected is no longer "did I get things done
today" but "did I keep the streak alive," and once a streak breaks there is nothing left to
protect. For a tool aimed at people whose days are already inconsistent by nature, that mechanic
punishes the exact pattern it should be accommodating. The cost of leaving it out is real: streaks
are a proven engagement lever, and this app is deliberately worse at pulling someone back in after
a gap. That is the point, not a gap in the feature set.

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
picking a template, and because the year strip (`src/widgets/year-strip/`, colored per day) wants
exactly this distinction to color by. The type is there to hang a real scoring difference on if one
ever turns up; today it hangs a label and nothing else.

## A year strip with no in-between

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
clears its core flag rather than carrying it along (`rolloverUnfinished` in `src/lib/store.ts`,
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
`src/lib/store.ts` only removes the template from the list - `DayPlan.templateId` on a day stamped
from it is left exactly as it was, now pointing at a template that no longer exists.

This follows the same reasoning as `dayType` and `core`: both are copied onto the day at the moment
of stamping rather than looked up live, specifically so that editing or deleting a template later
cannot silently rewrite what already happened. Clearing `templateId` on delete would break that
consistency for no real gain - a stamped day is a fact about a date, not a live pointer that should
go stale-safe the moment its source is gone. The alternative once considered - clearing the
reference so nothing has to guard against it - was rejected because a stamped day earning a blank
slate on deletion, while its tasks, its color history, and its score all stay put, would be the odd
one out rather than the consistent choice.

The cost is that every place that reads `templateId` - `DayView`, `CalendarView`,
`src/widgets/year-strip/yearGrid.ts` - has to treat a template lookup that comes back empty as
"no template" rather than assuming it always resolves. All three already did, before this was ever
written down: a dangling `templateId` degrades to an uncolored, unlabeled day rather than crashing,
which is pinned by tests in `store.test.ts`, `DayView.test.tsx`, and `yearGrid.test.ts`.

## Templates instead of recurring tasks

Most planners represent a repeating commitment as a recurring task: "every weekday, 09:00, standup."
Dienius has no recurrence engine. Instead, a `Template` is a named, coloured list of time blocks
that gets stamped onto specific calendar dates (`applyStamps` in `src/lib/stamping.ts`), one date
at a time, with the stamps staged in the calendar view until an explicit save.

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
tax, but it is still more clicking than a recurrence rule would ask for.

## A hand-rolled service worker

`public/sw.js` is written by hand rather than generated by `vite-plugin-pwa` or a similar library.
`scripts/generate-sw.mjs` runs after every production build, hashes the built output, and writes a
versioned cache name plus a full precache list directly into the worker file.

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
rest day, and a night shift are written as an actual person's day (specific titles, real times, a
night shift that runs a genuine eight hours) rather than a "Task 1, Task 2" scaffold, because this is
what a brand new person will assume the app is for. `docs/RESEARCH-ADHD.md` section 12 rules out a
guided multi-step flow and any coach marks or tour; nothing here is a flow. A person can ignore the
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

## Relatedness is the motivator local-first cannot serve

Self-determination theory identifies three needs that sustain motivation, and is the best-evidenced
account of what motivates people with ADHD specifically (Morsink et al. 2022): autonomy, competence,
relatedness. Dienius serves the first two. Autonomy - the app never auto-schedules and never decides
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
- **Theme discovery gets one onboarding line, not a moved gallery.** The eleven themes stay under
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

## The sleep window is explicit, greyed on the grid, and split by day type

The fixed 07:00-23:00 waking window (13:00-24:00 on a night day) in `capacity.ts` was never configured
per day, but it was also never visible - hours outside it were simply absent from the timeline grid, so
neither the free-time figure nor its own shape on screen said why. `Settings.sleepWindow` and
`Settings.nightSleepWindow` replace the two hardcoded constants with two set-once fields, each a
bedtime/wake-time pair, both defaulting to the exact inverse of the windows they replace - an existing
install that never opens Settings computes and draws identically to before.

**Two windows, not one, because a day's own type already says which applies.** The alternative - one
global sleep window used for every day - cannot represent a real night-shift worker's actual life: their
daytime sleep hours are not a predictable offset from their ordinary night's sleep, they are a different
schedule entirely, and only the owner can state it. `dayType` already exists precisely to carry this
distinction; reading it here is not a new decision, the same reasoning `windowFor`'s original fixed
`NIGHT_WINDOW` shift already rested on. What changed is that the night window is no longer a guess
baked into the code - it is exactly as tunable as the ordinary one.

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
line carries the clock time on a filled chip in the gutter, because it lands wherever the minute falls,
often straight on top of an hour label.

**One task is current, and three places say so.** `activeTask` in `capacity.ts` picks it: timed, sized,
not done, containing the clock, later start wins where two overlap. Its block gets a ring in the now
colour over whatever category colour it already had - "current" and "what kind" are two signals that
never overwrite each other - its card gets the same ring plus a countdown, and the header states it in
plain text: `15:21 · Meetings · 39 min left`. Deliberately narrow about all three conditions: an unsized
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
