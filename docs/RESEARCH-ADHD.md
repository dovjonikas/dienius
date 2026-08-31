# Dienius - what the research actually says

> Written 2026-09-01. The question behind this document: what actually makes a person with an
> ADHD-shaped brain start and finish planned tasks, and what only looks like it helps?
>
> Every finding ends with a line on what it means for this app. A research document that does not
> change the product is a waste of a night. Section 12 lists what we should NOT build, and it is
> the most useful part.
>
> Where a claim is popular but unsupported, it says so. Where a famous finding failed replication,
> it says so. Several widely repeated statistics turned out to have no traceable source at all;
> those are named in section 13 so nobody re-adds them later.

## How to read the evidence labels

- **Strong** - meta-analysis or repeatedly replicated experimental work.
- **Moderate** - a small number of controlled studies, or a large study not yet replicated.
- **Weak** - single small study, uncontrolled, or preliminary.
- **Inference** - the mechanism is evidenced but the specific application is not tested.
- **Folk** - clinical or coaching vocabulary with no research behind the specific claim. Not
  worthless, but not evidence.

---

## 1. Implementation intentions - the strongest thing in this document

**Strong (general population).** Gollwitzer and Sheeran (2006), meta-analysis of 94 independent
tests, N over 8,000: forming an if-then plan produces **d = 0.65** on goal attainment over holding
a goal intention alone. Sheeran, Listrom and Gollwitzer (2025) extended this to 642 tests with
effects between d = 0.27 and d = 0.66. That newer meta-analysis found three moderators that matter
for design: effects are larger when the plan has a **true contingent if-then format** rather than a
restated goal, when the person is genuinely motivated toward the underlying goal, and when the plan
has been **rehearsed at least once**.

**Moderate (ADHD children).** Gawrilow and Gollwitzer (2008): children with ADHD given an if-then
plan for a Go/No-Go suppression goal improved response inhibition **to the level of non-ADHD
controls**. Not improved - closed the gap. A second study found if-then plans plus stimulant
medication outperformed either alone. Breitwieser et al. (2025/2026), meta-analysis of 42 studies
in children, N = 12,957: overall Hedges' g = 0.31, with **larger effects in the ADHD subgroup**.
Subgroup findings in meta-analyses are routinely overstated, so treat that last point carefully.

**Not established (ADHD adults).** There is no experimental implementation-intention study on adults
with diagnosed ADHD. The closest is Ramsay (2016), a clinical case-study paper with no effect sizes.

**Strong (adjacent clinical populations).** This is the bridge worth knowing about. Brandstätter,
Lengfelder and Gollwitzer (2001) tested if-then plans in opiate addicts in withdrawal and in
schizophrenic patients - populations with severely compromised executive control - and found effects
**equal to or larger than** in healthy samples, even under high cognitive load. Toli, Webb and Hardy
(2016), meta-analysis of 28 studies across clinical populations: **d+ = 0.99**, larger than the
general-population figure. The pattern across all of it is that implementation intentions help most
where self-regulation capacity is lowest.

**Contested: how specific the trigger must be.** The dominant theory says a concrete situational cue
fires more reliably than a vague one, and the mechanism supports it - Achtziger, Bayer and Gollwitzer
(2012) found cues named in a plan attract more attention, even in an unattended channel, and are
recalled better both 15 minutes and 2 days later. But the one direct head-to-head test (N = 133,
volitional help sheet paradigm, 2018) found **a single generic situation was as effective as choosing
among ten specific ones**. Both beat no plan. So: the contingent if-then structure is robustly
better than a restated goal; how granular the "if" needs to be is not settled.

**What this means for Dienius.** The if-then feature is the best-evidenced thing in the app and
deserves more weight than it currently has, not less. Three concrete consequences: (1) the format
must stay genuinely contingent - "IF this specific thing happens, THEN this one action" - because
that structure is where the effect lives, and a rule that degrades into a note loses it. (2) The
rehearsal moderator is a direct argument for surfacing a rule on the day view rather than filing it
in a tab, since a rule seen daily is a rule rehearsed. (3) Do not build a specificity validator or
nag the user to make triggers more concrete; the evidence for that does not exist, and it would add
a decision per rule for no proven gain.

---

## 2. Barkley's point of performance

Barkley's term, defined as the critical place and time where a behaviour must happen. The claim: for
someone whose executive function is impaired, information cannot live in a plan reviewed elsewhere.
It has to be externalised - made physical - and present **at the moment and place the behaviour
occurs**.

