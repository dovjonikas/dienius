# Dienius - the timeline, and what replaces the if-then board

> Written 2026-08-31 after the owner used the app for a day and said the flat today-list does not
> work for him, that he wants an hour grid showing occupied time like the calendar apps do, and that
> the if-then board is dead weight as built. This doc is the design answer to both. Read
> `docs/DECISIONS.md` first - several choices here deliberately contradict what a normal calendar
> would do, and the reasons matter.

## 1. The problem with a flat list, honestly

A list of items with optional start times cannot answer the only question that matters at 9am:
**does today actually fit?**

Eight tasks look identical to three tasks plus a five-hour shift. The list has no notion of how much
of the day is already gone, so it invites planning a day that was never possible - and then the
score at the end measures a person against a plan that was fiction from the start. That is the exact
guilt the no-guilt score was built to avoid, arriving through a side door.

## 2. Why NOT to copy Google Calendar

The obvious fix is a grid where everything gets a slot. That fails for this owner specifically, and
the reason is in the brief: **times are anchors, not a minute grid.** Fix only what is really fixed.

Every calendar-first planner dies the same way. It demands a decision for every item (when exactly?),
most items have no honest answer, so the person either invents one or stops using the app. Placing a
task at 14:30 that could happen any time between lunch and evening is a lie you have to maintain.

So the grid stays, but it stops being a placement surface and becomes a **capacity surface.**

## 3. The twist - anchors, floats, and the gap between them

Three ideas, and the third is the product.

**Anchors** are things with a real time: the shift, the gym class, the call at 16:00. They are drawn
on the grid at their actual position, with a real height, because they genuinely occupy that time.

**Floats** are everything else: publish the video, guitar 20 minutes, call grandma. They have a size
but no position. They sit in a tray under the grid, unplaced, and that is a valid final state - a
float never has to be scheduled to be done.

**The gap** is the point. The app computes the free time between anchors and compares it against the
total size of the floats:

```
Anchors take 6h10. Free: 5h20 across 4 gaps.
Floats need about 6h. You are 40 min over.
```

That single line is the whole feature. It is the thing a list cannot say and a calendar refuses to
say, and it is the ADHD-relevant one: time blindness is not fixed by more boxes, it is fixed by
seeing the arithmetic before the day starts instead of at 23:00.

**No auto-scheduling.** Motion and its imitators place your tasks for you. Do not. The moment the app
decides where things go, the person stops holding their own day in their head, which is the one thing
the brief says the product is for ("kad jau turetume viska ir reiktu tik daryt kaip per pamokas" -
his words about knowing the day, not being told it).

## 4. What this needs in the data model

One required change and one optional field. Both are additive, both default to today's behaviour.

```ts
export interface Task {
  // ...existing
  time?: string          // start, already exists - now means ANCHORED at this time
  minutes?: number       // NEW. Estimated size. Absent = unsized.
}

export interface TemplateBlock {
  // ...existing
  minutes?: number       // NEW, same meaning - templates carry sizes so a stamped day arrives sized
}
```

A task with `time` is an anchor. A task without it is a float. That distinction already exists in the
data by accident - this just gives it a name and a consequence.

`minutes` absent means unsized, and unsized floats are counted separately ("+3 unsized") rather than
guessed at. Never invent a default duration; a wrong number is worse than a missing one because it
silently poisons the capacity line.

**Default sizes come from templates, not from the app.** When he builds a "Full day" template he sets
gym 90, guitar 20, deep work 120 once, and every stamped day inherits them. That is the
decision-once principle applied to duration, and it means the capacity line works from day one
without him ever typing a number into a task.

## 5. What the day view becomes

Three zones, top to bottom, on one screen at 375px.

**Zone 1 - the capacity line.** One sentence, the arithmetic above. Never red, never a warning icon.
When floats exceed free time it says so plainly and offers one action: "trim". Trimming moves a float
to tomorrow, which is the existing push mechanism with a new entry point.

**Zone 2 - the grid.** Vertical hours. Two rules that separate it from every calendar:

- **It shows only the waking window that is actually in use** - first anchor minus an hour to last
  anchor plus an hour, not 00:00 to 23:59. A day with two anchors should be two blocks and some air,
  not a wall of empty rows to scroll past.
- **The gaps are drawn as real objects,** not as blank space. A 90-minute hole between the shift and
  the gym is a labelled, tappable region: "1h30 free". Tapping it offers the floats that fit. That is
  the one calendar-like interaction worth having, and it is opt-in per gap rather than mandatory for
  every task.

Anchors show a title, their time range, and the day-type colour they came from. Nothing else fits at
375px and nothing else is needed.

**Zone 3 - the float tray.** The current task list, unchanged in behaviour: quick add, check off,
push. Each item shows its size as a small chip if it has one. Dragging a float onto a gap anchors it;
dragging it back to the tray un-anchors it. Drag is a convenience, never the only path - a long-press
menu does the same thing, because the calendar drag already has a documented history of not working
on touch in this repo.

