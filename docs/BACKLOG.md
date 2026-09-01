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

**Drag between the tray and the grid (step 7 of `docs/TIMELINE.md`).** Dragging a float onto a gap
anchors it; dragging an anchor back onto the tray un-anchors it - both through the same
`placeFloat`/`unanchorTask` store actions the tap-a-gap picker already uses, never a third path.
Follows `CalendarView.tsx`'s own pointer technique exactly: release pointer capture on `pointerdown`,
track the current target with `document.elementFromPoint` + `closest` on `pointermove` rather than
`pointerenter`, clean up on document-level `pointerup`/`pointercancel`. `touch-action: none` sits only
on a small drag handle per row and on the anchor's own block in the grid, never the whole row, so the
page keeps scrolling normally everywhere else. `dragDrop.ts`'s `resolveDrop` is the pure drop-outcome
logic, reusing `gapPlacement.ts`'s `canPlaceFloatInGap` rather than a second fit rule, so a drag can
never place something the tap picker would have refused. A minimum-movement guard stops a bare tap on
an anchor block from un-anchoring it by accident.

A long-press menu (`TaskActionsSheet.tsx`, `useLongPress.ts`) does the same two things through a path
that does not depend on drag working at all - the spec's own explicit requirement, given the
calendar's drag had a documented history of not working on touch in this repo. It lists a float's
available gaps straight from the day's own tasks regardless of whether the grid is expanded, which is
also the answer to a collapsed grid: dragging auto-expands the grid so there is something to drop
onto, and the long-press menu works without needing the grid open at all.

Verified live in the browser with real, unmocked `PointerEvent` sequences: both drag directions,
the oversized-float refusal, the bare-tap guard, normal page scrolling at 375px with the grid
expanded, and the long-press menu placing and un-anchoring correctly with the grid collapsed. Not
verified on real touch hardware - see the standing item in Tier 3 below, now widened to cover this.

**Update, row density pass:** the row's own drag handle described above - "a small drag handle per
row" - was removed. See
`.superpowers/sdd/2026-08-31-dienius-mvp/fix-task-row-density-report.md`: a float's row never had a
second way to reach placement beyond that handle, but the actions menu this same pass built out
(`TaskActionsSheet.tsx`) already offers placement directly, independent of the grid, so nothing lost
reachability - only the live drag gesture itself is gone for a float. The anchor's own block inside the
expanded grid still drags back to the tray exactly as described above; that half of this section is
current. `dragDrop.ts`'s `resolveDrop` was simplified to match - it only ever resolves an anchor now.

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

**Ongoing tasks - the push bound's third choice.** `docs/RESEARCH-PUSH-RULE.md`, written after the
owner said the two-push bound is right for most tasks and wrong for some, found the bound itself is
a design choice with no citation behind it - see the new section in `docs/DECISIONS.md` - and
recommended widening the do-or-delete moment a task already hits at the bound into three choices
instead of two, rather than asking anything new at quick-add.

`Task.unbounded?: boolean` is the whole data model, absent meaning false like every other optional
field on `Task`, so a task written before this shipped loads and pushes exactly as it did before.
`isPushable` in the new `src/lib/pushRules.ts` is the one place that answers whether a task can
still move - true under the bound, and true unconditionally once `unbounded` is set - and
`rolloverUnfinished`, `pushTask`, the push button, and the rollover count on the day view all read
it instead of each keeping their own copy of the comparison. `pushedForward` clears `core` on every
push, same as before, but leaves `unbounded` alone: it is a fact about the kind of task this is, not
a promise tied to the day it reached the bound on.

The maxed-note that used to read "Pushed twice - do it today, or let it go" now offers a third
branch: "Pushed twice - do it today, let it go, or mark it ongoing. Deleting counts as a decision,
not a failure." Marking a task ongoing sets the flag through the new `setTaskUnbounded` action and
shows a small, quiet, text-only label on the task's own row from then on - matching `core`'s own
plain treatment, no colour, no icon - and that label doubles as its own undo: tapping it clears the
flag with no confirmation step, the same weight as changing a task's size. Once a task is marked
ongoing, `pushCount` keeps incrementing internally but stops being shown anywhere on that task's row
- no count of how many times it has moved, no age, nothing that turns "this is standing" back into
"this has been sitting here for a while," which would have quietly reintroduced the guilt the whole
feature exists to remove.

