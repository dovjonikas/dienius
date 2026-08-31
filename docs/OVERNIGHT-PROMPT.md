# Overnight session prompt

> Paste the block below into the Dienius session after it finishes the current task list.
> Written 2026-08-31. The point of this shape: everything in it can be done without asking the owner
> a single question, because he is asleep. Anything that needs his call gets parked, not guessed.

---

You are continuing work on Dienius overnight. The owner is asleep and will read everything in the
morning. Work through this in order and do not stop to ask questions - if something genuinely needs
his decision, write it into `docs/OPEN-QUESTIONS.md` with your recommendation and keep moving.

Read first: `docs/TIMELINE.md`, `docs/THEMES.md`, `docs/BACKLOG.md`, `docs/DECISIONS.md`.

## Task 1 - the research, and do it properly

Write `docs/RESEARCH-ADHD.md`. This is the foundation for every design decision that follows, so it
comes before any more building.

The question: **what actually makes a person with an ADHD-shaped brain start and finish planned
tasks, and what only looks like it helps?**

Cover at minimum, and verify each against real sources rather than blog summaries:

- **Implementation intentions** (Gollwitzer). The effect size, what the meta-analyses actually say,
  and specifically whether they hold up for ADHD populations or only for the general population.
  This decides how much weight the if-then feature deserves.
- **Barkley's model** - ADHD as an executive function and self-regulation problem, and his
  "point of performance" principle: information has to be externalized and physically present at the
  moment and place where the behaviour happens, not stored in a plan somewhere else. If this holds,
  it is the strongest argument in the whole app for surfacing one rule on the day view rather than
  keeping a board.
- **Time blindness** - the actual research on temporal processing and time estimation deficits.
  Do people with ADHD underestimate durations, overestimate them, or just estimate with more
  variance? The answer changes what the capacity line should say.
- **Task initiation and activation energy** - what reduces the cost of starting. Five-minute rules,
  smallest-next-action, environmental cues.
- **Body doubling** - what evidence exists, and whether it is anything more than anecdote.
- **The Zeigarnik effect and open loops** - whether unfinished items genuinely occupy attention, and
  whether writing them down actually releases that.
- **Visual salience** - out of sight out of mind, and what that means for a tray of floats versus
  a collapsed list.
- **Gamification and streaks** - the case AGAINST them. Look for evidence on all-or-nothing thinking
  and streak loss, and on whether external reward structures undermine intrinsic motivation here.
  This app has deliberately refused streaks; find out whether that refusal is actually supported.
- **Choice load** - decision fatigue is a contested area, so be honest about how weak or strong the
  evidence is rather than repeating the popular version.
- **Novelty, interest and urgency** as motivational drivers in ADHD specifically.

Rules for this document:

- Cite real papers with authors and years. Say plainly when something is a popular claim without
  solid backing, and say when a finding failed replication.
- For every finding, end with a **"what this means for Dienius"** line. A research doc that does not
  change the product is a waste of a night.
- Include a section called **"What we should NOT build"** - features that feel helpful and are not
  supported. That section is the most valuable one and the easiest to skip.
- Flag anything that contradicts a decision already made in `docs/DECISIONS.md`. Do not quietly
  reverse a decision, just surface the conflict.

## Task 2 - build the timeline from the spec

Follow `docs/TIMELINE.md`, steps 4 to 7, in order. The `minutes` field and the capacity line are
already done - continue from the grid.

4. The grid, read only: anchors placed at their real position with real height, gaps drawn as
   labelled objects, and the window collapsed to what is actually in use.
5. Gap interaction: tap a gap, get the floats that fit, one tap to place.
6. If-then relocation: `dayTypes` and `when` fields on `IfThenEntry`, one rule surfaced quietly on
   the day view, the separate tab deleted, editing moved to where the rule is tapped.
7. Drag between tray and grid, using pointer events with the same care as the calendar drag.

Stop after each step, run the tests, commit, and review your own diff before moving on. The existing
review discipline in this repo is why nothing is broken - do not drop it because it is night.

## Task 3 - themes

`docs/THEMES.md`, whatever is left of steps 1 to 8. If the timeline work runs long, this waits;
the timeline is what he actually uses tomorrow.

## Standing rules for the whole session

- Every step: tests green, `npm run build` clean, committed with a conventional message.
- No em-dashes anywhere. Plain "-". English everywhere in the repo.
- Mobile first. 375px, 44px touch targets, 16px inputs, safe-area insets. Anything that only works
  with a mouse is not done.
- Never add a feature that requires one more decision per day from him. If a change means he has to
  answer a new question before the day can start, build the version that does not.
- Update `docs/BACKLOG.md` as things ship, the same way it has been kept so far.
- Write a short summary at the end: what shipped, what you found in the research that changes the
  plan, what is parked in `docs/OPEN-QUESTIONS.md` and why.
