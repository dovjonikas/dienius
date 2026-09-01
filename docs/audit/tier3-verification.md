# Tier 3 verification

Every struck-through claim in `docs/BACKLOG.md`'s Tier 3 section, checked against the code as it
stands, not trusted on the word of the strikethrough. The full test suite was also run:
774 tests across 47 files, all passing, none skipped.

## Claim by claim

| # | Claim | Verdict | Settled by |
|---|-------|---------|-----------|
| 1 | Dangling `templateId` deliberately kept, guarded in `DayView`, `CalendarView`, `yearGrid`, pinned by a `store.test.ts` test | True | `src/widgets/day-plan/DayView.tsx:41-43`, `src/views/CalendarView.tsx:89` and `:234-235`, `src/widgets/year-strip/yearGrid.ts:65` all resolve a missing template to `undefined` via `.find`, never throw. `src/lib/store.test.ts:493-506` stamps a day, deletes the template, and asserts `templateId` is still set. No other production file reads `day.templateId` for a template lookup - the only other match, `src/lib/storage.ts:151`, is a load-time type check (`isOptionalString`), not a lookup, so it cannot crash on a dangling id either. |
| 2 | Template block ids regenerate fixed: surviving block keeps its id, new block gets a fresh one | True | `src/views/TemplatesView.tsx:302-315` (`saveDraft`): `blocks: next.blocks.map((b, i) => ({ ...blocks[i], id: b.id ?? crypto.randomUUID() }))`. `startEdit` (line 258-274) carries `id: b.id` forward from the template being edited; `addBlock` (line 89-109) never sets an `id` on a freshly added `DraftBlock`, so it falls to `crypto.randomUUID()`. Pinned by `src/views/TemplatesView.test.tsx:223-248`. Rename (of the template's own name, or of a block's `core`/`unbounded` flags) never touches `id`. Removal simply drops the entry from the array. There is no block-reorder UI anywhere in the editor (no move-up/down control, no drag) - blocks only ever get added at the end or removed by index, so the "on reorder" question is moot: nothing in the app can currently reorder a block. |
| 3 | Delete-template needs a second confirming tap, pinned by a test | True | `src/views/TemplatesView.tsx:276-283` (`handleDeleteClick`) requires `confirmDeleteId === t.id` before calling `actions.deleteTemplate`. Pinned by `src/views/TemplatesView.test.tsx:43-51`. Disarm: `onBlur={() => setConfirmDeleteId(prev => (prev === t.id ? null : prev))}` on line 373, exercised by the test at `TemplatesView.test.tsx:53-63` (arming, moving focus to Edit, then Cancel returns the button to plain "Delete"). |
| 4 | Save button `disabled` while name is blank | True | `src/views/TemplatesView.tsx:244`: `disabled={!draft.name.trim()}`. `.trim()` means a whitespace-only name ("   ") is also blank and also disables the button, not just a fully empty string. No dedicated test exercises this specific button's disabled state (whitespace or otherwise), but the code itself matches the claim exactly. |
| 5 | `aria-current`/`aria-pressed` present on nav tabs and theme control | True | Nav tabs: `src/App.tsx:62`, `aria-current={view === tab.view ? 'page' : undefined}`. Theme mode buttons: `src/views/ThemeModeControl.tsx:34`, `aria-pressed={mode === option.value}`. A full sweep of the app (see below) found every other single-choice/toggle control already carries the matching state attribute - nothing else is missing it. |
| 6 | Pre-paint script in `index.html` sets `data-theme` before the app's own script runs | Partly true | Ordering is correct: the `<script id="pre-paint-theme">` block sits in `<head>` (`index.html:16-402`) and runs synchronously before `<script type="module" src="/src/main.tsx">` in `<body>` (`index.html:406`) even parses. The whole body is wrapped in one `try { ... } catch (e) {}` (lines 42 and 401), so it cannot throw and block rendering. However, the claim's own text ("a unit test cannot observe a pre-paint script by its nature") is false: `src/preTheme.test.ts` extracts this exact script by its `id` attribute and runs it via `new Function()` against 14 scenarios (valid themes, corrupt JSON, non-object JSON, invalid theme values, non-string overrides, system-mode following live `matchMedia`), asserting its output equals the real `resolveTheme`/`applyResolvedTheme` pipeline's. The mechanism is verified correctly; the backlog's description of its own test coverage is out of date. |
| 7 | Tests added for `deleteTask`, `updateTemplate`, `setTheme`, `importData`, `subscribe` | True | All five exist in `src/lib/store.test.ts` and assert real behaviour rather than restating the implementation: `deleteTask` (lines 27-39, including a no-plan case that must not throw), `updateTemplate` (475-491, including a no-match no-op case), `setTheme` (573-589, asserts mode changes while preset/overrides/other settings are untouched), `importData` (686-701, both the replace path and the throw-on-invalid path that leaves the store untouched), `subscribe` (703-728, notification count and the unsubscribe function, plus a second test that one listener's unsubscribe does not affect another). |
| 8 | Focus moves into the template editor's name field on open, for both new and edit | True | `src/views/TemplatesView.tsx:79-87`: `TemplateEditor` owns `nameRef` and calls `nameRef.current?.focus()` in a mount-only `useEffect`. It is mounted fresh each time (`key={draft.id ?? 'new'}` at line 342), so the effect re-runs for every open. Pinned by `src/views/TemplatesView.test.tsx:13-18` (new) and `:20-26` (edit). |
| 9 | Month grid has `role="row"` wrappers and `role="columnheader"` weekday headers, pinned by two tests | True | `src/views/CalendarView.tsx:221-232`: weekday headers at line 228 (`role="columnheader"`), each week wrapped at line 226/232 (`role="row"`), cells at line 249 (`role="gridcell"`). Pinned by `src/views/CalendarView.test.tsx:27-47` (row/columnheader structure) and `:49-58` (each cell's accessible name is a real date, not a bare number). |

## Fresh sweep

- **`docs/BACKLOG.md`'s own claim about claim 6 is stale.** The text says "a unit test cannot observe
  a pre-paint script by its nature," but `src/preTheme.test.ts` does exactly that (see above). Not a
  code defect, just an inaccurate line in the backlog. Recommendation: correct that sentence, or drop
  it, so a future reader does not skip writing a test that already exists in spirit or assume there is
  a gap where there is not one.
- **`TODO`/`FIXME`/`XXX`/`HACK` comments:** none found anywhere in `src/`.
- **Commented-out code:** none found. Every block comment and line comment checked is prose, not dead
  code.
- **`console.log`/`console.warn`/`console.error` in a production path:** one hit,
  `src/ErrorBoundary.tsx:26`, `console.error('Dienius could not render this screen.', error, info)`
  inside `componentDidCatch`. This is the standard, intentional use of `console.error` in a React
  error boundary, not a leftover debug statement - no action needed.
- **`catch` blocks that swallow without explanation:** every `catch` in `src/` (checked in `App.tsx`,
  `ErrorBoundary.tsx`, `storage.ts`, `theme.ts`, `theme-override-warnings.ts`, `useSystemPrefersDark.ts`,
  `pwa.ts`, `SettingsView.tsx`, `draft.ts`) either forwards the failure (throws a clearer error,
  returns a fallback value the caller checks) or carries a comment explaining why swallowing is safe
  (e.g. `draft.ts:37-39`, `pwa.ts:13-16`). None found that swallow silently with no explanation.
- **Exported symbols nothing imports:**
  - `src/lib/themes.ts:100`, `SYSTEM_CONDENSED` - used only inside `themes.ts` itself (line 520).
  - `src/views/TemplatesView.tsx:12`, `TEMPLATE_COLORS` - used only inside `TemplatesView.tsx` itself.
  - `src/widgets/day-plan/capacity.ts:122`, `gapsInWindow` - used only inside `capacity.ts` itself.
  - `src/widgets/day-plan/TaskRow.tsx:9`, `pushCountLabel` - used only inside `TaskRow.tsx` itself.
  All four are real runtime exports (`function`/`const`) with no other file importing them - the
  `export` keyword is dead weight, not a defect, low priority.
  Recommendation: drop `export` from these four unless a near-term feature is about to need them
  from elsewhere.
  A broader scan of every exported `interface`/`type` (about 28) found the same "only used in its own
  file" pattern for most of them (e.g. `RolloverResult` in `store.ts`, `DayScore` in `score.ts`,
  `Capacity` in `capacity.ts`, `ResolvedTheme` in `theme.ts`). This is normal, idiomatic TypeScript -
  a function's return type does not need to be imported by name for callers elsewhere to get it
  through inference - so these are not treated as debt here.
- **Tests that assert nothing, or are skipped:** none found. No `.skip`, `.only`, or `test.todo`
  anywhere in `src/`. A handful of tests in `src/preTheme.test.ts` (lines 219-257) looked
  assertion-free on a first pass because they call a shared `expectAgreement()` helper rather than
  `expect(...)` directly - reading the helper (lines 56-64 of the same file) confirms it does perform
  a real `expect(...).toEqual(...)`, so these are genuine tests, not false coverage.

No item from the sweep is a live defect worth reopening; the two worth actually doing something about
are the stale sentence in claim 6 and the four dead exports, both cosmetic.
