# Dienius - backlog after the MVP

> Written 2026-08-31 from a full review of the repo against the original product brief.
> Ordered by what the app is missing to BE the thing described in the brief, not by effort.
> Themes have their own spec: `docs/THEMES.md`.

## Shipped since this was written

**The push rule.** `Task.pushCount` tracks how many times an item has moved to the next day.
`rolloverUnfinished` moves anything under two pushes and leaves anything at two in place, and tells
the caller how many of each. A task at the bound shows only do-or-delete: the checkbox to finish it,
and a delete button that stays visible rather than waiting for hover, next to a line saying the
choice is fine either way. The rollover button says up front what it is about to do, including when
some tasks are staying behind.

**No-guilt day score.** `dayScore` in `src/widgets/day-plan/score.ts` counts done over total from a
day's own tasks and nothing else - no global target, nothing carried in from other days. An empty
task list returns `{ planned: false }` rather than a zero, so an unplanned day formats to no score at
all instead of "0/0". Shown on the day view as a plain fraction next to the date, quiet and easy to
ignore, and it updates live as tasks are checked off. Left off the calendar grid: at 375px a cell
already carries a day number and a template color with no room to spare, and a fraction on top of
that would make the month noisy rather than glanceable.

**PWA - offline and installable.** `public/manifest.webmanifest` with `display: standalone`, a
subpath-safe `start_url`/`scope` (both `.`, resolved relative to the manifest's own URL so they
survive the `/dienius/` project-page path without hardcoding it twice), and an icon set covering
16/32 favicons, a 180 apple-touch-icon, 192 and 512 "any", and a 512 maskable icon with proper
safe-zone padding. The mark is a small original geometric glyph - three rounded bars of decreasing
width on a dark ink tile, reading as an agenda at a glance, with the shortest bar in the app's own
accent blue.

`public/sw.js` is a hand-rolled service worker, not `vite-plugin-pwa`: the app is a handful of
static files with no runtime caching strategy to speak of, so a dependency did not earn its place.
`scripts/generate-sw.mjs` runs after `vite build`, hashes every built file's content, and writes that
hash into the cache name plus a full precache list into the service worker - so a deploy where
nothing changed keeps the same cache, and a deploy where anything changed (even just prose in
`index.html`) gets a new one. `activate` deletes every cache that is not the current one, and both
`install` and `activate` skip the waiting phase (`skipWaiting` / `clients.claim()`), so a new deploy
takes over as soon as it is installed rather than waiting for every tab to close - the classic way a
hand-rolled worker ends up pinning users to a stale cache forever. Navigations go network-first with
a cached-shell fallback so an online visit always sees the latest `index.html`; everything else is
cache-first. `src/pwa.ts` registers the worker (production builds only) and reloads the page once,
guarded against a reload loop, when a new worker takes control mid-session.

`<meta name="theme-color">` now follows the active theme instead of the light value pinned in
`index.html`: `src/lib/theme-color.ts` mirrors the two `--bg` values from `styles.css` and
`App.tsx`'s existing theme effect updates the tag alongside `document.documentElement.dataset.theme`.
iOS gets its own treatment beyond the manifest: `apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style` set to `black-translucent` (the app already reserves
`env(safe-area-inset-top)` and declares `viewport-fit=cover`, so content was already drawn for an
edge-to-edge status bar), and `apple-mobile-web-app-title` for the name under the home screen icon.

Verified against a real production build served from `/dienius/`, not the dev server: the manifest
and every icon path resolve with the base path applied, the service worker registers with scope
`/dienius/` and reaches `activated` with no waiting worker, and the app fully re-renders with the
origin server killed outright. Rebuilding after a content change produced a new cache name, and
`registration.update()` against the running tab installed the new worker, purged the old cache down
to one entry, and reloaded the page onto the new version with no user action.

