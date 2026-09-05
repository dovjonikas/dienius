# Using this every day

Setting Dienius up once so that from Monday morning it is just the thing you
open. Written for the person using it, not for whoever works on the code.

About twenty minutes on a Sunday. Steps 1 to 3 are the ones that make the
difference; 4 and 5 can wait until you want them.

Everything lives in the browser you set it up in. **Do step 5 at some point
in the first week** - it is the only thing standing between a lost laptop and
a lost plan.

---

## 1. Build the templates you actually have

A template is a set of blocks you stamp onto a day, so a Tuesday does not
have to be typed out every Tuesday.

Open **Templates → New template**. Give it a name and a colour. Then, for
each block, set the time, type what happens, pick a length, and press **Add
block**. Leave the time empty on anything that happens but not at an hour.
**Save template** when the list looks right.

Three things worth knowing while you build:

- **Only put in what actually happens.** A template with a 06:00 block you
  have never once done at 06:00 makes every day start with a lie on it.
  Six or eight blocks is a lot; three is fine.
- **Mark the one or two that matter as core.** On a shift or a rest day the
  score counts only those, so a twelve-hour day is not scored like a Tuesday.
- **You will edit these.** Nothing about a template is permanent, and
  changing one does not touch the days you already stamped from it.

Start with two: the ordinary working day, and whatever the other kind of day
is - a shift, a day off, a Sunday. Add more when you notice a third kind.

## 2. Say which weekday gets which

**Settings → Week → A template per weekday.** One dropdown per day of the
week. Set the ones you are sure of and leave the rest on Nothing.

From then on a new day opens already set up. Two rules to trust it:

- **A day you stamp by hand always wins**, so an unusual Tuesday is one tap.
- **Deleting what arrived leaves it deleted.** Re-opening the day does not
  put it back. It is a starting point, not a rule.

## 3. Write down what the days are for

**Settings → North → Write one down.** Up to four. Each is three lines:

| | |
|---|---|
| **What** | Short, and something you do rather than something you get |
| **Why** | In your own words, the reason you would say out loud |
| **Who it makes you** | "I am someone who ..." |

Press **Write it down** to keep it.

One of them appears under the day's title each morning, rotating. **Nothing
here is ever measured** - no progress, no deadline, nothing to tick. The one
number near a goal is how many days you have lived toward it, which is a
fact and cannot be lost.

Two of these is plenty to start with. Writing a fourth to fill the space is
how you end up with one you do not believe.

### And what pulls you off them

**North** is its own screen now - the sixth icon in the rail, the `6` key, or
that line under the day's title. It is where the goals are read rather than
written, and under each one sits a short list headed **What pulls me off
this**.

Each line is a moment you can catch and the one thing you already decided to
do about it:

> If I catch myself scrolling at 23:00 -> phone in the kitchen, book in hand.

**Add another** writes one. Five per goal, and the cap refuses rather than
dropping the oldest. Write them the way you would say them, in the second
person, about a moment specific enough to notice: "when I get home and the
kitchen is a mess" is a moment; "when I feel unmotivated" is not.

Nothing counts them, nothing asks whether you did them, and nothing shows
them on the day view. They appear in exactly two places: here, and once under
the why on the card that comes forward after a day that got away, introduced
as what you wrote yourself.

If you wrote rules before they belonged to goals, they are all still here,
gathered under **Not under a goal yet** with the goals offered beside each
one. Nothing was filed for you, and a rule can stay there as long as it
likes.

## 4. Point a reading block at the Library

Only if you read, or watch, or work through courses. The point of it: the
block on your template says "a reading session", the list says which book,
and finishing one moves the block on to the next by itself.

1. **Library → Start a Books list** (or Something else, for a different unit
   - lessons, songs, episodes). **More than one list is the point**: a single
   queue stalls, because everything in it sits behind whatever is at the
   front. Three shorter ones - the heavy reading, the work reading, and the
   thing you will actually pick up on a Tuesday evening - each move on their
   own, and finishing something in one offers the next thing from *that* one.
   `Ctrl-K` → **Load my reading plan** fills three named MIND, CRAFT and
   LIGHT if you want a shape to start from.
2. Add what is on the shelf, in the order you would actually read them:
   `Deep Work, 12 chapters`. A page-counted book is `The War of Art, 139
   pages`; a series is `Andor, 2 seasons`. Or use the two controls beside the
   box, which say the same thing without typing.
3. Tap the top book, then **Add to template**. Pick the template, give the
   block a time and a length, **Add block**.

That is the whole binding. From then on, stamping that template puts the
current book on the day by name, and ticking the block off advances it. When
a book ends, the list says so and offers the next one.

To reorder the queue, drag a row in the Library - or focus its grip and use
the arrow keys. The order *is* the queue; nothing else decides what is next.

## 5. Name the kinds of task you actually have

The six the app ships with - core, routine, personal and the rest - are a
starting point, not a vocabulary you have to live in. **Settings →
Categories** is where they become yours: rename one, pick its colour from the
same eight everything else uses, add one, drop one.

