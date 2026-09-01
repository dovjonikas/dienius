# Dienius - how shipping calendars draw a day, and what that means for our timeline

> Written 2026-09-01 after the owner called the timeline "not good enough" off a screenshot showing
> a thin dashed box reading "dasdadda / 09:00 - size unknown" under a sparse hour column, with a note
> that gaps weren't shown, and a scrollbar. He wants it to look professional, closer to what shipping
> calendar apps do, without becoming one. Read `docs/TIMELINE.md` first for why this grid is not a
> normal calendar, and `docs/RESEARCH-ADHD.md` sections 7 and 12 for the two constraints that bind
> everything below: about four items in visual working memory, and the list of mechanics this app has
> already refused.
>
> The running app (`npm run dev`, seeded with a shift-style day) and the actual marketing screenshots
> of Sunsama, Structured and Tiimo were examined directly for this document, not recalled from memory.
> Google Calendar and Apple Calendar's exact pixel values were not directly measurable this way (no
> Google account was signed into, and there is no native Apple Calendar available in this environment)
> - those numbers are stated as public, well-known convention and flagged as such, not as measurements.

---

## 0. What is actually on screen right now

Before comparing to anyone else, here is what the current build does, confirmed by running it and
seeding a day with two anchors (Guitar practice, 20 min, 10:00; Gym, 30 min, 11:00) and floats:

- The hour label at the very top of the window is clipped. `TimelineGrid.tsx` positions each hour
  mark at `top: windowPercent(...)%` and the label at `top: -7px` relative to that mark
  (`.timeline-hour-label` in `styles.css`). Whenever the window's first hour lands exactly on a whole
  hour - which is common, since the window is "first anchor minus one hour," and a lot of days start
  on the hour - that first mark sits at `top: 0%`, and the `-7px` offset pushes half the label above
  the scroll container's own top edge, which has no padding to absorb it. The "09:00" in the screenshot
  above is not a rendering fluke, it happens on most seeded days.
- The anchor card and the gap card use the same visual material: a rounded rectangle, a thin
  `1px solid var(--border)` (or dashed for an unsized anchor), roughly the same corner radius, and the
  anchor additionally carries `box-shadow: var(--shadow)`. Nothing about the two differs enough at a
  glance to read as "occupied" versus "open." Both read as form fields, because both are drawn with the
  same edges-and-shadow language every input and card elsewhere in this app already uses. That is
  exactly why the owner's screenshot reads as a debug view: nothing on the grid tells you a card
  represents a slice of time rather than a piece of UI chrome.
- A 20-minute anchor, which should hit `SIZED_MIN_HEIGHT_PX` (24px) and read as visibly small, instead
  renders close to the same height as the 40px `COMPACT_HEIGHT_PX` cutoff, because `padding: 6px 8px`
  plus a 13px/1.4 line-height title already needs about 30px of content box before the 24px floor is
  ever reached. The floor is real code, but it never actually binds - the padding and type size claim
  the space first. A constant nobody's design can reach is worse than a slightly bigger honest one.
- `templateColor` fills a sized anchor correctly and reads fine; an anchor with no template still gets
  the plain bordered-card treatment, which is the right fallback.
- Gaps are exactly what `docs/TIMELINE.md` asks for structurally (a real, labelled, tappable object)
  but visually indistinguishable from an anchor at a glance, which undercuts the one piece of
  information the grid exists to carry: which of these blocks is spoken for and which is not.

None of this is a logic bug. `computeTimelineLayout`, the packing, the clipping fade, the collapse
toggle - all of that is sound and matches the spec. What is missing is material: the grid draws
correct geometry in the visual language of a form, not a calendar.

---

## 1. What shipping apps actually do

### Sunsama

Examined directly: the marketing screenshot on sunsama.com and the "Planned and Actual Times" help
page (help.sunsama.com/docs/planned-and-actual-times).

- **Event block.** Solid, fully saturated fill (orange, blue, purple in the sample shown) with no
  border and no visible shadow. Generous corner radius, roughly a third of the block's own height.
  Title sits on its own line, the time range ("10 - 1", "Lunch 12-1") sits directly under it in the
  same block, smaller and lower-contrast against the fill. Text is dark-on-light or light-on-dark
  depending on the fill's own luminance, not a fixed color - the block picks readable text for
  itself rather than the app picking one text color for every block.