**Evidence status: clinically well-established, directly inferred rather than directly tested.**
Point of performance has not been isolated as an intervention and tested in a controlled ADHD trial.
It is Barkley's extrapolation from his executive-function model, which itself rests on decades of
neuropsychological work. What *is* independently tested is the adjacent literature on point-of-choice
prompts and just-in-time cues in behaviour change: a systematic review of periodic prompts and
reminders (19 studies, roughly 15,655 participants) found mostly positive effects, and further
systematic reviews on cue reminders and point-of-choice prompts agree. None of those were done in
ADHD populations.

This connects to the prospective-memory finding in section 7, which is the closest thing to direct
support: in ADHD, **externally cued remembering holds up far better than remembering on your own at
a given time**.

**What this means for Dienius.** This is the strongest argument in the whole app for moving the
if-then rules out of their own tab and onto the day view. A board someone has to remember to open is
a plan stored elsewhere, and the trigger fires precisely when they are not in a state to go looking.
It also argues for the capacity line and the timeline sitting on the screen the person actually opens,
which is already where they are. State it honestly in `DECISIONS.md` as well-reasoned theory with
strong adjacent support, not as a proven intervention.

---

## 3. Time blindness - and the direction question, answered

The overnight brief asked directly: do people with ADHD underestimate durations, overestimate them,
or estimate with more variance?

**The answer is variance.** Marx, Cortese, Koelch and Hacker (2021), meta-analysis in JAACAP across
four paradigms - time discrimination (25 studies, 1,633 participants, medium effect), time
reproduction (26 studies, 2,364 participants, medium effect), time estimation (8 studies, 1,024
participants, small to medium), time production (7 studies, 380 participants, small) - concluded
that people with ADHD "are more variable in their time estimates of several seconds irrespective of
the paradigm examined." Not systematically short, not systematically long. **Noisier.**

Individual studies do report directional effects at particular interval lengths, and they disagree
with each other, which is itself evidence for the variance reading rather than a directional one.

**Adult-specific evidence is thin.** Mette (2023) systematic review found only 9 studies meeting
criteria out of 535 screened, with effect sizes ranging from d = 0.14 to d = 1.5. The claim that
adults with ADHD have measurably impaired time perception has some support from a very small and
heterogeneous literature, and leans substantially on child data plus Barkley's framework.

**What this means for Dienius.** This changes what the capacity line should say, and it is good news
for the design we already shipped. Because the error is variance rather than bias, there is no
correction factor to apply - the app should not quietly pad estimates by 20 percent or warn that the
user is "probably underestimating," because on average they are not. What it should do is exactly
what it does: state the arithmetic from the numbers given, keep the word "about", and make unsized
things visible as unsized rather than guessing. The design implication of noisy estimates is to
favour **reconciliation after the fact over precision before**: a person's own template durations,
corrected over weeks of real use, will beat any estimate they type in on a given morning. That is an
argument for keeping durations on templates, which is already how it works.

---

## 4. Task initiation, and what "activation energy" really is

**Strong.** Willcutt et al. (2005), meta-analysis of 83 studies, ADHD N = 3,734: medium effect sizes
(d = 0.46 to 0.69) across executive-function measures, strongest on response inhibition, vigilance,
working memory and planning. Note that executive-function deficits explain a meaningful but partial
share of ADHD, are not present in every case, and are not unique to ADHD.

**Moderate to strong (mechanism).** Volkow et al. (2010/2011), PET imaging, 45 ADHD adults vs 41
controls: lower self-reported motivation, correlating with dopamine D2/D3 receptor availability in
the ADHD group only. Single prominent study, not independently replicated at scale. Sonuga-Barke's
dual-pathway model (2003, revised 2010) frames ADHD as arising through two dissociable routes -
executive dysfunction and delay aversion - which is why some initiation failures look cognitive and
others look motivational.

**Folk.** "Activation energy" is a chemistry metaphor with no academic ADHD literature behind the
specific framing. "Wall of Awful" is Brendan Mahan's coaching metaphor, likewise with no research
base. Both are useful for talking to people. Neither is a mechanism. The research-backed alternative
for the same phenomenon is **Action Identification Theory** (Vallacher and Wegner, 1987): construing
an action at a low, concrete, mechanical level is easier to initiate than construing it at a high,
abstract level. "Open the laptop" versus "write the report" is a real, evidenced distinction.

