# Dienius - backlog

Sorted on 2026-09-24 for the freeze that starts on Monday 2026-09-28 (the
first section of [`STATE.md`](STATE.md)): everything this file and the
lists beside it ever asked for, in three parts. **Parked** is what waits,
and where anything asked for during the freeze is written down. **Done** is
what was asked for and is built, with where it lives. **No longer
relevant** is what was asked for and then overtaken, with what overtook it.

Before the sort this file was the ledger of the MVP review of 2026-08-31,
tier by tier, and a second one-item list stood in the repo's root; the
long entries are in git history (`git log -- docs/BACKLOG.md BACKLOG.md`),
and the version-by-version account of how each was built is
[`HISTORY.md`](HISTORY.md).

## Parked

**How a request is parked.** One entry each: what is asked for, in the
owner's terms rather than the code's; the date and who asked; why it waits;
and what it would take, as far as that is known. A request is parked when
it would make the app do something it does not do today - a new screen, a
new setting, a new kind of data, a control that is not there. A fault in
what the app already does is not parked: it is a bug, and bugs are fixed
in the freeze (STATE, "Freeze nuo 2026-09-28").

| What | Asked | Why it waits, and what it would take |
|---|---|---|
| **A day's own task marked core.** Only a task stamped from a template block can be core, so something typed on a shift day that turns out to matter cannot carry the day's score | The MVP review, 2026-08-31 | A control on the task and a store action, a new thing the day can do. DECISIONS "Manual tasks are never core" keeps it as a known cost until a real month of shift days shows whether it matters |
| **A reminder that arrives while the app is closed.** A push, not a notice on an open page | The owner's list of 2026-09-15, D3 | GitHub's scheduled runs are late by ten to thirty minutes, so a reminder before a task would arrive after it started. What such a run can carry honestly is a digest: the day's timed tasks at seven, and the evening close. A VAPID key pair, the private key as a secret in the data repo, a workflow there, web push, and the app installed on the phone's home screen - about a day, checkable only on the owner's devices |
| **An hour at a time in a time field.** Shift with an arrow key moves a stepper by more; the time field has no arrows to hang that on, and its answer is the column of times | v2.14's sweep | If a week of use asks for it, the answer is a control, not a line of help |
| **The script split by page.** One 799 KB script, 232 KB over the wire, that the first open over a slow line waits for | v2.17's hunt, measured again in [`SPEED.md`](SPEED.md) | Kitchen, the Library, Templates, Settings and Review each fetched when first opened would halve the first screen's script. Every part is one more thing a deploy can take away from a page left open, and every open after the first is served from the worker's cache. SPEED.md prices it |
| **A kind before a day shift.** The free day before a day shift keeps a free day's evening, which runs into the day shift's early night | The owner's month, lived in a test, 2026-09-25 | The owner's file answers it since 2026-09-25: its free day's evening ends by the day shift's bedtime (DECISIONS "Four questions answered before the freeze"), so it waits until a day asks for more than the file can say. What it would take: a rule beside `afterNight`, a kind naming the kind it is on the day before another, read at every door `resolveAfterNight` is - a field on the mark, the resolver both ways, the editor's select, the file's field and v2.40's tests again, about a day |

**Not a feature, and waiting for a hand:** every drag, the block resize,
the long-press menu and the calendar's paint across dates, by a finger on
a real iPhone - CHECKS-BY-HAND B1, in the list of what only the owner can
do (STATE section 4). Written up in 2026-08 as a standing task, for
Android Chrome too; it closes when B1's table is filled in.

## Done

