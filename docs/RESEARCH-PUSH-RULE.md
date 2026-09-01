# The push rule is not one rule - what should replace it

> Written 2026-09-01, after the owner looked at a real day and said the two-push bound is right for
> most tasks and wrong for some. This extends `docs/RESEARCH-ADHD.md` rather than repeating it -
> sections 4, 6, 8, 9, 10 and 12 are cited below by name instead of re-summarized. Same evidence
> labels as that document: Strong, Moderate, Weak, Inference, Folk.

## The problem restated precisely

`MAX_PUSHES = 2` (`src/lib/pushRules.ts`) is one number applied to every task with no exceptions.
`rolloverUnfinished` and `pushTask` (`src/lib/store.ts`) both check `pushCount < MAX_PUSHES` and
nothing else. A task at the bound gets one fixed line, regardless of what the task actually is:
"Pushed twice - do it today, or let it go. Deleting counts as a decision, not a failure."

That line is honest and calm for a task that genuinely stalled. It is wrong for a task that was
never going to be a two-day thing - something waiting on someone else, something that recurs by its
nature, something the owner always intended to carry for a while. Forcing the same do-or-delete
choice onto both kinds treats a structural fact about the task as if it were a lapse.

The founding constraint on any fix: nothing may add a decision before the day can start. Quick-add
is one input and one Enter press, and that does not change.

## Is the two-push bound itself evidence-based

**No. It is a guess, and it should be described as one from now on.** Neither `DECISIONS.md` nor
`BACKLOG.md` cites a reason for choosing two rather than one, three, or five - `BACKLOG.md` states
only what shipped. The push rule predates `RESEARCH-ADHD.md` by one day; nothing in that document was
consulted when the number was picked, and nothing in it names a study that tested a push count
against task completion, in ADHD populations or otherwise. No such study was found in this pass
either. This matters for how freely the number can be changed: it is not defending a finding, it is
defending a shipped default. It can be revised on the owner's own judgment with no research cost.

What the two-push bound is not resting on, even though it might look like it is:

- **Not the Zeigarnik effect.** Section 6 of `RESEARCH-ADHD.md` found the "unfinished tasks occupy
  your memory" claim fails meta-analysis. If the bound was ever meant to "close an open loop," that
  is not a real mechanism.
- **Not decision fatigue.** Section 9 found ego depletion, the theory decision fatigue rests on,
  produced d approximately 0.04 in a 23-lab replication - indistinguishable from zero. A bound cannot
  be justified as preventing a resource from draining, because the resource does not measurably
  exist.

What the bound can honestly rest on, which nothing in the codebase currently says out loud:

- **The four-item working-memory ceiling (Strong, section 7).** Luck and Vogel (1997) and Cowan
  (2001) put active visual working memory at roughly four integrated objects, and Martinussen et al.
  (2005) found the ADHD visuospatial deficit is roughly twice the verbal one. A task list that never
  sheds a stalled item accretes silently, and every stale item sitting in the list at full visual
  weight competes for the same four slots as what actually matters today. This is a real cost of an
  unbounded list, not a manufactured one.
- **Maintenance burden and abandonment (Strong, section 11).** The JMIR scoping review names
  burdensome upkeep as a leading cause of planner abandonment. A list that silently grows because
  nothing ever forces a decision on old items is exactly that kind of upkeep, just deferred rather
  than avoided.

So the bound has a real justification - it is just a narrower and quieter one than "closes an open
loop" or "prevents decision fatigue." It argues for keeping stalled one-off items from accumulating
forever. It does not argue that every task must be treated as a stalled one-off item, which is
exactly the owner's complaint.

## What Lally et al. (2010) says about this specifically