**README, LICENSE, and decisions doc.** `README.md` covers what the app is, a live demo link,
screenshots (light and dark, desktop and phone) in `docs/screenshots/`, the features as they behave
for a person, the reasoning behind the design choices, the stack, and how to run and test it.
`LICENSE` is MIT. `docs/DECISIONS.md` explains the same choices for a reviewer instead of a user -
why localStorage, why no accounts, why no streaks, why templates instead of recurring tasks, why a
hand-rolled service worker - including the costs, not just the upside.

**Day types on templates.** `Template.type` is `'full' | 'shift' | 'night' | 'rest'`, absent meaning
`'full'` so every template saved before this shipped loads and scores exactly as it always did.
Shift, night and rest all follow the same rule - not every value needed its own scoring behavior,
just its own name for the day it describes. On a full day `dayScore` still counts every task, the
same as before this feature existed. On any other type it counts only tasks marked `core` - the
ones that genuinely had to happen - and ignores the rest entirely, so a shift day with one required
block and nine optional ones scores against that one block, not ten. A non-full day with tasks but
none of them core reports no plan at all, the same way an empty day always has: nothing required
means nothing to measure, not a failed 0/0.

`core` lives on both `TemplateBlock` and `Task`, copied from block to task at stamp time in
`applyStamps`, and baked onto the day itself as `DayPlan.dayType` rather than looked up live from
the template - so editing or deleting a template later never silently changes how an already-
stamped day is scored. A manually typed quick-add task is never core: the things that had to happen
are the ones planned ahead of time in the template, and letting a spur-of-the-moment task count
toward a shift day's required total would work against the whole point of a reduced score. There's
no second field on quick-add to change that, and none was added.

The template editor gets a day type picker, a plain four-way segmented control. The per-block core
toggle only appears once a template is anything other than a full day, so the common case - most
templates are full days - stays exactly as clean as it was. On the day view, a non-full day's score
carries a small "core" note next to the fraction, and each core task carries a matching quiet label,
so a reduced count reads as what it is instead of looking like the app dropped tasks. The calendar
gets no new signal for day type - it already paints by template color and is close to full at
375px, and a shift day's own template chip plus the score's own note already say what needs saying.
`rolloverUnfinished` clears `core` on a pushed task, the same way it already clears `fromTemplate` -
core describes a promise the day's own template made, not a property that should follow a task onto
whatever day it lands on next.

Known limitation, shipped deliberately rather than blocking on it: a task can only ever become core
by being on a template block before the day starts. Nothing typed by hand, and nothing pushed
forward from an earlier day, can register as required, so a task that turns out to genuinely matter
mid-shift has no way to move a shift day's score even if it sits undone. Worth revisiting once a
real month of shift days (starting this September) shows whether that gap actually matters in
practice, or whether the push bound already covers it well enough on its own.

**If-then board.** An implementation intention is a trigger and a response decided in advance, so
there is nothing left to decide when the trigger actually arrives. `IfThenEntry` in
`src/lib/types.ts` is just that: a trigger, an action, and an optional colour tag - no done flag,
no count of how often it fired. An if-then pair is not a task, and nothing on the board measures
it; adding a checkbox or a streak here would turn a coping tool into another thing to fail at.

It lives on the day view rather than behind a fifth nav tab. The four existing tabs were checked at
375px, not assumed: the nav row already wraps under the brand and the four buttons fill the wrapped
row edge to edge with no spare width, so a fifth tab would either overflow or force an ugly second
wrap. It originally sat in the widget registry as its own stacked section under the day plan; see
"If-then relocation" below for where it moved and why - the registry entry is gone, but the
day-view-not-a-tab reasoning above still holds exactly as written.

Cards read trigger-first: the IF line is bold and leads, the THEN line sits under it in lighter
weight, because the trigger is what a person scans for standing in the moment, not the response.
Editing is one click away and in place - clicking Edit turns that exact card into its own inline
form without a modal, so the rest of the board stays on screen and scrollable the whole time.
Deleting takes the same two-tap confirm already used for templates.

