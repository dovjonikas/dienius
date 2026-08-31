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
Tokens: `--font-display`, `--font-body`, `--font-mono`, `--font-hand`, `--radius`, `--edge`
(rounded rect vs hand-drawn irregular radius), `--shadow`.

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
- Type: system / rounded / mono / handwritten

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
   blue-pen accent, yellow highlighter, hand-drawn edges, one handwritten font for headers.
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

1. Refactor tokens into the three layers and move the current light/dark into two presets.
2. `src/lib/themes.ts` with the preset type and the first three presets as data.
3. Resolution pipeline plus the inline pre-paint script in `index.html`.
4. Theme gallery in Settings with real miniature previews.
5. Override panel with per-preset patches and reset.
6. `theme-color` and manifest sync.
7. The remaining presets.
8. Contrast unit test over the preset array.

Steps 1 to 4 are what makes it feel like a different app. Everything after is polish that can land
across separate sessions.