## 6. What replaces the if-then board

The board is not a bad idea badly built. It is a correct idea in the wrong place.

Implementation intentions work because the decision is already made when the trigger arrives.
A separate tab requires a person to remember to open it - which is precisely the state they are not
in when the trigger fires. A rule nobody reads at the right moment is not a rule, it is a note.

**Delete the tab.** Keep the data. Change where it appears.

**Attach rules to day types.** An `IfThenEntry` gains an optional `dayTypes?: DayType[]`. Night-shift
rules only surface on night days. This is where his real ones live: the sleep protocol matters on a
night, not on a rest day.

**Surface exactly one, on the day view, under the capacity line.** One rule, quiet, no styling that
demands attention. It rotates: the one most relevant to today's type, then least-recently-shown.
Tapping it opens the full list, which is where editing lives.

**Add optional time bands.** A rule can carry `when?: 'morning' | 'day' | 'evening' | 'any'`. The
evening trigger surfaces in the evening. This is a two-line change and it is most of what makes the
feature actually fire.

Still nothing is measured. No "did you use this rule" counter, no streak, no done flag. The moment a
rule becomes a task it stops being a pre-made decision and becomes one more thing to fail at - that
reasoning is already in `docs/DECISIONS.md` and it stands.

## 7. What is worth taking from other planners

- **Sunsama** - the daily planning ritual and, crucially, the planned-time-versus-available-time
  readout. That readout is the direct ancestor of the capacity line. What to skip: the ceremony. It
  is a five-minute guided flow every morning and it is too much for someone who wants zero decisions.
- **Structured (iOS)** - the visual timeline that reads as a single ribbon rather than a spreadsheet.
  Worth stealing the shape. What to skip: it wants everything placed.
- **Amazing Marvin** - built for ADHD; time estimates on tasks and a "today is overcommitted" signal.
  What to skip: everything else, it drowns in options.
- **Motion / Reclaim** - auto-scheduling. Explicitly do not copy, see section 3.
- **Google Calendar** - the only thing worth taking is the hour grid's legibility at a glance.

The synthesis: Structured's ribbon, Sunsama's capacity readout, Marvin's estimates, and the
push rule and no-guilt score that are already this app's own.

## 8. Build order

1. **Done.** `minutes` on `Task` and `TemplateBlock`, plus the size chip in the template editor.
   Additive, nothing else changed. A task's own size can also be set or changed after the fact
   through a quiet control on its own row - never through quick-add, which stays one input and one
   Enter. `validate()` in `storage.ts` accepts both shapes: absent minutes loads exactly as it did
   before this field existed, and a present value must be a non-negative whole number or the payload
   is rejected the same way a bad `pushCount` already was.
2. **Done.** `capacity.ts` - pure functions: free gaps from anchors, total float size, the resulting
   sentence. Unit tested with no React anywhere near it, same as `score.ts`.

   The window free time is measured against - the question section 3's own example raised without
   answering - is **the span from the earliest anchor's start to the latest anchor's end, and
   nothing else.** Not a fixed waking window (07:00-23:00 is wrong for a night shift), not something
   read off the day's type (still an invented number, now hiding behind a setting). A window built
   only from the day's own anchors needs no configuration at all, which is what section 9 actually
   asks for: it degrades correctly with no special-casing - one anchor produces a window equal to its
   own span (zero free time, zero gaps), and zero anchors produce no window, reported as `null` and
   left out of the sentence rather than guessed at. An anchor with no `minutes` of its own still
   marks its point on the timeline - it can still separate two real gaps - but contributes nothing to
   the occupied total, the same "never invent a duration" rule section 4 already states.
3. **Done.** The capacity line on the day view, one plain sentence at the top, plus the "trim" action
   for the over case - a single tap that pushes the largest eligible float to tomorrow through the
   same `pushTask` mechanism `rolloverUnfinished` already uses, bound by the same `MAX_PUSHES`. Never
   red, never an icon, never a warning word; "about" appears exactly once, on the floats estimate,
   since that is the one number built from guesses rather than clock time.
4. The grid, read-only: anchors and labelled gaps, collapsed window.
5. Gap interaction: tap a gap, pick a float that fits.
6. If-then relocation: `dayTypes` and `when` fields, one rule on the day view, tab deleted.
7. Drag between tray and grid, pointer-events, tested on a real phone before it is trusted.

Steps 1 to 3 are the ones that change how the day feels. Everything after is the picture.

## 9. The one thing to protect

Every step here can be built in a way that quietly demands more decisions per day. If a change means
he has to answer one more question before the day can start, it is the wrong version of that change -
even when the feature is right. The product is a day you decided once, not a day you negotiate every
morning.
