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
picking a template, and because a planned feature (a GitHub-graph style year strip, colored per day)
wants exactly this distinction to color by. The type is there to hang a real scoring difference on
if one ever turns up; today it hangs a label and nothing else.

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
