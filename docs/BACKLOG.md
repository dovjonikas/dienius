# Dienius - backlog after the MVP

> Written 2026-08-31 from a full review of the repo against `planner-app-brief.md`.
> Ordered by what the app is missing to BE the thing described in the brief, not by effort.
> Themes have their own spec: `docs/THEMES.md`.

## Tier 1 - without these it is not Dienius yet

**The push rule.** Missing entirely. `Task` has no `pushCount`, and `rolloverUnfinished` moves items
with no counting. The brief's core anti-guilt mechanism: an item can be pushed twice; on the third
it must be done or deleted, and deleting is a decision rather than a failure. Without it this is an
ordinary todo where unfinished work piles up forever.
Build: `pushCount` on `Task`, visible on the item, third push offers only do-or-delete.

**No-guilt day score.** No scoring at all. Score = done/planned for THAT day's own plan. A day with
no plan is a day with no plan, never a failed day. No streaks anywhere.
Build: computed from the day's own tasks, shown as "4/6", never a percentage, never red.

**PWA - offline and installable.** No `public/`, no manifest, no service worker. The brief said
mobile and offline are not optional, and September shifts make that real. Daveedus has this and
Dienius does not.
Build: manifest, icon set, service worker, `display: standalone`, theme-color synced to the theme.

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

1. Push rule with `pushCount`
2. No-guilt day score
3. Theme system, steps 1-4 of `docs/THEMES.md`
4. PWA (manifest, service worker, icons, theme-color)
5. README with screenshots, plus LICENSE
6. Day types and core tasks
7. If-then board
8. Year strip
9. Debt clearing from Tier 3

Items 1 to 5 turn a working todo into the product the brief describes and into something worth
showing. The rest are features and hygiene.
