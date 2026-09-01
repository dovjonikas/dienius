# Open questions

> Things that need the owner's decision, parked here during work rather than guessed at.
> Each one has a recommendation. Nothing here is blocking - work continued around all of it.

## 1. Two justifications in `DECISIONS.md` rest on research that does not hold

From `docs/RESEARCH-ADHD.md` section 14. The features are fine; the stated reasoning is not.

- **The Zeigarnik effect** (unfinished tasks occupy your memory) fails meta-analysis - Ghibellini and
  Meier (2025) found essentially no recall advantage. The narrower claim that writing a plan reduces
  intrusion has one good study and no independent replication.
- **Decision fatigue** rests on ego depletion, which failed a 23-lab preregistered replication
  (Hagger et al. 2016, d approximately 0.04). The no-new-decisions rule is still right; the reason
  should move to maintenance burden, which the app-abandonment literature supports solidly.

**Recommendation:** rewrite those two justifications rather than the features. I did not touch
`DECISIONS.md` because it records decisions you made, and quietly rewriting your reasoning is not
mine to do. Say the word and it takes ten minutes.

## 2. Relatedness is the one motivator the app deliberately cannot serve

Self-determination theory is the best-evidenced account of what sustains motivation in ADHD
specifically (Morsink et al. 2022): autonomy, competence, relatedness. Dienius serves autonomy well
(it never decides for you) and competence honestly (the fraction, the capacity line). Relatedness it
cannot serve at all, because local-first with no accounts rules it out.

**Recommendation:** record it in `DECISIONS.md` as a known cost of the local-first choice rather than
leaving it unmentioned. Do not build a social layer - the body-doubling evidence is a null
group-level EEG result and an N of 12, nowhere near enough to justify accounts and a server.

## 3. The timeline grid is a reasoned design choice, not an evidence-backed one

No study compares proportional-height time blocks against durations written as text, in ADHD
populations or otherwise. The grid is consistent with Barkley's externalisation principle and with
general cognitive science on time and space, but the specific claim is unstudied.

Related and worth knowing: the closest real evidence (Hallez and Vallier 2025, n = 44, controlled)
found visible timers reduced anticipatory anxiety and inattentive behaviour, but **task accuracy did
not improve**. Making time visible plausibly changes how the day feels. There is no evidence it makes
anyone finish more.

**Recommendation:** keep the grid, and keep the claim honest in the docs. It is worth building for
how it makes the day feel. That is a good enough reason.

## 4. "Everything in front of my eyes" has a ceiling of about four things

Visual working memory holds roughly four integrated objects (Luck and Vogel 1997; Cowan 2001), and in
ADHD the visuospatial deficit is about twice the verbal one (Martinussen et al. 2005). A screen with
twelve equally loud elements is not showing twelve things - it is showing noise with four things in
it. Density itself is not the problem; ungrouped density is (Moacdieh and Sarter 2015).

**Recommendation:** as the day view grows - capacity line, grid, float tray, an if-then rule - the
answer is hierarchy and grouping, not more elements at equal weight. One element should obviously
dominate. If the grid ever competes with the task list for attention, the research says that costs
more than it gives.

## 5. An inference in the timeline grid worth confirming

`docs/TIMELINE.md` says the grid window runs from the first anchor minus an hour to the last anchor
plus an hour. It does not say what that padding is. The implementation treats it as air rather than
as a labelled free gap, on the reading that the spec's gap examples are all between anchors.

**Recommendation:** it looks right, but you would know in a second from using it. If that hour before
your first anchor should read as usable free time, it is a small change.

## 6. Placing a float sets it to the gap's own start, not somewhere within it

`docs/TIMELINE.md` section 5 says tapping a gap offers the floats that fit and one tap places one,
but does not say what time the placed float actually gets. I chose the gap's own start - it is the
plainest, most predictable answer, matches how a person reads a gap top to bottom, and needs no
second decision about where within the gap. The remainder of the gap, if any, stays free after it.

**Recommendation:** it reads naturally in the browser - Guitar tapped into "1h free, 13:00 to 14:00"
lands at 13:00 and leaves "40 min free, 13:20 to 14:00" behind it. If you would rather a placed float
land at the gap's end instead (so the free remainder sits first, closer to whatever's already
anchored before it), that is also a small, contained change - `handlePlace` in `TimelineGrid.tsx` is
the only place that decision lives.

## 7. The if-then time bands split the day at noon and 18:00 - not tied to your actual shifts

`docs/TIMELINE.md` section 6 asks for `when?: 'morning' | 'day' | 'evening' | 'any'` on a rule but
does not say where the boundaries fall. `timeBandFor` in `src/widgets/if-then/select.ts` reads
00:00-11:59 as morning, 12:00-17:59 as day, and 18:00-23:59 as evening - the same coarse,
fixed-window posture `capacity.ts` already takes for the waking window, not a personalized reading of
when your own shifts start or end. There is no separate "night" band, so the small hours after
midnight read as morning here.

**Recommendation:** it is a reasonable default and nothing about it is hard to change - only the two
numbers in `timeBandFor` would move. Worth confirming once you have actually written an evening or
morning rule and seen when it starts and stops showing up: if a "wind down" rule you meant for after
a night shift ends up reading as tomorrow's morning instead of tonight's evening, that is the
boundary to adjust.

## 8. Dragging a float while the grid is collapsed auto-expands it

`docs/TIMELINE.md` section 8's drag step asks what should happen when someone tries to drag with the
grid collapsed, without specifying an answer. I chose to expand the grid the instant the drag starts
(only when there is at least one anchor for it to expand into) rather than leave the drag picked up
with nowhere to go. This is functionally identical to the owner tapping "Show timeline" himself,
just triggered by the one gesture that actually needs it, and it respects the existing rule that the
toggle is one app-wide setting, not a per-day decision - it does not ask anything new, it just does
what the existing control would have done anyway.

