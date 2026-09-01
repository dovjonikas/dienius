# Dienius - hardest-user review

Reviewed as the person the app is built for: two days into using it, it is 7am, a night-shift week,
slept badly, standing up, on a phone, maybe ninety seconds of patience. The job was to find out what
today looks like and get moving, and to notice every place the app got in the way of that.

## Method and evidence

Tested live against a running dev server (`npm run dev`) at a 375x812 viewport. Storage was cleared
and the true first-run state was checked before seeding anything. Realistic data was then written
directly into `localStorage` under the app's own `dienius:data` key (the exact shape `AppData`
expects, per `src/lib/types.ts` and `src/lib/store.ts`) rather than typed through the UI one field at a
time, so a whole night-shift week, several push states, and three if-then rules could exist at once:
a week of night shifts (Aug 25-31, all done), a rest day, today (Sept 1) mid-shift-cycle with tasks
done, not done, at the push bound, and marked ongoing, an empty day (Sept 2), and a couple more days
later in September for calendar variety. Every screen listed in the brief was then driven from that
seed: Today full and empty, Today mid-day with a task at the push bound, the timeline open and
closed, tapping a gap, the calendar with and without templates, the template editor including a
zero-block template, the year strip, Settings, the theme gallery, and a bad-file import.

The browser pane was exactly as unreliable as flagged: coordinate clicks timed out repeatedly, the
pane's active tab jumped to unrelated tabs mid-session more than once, and one screenshot was
confirmed stale against the live DOM. Because of this, almost everything below is driven and verified
through JavaScript executed in the page - real DOM events, `getBoundingClientRect()`, and direct
`localStorage` readback - not coordinate clicks or trusted screenshots alone. Each finding below says
which kind of evidence it rests on: **[live DOM]** for state read or measured straight from the
running app, **[screenshot]** for something confirmed visually (and re-confirmed on a second capture
where the first looked suspicious), or **[code]** for something established by reading source rather
than exercising it live.

Three themes were checked at the day view: Slate (default dark), Terminal (green-on-black monospace),
and Legal pad (cream, ruled-paper, serif headings) - the two extremes named in the brief plus the
default.

---

## Blocking

None found. Nothing encountered in this session crashed, lost data, forced a decision before the day
could start, or left a dead end with no way forward. The closest candidate - the timeline rendering
bug below - was deliberately *not* placed here, because the task list underneath it keeps working
perfectly well on its own and nothing requires opening the timeline at all.

---

## Important

### 1. The timeline grid draws overlapping, unreadable text for any gap shorter than about 38 minutes

**What I did:** Seeded today as a night-shift day with two anchored tasks 45 minutes apart (Commute
home at 06:30, Wind down and sleep at 07:15 - both real 30-minute blocks with a genuine 15-minute gap
between them), then tapped "Show timeline."

**What happened [screenshot, confirmed with a second capture, plus live DOM]:** The "15 min free" gap
label renders on top of the "Wind down and sleep" block below it, not in the empty space between the
two blocks. The label's ghosted text is legible only as noise laid over the next task's title. This
was not a one-off screenshot glitch - I re-measured it directly:

```
gap "15 min free":        top 224, bottom 268 (44px tall)
anchor "Wind down and sleep": top 239, bottom 274
```

The gap box and the following anchor's card overlap by 29 pixels. The same thing reproduced later in
the session with two different 15-minute gaps elsewhere on the same day, and it reproduced identically
in Slate, Terminal, and Legal pad - it is not a theme issue.

**Why:** `src/widgets/day-plan/TimelineGrid.tsx` sets `GAP_MIN_HEIGHT_PX = 44` (a touch-target floor,
matching the 44px minimum the rest of the app uses) but never displaces the anchor blocks around it to
make room. At `PX_PER_MINUTE = 1.15`, a real 15-minute gap only earns about 17 real pixels; the 44px
floor then draws 27 extra pixels straight over whatever sits below it. Any gap shorter than
`44 / 1.15 ≈ 38 minutes` will overlap its neighbour this way. Short buffers under 38 minutes - a
15-minute commute, a quick changeover between blocks - are exactly what a real shift schedule is full
of, so this is not a rare edge case for this app's own target user; it is close to the common case.

