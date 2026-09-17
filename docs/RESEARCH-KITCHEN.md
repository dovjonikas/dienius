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

## 6. v2.30: many recipes, on cards, into templates

The owner used Kitchen and said what v2.27 had missed: there will be a lot of
recipes, so they need to stand sorted by meal and be easy to find; they should
lie on cards the way North's headings do, with a kitchen's own character; the
Cook button is not needed; a meal block in a template should take recipes from
Kitchen the way a reading block takes books from the Library; and writing a
recipe should work like the Library's add line - numbers typed into the text
fill their fields, and the fields can still be filled by hand. What follows is
what was decided for each, and why.

### 6.1 Cook goes, and what only Cook did

Cook, its screen kept awake, and Done adding to times cooked are removed:
`CookMode`, `useWakeLock`, `markCooked`, and the "Cooked 3 times" on a row and
a page. The count had one source, and a number that can never move again is a
false fact on every recipe. The `cooked` field stays in the data - a backup
and an older device still carry it, and both guards accept it - and nothing
shows it or writes it. Section 4 stands as the record of what was built.

### 6.2 A recipe needs only its name

Many recipes arrive as a name and a few facts long before anybody types the
method: a breakfast, its kcal, its tag. So Save waits for a name, and the text
may be empty. An empty text is stored as the empty string, which the guard has
always taken - `text` is checked as a string, in v2.28's frozen copy too - so
an older device reads such a recipe and shows its name.

### 6.3 Numbers typed into the text fill their fields

`recipeNumbers(text)` reads kcal, protein, carbs and fat for a serving,
servings and minutes where a number stands beside its word: "450 kcal", "kcal
450", "Protein: 30 g", "30g protein", "2 servings", "serves 2", "45 min",
"1 h 30 min". The words are English and Lithuanian, with and without the
Lithuanian letters, because recipes are written in the language they are
cooked in; a decimal comma is a decimal. The first mention of each number is
the one read.

- **Never from inside the ingredients or the steps.** "30 g protein powder" is
  an ingredient, not a serving's protein; section 2 keeps amounts in an
  ingredient line as words. Numbers are read from the lines around those two
  lists - an introduction, a heading of their own.
- **One truth with the fields** (CONVENTIONS 16). Where the text says a number,
  its field shows it, and changing the field rewrites that number in the text;
  where the text says nothing, the field is filled by hand. More opens by itself
  when a number is read, so the filled fields are seen.
- **Still information, never a total** (section 3): reading a number into a
  recipe's field adds nothing up anywhere.

### 6.4 Kitchen on cards, by meal

- **Sections by meal** in the app's order - Breakfast, Lunch, Dinner, Pre-gym,
  Post-gym, Snack - and one for recipes with no meal yet. A recipe for two
  meals stands under both, the way a cookbook's index lists a dish in two
  chapters. The chips choose one meal; the search narrows every section.
- **A card is a recipe at a glance**: its name, how long and how many servings,
  its kcal and protein, and the first few ingredients on a quiet line - what a
  choice between dinners is made on. A press opens the recipe.
- **North's plate, with a kitchen's character**: the cards lie in a grid the
  way North's headings do, carry North's small shadow and top light - the second
  exception in DESIGN, asked for - and each carries the Meals category's colour
  down its edge, the mark a meal block already has on the day. No colour says
  anything about a number.

### 6.5 A meal block takes recipes from Kitchen, like a reading block takes books

- **Several recipes on a block** (`TemplateBlock.recipeIds`), chosen in a picker
  that is Kitchen in small - sections by meal, a search, a press to add or take
  away - in the order they were added. The chosen ones stand numbered at its top,
  each with Take out, and under the sections the kinds of meal to leave to the
  day; a block is one or the other.
- **Each day gets the next one.** A day stamped from the block holds one recipe
  (`Task.recipeId`, as now), and which one walks the list by the date, so
  Monday's dinner is not Tuesday's and every chosen meal comes round. Worked
  out from the date alone, so it is the same on every device and needs nothing
  stored; a day skipped moves the walk on rather than holding it back.
- **What the day shows and does is unchanged**: the card names the recipe and a
  press opens it; choosing another on the day is the day's. A kind of meal
  left open to choose on the day stays as it is.
- **From a recipe's page, Add to template**, the way a book is added: a
  template and one of its meal blocks, or a new meal block with a time and a
  length. The recipe joins that block's list, once. A new block is offered on a
  day template only: on a week a block belongs to a weekday, which the week's
  editor asks.
- **An older device** reads `recipeId`, which is written as the first of the
  list, so it still stamps a meal rather than none.

### 6.6 Tests

Each rule gets a unit test that fails first: the number reader (every word, both
languages, decimals, never inside the ingredients or steps, the first mention
only), the form's one truth both ways, a recipe with only a name through the
guard and v2.28's, the sections and the card's lines, `recipeIds` through the
guard, a backup and sync, the walk by date (every recipe comes round, the same
date the same meal, a skipped day), stamping and the echo, the picker, Add to
template, and nothing left of Cook. The phone and both themes are walked and
pictured at the end, with generic recipes only.

## 7. What is left out, on purpose

Calorie or macro goals, day or week totals, progress bars and any verdict (section 3); scaling
servings and parsing ingredient amounts (section 2); shopping lists; tags of one's own beyond the
six meals, which cover what was asked. Each is a feature of its own with its own costs, and none was
asked for yet.

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