Two things worth knowing before you rearrange them:

- **A colour that will not read is refused**, with the reason said out loud.
  A category's colour ends up as a two-pixel edge on a task card and a dot in
  a month cell, and one that vanishes against the theme is a category you
  cannot see.
- **Deleting one never orphans a task.** The delete asks what its tasks
  should become and moves them there in the same press, so nothing is left
  pointing at a category that is gone.

Templates are where most tasks get their category, because a stamped day
arrives already sorted - the row of dots under the block-add line is the same
picker quick-add uses on the day view.

## 6. Turn on the copy on GitHub

The one that survives losing the machine. It writes your plan as plain JSON
into a private repo you own, so it is readable in a browser from anywhere.

**Make the repo**

1. On github.com: **New repository**. Call it something like
   `dienius-data`. Set it to **Private**. Do not add a README - an empty
   repo is what this wants.

**Make the token**

2. Go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
3. **Repository access:** Only select repositories → the one you just made.
4. **Permissions → Repository permissions → Contents:** Read and write.
   Nothing else. Leave every other permission alone.
5. Set an expiry you will remember. When it expires the app says so in plain
   words and you make another; nothing is lost in the meantime.
6. Generate it and copy it. GitHub shows it once.

**Tell Dienius**

7. **Settings → Backup → A copy on GitHub.** Repo is `you/dienius-data` -
   the two halves, not the full address. Paste the token. **Save**.
8. Press **Back up now** once, to see it work. The line under the buttons
   should read "Last backup: today ...".
9. Open the repo on github.com. There is `data/state.json`, and
   `data/history/` with one file per day.

After that it writes itself: when you close the day, and on the first open
of a new one. **The token never leaves this device** - it is not in an
export, it does not sync, and it is not in the copy it writes. Which also
means: set it up separately on each device you use.

## 7. Two devices, if you have a second one

Optional, and unrelated to step 5. Sync needs a small server you run
yourself - a PC at home, reached from the phone. `server/sync-server.mjs`
in the repo, and **Settings → Sync** for the address and token it prints.
Skip this entirely if one browser is where you plan; nothing degrades.

---

## What a day looks like once it is set up

- **Morning.** Open it. The day is already stamped. If yesterday left
  anything, a line at the top says so and moves it forward in one tap - it
  never moves anything on its own.
- **All day.** Type a title into the box and press enter. The time and the
  length beside it already hold real answers, so that is the whole gesture.
  A thought with no home goes to the Inbox; something for another week goes
  to the Backlog; a number said once on the phone goes into Scratch (the pen
  at the foot of the rail, or the `S` key).
- **When the plan breaks.** **Replan**, under the date. Three doors:
  something came up, shift the rest, I was away. Each shows its answer
  before you accept it.
- **Evening.** Around half nine, or the moment the last thing is ticked, a
  card offers to close the day. It never says anything about what was not
  done.

Two keys worth learning: **`N`** jumps to the box, **`Ctrl-K`** finds
anything or runs any command. **`?`** shows the rest - and every icon in the
rail names its own key when you rest on it, which is the easier way to pick
them up: `1` to `6` for the six screens, a comma for Settings.

---

## If something looks wrong

In this order, and the order matters:

**1. Back it up first.** Settings → Backup → **Back up now**, or
Settings → General → **Export backup** if GitHub is not set up. Whatever is
wrong, having a copy of it is better than not.

**2. Write it down while you can see it.** Press the pencil (or `S`) and
type it starting with `#bug`:

```
#bug the week arrows are too close to the edge on my thumb
```

It saves as you type. Later, open Scratch, tap the `#bug` chip, and press
**Export bugs** - it copies them all as a list to paste wherever.

**3. Then, if you need the plan back:**

- **Something is wrong from earlier today** - Settings → General →
  **Restore from a snapshot**. One copy a day, taken on the first open, seven
  kept, so this morning's is the newest. It replaces everything, and it says
  what it holds before it does.
- **Something is wrong since yesterday or before** - Settings → Backup →
  **Restore from cloud**. It reads the copy on GitHub, tells you what is in
  it and what is here, and replaces only on the second press.
- **You want one specific day back and nothing else** - open
  `data/history/YYYY-MM-DD.json` on github.com, download it, and
  Settings → General → **Import backup**. Same thing: it replaces everything,
  so back up first.

**Never clear the site data.** That is the one action nothing protects you
from. Every destructive thing inside the app asks twice; that one does not
ask at all.

---

## The two things it will not do, on purpose

Worth knowing so they do not read as missing:

- **It never shows progress toward a goal**, and never will. Being shown how
  far along you are is what makes people ease off. The reason is written down
  in [`DECISIONS.md`](DECISIONS.md) if you want it.
- **It never says what you did not do.** Not on the evening card, not on a
  past day in the calendar, not in a colour. Everything left is still in the
  list, where you can look at it if you want to.

If either of those ever stops being true, that is a bug, and the most
important kind.
