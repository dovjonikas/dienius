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