Colour tags reuse the exact same eight-colour palette templates already use (`PALETTE_COLORS` in
the new `src/lib/colors.ts`, with `TEMPLATE_COLORS` now derived from it) rather than inventing a
second one. The one addition the palette needed was a name per colour: a template's colour sits
next to the template's own name, so colour there is reinforcement on top of text that already
carries the meaning, but an if-then tag has no name of its own - the colour *is* the tag - so
without a name attached to each swatch, a colourblind person or a screen reader user would have no
way to know what an untagged colour meant. Every tag renders as visible name text on the card and
on its filter chip, never as an unlabelled dot, and the palette's "no tag" option is its own
dashed, labelled swatch rather than an implied default.

The trigger and action inputs' placeholders are real, specific examples ("I get home and the
kitchen is a mess", not "I feel unmotivated"), and a short line under the trigger field says
plainly what makes a trigger useful: a specific moment, not a feeling. That is the whole nudge -
no validation blocks a vague entry, because the brief only really works if the person writing it
means it, not because a field passed a pattern check.

**If-then relocation.** `docs/RESEARCH-ADHD.md`, written the night after the board first shipped,
raised the stakes on where it lived: implementation intentions are the best-evidenced mechanism in
the whole app (Gollwitzer and Sheeran 2006, d = 0.65), the effect is larger still in populations
with impaired executive control, and Barkley's point-of-performance principle argues directly
against a rule filed in a place a person has to remember to open - which is exactly the state they
are not in when the trigger fires. The "no collapse, no cap" limitation noted above is now moot for
a different reason than a scroll fix would have solved it: the board is no longer a section on the
day view at all.

`IfThenEntry` gained `dayTypes?: DayType[]` and `when?: 'morning' | 'day' | 'evening' | 'any'`, both
absent-means-everything so every existing entry keeps behaving exactly as it did. `pickIfThenRule`
(`src/widgets/if-then/select.ts`) is the pure selection function - eligibility is a strict filter
("a night-shift rule surfaces only on night days" is a hard rule, not a nudge), the most specific
eligible rule wins, and ties break toward whichever eligible rule has gone longest without a turn,
tracked as a plain `lastSurfaced` date key on the entry itself rather than any kind of use counter -
`docs/RESEARCH-ADHD.md` section 12 rules out measuring an if-then rule by name, and this is
scheduling metadata, not a record of whether the rule was read or acted on. A rule already chosen
for the date being viewed keeps being the pick for that date, so rotation moves day to day and never
flips mid-visit.

One quiet line - `IfThenDayRule` - sits directly under the capacity line on the day view: no color,
no icon, each of its two lines capped to one row with an ellipsis. Tapping it opens the full board
in a bottom sheet (`IfThenSheet`), copying `GapPicker.tsx`'s own dialog exactly rather than
inventing a second modal pattern - creating, editing and deleting a rule all still happen exactly
where they always did, just one tap further in instead of a scroll down the day view. The widget
registry (`src/widgets/registry.ts`) now lists only `day-plan`; every real install still carries
`'if-then'` in `settings.enabledWidgets` from the board's time as a registry entry, and
`normalizeLoaded` in `storage.ts` strips that id out on load so nobody's data keeps a reference to a
widget that no longer exists.

Measured at 375x812 with a realistic day (a shift, an appointment, five floats) and five seeded
if-then rules across different day types and time bands: the one quiet line added 79px under the
capacity line - first task at `top: 375` without it, `top: 454` with it, nowhere near the 812px
fold - and the correctly-scoped rule (a night-only trigger, on a seeded night day) was exactly the
one that surfaced. Checked in both a dark and a light theme; the new day-type picker in the form
needed its own themed chip background rather than the tag filter's bare `.chip`, which falls back to
the browser's native button chrome and reads as an unstyled leftover on a dark surface - scoped to
the new picker specifically so the tag pills and filter chips elsewhere are untouched.