**Strong, and directly relevant.** Missing a single occurrence did not measurably disrupt habit
formation - the behaviour recovered regardless. Applied here: a task's fourth or fifth push is not
evidence of anything going wrong that a forced choice needs to correct. The existing copy already
gets this right for the two-push case ("not a failure"). Whatever replaces the blanket rule has to
keep that framing for a task that goes on being pushed past two, not add a harder line at five or
ten. There is no research basis for believing a later bound would be "safer" - the evidence points
the other way, toward not treating a repeat push as a warning sign at all for a task that has already
been marked as the standing kind.

## How comparable tools draw this line, and what each costs

**GTD's Someday/Maybe list (Allen, 2001).** A task judged not actionable right now goes onto a
separate list, reviewed on a weekly cadence rather than daily. Mechanism: a status, not a count - the
task leaves the daily working set entirely until pulled back. Cost: a sorting decision at capture
time (does this go on the actionable list or Someday/Maybe) and a standing weekly-review habit to
keep the list honest, which is itself a small daily-planning ritual of the kind `RESEARCH-ADHD.md`
section 11 flags Sunsama for. No controlled evidence behind the specific distinction - it is
practitioner methodology refined over two decades, not tested.

**Todoist and Things - no bound at all, and recurrence as a separate object.** Neither imposes a
push limit; an overdue task just accumulates a red date until rescheduled, in bulk if the person
wants. A recurring commitment is not "the same task pushed forward" in either app - it is a
recurrence rule ("every Monday") decided once at creation, and each occurrence is a fresh instance
with its own completion state. Mechanism: structural separation between a one-off task and a standing
one, decided at the moment the thing is created, never revisited. Cost: zero ongoing decisions, but
also no forcing function of any kind for a genuinely stalled one-off - the exact feature Dienius is
trying to keep. This is the strongest real-world precedent for treating "kind of task" as the right
unit rather than the individual instance, and it costs nothing because the decision is made once, at
creation, not per push.

**OmniFocus - defer dates and a Someday/Maybe perspective.** Similar shape to GTD's list, implemented
as a saved filter rather than a separate data structure. Same cost profile as GTD: a sort decision up
front, no per-push friction after that.

**Kanban's "Waiting on" column.** A status change, not a count - a card moved to Waiting sits there
until someone manually moves it back, typically because an external blocker cleared. Mechanism:
explicit state set by the person, once, when they know the task is blocked rather than stalled by
avoidance. Cost: one manual action, taken at the moment the person actually knows the task is
different, not predicted in advance. No controlled evidence; this is convention, and it is the
closest existing pattern to the mechanism recommended below.