**Recommendation:** it reads naturally in the browser - picking up a float while the grid is
collapsed opens it immediately with the gap right there to drop onto. If you would rather dragging
leave the grid alone and require an explicit tap first, `startDrag` in `DayView.tsx` is the only
place this decision lives - dropping the `actions.setTimelineExpanded(true)` call there is the whole
change. The long-press menu does not have this question at all: it lists a float's available gaps
straight from the day's tasks regardless of whether the grid is open, which is arguably the better
default for that path specifically.

## 9. Step 7's drag was not verified on real touch hardware

Every check in the step 7 report used synthetic `PointerEvent`s (including ones with
`pointerType: 'touch'`) dispatched through a desktop browser's automation, plus jsdom unit tests. That
exercises the exact code path a real touchscreen would trigger, but it is not the same as a real
finger's own gesture recognition - which is precisely the thing that broke the calendar's first drag
attempt in this repo, silently, until a review caught it. This drag reuses that same
`elementFromPoint` + `touch-action` approach on purpose, but reusing a pattern is not the same as
re-proving it works on hardware.

**Recommendation:** the standing real-device item already in `docs/BACKLOG.md`'s Tier 3 (verify the
calendar's stamp-drag on real iOS Safari and Android Chrome) should be widened to cover this step's
two drags and its long-press menu at the same time, on the same pass over the same hardware. Nothing
about this step should be trusted as touch-complete until that happens - it is not blocking, since the
long-press menu and every existing tap path work regardless of whether the drag itself turns out to
need a fix.

## 10. Theme discovery: one line on the first screen, not a moved gallery

The brief flagged that the eleven themes - the most immediately impressive thing in the app - sit
behind Settings, several taps from the app's default screen. I did not move the gallery, add a fifth
nav tab, or restructure Settings: `docs/BACKLOG.md`'s own year-strip entry already measured that a
fifth tab overflows the 375px nav row rather than wrapping, and moving the theme section around
inside Settings does not change how many taps away it is from Today, the tab the app actually opens
on. Instead the first-run teaching state carries one added line: "There are also eleven color themes
here, light and dark - see them under Settings." That puts the fact in front of a new person at the
exact moment they are deciding whether the app is worth spending time on, at the cost of one sentence
and nothing else - no tour, no coach mark, no second onboarding surface.

**Recommendation:** this is a minimal, reversible choice, not a structural one - if you want the
gallery reachable in fewer taps on every visit, not just the first, that is a bigger design decision
(a compact preview on Settings' own top, a swatch in the header) that I did not make on your behalf.

## 11. A starter tapped on the day view plans the date on screen, not always today

The day view's teaching state can show on any date, since `isFirstRun` is a property of the whole
install, not of one date - swiping forward while nothing has been planned yet still shows it.
`handleUseStarter` stamps the exact date `DayView` was given, not `todayKey()`, so tapping an offer
while three days out plans that day, not today.

**Recommendation:** this matches how the rest of the day view already treats its date prop -
quick-add, rollover, and every task action already act on whichever date is open, never assuming
"today." Always stamping today regardless of which date is on screen would surprise anyone who had
already navigated forward before tapping an offer, and a second control asking "which day" would be
exactly the kind of extra decision the brief asks not to introduce.

## 12. The update notice's exact wording and placement are my calls, not yours

`docs/DECISIONS.md`'s new "An installed copy tells you when it updates" section explains the
reasoning; this is just flagging the two most subjective pieces of it in case you want them
different. The copy is "An update is ready." with a single "Reload" button, in English (your brief's
"Atnaujinta" was given as an example of tone, not a request for Lithuanian - the app has no other
Lithuanian anywhere). Placement is a quiet fixed banner at the bottom of the screen, full-width on a
phone, a floating pill from tablet width up, with no backdrop.

**Recommendation:** both are small, contained changes if you want something else - the copy lives
entirely in `src/UpdateNotice.tsx`, the placement entirely in the `.update-notice` rules in
`src/styles.css`. I chose "ready" over "available" because it is more accurate: by the time anyone
sees this, the new worker has already activated and claimed control in the background, it is not
waiting on anything further to download. I chose a bottom banner over, say, a line in Settings
because Settings is not somewhere a person opens by default and an update they never see is exactly
the problem this feature exists to close - but a header pill next to the app name is not unreasonable
either.

## 13. With if-then entries that exist but none eligible today, the board still has no opener

Fixed as part of full-loop verification: `IfThenDayRule` rendered nothing whenever no rule was
eligible for the current day type and time band, and its own button was the only opener anywhere in
the app for the if-then board - so an install with zero entries could never write its first rule.
That specific case now shows a quiet "No if-then rules yet - add one" line instead, see
`src/widgets/if-then/DayRule.tsx`.

I deliberately left one related case alone: once real entries exist somewhere, but none of them is
eligible for today's day type and time band, the day view still shows nothing at all, exactly as it
did before this fix. On that day there is still no way to reach the board from the day view - only
from a day where something happens to be eligible.

**Recommendation:** this looks like the right call, not an oversight - the day view showing nothing
when there is genuinely nothing to say for today matches the same posture the capacity line and
timeline toggle already take, and reaching the board is never more than a day or two away in
practice for anyone with more than one rule scoped to different times. If it turns out to matter -
someone whose rules are all scoped to a day type they rarely use - the fix is the same shape as the
one just made: add a second quiet opener for "entries exist, nothing eligible today" the same way the
"nothing exists yet" one now works, rather than leaving Settings or Templates as the only route. I did
not make that call for you since it trades a small amount of added text on an ordinary day against
covering an edge case that may never come up.