**Year strip.** A GitHub-graph style row, one cell per day of a chosen year, colour drawn straight
from `src/widgets/year-strip/yearGrid.ts` - a pure function separate from the component so the whole
question of "what does this year look like" is unit tested on its own, with no rendering involved.
An unplanned day carries no colour and no mark; a day with a plan is coloured by its template, the
same colour it has everywhere else in the app; a day that finished everything it planned - every
counted task, the same rule `dayScore` already uses - gets a thin ring, not a fill change, a
different shade, or anything on a colour spectrum. There is nothing in between a coloured cell and a
ringed one: a day attempted but not finished looks exactly like a day just stamped and not yet
touched, on purpose - the strip does not grade how much of a day got done, only whether it did or
did not get planned, and whether it did or did not get finished.

That "no in-between" rule is the whole defense against this becoming a streak tracker. There is no
current-streak or longest-streak value anywhere in `yearGrid.ts` or the component, no total, no
percentage, no comparison to another month or another year - the words "total", "average", and
"streak" do not appear anywhere in the feature's own copy, and a test asserts as much. An empty
stretch - a real gap where the app went unused - renders as flat, neutral tiles in the same colour
the grid's own background and borders already use, not a hole, not a different shade, not a warning
colour. Seeded with a realistic year including deliberate multi-week gaps and checked in both themes
at both a phone and a desktop width: the gaps are visible as a change in texture, which is the point
of the whole feature, but they do not read as red, punished, or broken - they read as the same tile
everything else on the grid is, just without anything painted on it.

It lives inside the calendar tab, not the day view and not a widget in `src/widgets/registry.ts`.
The registry is specifically the day view's widget list, and a year-at-a-glance strip is not
something anyone needs while looking at today's tasks - the same reasoning that put the if-then
board on the day view argues against putting this there too. It is also not a sixth - a fifth - nav
tab: measured directly rather than assumed, the nav row does not internally wrap at 375px (it has no
`flex-wrap` of its own), so a fifth tab would overflow the header rather than drop to a second line,
worse than the wrapping the if-then board's placement decision was written to avoid. A small
Month/Year segmented control - the same `.segmented` control the template editor's day-type picker
already uses - sits at the top of the existing calendar view instead, switching between the month
grid and the strip without adding anything to the app's navigation.

375px is the hard part of a 365-cell grid, solved by letting the strip scroll sideways inside its
own container instead of shrinking cells to fit or letting the page itself scroll. Measured directly
in a real 375px viewport: the page's own `document.body` never exceeds the viewport width, while the
strip's inner scroll container legitimately overflows and scrolls - confirmed both by the numbers
(317px visible against 634px of content) and by seeing a visible native scrollbar under the grid.
Cell size is fixed at 10px on every screen size rather than shrinking further on a phone: the grid
was always going to need to scroll below a full year's width, so a smaller cell only bought back a
little of that scrolling distance at the cost of a target that was already an accepted exception to
the app's usual 44px minimum becoming even harder to aim at.

Accessibility took the most rethinking. 365 real, focusable elements each carrying their own
`aria-label` would technically not be "unlabelled," but it would still flood the page's tab order
and be exactly the kind of screen-reader hostility a contribution graph is usually criticised for.
The grid uses the same roving-tabindex pattern a native date picker uses instead: only one cell is
ever a tab stop at a time (`tabIndex={0}` on exactly one, `-1` on the rest), arrow keys move that one
stop a day (or a week) at a time, Home and End jump to January 1st and December 31st, and each
cell's accessible name - built by `formatYearCellLabel`, also unit tested - states the date plus its
template and completion only when either applies, never a bare "no plan" announcement for an empty
day. Today's cell carries `aria-current="date"`. Colour is reinforced by shape (the completion ring)
and, since a 10px cell cannot fit a template's name as text, by a small legend beneath the grid
naming every template that actually appears in the year on screen, next to its colour - the same
pairing a template already gets everywhere else it shows up in the app.