**Habit trackers (Streaks, Habitica's dailies).** The clearest structural answer to "is this the same
kind of thing." A habit is never the same instance carried forward - each day is a fresh completion
of a standing commitment, with no concept of a habit being "pushed." A one-off task and a recurring
habit are different object types from the moment they are created. This is the pattern
`docs/DECISIONS.md`'s own "Templates instead of recurring tasks" entry already gestures at without
naming it: a template is Dienius's version of a standing commitment, stamped fresh onto each date
rather than carried forward.

What all of this converges on, without a single controlled study behind the convergence: every
mature tool treats a standing or blocked item as a different kind of object from a stalled one-off,
set apart either at creation (Todoist, habit trackers) or the first time the person notices it is
different (kanban's Waiting column, GTD's someday sort). None of them make the daily user re-declare
the distinction task by task, and none of them ask before the day starts. This is convention, not
evidence - it is the strongest pattern found, but it is a design consensus, not a finding.

## Where the bounded-versus-unbounded distinction should come from

Not from asking. Two places, one for the case that reveals itself in advance and one for the case
that only reveals itself through use:

**Structurally, at template-build time.** A template block already carries `core`, decided once in a
calm moment with no day attached. A block can carry the same kind of decision about whether the task
it produces is a standing one - something the owner already knows, before any day starts, will
outlive two pushes. This covers the foreseeable case and costs nothing at quick-add, because it never
touches quick-add at all.

**Behaviourally, at the moment the bound would otherwise force a decision.** A task that reaches
`MAX_PUSHES` has already told the owner something quick-add could never know: it has survived two
real days without being finished or abandoned. That is exactly the evidence a person would use to
judge "is this actually a stalled one-off, or a standing thing I keep meaning to get to." The do-or-
delete moment already exists and already interrupts the owner - it happens on exactly the tasks that
reach the bound, never on every task, and never before the day begins. Widening that existing
decision to a third branch adds no new decision point; it makes the one that already exists more
honest.

This is the answer to "can it be inferred rather than asked": it cannot be fully inferred without
ever asking, because no signal available at capture time reliably distinguishes a task that will
stall from one that will recur. Pushed-twice is itself the signal. Using it means the "ask" - if it
can even be called that - happens exactly once per task, only for the small minority that reach the
bound, at the one point in the task's life where the answer is actually knowable, not guessed at
before the day starts.

## Recommendation - first choice

**Two changes, one data field, no new screen.**

**1. `Task.unbounded?: boolean`, absent means false.** Follows the exact pattern `core`, `minutes`
and every other optional field on `Task` already uses - a task written to disk before this field
existed loads and behaves exactly as it does today. No migration script, no back-fill.

`rolloverUnfinished` and `pushTask` in `src/lib/store.ts` change their guard from
`(t.pushCount ?? 0) < MAX_PUSHES` to `(t.pushCount ?? 0) < MAX_PUSHES || t.unbounded === true`. An
unbounded task keeps moving every day it is rolled over, exactly like a task under the bound does
today. `pushedForward` keeps clearing `core` and `fromTemplate` as it already does, but does not
clear `unbounded` - the whole point is that this fact travels with the task across days, unlike
`core`, which describes a promise the day's own template made and genuinely should not survive being
pushed onto a day the template never touched.

**2. A third choice at the bound, not a fourth question anywhere else.** `TaskRow.tsx`'s existing
`atBound` block - the do-or-delete note - gains one more control alongside the checkbox and the
delete button, shown only when `atBound && !task.unbounded`: a plain button that sets
`task.unbounded = true` and leaves the task exactly where it is. Copy stays in the same voice the
rest of the app already uses, still stating the choice rather than any judgment about it, for
example: "Pushed twice - do it today, let it go, or keep it moving. Deleting counts as a decision,
not a failure." The three options read as three equally legitimate answers to the same question,
because they are.

Once `unbounded` is true, the maxed-note disappears for that task on every later day - there is
nothing left to decide, so nothing is shown. The task keeps a small, quiet, textual label matching
the existing "core" note's own treatment (`day-score-note` in `DayView.tsx` is the precedent: plain
text, no colour, no icon), so the owner can tell at a glance which tasks are exempt without a new
visual element competing for the four slots section 7 puts a ceiling on. `pushCount` keeps
incrementing for an unbounded task - it stays useful information about how long something has been
carried, it just stops being a trigger.

**Reversibility.** The label doubles as a control: tapping it (or a line in the existing long-press
`TaskActionsSheet`) sets `unbounded` back to false. This is a plain, reversible action with no
confirmation step, the same weight as `setTaskMinutes` - it never carries the two-tap confirm
`deleteTemplate` uses, because nothing is lost by flipping it either way.

**3. Optional, secondary: `TemplateBlock.unbounded?: boolean`.** Copied to `Task.unbounded` in
`applyStamps` at stamp time, exactly the way `core` is copied today. This lets a foreseeable standing
task - one the owner already knows, while building the template, will not resolve in two days - skip
the first two pushes entirely rather than earning the exemption the hard way. This does not touch
quick-add and does not touch any daily decision; template editing is already a deliberate, undated
session. It is smaller in scope than the at-the-bound mechanism above and does not solve the case
that actually prompted this - a task typed by hand today - so it can ship later or not at all without
losing the core fix.

**Why this satisfies the no-new-decision rule.** The do-or-delete moment is not new. It already
exists, already interrupts the owner, and already forces a choice on exactly the tasks that reach the
bound. Nothing here adds a decision before the day starts, and nothing here adds a decision to a task
that has not already demanded one on its own. A task that never reaches the bound is never asked
anything, exactly as today.

