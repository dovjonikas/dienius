# Kitchen: why recipes are shaped the way they are

> Written 2026-09-17, when Kitchen was begun as v2.27. The brief asked for a recipe library that
> looks and feels like the Library and keeps its own data, a way to cook from it, and a link from
> the day's meal blocks, with no calorie goals, no totals and no verdict anywhere. This note is the
> short why behind each part. Same evidence labels as [`RESEARCH-ADHD.md`](RESEARCH-ADHD.md):
> **Strong**, **Moderate**, **Weak**, **Inference**, **Folk**.

---

## 1. A recipe is not a library list

The Library is built on progress: a list has a unit, an item has a total and a position in it, and
everything the Library draws - the bar, the pace, what the queue moves on to - reads those. A
recipe has nothing to move through. Putting one in a `LibraryList` would mean a unit nobody counts,
a total that is always absent, and every Library reader learning to skip it.

So `Recipe` is its own entity (CONVENTIONS 7): a top-level list in `AppData`, one sync entity per
recipe at `recipe:<id>`, validated by its own table, carried whole by export and import, and absent
from every backup written before it - which loads as an empty Kitchen. What is shared with the
Library is the look: the page frame, the search field, the chips, the quiet rows and the empty
state. **Inference.**

## 2. One text, read by North's rule

A recipe is a name and one free text. The structure a recipe page needs - ingredients as a list,
steps as numbered steps - comes from the same rule North already taught: a line in capitals is a
heading. Under `INGREDIENTS` every line is an ingredient, under `STEPS` every line is a step, other
headings are headings over their paragraphs, and a text with no heading is shown as typed. The
parser is North's, not a copy (`lib/northSections.ts`), so the two can never disagree about what a
heading is.

Why not fields for ingredients and steps: a recipe arrives pasted from a message, a site or a
note, and a form of twelve rows is a form nobody fills in twice. A text takes the paste as it is,
and capitals are the only formatting to learn. Quantities stay words inside the line - nothing
parses "250 g" - because scaling a recipe was not asked for, and a parser that reads amounts right
most of the time is a parser that is wrong in the kitchen. **Inference.**

## 3. The numbers are information, never a total

Kcal, protein, carbs and fat per serving, servings and minutes are optional, shown on the recipe
and on its row, and read by nothing else: no day sums them, no week charts them, no goal compares
with them, and nothing is ever coloured by them.

Calorie counting and tracking apps are associated with eating disorder symptoms. In a sample of
college students, use of calorie-tracking technology was associated with higher eating concern and
dietary restraint (Simpson and Mazzeo, 2017), and among people in treatment for an eating disorder
most who had used a popular tracker said it had contributed to their symptoms (Levinson and
colleagues, 2017). **Moderate** for the association, **Weak** for cause: both are cross-sectional
and self-reported. It is still enough to decide the direction for an app whose whole stance is to
refuse scores (ARCHITECTURE section 6): a number beside a recipe helps choose one for after the gym,
and a running total turns every meal into a test.

## 4. Cook: larger, tickable, awake

Cook is the recipe on a screen meant to be read from arm's length with wet hands: larger type,
each ingredient and each step ticked off with a press, and the screen kept awake.

- **Ticking a line off is place-keeping.** Following a procedure means remembering which step comes
  next, and brief interruptions of a few seconds were enough to multiply sequence errors in a
  procedural task (Altmann, Trafton and Hambrick, 2014). A kitchen is interruptions. A mark on the
  step already done moves that memory out of the head. **Moderate** (laboratory task), and it is the
  same external-memory argument `RESEARCH-ADHD.md` makes for the day's checklist.
- **The ticks are not kept.** They belong to this cooking, so they live in the screen and go with
  it. Stored, they would be a half-cooked recipe waiting next time.
- **The screen stays on through the Screen Wake Lock API**, where the browser has it; where it does
  not, nothing is said and nothing breaks. Recipe pages were a motivating case for the API, and a
  large recipe site reported a sharp rise in engagement after adopting it. **Weak** (an industry
  case study), but the failure it prevents - a dark screen and a floury finger - needs no study.
- **Done adds one to times cooked**, and nothing else: no date, so nothing can say how long ago or
  keep a streak. The count answers "which of these do we actually make", which is what the row shows
  it for. Leaving Cook without Done counts nothing.

## 5. The day links to a recipe, and does not copy it

A block on the day or in a template whose category is Meals may point at a recipe, or only at a
kind of meal. With a recipe the block shows its name and a press opens it; with a kind of meal a
press opens Kitchen filtered to that kind, which is the moment of choosing and so the moment the
choice is small. A block with neither works exactly as before. The block holds an id, not a copy,
so editing a recipe changes it everywhere, and a recipe deleted on another device leaves a block
that simply names nothing (CONVENTIONS 7, a dangling id degrades).

Planning meals ahead is associated with more varied and better quality diets in a large French
cohort (Ducrot and colleagues, 2017). **Moderate**, cross-sectional. It supports making the link
easy; it does not support nagging anybody to plan, and nothing does.

## 6. What is left out, on purpose

Calorie or macro goals, day or week totals, progress bars and any verdict (section 3); scaling
servings and parsing ingredient amounts (section 2); shopping lists. Each is a feature of its own
with its own costs, and none was asked for yet.

---

### Sources

- Altmann, E. M., Trafton, J. G., and Hambrick, D. Z. (2014). Momentary interruptions can derail the
  train of thought. *Journal of Experimental Psychology: General*, 143(1), 215-226.
- Ducrot, P., Méjean, C., Aroumougame, V., and colleagues (2017). Meal planning is associated with
  food variety, diet quality and body weight status in a large sample of French adults.
  *International Journal of Behavioral Nutrition and Physical Activity*, 14, 12.
- Levinson, C. A., Fewell, L., and Brosof, L. C. (2017). My Fitness Pal calorie tracker usage in the
  eating disorders. *Eating Behaviors*, 27, 14-16.
- Simpson, C. C., and Mazzeo, S. E. (2017). Calorie counting and fitness tracking technology:
  Associations with eating disorder symptomatology. *Eating Behaviors*, 26, 89-92.
- W3C Screen Wake Lock API, and the web.dev case study of its use on a recipe site (2020).