`TemplateBlock.unbounded?: boolean` gives the same exemption a way to start on day one, for a task
the owner already knows, while building a template, is not going to resolve inside the bound -
copied onto `Task.unbounded` in `applyStamps` at stamp time exactly the way `core` already is. Its
toggle in the template editor is not gated on day type the way `core`'s is, since being a standing
task has nothing to do with whether the day scores by core tasks only - it is a quiet second pill
next to Core wherever Core already appears, and shown on its own on a full-day template where Core
is hidden.

Checked at 375px with a long task title, both the maxed-note's three-choice sentence and the
template editor's block row (time, size, Core, Ongoing, remove, on a single block already carrying
a long title): no horizontal overflow on either `document.body` or any individual element, measured
directly through `getBoundingClientRect` rather than a screenshot, which this session's browser
pane could not be trusted to render reliably. The mark-ongoing button, the reversible ongoing label,
and pushing a task well past the bound were all exercised through real DOM `click()` calls and
confirmed by reading the change straight back out of `localStorage`, not by trusting what rendered
on screen.

**First-run experience.** A person who cleared storage and opened the app saw the brand, four nav
tabs, today's date, quick-add, and one grey sentence naming templates without offering a path to one -
measured directly against `docs/RESEARCH-ADHD.md` section 11's finding that the sharpest drop in
ADHD-tool retention comes right after acquisition, with confusing interfaces and setup cost among the
recurring causes. Fixed without reversing the app's own ships-empty rule - see the new "Starter
templates offer, they never install" entry in `docs/DECISIONS.md` for the full reasoning.

`isFirstRun` in the new `src/lib/onboarding.ts` reads `AppData` directly - true only while there is no
template anywhere and no day holding a real task - rather than a stored flag, so it needs no
migration and comes back on its own if a person erases everything. While it is true, the day view's
empty state is replaced by three starter offers (`STARTER_TEMPLATES` in the new
`src/lib/starterTemplates.ts`, rendered by `StarterOffers.tsx`): a working day, a rest day, and a
night shift, each written as an actual person's day - real titles, real times, an eight-hour night
shift - with the day type's own scoring rule already at work in the content, not just explained: the
rest day has one core block (morning medication) among five that are not, and the night shift has one
core block (the shift itself, 480 minutes) among five that are not, so tapping either one shows a
reduced score without a sentence of explanation needed. One tap creates the template through the same
`actions.addTemplate` the manual editor already calls and stamps it onto the date being viewed through
the same `actions.stamp` the calendar's own stamp bar already calls - no third code path for either
half of what the tap does. The templates list's own empty state offers the same three cards through
the same component, minus the stamp - there is no single date to stamp there - and a person who
already has any template never sees the offers on either screen again.

The calendar's empty state got the smaller fix it actually needed: with no templates yet, the stamp
bar used to just be absent, a silent gap rather than a dead end that says what to do about it. It now
shows one sentence and a "Create a template" button that switches to the Templates tab (`onOpenTemplates`,
a new optional prop threaded from `App.tsx`), rather than repeating the starter cards a third time.

Where the eleven themes get discovered was reconsidered rather than left alone or restructured: no
fifth nav tab (`docs/BACKLOG.md`'s own year-strip entry above already measured that the nav row
overflows rather than wraps at 375px) and no relocation of the Settings section that already shows
them. The first-run teaching state carries one line instead - "There are also eleven color themes
here, light and dark - see them under Settings" - surfacing the fact at the one moment a new person is
actually deciding whether the app is worth their time, without a tour or a second onboarding surface.
Recorded as its own item in `docs/OPEN-QUESTIONS.md` since it is a judgment call, not a spec.

No guided flow, no coach marks, no modal sequence anywhere in this: `docs/RESEARCH-ADHD.md` section 12
names Sunsama's five-step morning ritual as the thing to avoid, and every path here - quick-add,
Templates' own "New template," and now the starter offers - sits at the same single tap depth as
before, with nothing that has to be dismissed before the app works.

