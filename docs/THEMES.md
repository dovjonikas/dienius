# Dienius - the theme system

> Written 2026-08-31 as a spec for the next build session. This is the feature the app is judged on
> before anyone reads a single word of copy: someone sees it on a friend's phone and asks what it is.
> Everything below is design intent plus the concrete shape to build. No em-dashes anywhere, plain
> "-" only, English throughout, same as the rest of the repo.

## 1. The idea in one paragraph

A theme is not a colour swap. A theme is a **room**. It sets the surface you write on (paper, its
grain, its ruling), the ink you write with, the accent that marks what matters, and the type. One
tap picks a whole room. After that, every individual piece can still be changed by hand, and those
manual changes survive switching rooms and coming back.

The reference is the journal dashboard's Sketchbook theme: a dark squared notebook, blue-pen accent,
yellow highlighter for what matters today, hand-drawn irregular borders. It works because the
background is a real surface rather than a flat fill, and because the colours come off a physical
desk instead of a palette generator.

## 2. Architecture - three layers, kept separate

The single most important decision here. Do not collapse these into one blob.

**Layer 1 - SURFACE.** The page itself. Base colour, texture, ruling.
Tokens: `--bg`, `--surface`, `--rule`, `--rule-size`, `--grain`, `--vignette`, `--border`.

**Layer 2 - PALETTE.** The marks made on the surface.
Tokens: `--text`, `--muted`, `--accent`, `--accent-dim`, `--mark` (the highlighter), `--danger`,
`--good`, plus the template-colour swatch set.

**Layer 3 - TYPE + SHAPE.** How it is drawn.
Tokens: `--font-display`, `--font-body`, `--font-mono`, `--radius`, `--edge`
(rounded rect vs hand-drawn irregular radius), `--shadow`.

No script, handwritten, or novelty face on any token, ever - this reverses the `--font-hand` token
this section originally specified. The owner reads every screen with an ADHD brain, and both he and
an independent review flagged the same problem from opposite sides: it did not look like a
professional planner, and the actual font stack backing it resolved to Comic Sans on most
non-Apple devices. A theme's personality belongs to the surface and the palette, which is the part
that was already carrying it - not to decorative type. A header may use a distinctive face only
when it is a well-crafted, professional, highly readable one; a good serif or a good mono is fair
game, a script is not.

A **preset** is a named object that fills all three layers at once. A **user override** is a sparse
patch on top: `{ accent: '#e0553b' }` and nothing else. Resolution order at paint time:

```
defaults  ->  preset  ->  user overrides  ->  live CSS custom properties on :root
```

Store the preset id and the override patch separately in `Settings`. Never write the resolved
values into storage, or changing a preset later will not reach anyone who already used it.

```ts
export interface ThemeOverrides { [token: string]: string }

export interface ThemeState {
  presetId: string
  overrides: ThemeOverrides     // sparse, usually empty
  mode: 'light' | 'dark' | 'system'
}
```

Presets live in code (`src/lib/themes.ts`) as data, not CSS. That way the picker can render swatches
from the same source of truth and the whole set is one array to grow.

## 3. How the picker behaves

**The gallery.** A grid of preview cards, each one a real miniature of the app - a scrap of the
actual surface with its ruling, two lines of text in the theme's type, one accent chip, one
highlighted item. Not a colour circle. The card must show the ROOM.

**One tap applies everything** and the whole app transitions to it. Instant, no confirm step, no
save button. Wrong choice costs one more tap.

**Below the gallery: "Adjust this theme".** Collapsed by default so the normal path stays one tap.
Opened, it lists the individual tokens that are actually worth changing, each with the preset value
pre-filled:

- Accent (the primary colour)
- Highlight (the marker)
- Paper / background
- Text
- Ruling: none / lines / squares, plus its spacing and opacity
- Corners: soft / sharp / hand-drawn
- Type: system / rounded / mono / serif (all professional, highly readable faces - no script or
  novelty option; see section 2's note on why `--font-hand` was removed)

Every control writes ONE token into `overrides`. A "Reset to preset" button clears the patch. A
changed token shows a small dot next to its label so it is obvious what you moved.

**Overrides are per preset**, keyed by preset id. If he makes the Sketchbook accent orange, then
tries three other rooms and comes back, Sketchbook is still orange. This is the detail that makes it
feel like his app rather than a settings screen.

## 4. Light and dark

Every preset ships BOTH variants. Mode is separate from preset: preset says which room, mode says
whether the light is on. Default mode is `system` and follows `prefers-color-scheme` live.

A preset that only makes sense in one mode (a very dark ink theme, for example) declares
`modes: ['dark']` and the mode toggle disables gracefully rather than producing a broken light
version. Better to ship one honest mode than two where one is bad.

## 5. The surface layer - how to make paper look like paper

This is what separates it from every flat-colour app.

**Ruling** as repeating gradients, exactly like the journal does it:

```css
background:
  repeating-linear-gradient(0deg, var(--rule) 0 1px, transparent 1px var(--rule-size)) fixed,
  repeating-linear-gradient(90deg, var(--rule) 0 1px, transparent 1px var(--rule-size)) fixed,
  var(--bg);
```

Squares use both axes, lines use only the first, plain uses neither. `--rule-size` around 28px feels
like a notebook; below 20px it turns into noise on a phone.

**Grain.** A single tiling SVG noise as a data URI at very low opacity, one layer, no images. It is
the difference between "a colour" and "a material". Keep it under 4 percent opacity or it reads as a
dirty screen.

**Vignette.** One soft radial gradient at the top, tinted with the accent at about 7 percent. The
journal uses this and it is why the page has a light source.

**Hand-drawn edges.** Irregular border radii read as pen rather than a component:

```css
.edge-hand { border-radius: 225px 14px 255px 15px / 15px 255px 14px 225px; }
```

Two or three variants alternated across cards stop it looking like a repeated shape.

Performance note: `background-attachment: fixed` is expensive on iOS Safari when the page scrolls.
Put the surface on a fixed full-screen pseudo-element behind the content instead, with
`pointer-events: none`. Test it on a real phone with a long day list before shipping.

## 6. The starter set - build all of these, he will cut what does not land

Ship many and let him delete. Each one needs a real identity, not a hue rotation.

1. **Sketchbook (dark)** - the journal's own. Near-black blue-grey paper, faint blue squares,
   blue-pen accent, yellow highlighter, hand-drawn edges, a professional serif on headers only
   (not a handwritten face - see section 2's note; the room's character comes from the paper and
   the ink, the type just needs to stay out of the way and stay legible).
2. **Sketchbook (light)** - cream paper, grey-blue squares, same blue pen, same marker.
3. **Graph** - cool white, fine cyan squares, sharp corners, mono type throughout. Engineer's pad.
4. **Legal pad** - warm yellow paper, horizontal blue lines, red left margin rule, dark ink.
5. **Moleskine** - unruled ivory, no grid, warm shadow, serif display, generous margins. The calm one.
6. **Blueprint** - deep blue ground, white hairline grid, white and cyan ink, technical mono.
7. **Terminal** - true black, no ruling, green or amber phosphor accent, mono everything, sharp
   corners. The one that gets screenshotted.
8. **Newsprint** - grey-white, visible grain, black ink, red accent, condensed display type.
9. **Slate** - dark grey, no ruling, single warm accent, soft radius. The neutral fallback that
   never gets in the way.
10. **Receipt** - narrow feel, off-white, dotted-matrix mono, black ink, one red stamp accent.
11. **Ink and wash** - white paper, one desaturated blue-grey accent, thin lines, lots of air.
12. **Midnight** - deep indigo, faint star-field grain, violet accent. The late-night one.

Numbers 1, 2, 5, 7 and 9 are the safest bets. The rest exist so he can see the range and throw half
away.

## 7. Phone first - this is where it gets judged

- Preview cards in a 2-column grid at 375px, each at least 150px tall so the surface is actually
  visible. One column is too slow to browse, three is too small to read.
- Theme switching must not flash. Set `data-theme` and the token block on `document.documentElement`
  in a tiny inline script in `index.html` BEFORE React mounts, reading straight from localStorage.
  Otherwise a dark-theme user gets a white frame on every launch. The repo already has this problem
  flagged in the ledger for the current theme toggle - fix it here at the same time.
- `<meta name="theme-color">` must be updated live to the theme's `--bg` so the iOS status bar and
  the Android task switcher match the app. This is a two-line change and it is most of why an app
  looks native.
- The PWA manifest needs `background_color` and `theme_color` too. If the theme is user-selectable,
  write the current one into the manifest link at runtime.
- Respect `prefers-reduced-motion`: no cross-fade on theme change for those users.
- Respect `prefers-reduced-transparency` and skip grain for those users.
- Every preset must pass a contrast check before it ships: body text at least 4.5:1 against its own
  surface, accent at least 3:1. Write it as a unit test over the preset array so a bad theme cannot
  be merged. This is also the exact kind of detail that reads as professional in a portfolio repo.

## 8. What makes someone ask about it

Three things, in this order.

**The surface.** Everything else on a phone is a flat rectangle. Ruled paper with grain is not, and
it is visible from across a table.

**The transition.** Changing theme should feel like turning a page, not like a re-render. A 200ms
crossfade on the token values, nothing sliding.

**One unexpected touch per theme.** The red margin line on the legal pad. The phosphor glow on
terminal. The torn edge on newsprint. One detail that was clearly chosen by a person.

What kills it: too many accents at once, drop shadows on everything, gradients on buttons, and
themes that are the same layout in a different hue.

## 9. Build order

1. [x] Refactor tokens into the three layers and move the current light/dark into two presets.
2. [x] `src/lib/themes.ts` with the preset type and the first three presets as data.
3. [x] Resolution pipeline plus the inline pre-paint script in `index.html`.
4. [x] Theme gallery in Settings with real miniature previews.
5. [x] Override panel with per-preset patches and reset.
6. [x] `theme-color` and manifest sync.
7. [x] The remaining presets.
8. [x] Contrast unit test over the preset array.

Steps 1, 2, 3 and 8 landed together as the architecture phase: the three-layer token structure,
Slate and Sketchbook as data (both variants each), the full resolution pipeline including the
pre-paint script, and the contrast check over the preset array.

Step 4 landed next: the gallery grid in Settings (`src/views/ThemeGallery.tsx`,
`src/views/ThemePreviewCard.tsx`), each card a miniature room built from `buildPreviewStyle` in
`src/lib/theme-preview.ts` off the same `ThemeVariant` data the app itself resolves from - ruling,
vignette, grain, accent chip and highlighter tag all present, scoped under `--pv-*` custom
properties so a card never touches the live tokens painting the rest of the page. The old bare
mode-only segmented control is gone; `src/views/ThemeModeControl.tsx` replaces it, still light/
dark/system, now disabling whichever of light or dark the active preset does not ship rather than
offering a broken variant - the one control this phase leaves in Settings, not two competing ones.

Step 6 also landed: `theme-color` sync already existed before step 4 and reads the resolved `--bg`
directly. `src/lib/manifest-sync.ts` adds the manifest half - it rewrites the `<link rel="manifest">`
href to a blob url carrying the resolved background on every theme change. Read that file's own
comment for the honest limit: an OS reads and caches a PWA's manifest once, at install time, for the
splash screen it shows before the page paints - nothing a running page does can reach back into an
already-installed home screen icon and change that. What this actually buys is real but narrower:
the browser's install prompt reads the manifest link's current href at the moment of install, so a
person who tries a theme and then installs (or reinstalls after switching) gets a splash screen and
initial status bar that already match it.

Steps 1 to 4 are what makes it feel like a different app. Everything after is polish that can land
across separate sessions.

Step 5 landed next: "Adjust this theme" in `src/views/ThemeOverridePanel.tsx`, a collapsed-by-default
disclosure below the mode control. It reads and writes through `actions.setThemeOverride`/
`resetThemeOverrides`, which the architecture phase already built and left unused. Controls are
grouped under four subheadings (Colors, Ruling, Corners, Type) rather than laid out as one flat list,
and Ruling's spacing and opacity controls only render once a ruling style is actually chosen - both
are there specifically to keep a panel that can reach nine individual controls from reading as the
wall of controls section 3 warns against. Every control still writes exactly one token.

Type offers `system / rounded / mono / serif`, not the `handwritten` option an earlier draft of this
section named. This follows directly from section 2's rule, settled during the architecture phase's
fix pass: no script, handwritten, or novelty face on any token, anywhere, ever - not because a
handwritten face cannot look good, but because the owner reads every screen with an ADHD brain, and a
script face already had to be pulled back out of Sketchbook once (see section 2's note) for failing
that bar in practice on real devices. A user-facing font control that let someone pick a handwritten
face back in would reopen exactly the readability problem the rest of the token system was rewritten
to close. All four options this control does offer are the same known-good, professional stacks
already proven inside `themes.ts` - nothing new was invented for the panel.

A user can now set an accent or text color by hand, which means a user can now build a preset that
fails the merge-time contrast gate on purpose or by accident. Silently allowing that contradicts "text
must always look professional and stay highly readable"; hard-blocking the color picker contradicts
the app being genuinely his to reshape. The panel warns, honestly and by name, without ever refusing
the write - see `src/lib/theme-override-warnings.ts`, which runs the exact same 4.5:1 text / 3:1 accent
thresholds theme-contrast.test.ts enforces at merge time, against both `--surface` and `--bg`, the
moment a hand-picked color would fail them.

Step 7 landed last: the nine remaining presets from section 6 - Graph, Legal pad, Moleskine,
Blueprint, Terminal, Newsprint, Receipt, Ink and wash, Midnight - joining Slate and Sketchbook for an
even dozen. Full detail, including each preset's own identity, its one unexpected touch, and the
browser pass that checked every one of them at 375px and desktop, is in the phase report
(`.superpowers/sdd/2026-08-31-dienius-mvp/themes-phase-d-report.md`). The short version:

**Modes shipped, and why.** Graph ships both light and dark - a drafting table and a CAD screen at
night are both real rooms for an engineer's grid, not one room with its colours inverted. Six presets
ship one mode only, each an honest call rather than a manufactured symmetry: Legal pad, Moleskine,
Newsprint, Receipt and Ink and wash are all physical paper products that are light by definition - a
"dark legal pad" or "dark receipt" is not a real object, the same way section 6 itself already ruled
out a light Terminal. Blueprint, Terminal and Midnight are dark only for the opposite reason - each
one's whole identity depends on the dark ground (a blueprint's own deep blue, a CRT's black, a night
sky), so a light variant would stop being that preset and start being a different one (a light
Blueprint is just Graph again).

**The one new token.** `--margin` joins the surface layer - a single vertical accent rule at a fixed
offset from the left edge, transparent by default, a real colour only on Legal pad, drawn through one
more shared gradient layer in `body::before`/`.theme-card-room::before` exactly like `--rule` already
is. This was the one touch from section 8's own examples ("the red margin line on the legal pad") that
genuinely could not be built as a value choice on an existing token - every other preset's unexpected
touch (Terminal's phosphor glow, Blueprint's light-table glow, Graph's crisp drafting hairline,
Moleskine's warm two-layer shadow, Newsprint's masthead rule, Ink and wash's soft diffuse wash,
Midnight's violet bloom, Receipt's red stamp standing in for the highlighter role) rides entirely on
`--shadow`, `--mark`, or a font/edge choice already in the system.

**One limitation named rather than papered over.** Receipt's "narrow feel" (section 6 item 10) is only
partly real - the mono type and tight ruling rhythm evoke it, but the app's own column width is not a
themeable token in this architecture, so no preset can actually narrow the layout without a per-theme
layout hack the assignment rules out. The phase report says this plainly rather than claiming the full
effect.

Build order is now complete.