**Why it matters:** `docs/DECISIONS.md` and `docs/RESEARCH-ADHD.md` both promise that "text stays
highly readable." This is the one place I found that promise directly broken - not stylistically, but
literally: two labels drawn on top of each other. The timeline is opt-in and collapsed by default, so
it does not block using the app, but it is the app's own most-championed feature (the research doc
calls it out by name as something that "earns its place... but only while it stays grouped and quiet")
rendering visibly broken on the first realistic shift-work data I gave it.

**Where:** `src/widgets/day-plan/TimelineGrid.tsx`, the gap rendering block around line 320-346
(`GAP_MIN_HEIGHT_PX`, line 71); the underlying layout math is `computeInteriorGaps` in
`src/widgets/day-plan/timelineLayout.ts`.

### 2. The capacity line opens every day with unexplained words, and can flatly contradict the gap picker on the same screen

**What I did:** Read the capacity line at the top of today's view exactly as a first-time reader
would, then tapped through to place a task in a gap.

**What happened [live DOM, cross-checked against the code]:** The very first sentence on the day view
was "Anchors take 3h within today's window. Free: 8h across 3 gaps. Floats need about 15 min, plus 3
unsized." Nothing on screen, anywhere in the app's UI, ever says what an "anchor" or a "float" is - not
a tooltip, not an info icon, not a line in the first-run copy. A person two days in has no way to learn
these words except by guessing from context, every single morning, before they have context. This
happens on the single most-seen screen in the app.

Worse, the numbers this sentence states are not the same numbers the rest of the day view uses. For
that same day, opening the "Reply to schedule email" task's actions sheet (the "place it in a gap"
list) showed four gaps totaling roughly 13h30 free - not the "8h across 3 gaps" the capacity line had
just stated. Both figures are honestly computed, but from two different windows
(`computeCapacity`'s fixed 07:00-23:00/13:00-24:00 waking window versus `computeTimelineLayout`'s
window cropped to the anchors that actually exist) - the code says outright that "this window is not
`computeCapacity`'s window, and the two are meant to disagree at the edges." That is a reasonable
engineering position and a confusing one to actually read: the app states two different "how much room
is left today" answers on the same screen with no signal to the reader that they are answering
different questions.

**Where:** `formatCapacityLine` in `src/widgets/day-plan/capacity.ts`; the deliberate-disagreement
comment is the module doc on `src/widgets/day-plan/timelineLayout.ts`, `computeTimelineLayout`.

**Note:** this exact issue - the capacity line's unexplained "anchor"/"float" vocabulary - is already
the #1 priority item in this repo's own `docs/audit/copy-pass.md`. This review reproduces it live and
independently arrived at the same conclusion; as of this session it is still unfixed in the running
app.

---

## Minor

### 3. A day stamped with an empty template still tells you to "stamp a template"

**What I did:** Built a template with zero blocks (the editor allows saving with an empty block list
- "Save template" is only gated on a non-empty name), stamped it onto a day, then opened that day.

**What happened [live DOM]:** The day header correctly shows the template's chip ("No Blocks Yet"),
but the task list area still reads "Nothing planned. Stamp a template from the calendar, or add a task
above." - the exact instruction for the thing the reader just did. A self-inflicted edge case (nobody
would normally build a template with no blocks on purpose), but a real dead end if it happens: the
empty-state copy does not know the difference between "no template stamped" and "template stamped,
produced nothing."

**Where:** `src/widgets/day-plan/DayView.tsx`, the `!firstRun` empty-state branch around line 333.

### 4. Year-strip cells are 10x10 pixels - far below the touch target the rest of the app uses

**What I did:** Opened Calendar → Year, scrolled to September, measured a day cell.