Timed by hand against a real build, storage cleared first: from an empty install to a fully planned,
scored day with a real timeline and a real capacity line took one tap once the page had loaded, in
both a light and a dark theme and at both 375px and desktop width, verified by reading the resulting
template and day straight back out of `localStorage` rather than trusting only what rendered - the
browser pane in this session went stale mid-session exactly as past sessions warned it might, caught
by a `window.innerWidth` of `0` on a hidden tab that a fresh `preview_start` and an explicit resize
fixed. No horizontal overflow on `document.body` at 375px, confirmed through `getBoundingClientRect`
on the offer cards and their buttons, which meet the app's 44px minimum through the same base `button`
rule every other button in the app already gets.

**Timeline gap overlap, fixed.** An ADHD-user review found that a gap shorter than about 38 minutes
drew its own 44px touch-target floor straight over the anchor card that followed it - the app's own
"text stays highly readable" promise broken literally, two labels drawn on top of each other, on a
shape of day (a short buffer between two blocks) that real shift schedules are full of. The cause was
a layout that positioned every anchor and gap purely proportionally to real clock time and applied the
44px floor only afterward, as a CSS `min-height` on the box - the floor could grow a box past its own
proportional bottom edge, but nothing told the *next* element to move out of the way.

`computeVerticalLayout` in `timelineLayout.ts` replaces that with a piecewise-linear map: clock time is
split into the segments the grid actually draws - an anchor cluster (touching or overlapping anchors,
whichever needs the taller floor), the real gap between one cluster and the next, and the one-hour
buffer on each end - and every segment is guaranteed at least its own pixel floor before segments are
stacked in order. A segment that already earns more than its floor from real time is left alone; one
that does not is stretched to the floor, and the stretch pushes every later segment down by exactly the
same amount, so nothing after a floored gap can ever be drawn underneath it. `TimelineGrid.tsx` now
positions every hour mark, half-hour rule, anchor, gap and the current-time line from this one function
instead of the old percent-of-window conversion, so everything on the grid still reads as one coordinate
system. A day with any unsized anchor - which already suppresses every gap object for the whole day, its
real end being unknown - reserves no floor for a gap that will never render a button, so that scenario's
spacing is unchanged from before this fix.

A second, smaller overlap turned up while verifying the first fix by measurement rather than by eye: the
gap button's own `margin: 2px 8px 2px 0` shifted its rendered box two pixels past what the layout math
promised - a vertical margin on an absolutely positioned element with an explicit `top` and `height`
moves the margin-top edge without shrinking the box to compensate, silently eating two pixels into
whatever came next. Fixed by dropping the vertical margin (`margin: 0 8px 0 0`), keeping only the
horizontal breathing room against the scroll container's own edge.

Verified by measurement, not by eye: rebuilt the exact case the review reported (two real 30-minute
blocks, a short buffer between them) with 15, 25 and 35-minute gaps and read `getBoundingClientRect()`
off the live DOM for the gap and the anchor immediately after it, in Slate, Terminal, Legal pad and Ink
and wash, at both a desktop width and 375px. Every gap measured exactly 44px tall; the following
anchor's own top matched the gap's bottom in every case, to the pixel - flush, never overlapping. No
theme in `styles.css` scopes a rule to `.timeline-gap` or `.timeline-anchor`, so the geometry does not
vary by preset by construction; the four themes checked live are a spot check on that fact, not a
search for an exception. The gap stayed a real, focusable button throughout - confirmed it still opens
its picker on click at 375px, `aria-expanded` flips to `"true"`, and `document.body` never exceeded the
viewport width.

**Unvalidated colors closed off as a beacon vector.** A security audit found that `Template.color`,
`IfThenEntry.color`, and every value inside a `ThemeOverrides` patch were validated only as
`typeof x === 'string'`, then landed unsanitized as literal CSS values - a crafted backup with a color
of `url("https://attacker.example/x")` fired a real network request on import, confirmed live, leaking
the viewer's IP, user agent and timing. No code execution and no CSS-breakout were possible - a
semicolon-based attempt was tried live and rejected outright by both `CSSStyleDeclaration.setProperty`
and React's own style object - so this was a tracking beacon, not a takeover, but a real and reachable
one through the single most-trusted input path the app has.