- **Hour column.** Small, low-contrast hour labels at roughly the top-left of each hour's row, easy to
  miss on purpose - the color blocks carry the information, the numbers are backup.
- **Empty space.** Plain white gap between blocks. Not labelled, not tinted, not interactive. An empty
  hour is exactly nothing.
- **The capacity readout, not on the grid itself.** The "workload counter" at the top of the day
  column is the direct ancestor of Dienius's capacity line, and it is worth naming precisely because
  it diverges from Dienius on purpose: it shows actual-vs-planned time, and it turns yellow near a
  configured workload threshold and red over it. Dienius's own capacity line is written specifically
  to never do this ("never red, never a warning icon" - `docs/TIMELINE.md` section 5), and that
  choice should stay. Sunsama's own users are the ones who set the threshold; Dienius has decided that
  kind of graded alarm is not a decision the owner should be asked to configure or see.
- **What to take:** the solid-fill block with no border and no shadow, and blank space for nothing.
- **What to refuse:** the red/yellow workload alarm, and the five-to-fifteen-minute guided planning
  ritual that produces the view in the first place - both already ruled out in
  `docs/RESEARCH-ADHD.md` section 11 and section 12.

### Structured (iOS)

Examined directly: the App Store listing's own screenshots (apps.apple.com, id 1499198946).

- **Not a grid at all - a connected line.** The defining visual choice is a single vertical line
  running down the left edge of the day, with each item as a small filled circular icon sitting on
  that line like a stop on a subway map, colored by category (orange sun for a morning routine item,
  green for yoga, gray for a plain task). The line is what makes it read as "one ribbon" rather than
  "a spreadsheet with rows" - there is no boxed grid of hour cells at all, only the line and the nodes
  on it.
- **Text per item:** title on one line, time range and duration in parentheses on the line under it
  ("8:15 - 8:45 AM (30min)"), in a lighter weight. No card, no border, no fill block for a short item -
  the icon and the two lines of text are the entire representation.
- **Hour column:** absent in this treatment - position along the line stands in for it. (Structured's
  in-app week/day grid, not visible in the marketing shots examined, does add hour labels; the ribbon
  shown in App Store marketing specifically drops them in favor of the connecting line.)
- **What to take:** a continuous connecting line through the anchors is a cheap, strong way to make a
  handful of blocks read as "one day" rather than "several unrelated boxes stacked in a scroll
  container" - which is exactly the ribbon-versus-spreadsheet distinction `docs/TIMELINE.md` section 7
  already names as the thing worth stealing from this app.
- **What to refuse:** already named in `docs/TIMELINE.md` - Structured wants everything placed on the
  line. Dienius's floats stay in the tray.

### Tiimo

Examined directly: the App Store listing's screenshots (apps.apple.com, id 1480220328), built
specifically for ADHD and autistic users, cited already in `docs/RESEARCH-ADHD.md` section 11 for its
visual-timer research.

- **Event block:** a full-width, generously rounded pill-shaped row, one per activity, with a colored
  circular icon on the left rather than a fill-the-whole-block color. Warm, muted color palette rather
  than saturated primary colors. Rows read as closer to constant height than strictly proportional to
  duration - legibility and a calm, low-arousal palette are prioritized over precise proportional
  scale.
- **What to take:** the icon-plus-color-chip pattern (a small colored circle carrying the category
  color, rather than tinting the entire block) is a second, gentler way to signal "what kind of thing
  this is" without needing every block to be a loud saturated rectangle - worth considering for
  Dienius's own day-type color, which currently only shows up as a full block fill.
- **What to refuse:** nothing structural - Tiimo does not auto-schedule, does not gamify, and its own
  marketing explicitly avoids "productivity shaming" language. The one caution is Tiimo's rows are
  closer to a colorful checklist than a true proportional timeline, and Dienius's whole reason for
  having a grid at all is the proportional read of how the day's time is actually spent - copying
  Tiimo's near-constant row height would quietly undo that.

### Google Calendar

