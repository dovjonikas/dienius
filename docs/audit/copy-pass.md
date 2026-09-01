# Dienius copy pass

Every user-visible string reviewed against `docs/RESEARCH-ADHD.md`: front-load the point, plain
language, short, no encouragement or guilt copy, no exclamation marks, plain hyphens only. Strings
are read from source, not screenshots, so the hard-to-reach branches are included.

No em dash or en dash was found anywhere in `src/`, `index.html`, or the manifest - a search for
both characters across the whole tree returned nothing. That rule is already being followed.
No exclamation marks were found in user copy either. Both are clean; nothing to fix there.

**Reviewed:** roughly 130 distinct user-visible strings (visible text, placeholders, aria-labels,
visually-hidden text, and the capacity line's generated branches counted individually).
**Need a change:** 16, of which 4 are the ones that matter. The rest of the app - onboarding lede,
empty states, buttons, the push-bound note, the error screen, the settings copy, the theme panel -
is already calm, plain, and short. This pass rewrites the few things that read as jargon or
inconsistency, not the whole app.

---

## Priority order for a fixer

1. **The capacity line opens with unexplained jargon every single day.** "Anchors take 6h10." is
   the first sentence a person reads at the top of the day view, every day, before they have any
   context for what "anchor" means. Fix this first - it is the single most-seen string in the app.
2. **"Float" and "tray" leak into visible or screen-reader copy with no definition anywhere.**
   Same root problem as #1, smaller surface.
3. **The push-to-tomorrow action is named two different ways** depending on whether it is done to
   one task or to all of them at once.
4. **The "ongoing" toggle appears in the template editor with zero explanation** of what it does,
   and the screen-reader text for the day-view version of the same concept uses a phrase ("the push
   bound") that is never shown to a sighted user anywhere.
5. Everything else below is polish: a bare "core" badge that could front-load its meaning better,
   one edge-case in the onboarding flow, and a capitalization mismatch.

---

## 1. Onboarding (first run, `DayView.tsx`)

Read as someone who has never seen this app.

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "Dienius plans a day from a template: a reusable set of blocks you stamp onto a date instead of retyping it every morning. Tap one below to add it as a real template and set up today - edit or delete it any time afterward." | `DayView.tsx:322-326` | **GOOD** | Front-loads what the app does ("plans a day from a template"), defines "template" and "stamp" in the same breath, tells the reader what tapping does before they tap. No change. |
| "There are also eleven color themes here, light and dark - see them under Settings." | `DayView.tsx:328-330` | GOOD | Plain, short, correctly says "eleven" (matches the 11 presets in `themes.ts`). No change. |
| "Add a task... try 14:00 Call mom" (quick-add placeholder) | `DayView.tsx:314` | GOOD | Concrete example beats an abstract instruction - matches the research doc's own point about concrete task titles lowering initiation cost. No change. |
| "Nothing planned. Stamp a template from the calendar, or add a task above." | `DayView.tsx:334` | GOOD | Plain, tells the reader exactly what to do next. No change. |

**Verdict on the onboarding as a whole: good.** It explains the one piece of vocabulary the reader
actually needs before asking them to tap anything, gives a real, concrete example instead of a
generic scaffold, and is three short sentences, not a wall of text. The one gap is a sequencing
edge case: this text only appears on the Day tab. A person who opens Calendar or Templates first
(instead of landing on Day, which is the app's default tab) can reach "No templates yet, so there
is nothing here to stamp onto a day" (`CalendarView.tsx:216`) before ever seeing "stamp" explained.
Low priority - the app opens on Day by default, so this only bites someone who taps away
immediately - but worth a one-line mention if the fixer is already touching this area.

---

## 2. The capacity line (`capacity.ts`, rendered in `DayView.tsx:255-259`)

Every branch, checked against a normal day, floats over free time, unsized anchors, nothing at all,
and a clipped anchor.

| String | Location | Verdict | Replacement |
|---|---|---|---|
| `Anchors take ${duration}${windowNote}${unsizedNote}.` | `capacity.ts:364` | **FIX** | Opens the sentence, and the day, with a word that is never defined anywhere in the visible app. Replace "Anchors" with "Timed tasks": **"Timed tasks take 6h10."** |
| `${n} anchor(s) with no size yet.` | `capacity.ts:367` | **FIX** | Same word, same fix: **"2 timed tasks with no length yet."** (keeping "with no ... yet" but swapping "size" for "length" here reads slightly more natural as a sentence opener than "no size yet" does; either word is fine as long as "anchor" goes.) |
| "Free time isn't known until every anchor has a size." | `capacity.ts:371` | **FIX** | **"Free time isn't known until every timed task has a length."** |
| `Free: ${duration} across ${n} gap(s).` | `capacity.ts:374` | GOOD | "Gap" reads as plain English here (a free stretch in the day) - no change. |
| "No free time left today." | `capacity.ts:376` | GOOD | Plain, factual, no change. |
| `Floats need about ${duration}${unsized}.` | `capacity.ts:382` | **FIX** | Same problem as "Anchors": opens with an undefined word. **"Untimed tasks need about 3h40."** Pairs cleanly with the "Timed tasks" fix above - a reader gets both halves of the same vocabulary in the same breath the first time they see either. |
| "You are 2h over." | `capacity.ts:385` | GOOD | Stated as fact, no color or icon behind it, matches the research doc's own point about not treating overage as a warning. No change. |
| `${n} float(s) with no size yet.` | `capacity.ts:388` | **FIX** | **"2 untimed tasks with no size yet."** |
| "within today's window" (clipped-anchor qualifier) | `capacity.ts:362` | MINOR | Understandable in context (a window of time is ordinary English), but pairs oddly once "anchor" becomes "timed task" above. Once that fix lands, reread this qualifier - it may read fine as "Timed tasks take 11h within today's window" or may want "hours" instead of "window." Not urgent either way. |

Every branch was checked: a normal day, a day where untimed tasks exceed free time, a day with
unsized timed tasks, a day with nothing planned (correctly renders no line at all rather than a
fabricated "0h"), and a clipped anchor on a night shift. The arithmetic and the calm, no-guilt tone
are all sound - RESEARCH-ADHD.md section 3's finding about stating estimates honestly rather than
padding them is followed correctly throughout. The only defect is the vocabulary, and it is the
same defect five times over.

**Also affected by the same word**, one level down, only visible once the timeline grid is opened:

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "Gaps aren't shown - not every anchor above has a size yet." | `TimelineGrid.tsx:354` | **FIX** | **"Gaps aren't shown - not every timed task above has a length yet."** |
| `${time} - size unknown` (unsized anchor's own label) | `TimelineGrid.tsx:300` | GOOD | Never says "anchor" - just shows the time and "size unknown." No change needed. |

---

## 3. "Float" and "tray" - two more unexplained words

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "Nothing in the tray fits here." | `GapPicker.tsx:95` | **FIX** | "The tray" is never named or labeled anywhere else on screen - the task list has no visible label at all. A reader hits this cold. **"Nothing fits here."** (the picker is already titled with the gap's own time range, so "here" is unambiguous without needing a name for where the tasks are coming from). |
| `${task.title} returned to the tray.` / "Returned to the tray." (drag announcement) | `DayView.tsx:184, 377` | **FIX** | Screen-reader-only, but same problem. **"${title} is off the schedule again."** or plainer still, **"${title} no longer has a set time."** |
| `... Tap to place a float.` (gap button's full accessible name) | `TimelineGrid.tsx:326` | **FIX** | The word "float" is never shown to a sighted user anywhere in the app - this is the one and only place it reaches anyone, and it only reaches screen-reader users, which is its own small accessibility gap: they are handed a term nobody else ever sees. **"...free. Tap to fill this time."** |

---

## 4. Push, pushed, and "ongoing" - the push-bound note and its three options

| String | Location | Verdict | Replacement |
|---|---|---|---|
| `Pushed ${once/twice} - do it today, let it go, or mark it ongoing. Deleting counts as a decision, not a failure.` | `TaskRow.tsx:22` (`boundNote`) | **GOOD** | This is the one the brief singles out, and it holds up. It states the fact first ("Pushed twice"), lays out all three real options in one short, calm sentence, and closes on a line that quietly kills any guilt about deleting. No exclamation marks, no color, no icon. It reads just as well now that it offers three choices as it presumably did with fewer - nothing here needs to change. |
| "Push ${title} to tomorrow" (single-task action) | `TaskActionsSheet.tsx:175` | **FIX** (consistency) | See next row - same action, different word than the one below. |
| `Move ${n} to tomorrow` / `Move ${n} to tomorrow - ${held} staying here` (rollover-all button) | `DayView.tsx:358-359` | **FIX** (consistency) | The single-task button says **Push**; the all-at-once button says **Move**. Same action, same destination ("to tomorrow"), two different verbs on two different screens of the same app - exactly the kind of naming split the brief asks to catch. Recommend standardizing on **"Push"**, since that is also the word used in the resulting state ("Pushed twice") - a reader who pushes a task once will later recognize the word when they see it again: **"Push 3 to tomorrow"** / **"Push 3 to tomorrow - 2 staying here."** |
| "Mark ${title} as ongoing" / "Stop treating ${title} as ongoing" | `TaskActionsSheet.tsx:181, 187` | GOOD | Reads fine in this context - it sits directly under the bound note, which just explained what "ongoing" means as one of three options. No change here. |
| ", exempt from the push bound" (screen-reader-only continuation of the "ongoing" state mark) | `TaskRow.tsx:146` | **FIX** | "The push bound" is never shown to a sighted user anywhere - the visible copy always says "pushed twice" or spells out the three choices, never "bound." A screen-reader user hears a term nobody else in the app ever sees. **", exempt from being pushed to tomorrow"** matches the vocabulary actually used elsewhere. |
| "ongoing" toggle, template editor (no explanation at all) | `TemplatesView.tsx:196` (button), `192` (aria-label) | **FIX** | In the day view, "ongoing" always appears next to the push-bound note that explains it. In the template editor, it appears alone, before a reader has ever hit the push bound, with nothing nearby to say what it does. Add a one-line hint the same way the neighboring "core" toggle already has one (`TemplatesView.tsx:166`): **"Ongoing blocks are never pushed to tomorrow or need a decision."** |

---

## 5. "Core" - mostly fine, one place it could be plainer

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "Only blocks marked core count toward the score on this day type." | `TemplatesView.tsx:166` | GOOD | This is the one place "core" is actually explained, and it is explained well - plain, one sentence, right next to the control it describes. No change. |
| `core` (bare badge text on a task row) | `TaskRow.tsx:125` | MINOR | Shown with no hint on the one screen (day view) where the explanation above is never visible. Works fine for a returning user who built the template themselves and already knows what it means; a front-loaded word would need no memory at all. If touching this file, consider **"must-do"** in place of "core" here and on the template editor's toggle button (`TemplatesView.tsx:184`) and its aria-labels - "must-do" carries its meaning on first read, "core" does not. Not urgent: this is a returning-user feature (a person only sees non-full-day scoring after they have already built a shift/night/rest template themselves), so the audience for this string has more context than a brand-new reader does. |
| "3 of 5 core tasks done" (aria label, day score) | `DayView.tsx:54` | GOOD | The phrase "core tasks" is more self-explanatory than the bare badge above - keep as is if "core" stays the chosen word; update to "must-do tasks" only if the badge itself is renamed, so the two stay in sync. |

---

## 6. Task actions sheet, gap picker, timeline grid - everything not covered above

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "No free gaps to place this into right now." | `TaskActionsSheet.tsx:150` | GOOD | Plain, factual. No change. |
| "Remove time from ${title}" | `TaskActionsSheet.tsx:169` | GOOD | Clear action, no jargon. No change. |
| "Let go of ${title}" (delete, at the push bound) / "Delete ${title}" (delete, otherwise) | `TaskActionsSheet.tsx:192` | GOOD | Matches the bound note's own "let it go" framing exactly - consistent vocabulary between the two places this choice appears. No change. |
| "Show ${n} more" | `GapPicker.tsx:118` | GOOD | Short, does what it says. No change. |
| "size unknown" (unsized float row in the gap picker) | `GapPicker.tsx:100` | GOOD | Plain. No change. |
| Size-field aria-labels ("Size in minutes for ${title}", "Change size for ${title}, currently 45 min", "Set size for ${title}") | `TaskRow.tsx:156,169-173` | GOOD | Clear, front-loaded, consistent with the visible "size" button. No change. |

---

## 7. Templates screen

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "No templates yet. Start from one of these, or build your own with New template above." | `TemplatesView.tsx:352` | GOOD | Plain, tells the reader what to do. No change. |
| "Use this template" (starter offer button) | `StarterOffers.tsx:43` | GOOD | Clear call to action. No change. |
| "3 blocks" / "1 block" (template card) | `TemplatesView.tsx:365` | GOOD | Correct singular/plural handling, no change. |
| "Template name" / "What happens" (placeholders) | `TemplatesView.tsx:133, 207` | GOOD | "What happens" is a nicely concrete placeholder for a task title field - no change. |

---

## 8. Calendar and year strip

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "No templates yet, so there is nothing here to stamp onto a day." | `CalendarView.tsx:216` | GOOD (see onboarding note above) | Clear on its own; the only issue is sequencing (may be seen before "stamp" is explained on Day). No copy change needed. |
| "Click or drag across days to stamp. Click a stamped day to clear it." | `CalendarView.tsx:281` | GOOD | Says "click" - on a phone this is really "tap," but the app is described as being used on a phone throughout. Minor terminology mismatch, not urgent: "click" is broadly understood as "press/select" even on touch, and pointer events in this codebase are deliberately touch-and-mouse-agnostic. Consider "Tap or drag..." only if this file is already being touched. |
| "3 days staged" | `CalendarView.tsx:271` | GOOD | Plain. No change. |
| "A colored cell had a plan for that day. A ringed cell means everything planned for that day was done. Once a day is focused, the arrow keys move to another day, and Home and End jump to the first and last day of the year." | `YearStrip.tsx:214-217` | GOOD | Three short, literal sentences describing exactly what the colors and keys do. No jargon. No change. |

---

## 9. Errors and storage failures

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "Something went wrong" / "Dienius hit an error it could not recover from while showing this screen. Nothing you have entered is lost - it is still sitting in this browser's storage." / "Export a backup to be safe, then reset if reloading does not clear it." | `ErrorBoundary.tsx:59-64` | GOOD | Calm, reassures first ("nothing is lost"), then gives two concrete next steps in order of safety. This is what error copy for a frustrated reader should look like. No change. |
| "Saving to this browser failed. Your changes only live in memory - export a backup." | `SettingsView.tsx:65` | GOOD | Plain, tells the reader the consequence and the fix in one breath. No change. |
| "That file is not a valid Dienius backup." | `SettingsView.tsx:36` | GOOD | Short, factual, no blame. No change. |
| "Erase everything on this device - every template, every day's tasks, if-then rules, and any theme changes you have made. Export a backup first if you want to keep a copy." | `SettingsView.tsx:99-101` | GOOD | Spells out exactly what is lost, in plain words, before the button that does it. No change. |

---

## 10. Theme settings

| String | Location | Verdict | Replacement |
|---|---|---|---|
| "Adjust this theme" / "3 changed" | `ThemeOverridePanel.tsx:85-86` | GOOD | Clear disclosure label. No change. |
| Contrast warning: "Text is hard to read against the paper (3.2:1, needs 4.5:1)." | `theme-override-warnings.ts:45` | GOOD | States the fact and the number, no alarm language. No change. |
| "Currently a custom value, not one of these." | `ThemeOverridePanel.tsx:253` | GOOD | Plain. No change. |
| "Changed from the preset default" (visually-hidden) | `ThemeOverridePanel.tsx:213` | GOOD | Matches the visible dot's meaning exactly - a rare case where the hidden text and the visible marker say the same thing without redundant noise. No change. |

---

## 11. App shell, `index.html`, and the manifest

| String | Location | Verdict | Replacement |
|---|---|---|---|
| `<title>Dienius</title>` | `index.html:15` | GOOD | Short, clear. No change. |
| meta description: "A modular day planner built around reusable day templates." | `index.html:6` | GOOD | Accurate, plain, no change. |
| manifest name/short_name: "Dienius" | `manifest.webmanifest:2-3` | GOOD | No change. |
| manifest description: "A modular day planner built around reusable day templates. Works fully offline, all data stays on your device." | `manifest.webmanifest:4` | GOOD | This is what shows on a home-screen install and is genuinely informative - what it is, and the privacy-relevant fact that it's offline and local. No change. |
| Tab labels: "Today", "Calendar", "Templates", "Settings" | `App.tsx:14-19` | GOOD | Plain, no jargon. No change. |

---

## Invented vocabulary - verdict on each word

| Word | Where it reaches the user | Verdict |
|---|---|---|
| **anchor** | Capacity line (5 strings, the most-seen copy in the app) and one timeline note. | **Replace.** Never explained anywhere. Swap for "timed task" wherever it appears in user-facing copy (see section 2). The internal name can stay internal; only the words a reader sees need to change. |
| **float** | One screen-reader-only aria-label. | **Replace.** Same reasoning - swap for "untimed task" in the capacity line, and drop the word entirely from the one aria-label it appears in (see section 2-3). |
| **gap** | Capacity line ("across 2 gaps"), gap picker labels, timeline grid. | **Keep as is.** Reads as ordinary English in every place it appears - a gap in your day is immediately understood, unlike "anchor" or "float." |
| **core** | Task badge, day-score note, template editor toggle, one explanatory sentence. | **Keep but explain once, or replace.** It is explained once, well, in the template editor (`TemplatesView.tsx:166`) - but that explanation never reaches the day view where the bare badge and the score note actually live. Cheapest fix: replace "core" with "must-do" everywhere it is user-facing, which needs no explanation at all. If the word "core" is worth keeping for its own reasons, at minimum leave the existing explanation where it is and treat this as low priority - see section 5. |
| **ongoing** | Day-view state mark, task-actions sheet, template editor toggle, one screen-reader phrase ("exempt from the push bound"). | **Keep, but fix where it is unexplained.** It works well in the day view and the actions sheet because the push-bound note sits right next to it. It needs a one-line explanation in the template editor, where it currently has none, and the mismatched screen-reader phrase ("the push bound," never shown to anyone else) needs to match the visible wording instead. See section 4. |
| **stamp** | Onboarding lede, calendar stamp bar, calendar empty state, calendar hint text. | **Keep.** Explained in the first sentence a new user reads, and used consistently afterward as a plain verb ("stamp a template onto a day"). The only soft spot is sequencing if a reader skips the Day tab first - see section 1's onboarding note. |
| **template** | Everywhere. | **Keep.** Ordinary English word, explained on first use, never redefined differently in a second place. |
| **day type** | Template editor label, if-then form's "Applies on" section. | **Keep.** The word itself barely surfaces - the actual options (Full day, Shift, Night, Rest) are shown as plain labeled chips, which explain themselves without the reader ever needing to parse the phrase "day type" as a concept. |
| **push** | Rollover button, task-actions button, task state mark, push-bound note. | **Keep, but make consistent.** The word itself is fine and plain ("push to tomorrow" is a normal way to say "move to tomorrow"). The problem is that one button says "Push" and another says "Move" for the identical action - see section 4's consistency fix. Standardize on "Push" since that is also the word used in the resulting state. |

---

## What's already good and does not need touching

Worth saying plainly, since a copy audit that rewrites everything gets ignored: the large majority
of the app's copy is already exactly what the research document asks for.

- The onboarding lede, and the whole first-run flow.
- The push-bound note itself (`boundNote`) - the three-option version reads well and needed no
  rewrite.
- Every empty state (day view, templates, calendar, if-then board, gap picker).
- The error boundary's crash screen and Settings' storage-failure and bad-import messages.
- The if-then board's own hint text ("A specific moment, not a feeling - where you are, what just
  happened.") and its placeholder examples.
- The year strip's legend.
- The theme panel's labels and contrast warnings.
- `index.html`'s title and meta description, and the manifest's name and description.
- No em dashes, en dashes, or exclamation marks anywhere in the codebase.

The fixes above are concentrated in exactly two places: the capacity line's word choice (five
strings, one root cause, the highest-visibility copy in the app), and a handful of spots where
"ongoing," "push," and "core" are used correctly in one place but inconsistently or unexplained in
another. Fixing the capacity line and the push/move split covers most of the value here.
