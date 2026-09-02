# Open questions

> Things that need the owner's decision, parked here during work rather than guessed at.
> Each one has a recommendation. Nothing here is blocking - work continued around all of it.

The previous thirteen items in this file were answered by the owner on 2026-09-01. His answers are
recorded in `docs/DECISIONS.md`, not repeated here.

## 1. The wide layout's mini calendar cannot hit this app's own 44px touch target

`docs/LAYOUT-WIDE.md` section 5 gives the rail a fixed width - `minmax(200px, 240px)` - sized for "a
template chip plus a mini-calendar week row." A 7-column month grid inside a 240px-wide column comes
out to roughly 33x33px cells (measured live: 33px at 1280px, 1920px and every width in between, since
the rail's max-width caps it regardless of how much room the viewport has). Every other tappable
control added by this feature, and everything already in the app, holds the 44px minimum stated in
the brief - `.chip` (the template rail's own chips), the day-nav arrows, the Both/Calendar/Tasks
control, the timeline toggle. `MiniCalendar.tsx`'s cells are the one exception, and I built them that
way deliberately rather than silently shrinking the touch-target rule for one control: `styles.css`'s
`.mini-cell` rule says so directly, with a comment pointing back here.

I did not treat this as license to just widen the rail past what section 5 budgeted, because that
number was chosen alongside the day pane's and task pane's own minimums to fit inside the 1024px
breakpoint without crowding - widening the rail either pushes the breakpoint arithmetic that already
assumed 1024px as the line, or eats into the day/task panes' own minimums, and either is a real
trade-off I don't think is mine to make unilaterally.

**Recommendation:** I'd leave it as built. The mini calendar is a secondary, click-to-navigate
convenience next to the primary day and task panes, not the surface someone spends their day tapping
- it fires once per navigation, not per task - and on a tablet (the touch case this rule exists for)
a 33px target with a comfortable focus ring around it is workable even if it is not the house
standard. If it turns out to matter in practice, the two honest fixes are (a) raise the rail's own
`minmax` past 240px - my rough math says you'd need roughly 320px of column width for cells to clear
44px, which measurably narrows whichever pane the extra width comes from - or (b) drop MiniCalendar's
grid density on the rail specifically (fewer visible weeks, or a list instead of a grid) rather than
shrinking the cells further. Both are visible, scoped changes to `MiniCalendar.tsx` and
`.mini-calendar-grid`/`.mini-cell` in `styles.css` alone.

## 2. A task's title, used as the "where does this fit" control, is a 29px target rather than 44px

`.task-title-select` in `styles.css` - the title of an unplaced float, which doubles as the control
that selects it for the gap offers (see `TaskRow.tsx`) - deliberately escapes this app's usual
`button { min-height: 44px }` floor, the second control to do so after the mini calendar above.

Holding 44px there made a float's card sixteen pixels taller than an anchor's, because this button is
the tallest thing in the title row. A task list whose rows change height depending on whether the task
happens to have a time is a list that is harder to scan, and scanning is the only job that list has -
measured live during the one-screen rebuild: 66px for a float against 50px for an anchor, in the same
column, one under the other. The padding still gives the control a hit area around 29px tall running
the full width of the title, and a negative margin keeps that area out of layout so the card stays the
height of its content.

**Recommendation:** I'd leave it as built. A target that is 29px tall and 200px wide is a very
different thing from a 29px square - the dimension a thumb actually misses on is the one this keeps
generous - and the same task's actions menu sits on the same card at the full 44px and reaches the same
placement, so nothing here is the only way to do anything. If it turns out to matter on real hardware,
the honest fix is to give the label row a fixed content height and let the button's hit area extend
past it with padding plus a negative margin on both axes rather than one - the same technique, applied
vertically as well - and then check that the selected state's own outline does not visibly overlap the
meta line under it, which is the reason it was not done that way first.

Item 3 (the anchor drag-to-tray gesture unreachable by a real pointer, `pointer-events: none`
inheritance in `TimelineGrid.tsx`) is fixed as of branch `fix/anchor-drag-pointer-events` - see
`.superpowers/sdd/2026-08-31-dienius-mvp/fix-anchor-drag-pointer-events-report.md` for the
reproduction, root cause and fix. No longer open; removed from this list rather than left here
answered, matching how the previous thirteen items were handled above.

## 3. The README has no screenshots, because the ones it had were of a different app

The gallery pointed at six images taken before the interface rebuild: eleven themes, the Sketchbook
preset, the old stacked day layout, the old settings screen. Every one of them now shows something that
does not exist. Leaving them would have been worse than removing them - a portfolio page whose pictures
disagree with the link above them is a page that raises a question rather than answering one - so they
are gone, and the README says plainly that they are being re-taken.

**Recommendation:** you take them, and it takes five minutes. Six shots at 1920x1080 cover it: Today in
Dark with a real day part-finished, the same day in Light, the Focus screen, Settings scrolled to
Appearance, the phone at 390 wide, and an evening with everything cleared. Put them in
`docs/screenshots/` and restore the `<details>` gallery block that used to sit under the badges - the
markup is in the git history at the commit before v1.0. The reason this is yours rather than mine is
that a screenshot of your own real day is worth more on a portfolio page than a screenshot of a fixture
I seeded, and only one of us has the former.

## 4. Real touch hardware, still not tested

Standing item, unchanged and now larger: the block drag, the resize strip along a block's bottom edge,
the long-press actions menu, the calendar's paint-across-dates gesture, and the floating widget's
corner button have all been built and verified with synthesised pointer events in a desktop browser.
None of them has been touched by an actual finger.

Everything in that list is designed for touch - `touch-action: none` is scoped to the exact elements
that start a gesture and nowhere else, every target that can hold 44px does, and the two that cannot are
items 1 and 2 above - but design is not evidence. One morning of using this on the phone it was written
for will find more than another week of building will.