**Solid, and a genuine warning.** Kruger and Evans (2004), the segmentation effect: the sum of time
estimates for decomposed subtasks is reliably **larger** than the single estimate for the whole task.
Breaking a task down inflates its perceived size, and the decomposition itself costs effort. Locke
and Latham's goal-setting literature contains the matching caveat: on complex or unfamiliar tasks, a
specific outcome goal can **impair** performance relative to "do your best," because specificity
narrows attention away from strategy formation.

**Good (ADHD-specific).** Goal Management Training - In de Braek et al. (2012), *Journal of Attention
Disorders*, controlled intervention in ADHD adults teaching decomposition into subgoals plus periodic
"stop and check" - outperformed a psychoeducation control. This is the strongest ADHD-specific
controlled evidence for structured subgoal work.

**Weak.** The "five-minute rule" as a named technique traces to a single N = 10 unpublished student
poster. Its real evidence base is behavioural activation for depression (Jacobson, Martell and Addis,
2001), which is well-supported for depression and applied to ADHD by mechanism rather than by trial.

**What this means for Dienius.** Do not build a task-breakdown feature that pushes the user to
decompose. The segmentation effect means decomposition makes a task look bigger, and the app's whole
premise is reducing what stands between a person and starting. If subtask support is ever added, it
belongs on the template - decided once, in a calm moment - not offered as a prompt on a task the
person is avoiding right now. Also: prefer concrete, low-level task titles in placeholder text and
examples, since Action Identification Theory says that is what lowers the initiation cost, and it
costs nothing to do.

---

## 5. Body doubling

**Weak, and improving.** Until roughly 2024 there was no research at all. Since then: an EEG study
in the ACM ASSETS proceedings found **no statistically significant group-level effect**, with some
individual-level trends and no harm; a virtual-reality study with N = 12 found faster completion and
higher perceived attention with a body double; a 193-respondent qualitative survey found people
independently reinvent the practice to initiate and sustain tasks; a CSCW 2026 qualitative study of
22 ADHD adults describes task management as relationally co-constructed.

So: a widely reported practice that people arrive at on their own, with a handful of small,
preliminary, mostly null studies behind it.

**What this means for Dienius.** Nothing, for now. This is a local-first app with no accounts and no
social layer, and adding one on the strength of a null EEG result and an N = 12 VR study would be
building a whole architecture for an unproven mechanism. Record it as watched, not planned.

---

## 6. The Zeigarnik effect - mostly does not hold

**The famous claim fails.** Ghibellini and Meier (2025), meta-analysis in *Humanities and Social
Sciences Communications*: pooling modern studies, the ratio of interrupted-to-completed task recall
is **approximately 0.99**. There is essentially no memory advantage for unfinished tasks once
Zeigarnik's own 1927 data is excluded. Van Bergen (1968) and many later attempts had already failed
to reproduce it.

**A related effect does hold.** The Ovsiankina effect - the behavioural pull to resume an interrupted
task - replicates consistently.

**The "write it down and the loop closes" claim: one good study, no independent replication.**
Masicampo and Baumeister (2011), *Journal of Personality and Social Psychology*: unfinished goals
produced intrusive thoughts and impaired performance on unrelated tasks, and **writing a specific
plan eliminated those effects even though the goal remained unfinished**. Well-powered multi-study
design, cited 130+ times. But no independent direct replication could be found, and it comes from a
lab associated with other findings that later failed to replicate. Treat it as plausible and
evidenced once, not as settled.

**What this means for Dienius.** The app's justification for capture cannot be "unfinished tasks
occupy your memory," because that specific claim does not survive. What it can honestly rest on is
narrower: writing a plan plausibly reduces intrusion (one good study), and the pull to resume an
interrupted thing is real. Practically this changes little - quick capture stays - but it should
change the language in `DECISIONS.md` if the Zeigarnik effect is ever cited there as a justification.
It is not a good citation.

---

## 7. Visual salience, working memory, and the limits of "everything in front of my eyes"

This section matters most, because it both supports and bounds the owner's stated requirement.

**Strong, and the single most relevant finding in this document.** Martinussen, Hayden, Hogg-Johnson
and Tannock (2005), meta-analysis of 26 studies: in ADHD, **the visuospatial working memory deficit
is roughly twice the size of the verbal one** - spatial storage d = 0.85, spatial central executive
d = 1.06, against verbal 0.47 and 0.43. The deficit is largest in exactly the channel a visual
interface substitutes for.

