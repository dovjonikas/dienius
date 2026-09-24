# Speed, accessibility and the keyboard

The freeze's point 4, measured on 2026-09-24: Lighthouse at a phone's size
and a desktop's, what the bundle is made of, and every screen on a keyboard
alone. Where a score is under 100, what holds it there and what it would
cost to move it. Nothing measured is under 90.

## Lighthouse

The production build, served under `/dienius/` the way GitHub Pages serves
it; an empty app, and the demo's fortnight (`?demo=1`), which builds a full
plan on open. The phone is Lighthouse's own mobile preset - a mid-range
phone, a slow 4G line and a CPU four times slower than the machine - and
the desktop its desktop preset. `npm run build && node scripts/lighthouse.mjs`
runs all four and names the audits that are not at 100.

| | Performance | Accessibility | Best practices | First paint | Largest paint | Blocking | Layout shift |
|---|---|---|---|---|---|---|---|
| Phone, empty | 96 | 100 | 100 | 2.3 s | 2.3 s | 30 ms | 0 |
| Phone, the demo's fortnight | 95 | 100 | 100 | 2.3 s | 2.3 s | 80 ms | 0 |
| Desktop, empty | 100 | 93 | 100 | 0.5 s | 0.5 s | 0 ms | 0 |
| Desktop, the demo's fortnight | 100 | 93 | 100 | 0.5 s | 0.5 s | 0 ms | 0 |

### What holds the phone's performance at 95

The first paint, at 2.3 s on the slow line: the page cannot draw until its
one script (232 KB over the wire) and its stylesheet (39 KB) have arrived,
and Lighthouse counts both as holding the paint back (about 300 ms of it).
It also counts the parts of both that the first screen does not use: some
160 KB of script for the other pages and 35 KB of stylesheet.

**What it would cost.** Splitting the script by page - Kitchen, the
Library, Templates, Settings and Review each its own file, fetched when
first opened - would take the first screen's script to about half. The
cost is the reason the app is one file: a page left open across a deploy
asks for a part the deploy has removed, and every such part is one more
thing for the worker to keep in step (DECISIONS "The phone with no network,
and a deploy that takes over"). The gain is on the first open of a new
install over a slow line only: every open after it comes from the worker's
cache, without the network. Not done in the freeze.

### What holds the desktop's accessibility at 93

Two audits, contrast and the size of a target, on three things drawn only
on a desktop:

- **The mini month's days on either side of the month**, at 3.4:1 in the
  light theme. On purpose: CONVENTIONS 22 and the `--faded` token keep a
  thing that is there but not the point at 3:1 at least - "the line between
  a whisper and a smudge". 4.5:1 would make the months either side read as
  loudly as the month itself.
- **The quick-add's "Return" hint**, at 4.2:1: a quiet word that repeats the
  key's own label, hidden from a screen reader, and gone on a finger.
- **The time field's two arrows**, 34 by 17 px each with a mouse (44 px each
  on a finger). WCAG 2.5.8 excepts a target whose job another control on
  the page does, and the time field itself takes a typed time and the arrow
  keys; Lighthouse cannot know that. Arrows 24 px tall would make the field
  48 px beside every other 36 px control in its row (one look's rule 3).

The phone scores 100: none of the three is drawn there as it is on a
desktop.

Fixed on the way: the length control's button showed "45min", one word to a
screen reader, and was named "45 min long" - a name that did not hold what
it showed; and the empty day's three starters showed "Use this template"
and were named "Use the Working day template". Both are named by their own
words first now (DECISIONS "A control is named by the words on it").

### Best practices

100 at both sizes. Lighthouse lists the missing source maps, which it does
not score: a map deployed with the app would be precached by the worker and
downloaded by every install for nobody.

## The bundle

`npx vite build --sourcemap --outDir <a folder> && node scripts/bundle-parts.mjs <that folder>`
attributes every byte of the built script to the file it came from.

| | Raw | Over the wire (gzip) |
|---|---|---|
| The script | 799.4 KB | 232.2 KB |
| The stylesheet | 246.6 KB | 39.2 KB |

The script, by what makes it up:

| | KB | Share |
|---|---|---|
| `src/lib` - the plan's rules, storage, sync, the templates file | 200.0 | 25.0% |
| `src/views` - the pages, and their parts below | 181.1 | 22.7% |
| React's DOM | 174.4 | 21.8% |
| `src/widgets/day-plan` - the day | 121.2 | 15.2% |
| `src/views/kitchen` | 24.3 | 3.0% |
| `src/views/week` | 14.3 | 1.8% |
| `src` - the shell: App, the boundaries, the worker's registration | 13.8 | 1.7% |
| `src/widgets/clock` - the timer and the header's panels | 13.4 | 1.7% |
| `src/views/scratch`, `shifts`, `tour`, `north` | 39.8 | 5.0% |
| React itself and its scheduler | 11.0 | 1.4% |
| The rest | 3.5 | 0.4% |

React is the only library: everything else in the script is the app's own.
The largest single files are React's DOM (171 KB), the Library's page
(20 KB), the template editor (18 KB), the templates file's reader and
writer (16 KB) and replan (16 KB).

## The keyboard

`npm run keys` walks every page and, since the freeze, every sheet and
panel over them - 39 screens, 11 of them sheets, in both themes - and asks
four things of each: every stop shows its ring, Tab reads down the screen,
Escape shuts what a press opened and gives focus back, and nothing is
reachable only with a pointer. It found Tab running off the end of a sheet
into the page under its scrim; the page behind an open sheet is out of
reach now (DECISIONS "The page behind a sheet is out of reach"), and it
finds nothing.