Not signed in and directly inspected for this document; the following is stated as widely documented,
long-standing convention rather than a fresh measurement.

- **Hour column:** hour labels only (no half-hour text), small and low-contrast, positioned so the
  label sits just above the gridline it marks - the line, not the label's center, is the hour boundary.
  A half-hour gridline is drawn at roughly half the visual weight of the hour line, with no label of
  its own.
- **Event block:** solid, saturated fill by default (color assigned per-calendar or per-event), square
  or lightly rounded corners, no border of its own beyond a very slightly darker edge for separation
  against a same-colored neighbor. Below a certain height the time range drops and only the title
  shows, truncated; below that, only a colored sliver shows with the title on hover or tap.
  Google's own implementation notes (community threads) put a half-hour row around the high 20s in
  pixels at default zoom - consistent with an hour row somewhere in the high 50s to low 60s of pixels
  on desktop web, though this is not something Google documents as a fixed spec and it visibly changes
  with viewport height and zoom.
- **Vertical scale on phone versus desktop:** the mobile app shows fewer visible hours at once and
  scrolls more per swipe; the underlying per-hour pixel value is smaller on phone than on a desktop
  browser tab, which is the same tradeoff Dienius already made by cropping its own window to anchors
  plus a buffer hour rather than shipping a full 00:00-24:00 grid.
- **Current-time indicator:** a thin red horizontal line spanning the day's column(s), with a small
  red dot sitting in the hour gutter at the line's left end. This is close to universal across the
  category - Apple Calendar, Outlook and Fantastical all draw a version of it.
- **Overlaps:** side-by-side columns, narrower per event as more events share the same span - the
  standard interval-graph packing, the same approach `docs/TIMELINE.md`'s own build order already
  specifies and `TimelineGrid.tsx` already implements.
- **What to take:** the weight relationship between hour lines and half-hour lines, and the pattern of
  degrading a block's own text (full range, then title only, then nothing) as it gets shorter -
  already the right idea in Dienius's `COMPACT_HEIGHT_PX` cutoff, just not yet matched by the CSS
  underneath it.
- **What to refuse:** the full day grid and the idea that every hour, occupied or not, deserves an
  equal slice of the screen. `docs/TIMELINE.md` section 2 already rules this out by name.

### Apple Calendar

Same caveat as above - convention, not a fresh measurement, since there was no native Apple Calendar
available to inspect directly in this environment.

- Spartan, high-contrast, mostly white or near-black background depending on light/dark mode, thin
  gray hour and half-hour rules, red as the one reserved accent color for "this is happening now" and
  "this is today" and nothing else. No other UI element borrows that red.
- The current-time line is the same idea as Google's: a thin red rule across the day column with a
  small red dot at the gutter edge, moving continuously.
- **What to take:** the discipline of reserving one accent color for exactly one meaning (now/today)
  and never reusing it for anything else. Dienius already has this instinct in its own capacity line
  ("never red, never a warning icon") - the lesson transfers directly: whatever color a current-time
  indicator uses in Dienius, it should mean only that, and nothing else on the day view should borrow
  it.

### Fantastical, Amie, Notion Calendar (Cron), Motion

Handled together because none of them offered something the four apps above had not already covered
more concretely, and the research time was better spent confirming Sunsama, Structured and Tiimo by
direct inspection than skimming five more reviews.

- **Notion Calendar** is broadly reported as one of the more restrained, minimal grids in the category
  - thin lines, pastel event fills, no visual noise - which is a data point for "restraint is possible
  at commercial polish," not a new mechanic to adopt.
- **Amie** and **Fantastical** are both conventional proportional grids with the same hour-column and
  event-block mechanics as Google/Apple, distinguished mostly by type quality and color restraint
  rather than by a structurally different idea. Fantastical's one distinct feature - holding a
  modifier key to expand overlapping events for readability - is a desktop-only interaction with no
  clear mobile equivalent and was not investigated further for that reason.
- **Motion** auto-schedules tasks onto the calendar for the user. `docs/TIMELINE.md` section 3 already
  refuses this by name, and nothing in this research changes that conclusion; it is named again here
  only to confirm there was nothing new to learn from its visual treatment that a refusal of the whole
  mechanic would let through anyway.