**Strong.** Luck and Vogel (1997), *Nature*: visual working memory holds about **four integrated
objects**, regardless of how many features each has. Cowan (2001, 2010) puts the general focus-of-
attention capacity at three to four chunks once rehearsal strategies are stripped out. Miller's
famous 7±2 is from verbal digit-span work and is badly over-cited in design; it is not the visual
number. Even the figure of four is contested as a universal constant (Adam et al., 2024).

**Moderate, and the best direct support for external cues.** Altgassen, Kretschmer and Kliegel (2014):
adults with ADHD showed large impairment in **time-based** prospective memory - remembering to do
something at a future time with no external cue - while **event-based** prospective memory, triggered
by something in the environment, was comparatively preserved. The deficit is specifically in
unprompted recall. A cue narrows the gap.

**Important correction.** The popular "ADHD object permanence" framing is a misuse of a developmental
term. There is no research establishing ADHD as an object-permanence disorder. The real phenomenon
underneath it - uncued items and intentions failing to be retrieved - is well supported. Use the
mechanism, not the label.

**Where "more on screen" stops helping.** Sweller's cognitive load theory and Mayer's multimedia
work establish that redundant or spatially separated information imposes **extraneous load** that
competes for the same limited budget as the task itself. Moacdieh and Sarter (2015), controlled
experiment: high data density and poor organisation each independently raise response time and error
rate, and **poor organisation makes density worse**. The corollary is the useful one - a
well-organised dense display outperforms a poorly organised sparse one. Density is not the enemy;
ungrouped density is. And change-blindness research (Simons and Chabris, 1999) shows that visibility
alone does not guarantee something is registered.

**Applied UX, not peer reviewed.** Nielsen Norman Group eye-tracking: content above the fold gets
roughly 57 percent of viewing time, the next screenful about 17 percent. Real data on attention
allocation, though it does not directly measure forgetting. Whether the fold still matters is
actively contested. Progressive disclosure is near-universally endorsed by designers and has thinner
evidence than its popularity suggests.

**No direct evidence for the proportional-height grid.** No study tests spatially scaled time blocks
against durations written as text, in ADHD populations or otherwise. The design is consistent with
Barkley's externalisation principle and with general cognitive science on shared magnitude
representations of time and space, but the specific claim that a proportional grid beats a labelled
list is **unstudied**. Say that plainly rather than implying it is proven.

**What this means for Dienius.** The owner's instinct is well founded, with a precise limit.
Supported: put what matters on screen rather than behind a tab, because uncued recall is the specific
thing that fails. Bounded: only about four things can be actively held at once, so a screen showing
twelve equally loud items is not showing twelve things - it is showing noise with four things in it.
The design consequence is **hierarchy, not addition**. The day view should have a small number of
clearly grouped zones with one obviously dominant element, rather than everything at the same visual
weight. The timeline grid we just built earns its place on this argument, but only while it stays
grouped and quiet; if it ever competes with the task list for attention, the research says that costs
more than it gives. And the grid should be described honestly in the docs as a reasoned design
choice, not an evidence-backed one.

---

## 8. Streaks and gamification - the refusal was right, for better reasons than we had

The app refused streaks from the start on instinct. The evidence supports the refusal, though not
always through the arguments usually given.

**Strong, and the core of the case.** Deci, Koestner and Ryan (1999), meta-analysis of 128 controlled
experiments: tangible, expected, completion-contingent rewards **reliably undermine intrinsic
motivation**. Unexpected rewards and informational praise do not. This is one of the better
established findings in motivation psychology. Its application to streak and badge mechanics is an
extrapolation, but a well-grounded one, and it is the theoretical basis the direct HCI work invokes.

**Moderate, and directly on point.** Diefenbach and Müssig (2019), *International Journal of
Human-Computer Studies*, field study of the gamified task manager Habitica: identified concrete
counterproductive effects, including a reward system that in some cases incentivised gaming the
system rather than doing the work, with counterproductive effects correlating with perceived
inappropriateness of the rewards. Modest sample, but it is the closest thing to direct evidence about
gamification backfiring in a productivity app.

