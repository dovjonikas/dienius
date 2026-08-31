# Dienius - backlog after the MVP

> Written 2026-08-31 from a full review of the repo against `planner-app-brief.md`.
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

## Tier 1 - without these it is not Dienius yet

**README with screenshots.** There is no README. This is a public portfolio repo - an employer opens
it and sees nothing. This single file carries more weight than any feature.
Build: what it is, why it exists, screenshots light and dark, phone and desktop, stack, how to run,
and the reasoning behind the local-first choice.

## Tier 2 - brief features not built yet

**If-then board.** Implementation intentions: IF (specific trigger) + THEN (one concrete move) +
optional colour tag. Card view with filter chips, editing one click away. The point is recall in the
hard moment, not typing.

**Year strip.** GitHub-graph style row, one cell per day, filled by completion, coloured by day type.

**Day types on templates.** Templates exist with colours but carry no type semantics (full / shift /
night / rest). Needed before the September shifts so a 12-hour day does not render as a failed one.
Build: `type` on `Template`, `core` flag on tasks, non-full days score core items only.

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

## Tier 4 - the portfolio layer

- LICENSE (MIT).
- GitHub repo description and topics: "Dienius - decision-free day planner PWA".
- Live demo link at the top of the README.
- Screenshots: light and dark, phone and desktop.
- `docs/DECISIONS.md` - why localStorage, why no accounts, why no streaks. Written for the person
  reviewing the repo, not for the user.

## Suggested order for the next session

1. Theme system, steps 1-4 of `docs/THEMES.md`
2. README with screenshots, plus LICENSE
3. Day types and core tasks
4. If-then board
5. Year strip
6. Debt clearing from Tier 3

Items 1 and 2 turn a working todo into the product the brief describes and into something worth
showing. The rest are features and hygiene.