**What happened [live DOM]:** `getBoundingClientRect()` on today's cell returned a 10x10 pixel box.
Every other tappable control sized for touch elsewhere in this codebase targets 44px
(`MIN_ANCHOR_HEIGHT`, `GAP_MIN_HEIGHT_PX`, the gap picker's own comment about "comfortably tappable").
A year-at-a-glance grid genuinely cannot give 365 cells a 44px target each, so this is an inherent cost
of the idiom rather than an oversight, but on a real phone with a real thumb, a mistap here silently
opens the wrong day - there is no confirmation, just a jump to whatever date the finger actually landed
on.

**Where:** `src/widgets/year-strip/YearStrip.tsx`, the `--year-cell` sizing.

### 5. A brand new template defaults to the same color as the first one you ever made

**What I did:** Created a new template without touching the color swatches.

**What happened [live DOM]:** It defaulted to the same blue as the pre-existing "Working day" template
(`TEMPLATE_COLORS[0]`, always the first palette swatch). On the month calendar, the two different
templates' stamped cells were visually indistinguishable by color alone - only the small template-name
chip inside each cell (invisible at a glance, and hidden entirely below a certain width per
`styles.css`) tells them apart.

**Where:** `src/views/TemplatesView.tsx`, `emptyDraft()`'s `color: TEMPLATE_COLORS[0]`.

### 6. Long task titles wrap unevenly, breaking the list's rhythm

**What I did:** Compared rows with short titles ("Commute home") against longer ones ("Wind down and
sleep," "Sort out car insurance renewal") in the task list at 375px.

**What happened [screenshot]:** A short title keeps its time on the same line as the title. A longer
one pushes the time (or the "CORE" badge) onto its own line above or below the title, so row heights
and internal alignment vary row to row down the list. Not confusing, just visually uneven - a small
polish item, not a comprehension problem.

**Where:** `src/widgets/day-plan/TaskRow.tsx` and its row layout in `styles.css`.

---

## What worked well

- **The no-decision promise held up under real use.** Clearing storage and reloading never produced a
  modal, a tour, or a question that had to be answered before typing a task. The first-run offer
  (three realistic starter templates) sits inline above an already-focused-and-ready quick-add field,
  never blocks it, and disappears the moment real data exists - never a stored "seen it" flag. This
  matches `docs/DECISIONS.md` exactly and is good, careful work. **[live DOM + code]**
- **No streaks, no scores compared across days, anywhere.** The year strip, the day score, and the
  capacity line were all checked for anything resembling a percentage, a total, a "best day," or a
  guilt-flavoured word. Found none. An unplanned day on the year strip renders as flat, neutral texture
  exactly as documented - not a hole, not a warning color. **[screenshot + live DOM]**
- **The push-bound flow is genuinely well designed.** Reaching the bound offers exactly three honest
  choices (do it today, let it go, mark it ongoing), explains itself in plain language at the moment
  the decision is asked for, and once a task is marked ongoing its push count stops being shown
  anywhere - no residual guilt-by-numbers. Reversing "ongoing" costs nothing. **[live DOM]**
- **The if-then rule surfaces itself.** One quiet rule appears inline under the capacity line, rotates
  fairly, and renders nothing at all on a day with no eligible rule rather than nagging with a
  fallback. Exactly the point-of-performance argument the research doc makes for it. **[live DOM]**
- **Error handling was honest and calm.** A malformed import file produced "That file is not a valid
  Dienius backup." with no data loss and no stack trace. The empty-day message ("Nothing planned.
  Stamp a template from the calendar, or add a task above.") tells you exactly what to do next in
  plain words. **[live DOM]**
- **Both theme extremes stayed readable.** Terminal (green monospace on black) and Legal pad (dark
  serif on cream, with a ruled-paper background) were both checked at the day view, the timeline, and
  the if-then card. Every string I read stayed high-contrast and legible in both - the one place text
  actually became unreadable (finding #1 above) was a layout bug present in every theme, not a
  theme-specific contrast failure. **[screenshot, re-confirmed after catching one stale capture]**
- **Confirmation patterns are consistent and low-risk.** Deleting a template, deleting an if-then
  entry, and erasing all data all use the same two-tap "tap again to confirm" pattern, with the
  destructive option only turning red once armed. No accidental data loss was possible to trigger.
  **[live DOM + code]**