**Strong, and the cleanest argument against streaks specifically.** Lally et al. (2010), the
habit-formation study: **missing a single opportunity did not measurably disrupt habit formation**.
The behaviour recovers. A streak counter that resets to zero therefore encodes a rule the underlying
psychology does not support - it manufactures a catastrophe out of something the data says is not
one. That gap between perceived and actual harm is the real design argument, and it is better than
the usual one.

**Effects fade.** Multiple meta-analyses find gamification produces a small short-term boost to
intrinsic-motivation perceptions with minimal effect on actual performance, and that interventions
past roughly one semester show negligible to negative effects. A 2022 longitudinal study titled for
the finding - gamification suffers from the novelty effect but benefits from familiarisation -
separates the two. Novelty habituation is basic dopamine physiology, not a design failure to be
engineered around.

**Related mechanism.** Kivetz, Urminsky and Zheng (2006), goal-gradient work with 948 loyalty-program
members: people accelerate toward a reward and **disengage immediately after reaching it**. Relevant
to any milestone design.

**The case for streaks is weaker than it looks.** It rests almost entirely on Duolingo's own
published product analytics. Those numbers are real and traceable, but they are first-party,
correlational, and drawn from a self-selected population - people who hold streaks were already more
engaged.

**Ethical line.** Variable and unpredictable reward is the mechanism behind compulsive engagement in
gambling and infinite-scroll feeds (Schultz's reward-prediction-error work; a 2023 review in
*Addictive Behaviors*). Deploying it deliberately in a tool for a population with baseline reward-
processing differences is the wrong side of a line. Separately, Mathur et al.'s dark-patterns work
and the FTC's 2022 report both classify **fabricated urgency and scarcity** as deceptive design.

**What this means for Dienius.** Keep the refusal, and write the Lally finding into `DECISIONS.md` -
"a missed day does not actually damage a habit, so a mechanic that punishes one is encoding a
falsehood" is a much stronger sentence than "streaks feel bad." It also settles the question for the
year strip: gaps must keep reading as neutral, which an independent check already confirmed they do.
And it rules out, permanently, any future feature built on unpredictable reward or manufactured
deadlines.

---

## 9. Choice load and decision fatigue - be careful here

**The popular version does not hold.** Decision fatigue rests on ego depletion, and ego depletion
largely failed to replicate: Hagger et al. (2016), 23 laboratories, preregistered replication,
N = 2,141, found an effect of **d ≈ 0.04**, indistinguishable from zero. Any design argument that
leans on "each decision drains a finite resource" is leaning on contested ground.

Choice overload as a separate phenomenon has a mixed literature with real moderators, and no study
was found applying it to task lists specifically.

**What this means for Dienius.** The product's rule that no change may add a decision per day is
still right, but the honest justification is different from the popular one. It is not that decisions
deplete a battery. It is narrower and better evidenced: every extra step is another place to abandon
the flow, the app-abandonment literature identifies **maintenance burden** as a leading cause of
people quitting tools, and a planner whose upkeep requires the executive function it exists to
support is self-defeating. Keep the rule, fix the reasoning where it appears in the docs.

---

## 10. Novelty, interest and urgency

**Folk, and worth naming clearly.** Dodson's "interest-based nervous system" and its four factors -
interest, challenge, novelty, urgency - is a clinician's descriptive framework from practice, not a
tested model. There is no validated scale, no experimental manipulation isolating the four factors,
no peer-reviewed paper testing it. It is influential and probably useful shorthand. It is not
science, and should never be cited as though it were.

**Strong, and the real grounding underneath it.** Delay discounting: Marx et al. (2021),
meta-analysis of 37 group comparisons, roughly 3,763 participants, effect sizes around d = 0.4 to
0.5 - people with ADHD reliably choose smaller-sooner over larger-later rewards. This is the most
replicated finding in the area.

**Peer-reviewed formal model.** Temporal Motivation Theory applied to ADHD (2023, *Australian
Psychologist*): motivation = (expectancy × value) / (1 + impulsiveness × delay). This is the closest
thing to a real explanation for why "important" fails to move behaviour while "urgent" succeeds -
importance is value, which is discounted steeply as delay grows, and ADHD inflates the denominator.
It is a theory paper applying an established model, not a head-to-head experiment on task framing;
no such experiment was found.

