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
wrap. The widget registry in `src/widgets/registry.ts` - already built to hold a second module
alongside the day plan - was the natural home instead, and it puts the board exactly where "recall
in the hard moment" wants it: on the tab the app opens to, zero extra taps away. Unlike the day
plan, the board is not something a person can turn off from Settings today, so it is auto-enabled
for every existing install on upgrade the same way a brand new one gets it by default - there is no
toggle yet to have an opinion for or against.

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

Known limitation, shipped deliberately rather than blocking on it: the board has no collapse and
no cap. Four or five varied entries already measure roughly two screens of scroll below the task
list at 375px, and that only grows as entries accumulate with no way to shorten the view. Left
alone for now because there isn't a real month of use yet to say whether that actually becomes a
problem, or what the right collapse behaviour would even be if it does - guessing at a cutoff or a
show-more control without that evidence would be complexity standing in for a decision nobody has
actually made yet, the same reasoning behind leaving night and shift days scored identically until
a real case argues otherwise. Revisit once real usage shows the board actually getting long enough
to need it.

## Tier 2 - brief features not built yet

**Year strip.** GitHub-graph style row, one cell per day, filled by completion, coloured by day type.

**Time anchors, not free text.** `time` currently accepts anything, so "banana" is a valid time (the
team's own review flagged this as deferred). The brief says times are anchors: fix only what is
really fixed, let the rest float.
Build: validate and normalise time input, visually separate anchored items from floating ones.

## Tier 3 - debts already logged in the ledger

- Deleting a template leaves a dangling `templateId` on stamped days. Flagged in Task 5, still only
  worked around in views. Fix at the source.
- Template block ids regenerate on every edit. Harmless today, a trap for any block-level feature.
- Deleting a template has no confirmation.
- Saving a template with an empty name is a silent no-op, so the button looks broken.
- Nav tabs and the theme control lack `aria-current` / `aria-pressed`.
- Theme applied in `useEffect`, so dark-mode users see a one-frame light flash. Fixed for free by
  the pre-paint script in `docs/THEMES.md`.
- No test coverage for `deleteTask`, `updateTemplate`, `setTheme`, `importData`, `subscribe`.
- The calendar pointer drag has never been run on a real phone.
- `TemplatesView`'s new-template and edit forms do not move focus into the name field when they
  open. The if-then board had the same gap and had it fixed; this one is still open.

## Tier 4 - the portfolio layer

- GitHub repo description and topics: "Dienius - decision-free day planner PWA".

## Suggested order for the next session

1. Theme system, steps 1-4 of `docs/THEMES.md`
2. Year strip
3. Debt clearing from Tier 3

Item 1 turns a working todo into the product the brief describes. The rest are features and hygiene.