**The timeline grid (step 4 of `docs/TIMELINE.md`).** Zone 2 of the day view: a read-only vertical
hour grid under the capacity line, anchors drawn at their real position with a real height, the free
stretches between them drawn as labelled objects rather than blank space. `timelineLayout.ts` in
`src/widgets/day-plan/` is the pure module - window, position, height and gap detection, unit tested
with no React nearby - and `TimelineGrid.tsx` only renders what it computes.

The grid's own window (first anchor's start minus an hour to last anchor's end plus an hour) is
deliberately not `computeCapacity`'s fixed waking window, and the two are meant to disagree at the
edges - see the note in `docs/TIMELINE.md`'s build order for the full reasoning. The one-hour buffer
on each side is air for the eye, never a gap object; only the stretches strictly between two anchors
become one. A day with no anchors draws no grid at all rather than an empty frame.

An anchor with no `minutes` draws at its real start time with a fixed placeholder height - a UI floor,
not a duration guess - and a plain "size unknown" label instead of a time range, and it suppresses
every gap for that day the same way an unsized anchor already suppresses `computeCapacity`'s own free
figure: its real length is unknown, so a gap drawn around it would be a guess wearing arithmetic's
clothes. Overlapping anchors are placed in side-by-side columns through a standard interval-graph
packing rather than drawn on top of each other, and an anchor clipped by the window's own edge (a
night shift running past midnight) keeps stating its real time range, wrapped onto the next day's
clock, with only the drawn block itself stopping short.

A short anchor's card drops its time-range line below a fixed pixel threshold and shows only the
title - two lines of text do not fit inside a five-minute block's honest, proportionally tiny height
without either spilling past the card or the card growing past what its real duration earned, so the
line most useful for scanning wins and the exact range stays one glance away in the task list below.

An anchor's colour comes from the day's own template, the same pastel already used for its chip next
to the date - a day with no template falls back to a neutral card rather than inventing a colour
nothing chose. Text on a coloured anchor is pinned dark, not drawn from `--safe-ink`, matching the
calendar cells' own reasoning: a template's pastel is not `--surface`, so a token tied to `--surface`
is not guaranteed to read against it.

Entirely `aria-hidden`. Every anchor the grid draws is also an ordinary row in the task list directly
below it, already reachable by a screen reader with its title, time, checkbox and controls intact -
the grid adds a second, purely visual reading of the same information rather than a second, worse
copy of an interactive one. This follows the same reasoning the year strip's own accessibility note
above already documents for dropping a role that would only be half true, taken one step further
because a fully accessible copy of the same content already exists elsewhere on the same page. Zero
focusable elements live inside the grid, confirmed directly rather than assumed.

**Gap interaction.** Step 5 pulled the gap elements out from under the `aria-hidden` wrapper above,
exactly as flagged when it shipped. Each gap is now a real, focusable button with its own accessible
name ("1h30 free, 13:00 to 14:30. Tap to place a float.") that opens a bottom sheet listing the
floats that fit - a sized float fits when its own size is no larger than the gap's; an unsized one is
offered separately, labelled "size unknown," never claimed to fit and never guessed at, matching
`capacity.ts`'s own refusal to invent a duration. The sheet caps itself to four rows before asking
for more, following the working-memory limit `docs/RESEARCH-ADHD.md` section 7 documents. Placing a
float sets its `time` to the gap's own start and nothing else; a quiet "remove time" control on the
task's own row in the list below undoes it without needing step 7's drag, which is still the only
thing left in this area.

## Tier 2 - brief features not built yet