**Sustainable alternative, ADHD-specific.** Morsink et al. (2022), *Journal of Attention Disorders*:
children and adolescents with ADHD spontaneously cite autonomy, competence and relatedness - the
three self-determination-theory needs - as what motivates them. This is the best-evidenced pointer
toward what actually sustains engagement, as opposed to what spikes it.

**What this means for Dienius.** Two things. First, the app should get out of the business of trying
to make tasks feel urgent - manufactured urgency is both unevidenced for ADHD specifically and, when
presented as real, a documented deceptive pattern. Second, self-determination theory points at design
the app is already close to: **autonomy** (the person chooses, the app never auto-schedules),
**competence** (visible real progress, which the fraction and the capacity line provide honestly).
Relatedness is the one it does not serve at all, and that is a deliberate consequence of being
local-first with no accounts. That is a fair trade, but it should be recorded as a known cost rather
than an oversight.

---

## 11. Why planner apps get abandoned

**Strong.** A 2024 scoping review in JMIR mHealth, 18 studies, 525,824 participants: a median of
**70 percent of users discontinue within 100 days**, with the sharpest drop immediately after
acquisition. Six recurring causes: technical problems, privacy concerns, confusing interfaces (the
most consistently cited), personalisation gaps, **the time cost of upkeep and burdensome data entry**,
and changing needs.

**Moderate, adjacent.** Attig and Franke (2020), building on Clawson et al.'s analysis of abandoned
trackers, name "tracking taking too much mental effort" and "high maintenance frequency" among the
reasons people quit self-tracking tools. Wearables rather than planners, so this generalises by
analogy.

**No ADHD-specific study of planner abandonment exists.** The argument that generic tools fail
because they demand the exact executive functions ADHD impairs is sound extrapolation from clinical
research, not a study of app usage.

**On competitors, briefly.** Sunsama's daily planning ritual is a guided five-step flow taking five
to fifteen minutes each morning; a therapist review and an independent reviewer both flag that it
assumes consistent executive function and can itself become another thing to fail at. Routinery
removes the "what next" decision during a routine by auto-advancing timed steps, and an ADHD coaching
company's critique of it is precise and worth keeping: it solves transitions but **cannot help with
initiation**, because it only runs once you press start, and initiation is the more common barrier.
Amazing Marvin's configurability produces genuinely split reactions - real value for people who know
what system they want, real burden for people who do not. Tiimo's marketing claim that visual timers
reduce procrastination by 35 percent has no traceable source, but the underlying mechanism does have
real support: Hallez and Vallier (2025), controlled study, n = 44, found visible timers significantly
reduced anticipatory anxiety (p = .008) and inattentive behaviours (p = .002), with a stronger effect
in children at higher ADHD risk - though task **accuracy did not improve**. The timer helped how the
child felt and behaved, not how well they performed.

**What this means for Dienius.** The single biggest retention risk is upkeep, and the app's existing
answer - templates decided once, no grooming, no daily ritual - is the right one and should be
defended against every future feature. Sunsama's morning ritual is exactly what not to add. The
Hallez and Vallier finding is worth internalising honestly: making time visible plausibly reduces
anxiety and improves how the day feels, and there is no evidence it makes anyone finish more. That
is still worth building. It is just not the claim to make.

---

## 12. What we should NOT build

Each of these looks helpful and is not supported.

**Streaks, in any form.** Including soft ones, "best week" markers, or anything that makes a gap look
like damage. Lally et al. show a missed day does not harm habit formation, so any mechanic that
punishes one is encoding something false.

**Any variable or unpredictable reward.** Surprise points, random encouragement, mystery unlocks.
The mechanism is the one behind gambling and infinite scroll, and this is a population with baseline
reward-processing differences. This is an ethical line, not a preference.

**Manufactured urgency.** Fake deadlines, countdowns on things that have no real deadline, "act now"
framing. Unevidenced for ADHD specifically, and classified as a deceptive dark pattern by both the
research literature and the FTC when presented as real.

**Auto-scheduling.** Already refused, and the refusal holds. Beyond the existing reasoning, it works
against the autonomy need that self-determination theory identifies as one of the few sustainable
motivators here.

**A prompt to break tasks down.** The segmentation effect means decomposition makes a task look
bigger, and Locke and Latham show specificity hurts on complex or unfamiliar work. If subtasks ever
arrive, they belong on templates - decided in a calm moment - not offered to someone staring at a
task they are avoiding.