| What was asked for | Where it is |
|---|---|
| **Another recipe on a meal in two presses** - parked by the shift of 2026-09-25, taken out by the owner before the freeze | The "choose" and "another" mark on a meal's card and its list in place, `TaskRow.tsx`; `mealChoices` in `lib/kitchen.ts`; `actions.setTaskRecipe`; DECISIONS "Another recipe on a meal in two presses" |
| **The push rule** - an unfinished task moves to tomorrow twice, then waits for a decision | `lib/pushRules.ts`; `rolloverUnfinished` in `lib/store/days.ts`; the rollover line in `TaskPane.tsx` |
| **A day score without guilt** - done over planned, nothing on a day with no plan | `widgets/day-plan/score.ts` |
| **Installable and offline** - a manifest, a service worker, an update the person is told about | `public/manifest.webmanifest`, `public/sw.js` versioned by `scripts/generate-sw.mjs`, `src/pwa.ts`; DECISIONS "A hand-rolled service worker" |
| **README, LICENSE and a decisions log** | `README.md`, `LICENSE`, `docs/DECISIONS.md` |
| **Day types** - a shift, a night or a rest day scored by its core tasks | `DayType` in `lib/types.ts`, `lib/stamping.ts`, `score.ts`; DECISIONS "Four day types, one scoring rule" |
| **The timeline grid** | `timelineLayout.ts`, `TimelineGrid.tsx` |
| **A block dropped on the list is un-anchored, and a long press opens a task's actions** | `resolveDrop` in `dragDrop.ts`, `useLongPress.ts`, `TaskActionsSheet.tsx` |
| **A free gap is something to press** - it opens what fits in it; Remove time takes a task off the clock | `GapPicker.tsx`; `TaskActionsSheet.tsx` and `TaskDetail.tsx` |
| **Ongoing tasks**, the push bound's third choice | `Task.unbounded`, `setTaskUnbounded`; DECISIONS "The push bound is a design choice, not a finding - and it has one exemption" |
| **A first run that offers, never installs** | `lib/onboarding.ts`, `lib/starterTemplates.ts`, `StarterOffers.tsx`; DECISIONS "Starter templates offer, they never install" |
| **Gaps that no longer overlap on the grid** | `computeVerticalLayout` in `timelineLayout.ts` |
| **Colours checked before they are painted** | `HEX_COLOR_RE` in `lib/validate.ts`, the same check in the pre-paint script in `index.html` |
| **A wide screen used** - the day's two panes, a mini month and the templates beside it | `useIsWide` in `lib/viewport.ts`, `MiniCalendar.tsx`, `TemplateRail.tsx` |
| **An anchored block dragged by a real pointer** | `.timeline-anchor-draggable` in `styles.css` |
| **A time is a time, not free text** | `parseTimeInput` and `stepTime` in `capacity.ts`, `TimePicker.tsx` |
| **A template's blocks keep their ids across an edit** | the save in `TemplatesView.tsx` |
| **Deleting a template asks twice** | `DeleteTemplateButton.tsx` |
| **A template with no name cannot be saved** | Save disabled in `TemplatesView.tsx` and `WeekTemplateEditor.tsx` |
| **The rail and the theme controls say which is chosen** | `aria-current` in `NavRail.tsx`, `aria-pressed` in `ThemePreviewCard.tsx` and `AppearanceControls.tsx` |
| **No flash of the wrong theme on load** | the pre-paint script in `index.html`, run by `src/preTheme.test.ts` |
| **Tests for five store actions nothing tested** | `lib/store.test.ts` |
| **A template editor opens on its name** | `TemplatesView.tsx`, `WeekTemplateEditor.tsx` |
| **The month grid read as a grid** - rows and column headers | `CalendarView.tsx` |
| **Four exports nothing imported, and six nits from the security audit** | gone, or made true; [`audit/security-and-culture.md`](audit/security-and-culture.md) |
| **The repo's description and topics** | on GitHub |
| **React's act() warnings cleared**, and the next one fails its test | `src/test/setup.ts` |
| **The base field rule weighs nothing** | `input:where(...)` in `styles.css`, `notSpecificity.test.ts`; DECISIONS "The base field rule weighs nothing, and four fields look the way their rules asked" |
| **A file on this computer for a Library item**, and the same book on the phone | `lib/localFile.ts`, "Pick a file on this computer" and "Also at" in `LibraryView.tsx`; DECISIONS "A file on this computer is pointed at once, not copied and not served" and "The book's file, on the phone too" |
| **Sync that can be trusted** - Restore says what it replaces, an open screen catches up, the Sync line says when the other device last wrote (the list of 2026-09-15, A2 to A4) | `SyncSettings.tsx`, `lib/syncClient.ts`, `lib/githubSync.ts`; [`SYNC.md`](SYNC.md) |
| **The nets** - the precision pass sees alignment, the keyboard walk and the sweep serve themselves (C1 to C3) | `npm run precision`, `npm run keys`, `npm run sweep` |
| **A block dragged and pulled on the template's picture** (D1) | `TemplateTimeline.tsx` through the day's own drag hook |
| **The command palette's door on a phone** (D2) | the Search button in the header, `App.tsx` |
| **The eight leftovers of the rotating-shifts audit** ([`RESEARCH-SHIFTS.md`](RESEARCH-SHIFTS.md) section 1.3) - Core on a week's column, a deleted schedule or template left pointing, the Library's block on a week, three ways an imported event was cut wrong | fixed before the freeze, each with its test; DECISIONS "Eight defects and a reading plan, before the freeze" |
| **The worker says why a file could not be served** | `cacheFirst` in `public/sw.js` passes the network's own error on; `serviceWorker.test.ts` |

## No longer relevant

| What was asked for | What overtook it |
|---|---|
| **The if-then board**, and moving its rules onto the day view | Rules went under goals in v2.0, and goals and rules were retired in v2.28 - DECISIONS "North is one text, goals retired" |
| **The year strip** | Removed in v2.7 with the Year view - DECISIONS "The Year view goes" |
| **Dragging a floating task onto a gap** | A gap opens what fits in it, and a task's actions place it - the gap picker and the actions sheet above |
| **A first-run line about eleven themes** | Three themes now - DECISIONS "Three themes, and why eight good ones had to go" |
| **The mini month's cells at 44px** | Kept at 33px on purpose - DECISIONS "The mini calendar's cells stay at 33px" |
| **Clearing a deleted template's id off the days it stamped** | Rejected - DECISIONS "A stamped day outlives its template" |
| **Removing type-only exports nothing imports** | Declined: types cost nothing at build |
| **The set-aside shelf in the long walk** | Its premise was wrong: Back sets nothing aside - a one-off is set aside when Something came up skips it - and `replan.e2e.ts` walks the shelf and Bring back; the long walk asserts that Away pauses the day |