**Time anchors, not free text.** `time` currently accepts anything, so "banana" is a valid time (the
team's own review flagged this as deferred). The brief says times are anchors: fix only what is
really fixed, let the rest float.
Build: validate and normalise time input, visually separate anchored items from floating ones.

## Tier 3 - debts already logged in the ledger

Reviewed against the code on 2026-08-31. Several of these were already fixed in a later pass and
never struck from this list; each one below says which.

- ~~Deleting a template leaves a dangling `templateId` on stamped days. Flagged in Task 5, still
  only worked around in views. Fix at the source.~~ Reviewed, not fixed - kept as-is on purpose. A
  stamped day genuinely happened, and deleting the template it was stamped from should not rewrite
  that, the same reasoning that already bakes `dayType` and `core` onto the day instead of looking
  them up live. `DayView`, `CalendarView`, and `yearGrid` already treat a dangling `templateId` as
  no template rather than crashing; the guards are the correct handling, not a workaround waiting on
  a fix. Written up in `docs/DECISIONS.md` and pinned by a test in `store.test.ts` that checks
  `templateId` directly rather than only the day's presence.
- ~~Template block ids regenerate on every edit. Harmless today, a trap for any block-level
  feature.~~ Fixed. `TemplatesView`'s save path now carries a surviving block's id forward from the
  template being edited and mints a fresh one only for a block added during that session.
- ~~Deleting a template has no confirmation.~~ Already fixed by the time of this review - `Delete`
  requires a second confirming tap (`TemplatesView.tsx`), pinned by an existing test.
- ~~Saving a template with an empty name is a silent no-op, so the button looks broken.~~ Already
  fixed - `Save template` is `disabled` while the name is blank, so the button reads as unavailable
  instead of doing nothing when pressed.
- ~~Nav tabs and the theme control lack `aria-current` / `aria-pressed`.~~ Already fixed - the nav
  tabs carry `aria-current="page"` and the theme buttons in Settings carry `aria-pressed`.
- ~~Theme applied in `useEffect`, so dark-mode users see a one-frame light flash.~~ Fixed. An inline
  script in `index.html` reads the persisted theme and sets `data-theme` on the root element before
  the app's own script tag runs, the fix `docs/THEMES.md` specs. Verified by hand against a hard
  reload with dark mode persisted; a unit test cannot observe a pre-paint script by its nature.
- ~~No test coverage for `deleteTask`, `updateTemplate`, `setTheme`, `importData`, `subscribe`.~~
  Fixed - direct tests added in `store.test.ts` for all five, including `importData`'s throw path
  and `subscribe`'s unsubscribe function.
- ~~`TemplatesView`'s new-template and edit forms do not move focus into the name field when they
  open. The if-then board had the same gap and had it fixed; this one is still open.~~ Fixed,
  following the same pattern the if-then board already uses: the editor is its own component,
  mounted fresh each time a draft opens, and focuses its name field on mount.
- The calendar's month grid had `role="grid"` with `role="gridcell"` children and no `role="row"`
  between them - not logged here before this review, found while re-checking the same defect that
  was fixed on the year strip. Unlike the strip, a month calendar is genuinely two-dimensional with
  the visual and keyboard axes in agreement, so the fix completes the structure (weeks wrapped in
  `role="row"`, weekday headers as `role="columnheader"`) instead of dropping the grid roles the way
  the strip did. Fixed, pinned by a test on the structure and one on each cell's accessible name.
- **Standing task, not a defect - needs a real phone, so it stays open:** verify the calendar's
  pointer-based stamp drag on actual iOS Safari and Android Chrome hardware, not just a desktop
  browser's touch emulation. Check specifically: a touch-drag across cells stamps the whole swept
  range the way a mouse drag does; a diagonal or fast drag does not drop cells the finger passed
  over quickly; lifting the finger off the calendar section entirely (into the browser chrome, or
  past the edge of the screen) still stops the paint instead of leaving it stuck on; and the drag
  does not trigger the page's own scroll or a pull-to-refresh gesture while it is happening.

## Tier 4 - the portfolio layer

- GitHub repo description and topics: "Dienius - decision-free day planner PWA".

## Suggested order for the next session

Tier 3 is now clear. What is left:

1. Theme system, steps 1-4 of `docs/THEMES.md` - the pre-paint script (step 3's other half) is
   already done, but the preset architecture, the token layers, and the gallery are not.
2. Time anchors, not free text
3. The phone verification task carried over in Tier 3