**A morning planning ritual.** Sunsama's central mechanic. Reviewers of that product, including a
therapist writing about ADHD specifically, flag that it assumes stable executive function and becomes
another thing to fail at. Directly contradicts the no-new-decisions rule.

**Nagging toward more specific if-then triggers.** The one head-to-head test found a generic
situation was as good as a specific one. Adding a validator would add friction for an unproven gain.

**A correction factor on duration estimates.** The error is variance, not bias, so there is no
direction to correct toward. Padding estimates would make the arithmetic dishonest.

**Any measurement of if-then rules.** No counter, no "did this fire", no done flag. Already decided,
and the motivation literature supports it: turning a pre-made decision into a tracked task converts
it into one more thing to fail at.

**A social or body-doubling layer.** The evidence is a null group-level EEG result and an N = 12 VR
study. Not enough to justify accounts, a server, and a privacy surface in a local-first app.

**Notifications as a primary mechanism.** Notification fatigue is well documented at the product
level, and the app has no server. If reminders are ever added they should be quiet and in-app, at
the point of performance, which is where section 2 says the value actually is.

---

## 13. Statistics that circulate and are not real

Named so nobody re-adds them.

- **"Users with a 7-day streak are 2.4x more likely to return"** - genuine and traceable to Duolingo's
  own blog, but first-party and correlational. Not evidence that streaks cause retention.
- **"Gamification boosts engagement by 60%"** - no traceable source. Appears only on marketing
  content sites.
- **"A 2020 CHI study found streak anxiety was the top reason users abandoned habit apps" and
  "streak users are 63% more likely to quit after missing a day"** - could not be located by title,
  author or DOI. Appears only in SEO content.
- **"Visual timers reduce procrastination by 35%"** - Tiimo marketing. No study linked, none found.
- **"Students using visual timers completed tasks 40% faster (2018)"** - no citation trail anywhere.
- **"92% of people who use 5-minute micro-commitments complete the full task (University of
  Chicago)"** and **"MIT Sloan found 35% more likely to achieve larger goals"** - untraceable.
- **"68% of users abandon tasks due to decision fatigue"** - untraceable, and resting on a construct
  that failed replication anyway.
- **ADHD gamification figures - "48% higher retention", "60% boost in compliance", "47% improvement
  in focus duration"** - attributed to vaguely named studies, none verifiable.

---

## 14. What contradicts a decision already recorded

Surfaced, not reversed. These are the owner's calls.

1. **The Zeigarnik effect should not be used as justification anywhere.** If `DECISIONS.md` or any
   copy rests capture on "unfinished tasks occupy your mind," that specific claim fails
   meta-analysis. The narrower claim - writing a plan reduces intrusion - has one good study and no
   independent replication. The feature is fine; the reasoning needs replacing.

2. **The no-new-decisions rule has the wrong stated reason.** It is currently defensible on decision
   fatigue, which rests on ego depletion, which failed a 23-lab replication. The rule is right; the
   justification should move to maintenance burden and the abandonment literature, which is solid.

3. **The proportional-height timeline is not evidence-backed.** It is a reasoned design choice
   consistent with Barkley's principle and general cognitive science, and no study supports the
   specific claim that it beats durations written as text. Anywhere the docs imply otherwise should
   be softened.

4. **"Everything in front of my eyes" has a hard ceiling of about four active items.** Not a
   contradiction of a recorded decision, but a constraint on where the day view is heading. The
   answer is hierarchy and grouping, not more elements at equal weight.

5. **Relatedness is unserved.** Self-determination theory identifies autonomy, competence and
   relatedness as what sustains motivation in ADHD, and the local-first no-accounts decision rules
   the third one out entirely. That is a legitimate trade and probably the right one, but it should
   be recorded in `DECISIONS.md` as a known cost rather than left unmentioned.

---

## 15. What was looked for and not found

- **No experimental implementation-intention study in adults with ADHD.** Everything for adults is
  extrapolated from children and from adjacent clinical populations.
- **No controlled test of "if-then plan alone" against "if-then plan plus a reminder at the trigger
  moment."** The core design question for surfacing rules on the day view is untested.
- **No study comparing spatial or analogue duration display against numeric duration labels**, in
  ADHD populations or otherwise.
- **No study of proportional-height time grids** as an intervention.
- **No ADHD-specific study of planner-app abandonment.**
- **No study directly measuring on-screen information density against stress in ADHD populations.**
  The clutter literature and the ADHD sensory literature exist separately and have not been bridged.