### Synthesis by dimension

| Dimension | What shipping apps do | Craft convention or evidence |
|---|---|---|
| Hour labels | Hour only, small, low-contrast, sits at the line not floating above it; half-hour gets a lighter untexted line | Convention, near-universal |
| Event fill | Solid or tinted fill, no border, no shadow | Convention, near-universal (Sunsama confirmed directly) |
| Corner radius | Generous, matches the app's own general radius | Convention |
| Short-block text | Degrades: full range, then title only, then a bare sliver | Convention, and already the right idea in Dienius's own `COMPACT_HEIGHT_PX` |
| Vertical scale | Roughly 50-70px per hour on desktop, less on phone, varies by app and zoom | Convention, approximate, not independently measured here for Google/Apple |
| Current time | A thin line plus a dot, one reserved accent color, means only "now" | Convention, near-universal |
| Empty space | Simply blank | Convention - and the one thing Dienius deliberately does not copy, on purpose, see section 2 |
| Overlaps | Side-by-side columns, narrower per event | Convention, already implemented correctly in `TimelineGrid.tsx` |
| Density | One accent color per meaning, thin lines, no shadows on time blocks, generous whitespace between chrome and content | Craft judgment, consistent across every app examined here |

---

## 2. What Dienius should adopt, and what it must refuse

**Adopt - these are the fixes that would most change how the screenshot reads:**

1. A filled, borderless, shadowless event block for a sized anchor, in place of the current bordered
   card-with-shadow. This alone removes most of the "form field" reading.
2. A visibly lighter half-hour line, no label, so position between two anchors is legible without
   adding more numbers to the gutter.
3. A current-time indicator, since it is externalized point-of-performance information
   (`docs/RESEARCH-ADHD.md` section 2) rather than schedule pressure - see section 4 below for why this
   does not contradict "times are anchors."
4. Reserve one color for "now" and nothing else, the same discipline the capacity line already
   practices for "never red."

**Refuse - named explicitly because a shipping app does them and this research does not change the
verdict:**