Fixed at the validation layer in `storage.ts` rather than at each render site, so a bad value never
reaches storage in the first place. `Template.color` and `IfThenEntry.color` must now match
`/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/` - every hex length CSS itself
recognizes, matching every value `PALETTE_COLORS` in `colors.ts` or a native `<input type="color">`
can ever actually produce. `ThemeOverrides` needed more care: it is a sparse patch across all 21
`ThemeTokens` keys, and 9 of them are not colors at all - `ruleSize`/`radius`/`edge` are CSS length
shorthands (`edge` alone can be the hand-drawn preset's own multi-value `"225px 14px 255px 15px / 15px
255px 14px 225px"`), `grain` a plain 0-1 number, `vignette` a percentage, `fontDisplay`/`fontBody`/
`fontMono` font stacks, and `shadow` a real `box-shadow` value with `rgba()` calls in it - a blanket
hex-only check would have rejected every one of those as a false positive. Each of the 21 keys now has
its own grammar (a hex color; a space/slash-separated list of plain lengths; a 0-1 decimal; a
percentage; a letters-digits-spaces-hyphens-apostrophes-commas font stack with no parenthesis anywhere,
so no function call - including `url()` - can ever be written; or, for `shadow`, every `rgba`/`rgb`/
`hsla`/`hsl` call stripped out first, with whatever text is left required to contain no parenthesis at
all), so a `url()` value is unrepresentable in any of the 21 rather than merely blocked in the color
ones. A key naming none of the 21 - a stale token, a typo - is checked only as a bounded string, since
`applyOverrides` in `theme.ts` already ignores anything outside this list and it never reaches a style
attribute or a custom property regardless of what it holds.

A backup that fails the check is rejected whole, exactly the same treatment an out-of-range
`Task.minutes` or an unknown `DayType` already gets - this file has never partially accepted a payload
by silently dropping the one field that failed, and a color earns no special case. Because
`loadData()`/`importJson()` only ever replace state after `validate()` succeeds, a rejected import
changes nothing; the app's own promise that a bad import never destroys existing data holds exactly as
it did before this fix, now for this case too.

The one place this needed a second, independent fix: `index.html`'s pre-paint script duplicates
`storage.ts`'s own theme validation on purpose, to paint the persisted theme before React mounts - see
`docs/DECISIONS.md`. It had the exact same `typeof === 'string'` gap, and because it reads raw
`localStorage` directly rather than going through `storage.ts`, fixing `storage.ts` alone would not have
closed it: anyone who had already imported a malicious backup before this patch would have kept getting
the beacon fired on every single page load afterward, even though `loadData()` had started rejecting the
same payload the moment React mounted - a flash-fix, not a real one. `index.html` now carries the same
per-token grammar, `src/preTheme.test.ts` runs the real script text against both a bad-color and a
legitimate-multi-value-edge case and asserts it agrees with the real pipeline in both, and a live check
confirmed a crafted `url()` backup no longer paints on either side.

Verified live end to end, not just by unit test: seeded real existing data, imported a crafted backup
with `Template.color` set to a `url()` beacon through the actual file input Settings uses, and watched
with a `PerformanceObserver` for any request naming the attacker's domain. None fired, "That file is not
a valid Dienius backup." appeared, and the existing template was still exactly as it was. A second import
of a legitimate backup carrying a hex accent override, the hand-drawn edge's multi-value shorthand, a
real font stack, and an if-then tag color all succeeded with no false rejection, confirming the tightened
validation does not reject anything the app itself would ever produce. Regression tests added in
`src/lib/storage.test.ts` (a crafted color on a template and an if-then entry, every hex length accepted,
non-hex rejected including a semicolon-breakout attempt, every legitimate non-color override token
accepted, a `url()` value rejected on every override category) and `src/preTheme.test.ts` (the pre-paint
script's own agreement with the real pipeline on a bad color, on `bg` specifically - the token the audit
reproduced the beacon against live - on a bad non-color token, and on the legitimate multi-value edge
case).

## Tier 2 - brief features not built yet

~~**Time anchors, not free text.** `time` currently accepts anything, so "banana" is a valid time
(the team's own review flagged this as deferred). The brief says times are anchors: fix only what is
really fixed, let the rest float.
Build: validate and normalise time input, visually separate anchored items from floating ones.~~
Fixed. `parseTimeInput` in `capacity.ts` is the one place a typed time is turned into a real value -
a colon time ("9:30"), a bare-digit shorthand ("0930", "930"), or an hour on its own ("14") all
normalise to a canonical "HH:MM"; anything else, including "banana" and an out-of-range "25:00",
returns `undefined` and is discarded rather than stored. It shares its definition of a valid hour and
minute with `parseQuickAdd` in `parse.ts` (`TIME_RE`) rather than defining the shape of a real time
twice. An empty field still means a float, unchanged - this was never about requiring a time, only
about rejecting a fake one.

The template block editor's time field (`TimeStepInput.tsx`) is a custom text field rather than a
native `<input type="time">` - the native control's picker UI cannot be restyled consistently across
the app's eleven themes, and on iOS Safari it opens a full wheel picker on focus, slower for quick
entry than typing "0930" directly on the exact device this field is mostly used from. Typing still
works exactly as before and is normalised only on blur or Enter, never mid-keystroke, and never with
an error message - an unparseable value is discarded silently, reverting to whatever was last valid.
Arrow-key stepping is layered on top: Up and down move the time by 15 minutes, matching how templates
are actually built (on the hour or the quarter, never the minute); Shift with either arrow jumps a
full hour, for closing a bigger gap without counting presses, an accelerator that only exists for a
keyboard for the modifier key it depends on. Two visible step buttons sit beside the field doing the
same 15-minute move for a touch screen, which has no Shift key and, on iOS in particular, no arrow
keys on its on-screen keyboard either - keyboard stepping alone would have been invisible on the exact
phone this field is built for. Both buttons meet the app's 44px touch-target minimum. Stepping an
empty field seeds it at 09:00, the field's own placeholder, rather than midnight or the current clock
time, so the first press lands on the same value already shown as an example. Crossing midnight in
either direction wraps rather than clamping, pinned by tests in `capacity.test.ts`
(`stepTime`) alongside the rest of `TemplatesView.test.tsx`'s coverage of the field itself.

The block's `min` duration field did not get the same stepper. `parseMinutesInput` already discarded
an invalid value at save time before this change, so the "invalid can't be stored" half of the brief
already held there; what it did not have was live stepping, and a duration does not have the same
case for it a clock time does - there is no natural default to seed an empty field with, no wraparound,
and a typical estimate (60, 90, 120 minutes) would take four to eight presses at a 15-minute step,
working against the same time-cost-of-upkeep concern `docs/RESEARCH-ADHD.md` section 11 raises about
planner abandonment generally. One real bug in that field's live preview was fixed regardless: the
in-progress block list rendered a garbage size (e.g. `abc`) as `formatDuration(NaN)` - "NaNhNaN" -
before a template was even saved. The preview now runs the same `parseMinutesInput` check the final
save always used, so a bad size shows nothing rather than nonsense, without adding a stepper the field
does not need.

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
  reload with dark mode persisted, and `src/preTheme.test.ts` extracts that exact script by its `id`
  attribute and runs it via `new Function()` against a growing set of scenarios - valid presets, corrupt
  JSON, non-object JSON, invalid theme values, non-string and malformed override values, live
  `matchMedia` for system mode - asserting its output agrees with the real `loadData()`/`resolveTheme()`/
  `applyResolvedTheme()` pipeline every time. A unit test observing a pre-paint script's own text was the
  gap once; it no longer is.
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
- **Standing task, not a defect - needs a real phone, so it stays open:** verify every pointer-based
  drag in the app on actual iOS Safari and Android Chrome hardware, not just a desktop browser's touch
  emulation. Originally the calendar's stamp drag alone; widened by step 7 of `docs/TIMELINE.md` to
  cover its own two drags (float onto a gap, anchor back to the tray) and long-press menu at the same
  time, since all of them share the same `elementFromPoint` + `touch-action` technique and the same
  risk. Check specifically: a touch-drag across calendar cells stamps the whole swept range the way a
  mouse drag does; a diagonal or fast drag does not drop cells or gaps the finger passed over quickly;
  lifting the finger off the relevant section entirely (into the browser chrome, or past the edge of
  the screen) still stops the gesture instead of leaving it stuck on; none of these drags trigger the
  page's own scroll or a pull-to-refresh gesture while in progress; and a long-press on a task row
  opens its menu without also scrolling the page or toggling the checkbox underneath it.
- ~~Four exported symbols nothing outside their own file imports: `SYSTEM_CONDENSED` in `themes.ts`,
  `TEMPLATE_COLORS` in `TemplatesView.tsx`, `gapsInWindow` in `capacity.ts`, `pushCountLabel` in
  `TaskRow.tsx`.~~ Decided per symbol rather than dropping `export` from all four reflexively. Three
  were genuinely dead - `SYSTEM_CONDENSED` names Newsprint's own compiled `fontDisplay`, which the
  override panel never exposes (only `fontBody` is overridable there); `TEMPLATE_COLORS` is a
  values-only derivative of `PALETTE_COLORS` that the if-then board, the other feature drawing from the
  same palette, imports directly instead; `pushCountLabel` has exactly one caller, `boundNote` in the
  same file. `export` came off all three. The fourth, `gapsInWindow`, was a real gap rather than a false
  positive: its own comment already claimed the grid's `computeInteriorGaps` shared it, which was not
  true - that function reimplemented the same walk by hand. `computeInteriorGaps` now calls
  `gapsInWindow` directly and filters out whichever of its edge gaps (before the first anchor, after the
  last) do not belong on a grid that only ever draws the interior ones, so the comment's claim is true
  and the export is no longer unused. Every existing gap test - touching anchors, overlapping anchors,
  a single anchor, an unsized one suppressing gaps entirely - still passes unchanged, confirming the
  refactor is behavior-preserving.
- ~~Six culture nits from the security audit's Part 2.~~ Worked through individually rather than as a
  block. A stale doc comment claiming code sharing that did not exist is the `gapsInWindow` item just
  above - fixed there, not twice. `src/widgets/day-plan/draft.ts`'s one `catch { // ignore }` now
  explains itself the same way its own file's other two catches already do. The one real `act()`
  warning in `YearStrip.test.tsx` was tracked to its actual cause rather than guessed at: a raw
  `.focus()` call in the "arrow keys do not cross into a year that is not rendered" test fires the
  cell's own `onFocus` handler outside any `userEvent`-managed `act()` boundary, and every other test in
  the file gets away with the same pattern only because the arrow press right after it triggers a real,
  properly-wrapped state update that happens to flush the pending one along with it - here the press is
  refused (there is no next year rendered) and never does. Wrapped the one `.focus()` call that needed
  it; confirmed with a `console.error` spy that the warning is gone and confirmed by removing the wrap
  again that it reliably comes back, rather than trusting an absence of output alone. `.github/workflows/
  deploy.yml` now triggers on `pull_request` as well as `push`, with the `deploy` job itself gated to
  `github.event_name == 'push'` so a PR - from a fork, in particular - can never push to GitHub Pages,
  and the concurrency group scoped per branch/PR ref rather than one shared `pages` group so a PR run
  cannot race the deploy pipeline. `README.md`'s hardcoded test count is gone - the sentence around it
  already said what the suite covers without a number, and `npm test` reports the true count on demand
  instead of a figure that goes stale with the next feature commit.

  Left alone, on purpose: the audit's own Finding 2 additionally names a handful of `Props` interfaces
  and similar type-only exports (`TaskRowProps`, `GapPickerProps`, `WidgetDef`, and others) as unused
  outside their own file, and says plainly it would not spend a PR on them - types are erased at build
  time, so an unused `export` on one costs nothing to leave. Agreed; none of those were touched.

## Tier 4 - the portfolio layer

- GitHub repo description and topics: "Dienius - decision-free day planner PWA".

## Suggested order for the next session

Tier 3 is now clear, and time anchors are fixed. What is left:

1. Theme system, steps 1-4 of `docs/THEMES.md` - the pre-paint script (step 3's other half) is
   already done, but the preset architecture, the token layers, and the gallery are not.
2. The phone verification task carried over in Tier 3