- **No decay curve for an unreinforced implementation intention.** Nobody knows how long a rule keeps
  firing without rehearsal.
- **No dedicated meta-analysis of prospective memory in ADHD.** Individual studies only.
- **No direct test of the "what-the-hell effect" in streak-based apps.** The mechanism is
  well-established in dieting and addiction research and applied here by analogy.

---

## Sources

Achtziger, Bayer and Gollwitzer (2012), *Motivation and Emotion*. Adam et al. (2024), *Journal of
Cognition*. Altgassen, Kretschmer and Kliegel (2014), *Journal of Attention Disorders*. Attig and
Franke (2020), *Computers in Human Behavior*. Barkley (1997), *Psychological Bulletin* 121(1) and
*Journal of Developmental and Behavioral Pediatrics* 18. Barkley, Murphy and Bush (2001),
*Neuropsychology*. Brandstätter, Lengfelder and Gollwitzer (2001), *Journal of Personality and Social
Psychology* 81. Breitwieser et al. (2025/2026), *British Journal of Psychology*. Cowan (2001),
*Behavioral and Brain Sciences* 24; (2010), *Current Directions in Psychological Science*. Deci,
Koestner and Ryan (1999), *Psychological Bulletin* 125(6). Diefenbach and Müssig (2019),
*International Journal of Human-Computer Studies* 127. Gawrilow and Gollwitzer (2008), *Cognitive
Therapy and Research* 32. Gawrilow, Gollwitzer and Oettingen (2011), *Cognition and Emotion*.
Ghibellini and Meier (2025), *Humanities and Social Sciences Communications*. Gollwitzer (1999),
*American Psychologist* 54. Gollwitzer and Sheeran (2006), *Advances in Experimental Social
Psychology* 38. Hagger et al. (2016), *Perspectives on Psychological Science*. Hallez and Vallier
(2025), *European Journal of Investigation in Health, Psychology and Education* 15(12). In de Braek,
Dijkstra, Ponds and Jolles (2012), *Journal of Attention Disorders*. Jacobson, Martell and Addis
(2001), *Clinical Psychology: Science and Practice*. Kivetz, Urminsky and Zheng (2006), *Journal of
Marketing Research* 43(1). Kruger and Evans (2004), *Memory and Cognition*. Lally et al. (2010),
*European Journal of Social Psychology*. Locke and Latham (2002), *American Psychologist*. Luck and
Vogel (1997), *Nature* 390. Martinussen, Hayden, Hogg-Johnson and Tannock (2005), *JAACAP*. Marx,
Cortese, Koelch and Hacker (2021), *JAACAP*. Marx, Hacker, Yu, Cortese and Sonuga-Barke (2021),
*Journal of Attention Disorders*. Masicampo and Baumeister (2011), *Journal of Personality and Social
Psychology* 101(4). Mette (2023), *International Journal of Environmental Research and Public Health*
20(4). Miller (1956), *Psychological Review* 63. Moacdieh and Sarter (2015), *IEEE Transactions on
Human-Machine Systems*. Morsink, Van der Oord, Antrop, Danckaerts and Scheres (2022), *Journal of
Attention Disorders*. Pirolli, Mohan et al. (2017), *Journal of Medical Internet Research* 19(11).
Ramsay (2016), *Clinical Case Studies* 15. Rosenholtz, Li and Nakano, *Journal of Vision*. Sheeran,
Listrom and Gollwitzer (2025), *European Review of Social Psychology* 36(1). Simons and Chabris
(1999), *Perception* 28. Sonuga-Barke (2003), *Neuroscience and Biobehavioral Reviews* 27(7);
Sonuga-Barke et al. (2010), *JAACAP*. Steel, Temporal Motivation Theory applied to ADHD (2023),
*Australian Psychologist*. Sweller (1988), *Cognitive Science* 12(2). Toli, Webb and Hardy (2016),
*British Journal of Clinical Psychology* 55. Vallacher and Wegner (1987), *Psychological Review*.
Volkow et al. (2010/2011), *Molecular Psychiatry* 16(11). Willcutt, Doyle, Nigg, Faraone and
Pennington (2005), *Biological Psychiatry*. JMIR mHealth scoping review (2024). Mathur et al., Dark
Patterns at Scale. FTC (2022), Bringing Dark Patterns to Light. Nielsen Norman Group, Scrolling and
Attention.