## Recommendation - alternative

**Raise the bound and add a genuine Someday/Maybe holding area instead of a per-task flag.**

Set `MAX_PUSHES` higher - four or five - and give the owner a manual "park it" action, available from
the same long-press menu, that pulls a task off the daily rotation entirely into a separate list not
shown on any day until it is manually pulled back. This is the GTD/OmniFocus shape from the section
above, adapted to cost nothing at capture: parking is opt-in, available any time, never forced.

What this buys: a cleaner conceptual split (bounded tasks are pushed; parked tasks are not on any day
at all, so they stop competing for the four-item ceiling entirely, which the first choice's
`unbounded` tasks do not - they keep appearing on the day list forever). What it costs against the
first choice: a new list somewhere in the app, which is a new place to build, maintain and eventually
review - and a raised bound of four or five still forces the same do-or-delete choice onto a
genuinely stalled task, just later, so it does not actually solve "some tasks need pushing more than
twice" for a task the owner has not yet thought to park. It also reopens the review-cadence problem
GTD itself has: a parked list nobody revisits is exactly the silent-accretion cost section 7 and
section 11 warn about, just moved one screen over.

This is the better choice if an unbounded task should stop appearing on the daily list once it is
recognized as standing - if seeing it every day is itself the unwanted behaviour, not just the forced
choice. Nothing in the owner's own framing asked for that; he asked to keep pushing a task, not to
stop seeing it. The first choice is recommended over this one for that reason.

## What is evidence-backed here and what is judgment

**Evidence-backed:**
- The two-push bound has no research citation anywhere in this repo and none was found in this pass.
  It is a guess (confirmed absence, not inference).
- Zeigarnik cannot justify the bound (section 6, Strong - meta-analysis found no effect).
- Decision fatigue cannot justify the bound (section 9, Strong - 23-lab replication near zero).
- The four-item working-memory ceiling is a real cost of letting stalled items accumulate
  unaddressed (section 7, Strong for the ceiling itself; the specific application to a task list is
  Inference).
- Maintenance burden driving abandonment is well supported (section 11, Strong for the general
  finding, no ADHD-specific study).
- A missed push should not be treated as a warning sign, and a later bound is not evidenced as safer
  (Lally et al. 2010, Strong for the general habit-formation finding, applied here by direct analogy).

**Convention, not evidence:** every comparable tool's separation of standing from one-off items
(GTD, Todoist, OmniFocus, kanban, habit trackers). Real and consistent across the field, but nobody
ran an experiment on it - it is accumulated practitioner design, not a tested claim.

**Judgment, not evidence and not established convention:**
- Offering the third option exactly at the point the bound is reached, rather than through a
  separate status or list. No tool surveyed does exactly this; it is a novel application of an
  existing interruption, made to fit the no-new-decision constraint.
- Persisting `unbounded` across pushes rather than treating it as a one-time override.
- Keeping the exemption marker text-only with no colour or icon.
- The template-level field as a secondary, optional addition.
- Recommending the first choice over the alternative - this is a call about what the owner actually
  asked for, not a research conclusion.

## What was looked for and could not be established

- No study tests a per-task exemption from a push or rollover bound, in any task manager, ADHD or
  otherwise. The core mechanism recommended above is original to this document, not validated
  anywhere.
- No study establishes what push threshold, if any, produces better completion behaviour in ADHD
  populations. Two, four, and unbounded are all equally unstudied as specific numbers.
- No study measures whether a person self-declaring a task "standing" changes how often that task
  actually gets finished, compared to a task left under a bound.
- No usage data from this app's own history was available for this pass - only the code was read, not
  the owner's actual `localStorage`, so how many tasks currently sit at the bound, how often, or what
  they tend to be about could not be checked against real use.
- No source explains why the original push rule picked two specifically rather than any other number
  - not absence of a good reason necessarily, just absence of a written one.