- **No auto-scheduling** (Motion). Already refused in `docs/TIMELINE.md` section 3.
- **No red/yellow overage alarm on the capacity line** (Sunsama's workload counter). The capacity line
  states arithmetic, never a warning.
- **No forcing every float onto the line** (Structured). Floats stay in the tray; only anchors and
  labelled gaps live on the grid.
- **No morning ritual to produce the view** (Sunsama). The grid opens with one tap and shows whatever
  the day already has.
- **No full 00:00-24:00 grid** (Google, Apple). The cropped window stays.
- **No streak, comparison, or scoring drawn onto the grid itself.** Nothing here proposes one, but it
  is worth stating plainly given the second question below.

---

## 3. The habit-tracker screenshots: craft without the mechanic

The owner's reference screenshots are dense habit-tracker dashboards, two of them built around a
"Fire Streak" panel reading "Your fire is raging. Do not let it die." `docs/RESEARCH-ADHD.md` section
8 already settles the mechanic: Lally et al. (2010) found a single missed day does not measurably
disrupt habit formation, so a streak counter - and the urgency copy that panel uses - encodes
something the evidence says is false, and Deci, Koestner and Ryan's 1999 meta-analysis of 128
experiments found completion-contingent rewards reliably undermine intrinsic motivation. Both stand.
The streak is refused, permanently, regardless of how good the panel around it looks.

What is actually being asked for here is separable, and worth stating concretely rather than as a
vague "take the aesthetic":

**Worth taking:**
- **Tabular alignment.** Numbers and short labels set in a real grid, columns aligned, `font-variant-
  numeric: tabular-nums` (already used in `.timeline-hour-label` and `.timeline-gap-label` - extend the
  same treatment anywhere a count or a duration appears).
- **A single small type scale, held to consistently.** A dense dashboard that stays legible does so by
  using two or three font sizes everywhere rather than inventing a new one per widget - the same
  discipline `docs/THEMES.md` already asks of the theme system's own type tokens.
- **One accent color carrying the "this matters" signal, restated everywhere the same way**, rather
  than a different loud color per panel. This is the same "reserve the color" rule from section 2.
- **Thin hairline dividers instead of boxed cards for every row.** A dense grid that works draws rows
  with a 1px rule between them, not a bordered card per row - cards stacked edge to edge read as
  separate objects competing for attention; hairline-divided rows read as one table. This maps
  directly onto the anchor-versus-gap fix in section 0: the current grid draws every element as its
  own bordered card, which is precisely the pattern a good dense dashboard avoids.
- **Restraint in color used for status**, not absence of color. A dense grid can use color heavily and
  still read as calm if the palette is small and each color means exactly one thing throughout.

**Must not come with it:**
- The streak counter itself, in any form - a running count, a "best streak," a flame that grows or
  shrinks.
- Urgency or loss-framed copy of any kind ("do not let it die," "keep it going," any variant).
- Cross-day comparison - a cell, panel or number that measures today against a run of other days.
- Any color coding tied to consecutive-day performance (a cell that dims or reddens because yesterday
  was missed).

Dienius already has a working proof that the craft and the mechanic are separable: `docs/DECISIONS.md`
- "A year strip with no in-between" describes a dense, colored, grid-shaped view (`YearStrip.tsx`)
that deliberately carries only two states per cell, no numbers, no darker shade for "more empty," and
no ring for anything short of full completion - the exact restraint a habit-tracker dashboard's own
visual grammar can teach without the streak riding along inside it. The year strip is the existence
proof, not a hypothetical: it is possible to borrow "dense, aligned, restrained" wholesale while
refusing "measured against yesterday" wholesale, because this codebase already did it once.

---

## 4. Does a professional-looking day view actually help, or is this purely taste

Not purely taste, but the evidence supports a narrower claim than "it will make the app work better."

**Moderate to strong, well-replicated correlational finding.** Kurosu and Kashimura (1995), the
aesthetic-usability effect: in a study of 26 ATM interface variations and 252 participants, the
correlation between how attractive a design was rated and how usable it was rated was stronger than
the correlation between attractiveness and *actual* measured usability. People believe a
better-looking interface works better, even when it does not measurably work better. This finding has
been widely replicated since and is treated as one of the more solid results in the applied HCI
literature - the effect is on perception and trust, not on objective task performance.

**Strong, and specifically about first impressions.** Lindgaard et al. (2006), published in *Behaviour
and Information Technology*: people form a stable opinion of a web page's visual appeal within 50
milliseconds of seeing it, and that snap judgment correlates highly with the same rating given after
much longer exposure. The follow-on point made about apps specifically (a Google-run study, not
independently verified here in the same way) puts the number as low as 17ms for some factors. Either
way, the finding that matters for Dienius is the same one already reached in
`docs/RESEARCH-ADHD.md` section 11 by a different route: a 2024 JMIR mHealth review of 18 studies and
525,824 participants names "confusing interfaces" as the most consistently cited reason people abandon
a planner app. A screen that reads as a debug view on first glance is exactly the kind of thing that
finding is describing.

**No evidence found that visual polish improves task completion once someone is already using a
tool.** This is the honest limit, and it matches a pattern this app has already run into once:
`docs/RESEARCH-ADHD.md` section 11 found that Hallez and Vallier's 2025 controlled study of visible
timers reduced anticipatory anxiety and inattentive behaviour, but did not improve task accuracy - the
timer changed how the day felt, not how well it went. The same distinction almost certainly applies
here. No study was found (or plausibly exists) that isolates "the calendar block has a shadow" from
"the calendar block does not have a shadow" and measures whether more tasks get done.

**The answer:** polish is worth doing, and it is not just taste - there is real evidence it changes
trust, first impression, and the odds of the app surviving past its first hundred days, which is
exactly the retention risk `docs/RESEARCH-ADHD.md` section 11 already names as the biggest threat to
this whole product. What it will not do, and should not be sold to the owner as doing, is make the
capacity arithmetic more accurate or a task more likely to get finished. It is worth building because
it is the reason he keeps opening the app and would show it to a friend, which is a real and
legitimate thing for this product to want - not because a better-looking block moves the needle on
whether the day actually happens.

---

## 5. The concrete specification

Everything below is scoped to `TimelineGrid.tsx` and the `.timeline-*` rules in `styles.css`. Nothing
here touches `timelineLayout.ts`'s geometry (window cropping, gap detection, packing) - that logic is
already correct and already matches convention (section 1's synthesis table). This is a rendering
pass, not a data model change, and it takes no vertical space from zone 3: the grid is already
collapsed by default and already scrolls inside a capped container
(`max-height: min(58vh, 520px)` on `.timeline-grid-scroll`), so nothing proposed here reopens the fold
problem `fix-day-view-hierarchy-report.md` already solved. Where a change grows the grid's own content
height (the half-hour lines, the current-time line), it grows inside that same scrollable, already-
optional container - it never pushes anything below it.

**1. Fix the clipped top label.** Add top padding to `.timeline-grid-scroll` (or the inner
`.timeline-grid-layers`) equal to the label's own negative offset, so the first hour mark is never cut
by the scroll container's edge:

```css
.timeline-grid-scroll { padding-top: 8px; }
```

Confirmed cause, not a guess: `hourMarks()` in `timelineLayout.ts` always includes the window's own
first whole hour, which lands at `top: 0%` whenever the window opens exactly on the hour - common,
since the window is "first anchor minus one hour." `.timeline-hour-label`'s `top: -7px` then pushes
half the label above a container with no room to absorb it. 8px covers the offset with a small margin;
verify against a real 11px label's rendered box rather than trusting the arithmetic alone.

**2. Anchor block: fill, no border, no shadow, for a sized anchor with a template color.**

```css
.timeline-anchor.timeline-anchor-colored {
  border: none;
  box-shadow: none;
}
```

This is not only convention borrowed from Sunsama - it is already the app's own stated rule.
`docs/THEMES.md` section 8 names "drop shadows on everything" as one of the three things that "kills"
this app's visual design. The current `.timeline-anchor` rule puts `box-shadow: var(--shadow)` on
every anchor, sized or not, which is the app's own written design law being violated by its own
timeline component. Removing it is a correction, not a new opinion.

A sized anchor with no template color (no template on the day) keeps a visible edge, since it has no
fill to separate it from the surface:

```css
.timeline-anchor:not(.timeline-anchor-colored):not(.timeline-anchor-unsized) {
  border: 1px solid var(--border);
  box-shadow: none;
}
```

**3. Reconcile the height floor with what the box model actually needs.** Raise
`SIZED_MIN_HEIGHT_PX` from 24 to 32 in `TimelineGrid.tsx`, and drop anchor padding for a compact card
specifically:

```css
.timeline-anchor { padding: 6px 8px; }         /* unchanged, full card */
.timeline-anchor.timeline-anchor-compact { padding: 3px 8px; }  /* new modifier, short card */
```

(`compact` in the component already exists as a boolean; add its class to the anchor's own
`classNames` array alongside the existing conditionals, rather than inventing a second mechanism.)
32px was chosen as roughly what a single 13px/1.4 line-height title plus 3px top-and-bottom padding
plus a 1px edge actually needs to render without clipping - checked against the rendered box observed
in the running app, not assumed. This is a judgment call tuned to this app's own type scale, not a
number borrowed from another app.

**4. Half-hour line, no label.** Extend `hourMarks` (or add a sibling function) to also return
half-hour marks, rendered with a lighter rule and no `<span>`:

```css
.timeline-half-hour-rule {
  position: absolute;
  left: 44px; /* GUTTER_PX, matches .timeline-hour-rule */
  right: 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
}
```

45 percent is a starting point, not a measured value - visibly lighter than the hour line's full
`var(--border)`, adjust against a real screen in at least two themes (a high-contrast one like
Terminal and a low-contrast one like Ink and wash) before treating the number as final.

**5. Gap: tint only, no border, dashed reserved for "unsized."** Currently both a gap and an unsized
anchor use a dashed edge, which blurs what "dashed" means. Move the dashed treatment to unsized-anchor
only; gaps become a plain tinted rectangle with no border:

```css
.timeline-gap {
  border: none;
  background: color-mix(in srgb, var(--border) 20%, transparent);
}
```

**6. Unsized anchor: a considered pending state, not an empty box.** Keep the dashed edge (it is the
one place "not yet decided" should still read as dashed, per point 5), but give it a faint fill so it
does not read as unstyled:

```css
.timeline-anchor-unsized {
  background: repeating-linear-gradient(
    45deg,
    color-mix(in srgb, var(--muted) 8%, transparent) 0 4px,
    transparent 4px 8px
  );
  border: 1.5px dashed var(--muted);
}
```

**7. Current-time indicator.** New, small, and specifically scoped: a 1.5px line across the anchor and
gap columns only (not the hour-label gutter, so it never fights the hour text) plus a 6px dot at the
gutter's right edge, in `var(--accent)`, recomputed on a coarse interval (once a minute is enough - a
planner has no reason to animate every second). Rendered only when the current clock time falls
inside the grid's own cropped window; a day whose anchors are entirely in the past or entirely in the
future shows no line, the same honesty rule the rest of this feature already follows for an empty or
unsized day.

```css
.timeline-now-line {
  position: absolute;
  left: 44px; /* GUTTER_PX */
  right: 0;
  height: 1.5px;
  background: var(--accent);
  pointer-events: none;
}
.timeline-now-dot {
  position: absolute;
  left: 40px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  transform: translate(-50%, -50%);
}
```

Uses `var(--accent)`, never a hardcoded red, so it resolves correctly across all eleven themes without
importing a color outside the token system - a hardcoded red would clash badly against Legal pad
(which already uses red for its own margin rule) and would simply be wrong on Terminal's phosphor
palette. Do not compute this on every render; a `useEffect` with a 60-second interval, cleared on
unmount, matches the "coarse, not animated" intent and costs nothing meaningful in battery or layout
thrash.

**8. Vertical scale: leave `PX_PER_MINUTE` alone.** At its current 1.15 px/min (69px/hour), Dienius
already sits inside the same rough range public convention puts Google Calendar and Apple Calendar in
on desktop, and the window is already cropped rather than a full day. The screenshot's actual problem
was material (cards read as forms) and a clipped label, not scale. Do not retune this number as part
of this pass; if a future fold measurement on a real dense day shows it is genuinely the cause of a
new layout problem, that is a separate, evidence-driven change - not something to bundle in here on a
hunch.

---

## 6. What was looked for and could not be established

- **No direct pixel measurement of Google Calendar or Apple Calendar.** No Google account was signed
  into and no native Apple Calendar was available in this environment; the hour-row and current-time
  figures above come from public community threads and long-standing, widely repeated convention, not
  from measuring the real apps. Flagged wherever used above rather than stated as fact.
- **The owner's own habit-tracker screenshots were not directly viewed.** Section 3 works from the
  description given - a dense grid, small type, a "Fire Streak" panel with specific copy - rather than
  from inspecting the images themselves. If the actual screenshots show something materially different
  from that description, section 3's craft recommendations should be rechecked against them directly.
- **No study exists comparing a filled event block to a bordered-card block for legibility or trust,**
  in this app or any other. Section 5's specific choices (drop the border, drop the shadow, raise the
  height floor to 32px) are craft judgment applied to what was directly observed in the running app,
  consistent with this app's own written design law in `docs/THEMES.md`, not evidence-backed claims.
- **No usage data exists for Dienius itself.** This is a single-user, local-first app with no
  analytics (`docs/DECISIONS.md`, "localStorage, no backend"). Whether a more polished timeline
  actually changes how often the owner opens the app cannot be measured here, only inferred from the
  retention and first-impression literature cited in section 4.
- **Whether a current-time indicator helps or is neutral in a planner where times are anchors, not a
  schedule, is not directly tested anywhere.** Section 5's proposal rests on the point-of-performance
  reasoning already established in `docs/RESEARCH-ADHD.md` section 2, applied to a new surface by
  analogy, not on a study of current-time indicators specifically. If it turns out to read as pressure
  rather than orientation once built, that would be a real finding worth writing down, not a sign the
  reasoning here was sound and the execution wrong.
- **Structured's in-app hour-column treatment (as opposed to its marketing ribbon) was not examined.**
  The App Store screenshots used for this document show the ribbon specifically chosen for marketing;
  the actual day/week grid view inside the app, which does show hour labels, was not installed or
  inspected.
