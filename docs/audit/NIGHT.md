# The stylesheet, counted

> `npm run inventory`. Written by `scripts/stylesheet-inventory.mjs`, which reads
> `src/styles.css` rather than the rendered page: a rendered page shows what won,
> and this shows what was written, which is what gets tidied. The sweep is the
> other half and measures the page.

**Declared type steps:** --t-2xs, --t-focus, --t-focus-title, --t-glyph, --t-input, --t-lg, --t-md, --t-sm, --t-xl, --t-xs

**Declared spacing steps:** --s0, --s1, --s2, --s3, --s4, --s5, --s6, --s7, --s8

## Counts

- font-size declarations: **435**, of which literals: **0**
- distinct spacing values in use: **17**
- distinct border-radius values: **14**
- distinct border and outline values: **53**
- colour literals outside a token definition: **54** in **18** distinct values
- lines reading the accent: **217**
- transition and animation declarations: **96**, in **11** distinct durations
- keyframes: **20**

### Type

| value | uses |
| --- | --- |
| `var(--t-sm)` | 190 |
| `var(--t-xs)` | 121 |
| `var(--t-md)` | 64 |
| `var(--t-lg)` | 25 |
| `var(--t-glyph)` | 12 |
| `var(--t-2xs)` | 10 |
| `var(--t-input)` | 8 |
| `0` | 1 |
| `inherit` | 1 |
| `var(--t-focus-title)` | 1 |
| `var(--t-focus)` | 1 |
| `var(--t-xl)` | 1 |


### Spacing

| value | uses |
| --- | --- |
| `--s2` | 362 |
| `--s3` | 253 |
| `--s1` | 179 |
| `--s4` | 131 |
| `--s0` | 55 |
| `1px` | 24 |
| `--s5` | 22 |
| `3px` | 17 |
| `--s6` | 16 |
| `6px` | 14 |
| `--s8` | 13 |
| `--s7` | 8 |
| `0.75px` | 2 |
| `12px` | 1 |
| `18px` | 1 |
| `20px` | 1 |
| `48px` | 1 |

### Radius

| value | uses |
| --- | --- |
| `var(--r-control)` | 83 |
| `var(--r-card)` | 53 |
| `var(--r-pill)` | 50 |
| `var(--r-round)` | 38 |
| `var(--r-chip)` | 27 |
| `0` | 11 |
| `var(--r-card) var(--r-card) 0 0` | 8 |
| `1px` | 7 |
| `3px` | 3 |
| `inherit` | 2 |
| `0 0 var(--r-card) var(--r-card)` | 1 |
| `0 var(--r-chip) var(--r-chip) 0` | 1 |
| `var(--pv-edge)` | 1 |
| `var(--r-card) 0 0 var(--r-card)` | 1 |

### Borders and outlines

| value | uses |
| --- | --- |
| `1px solid var(--border)` | 137 |
| `2px solid var(--accent)` | 71 |
| `1px solid transparent` | 13 |
| `1px dashed var(--border)` | 8 |
| `1px solid color-mix(in srgb, var(--border) 70%, transparent)` | 8 |
| `1px solid color-mix(in srgb, var(--border) 60%, transparent)` | 6 |
| `1px solid color-mix(in srgb, var(--border) 55%, transparent)` | 5 |
| `2px solid transparent` | 4 |
| `1.5px solid currentColor` | 2 |
| `1.5px solid var(--accent)` | 2 |
| `1.5px solid var(--muted)` | 2 |
| `1px dashed color-mix(in srgb, var(--cal, var(--muted)) 70%, transparent)` | 2 |
| `2px dashed var(--accent)` | 2 |
| `2px solid var(--border)` | 2 |
| `4px solid transparent` | 2 |
| `solid currentColor` | 2 |
| `1.5px dashed var(--muted)` | 1 |
| `1.5px solid var(--safe-ink)` | 1 |
| `1px dashed color-mix(in srgb, var(--block, var(--accent)) 70%, transparent)` | 1 |
| `1px dashed color-mix(in srgb, var(--border) 50%, transparent)` | 1 |
| `1px dashed var(--accent)` | 1 |
| `1px solid color-mix(in srgb, var(--accent) 22%, var(--border))` | 1 |
| `1px solid color-mix(in srgb, var(--accent) 45%, transparent)` | 1 |
| `1px solid color-mix(in srgb, var(--border) 28%, transparent)` | 1 |
| `1px solid color-mix(in srgb, var(--border) 45%, transparent)` | 1 |
| `1px solid color-mix(in srgb, var(--border) 50%, transparent)` | 1 |
| `1px solid color-mix(in srgb, var(--border) 62%, transparent)` | 1 |
| `1px solid color-mix(in srgb, var(--cat, var(--accent)) 35%, var(--border))` | 1 |
| `1px solid color-mix(in srgb, var(--chip, var(--accent)) 45%, var(--border))` | 1 |
| `1px solid color-mix(in srgb, var(--mark) 55%, var(--border))` | 1 |
| `1px solid rgba(255, 255, 255, 0.35)` | 1 |
| `1px solid var(--accent)` | 1 |
| `1px solid var(--muted)` | 1 |
| `1px solid var(--pv-border)` | 1 |
| `2px dashed color-mix(in srgb, var(--border) 90%, transparent)` | 1 |
| `2px dashed color-mix(in srgb, var(--cat) 70%, var(--text))` | 1 |
| `2px solid color-mix(in srgb, var(--muted) 55%, var(--border))` | 1 |
| `2px solid var(--block, var(--accent))` | 1 |
| `2px solid var(--cal, var(--muted))` | 1 |
| `2px solid var(--cat, var(--border))` | 1 |
| `3px solid color-mix(in srgb, var(--accent) 55%, var(--border))` | 1 |
| `3px solid color-mix(in srgb, var(--mark) 70%, transparent)` | 1 |
| `3px solid color-mix(in srgb, var(--mark) 70%, var(--border))` | 1 |
| `3px solid transparent` | 1 |
| `3px solid var(--block, transparent)` | 1 |
| `3px solid var(--cal, var(--muted))` | 1 |
| `3px solid var(--cat)` | 1 |
| `4px solid var(--cat, var(--accent))` | 1 |
| `4px solid var(--cat, var(--border))` | 1 |
| `4px solid var(--cat)` | 1 |
| `5px solid currentColor` | 1 |
| `solid var(--good)` | 1 |
| `solid var(--on-accent, #fff)` | 1 |

### Colour literals

| value | uses |
| --- | --- |
| `#fff` | 20 |
| `rgba(0, 0, 0, 0.6)` | 6 |
| `rgba(0, 0, 0, 0.45)` | 5 |
| `rgba(0, 0, 0, 0.62)` | 5 |
| `rgba(0, 0, 0, 0.35)` | 3 |
| `#d9705f` | 2 |
| `rgba(0, 0, 0, 0.55)` | 2 |
| `#000` | 1 |
| `#3f9fae` | 1 |
| `#4fa46a` | 1 |
| `#5b8ae6` | 1 |
| `#8a9439` | 1 |
| `#9b7bd8` | 1 |
| `#bd7f30` | 1 |
| `#d1698f` | 1 |
| `rgba(0, 0, 0, 0.65)` | 1 |
| `rgba(0, 0, 0, 0.7)` | 1 |
| `rgba(0, 0, 0, 0.85)` | 1 |

#### where

- L1015 `background`: `#fff`
- L1078 `color`: `#fff`
- L2115 `color`: `rgba(0, 0, 0, 0.7)`
- L2465 `background`: `rgba(0, 0, 0, 0.35)`
- L3004 `box-shadow`: `rgba(0, 0, 0, 0.45)`
- L3098 `color`: `#fff`
- L3106 `background`: `#fff`
- L4313 `color`: `#fff`
- L4654 `color`: `#fff`
- L4688 `color`: `#fff`
- L4935 `color`: `rgba(0, 0, 0, 0.65)`
- L5123 `background`: `rgba(0, 0, 0, 0.35)`
- L5248 `background`: `rgba(0, 0, 0, 0.35)`
- L6267 `color`: `#fff`
- L6526 `color`: `#fff`
- L6546 `background`: `#fff`
- L6585 `color`: `#fff`
- L6588 `background`: `#000`
- L6699 `color`: `#fff`
- L8593 `background`: `rgba(0, 0, 0, 0.62)`
- L8624 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L8806 `box-shadow`: `rgba(0, 0, 0, 0.55)`
- L9265 `background`: `rgba(0, 0, 0, 0.45)`
- L9283 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L9777 `background`: `rgba(0, 0, 0, 0.45)`
- L9793 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L10149 `background`: `rgba(0, 0, 0, 0.62)`
- L10174 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L10752 `color`: `#fff`
- L11064 `background`: `#d9705f`
- L11064 `background`: `#bd7f30`
- L11064 `background`: `#8a9439`
- L11064 `background`: `#4fa46a`
- L11064 `background`: `#3f9fae`
- L11064 `background`: `#5b8ae6`
- L11064 `background`: `#9b7bd8`
- L11064 `background`: `#d1698f`
- L11064 `background`: `#d9705f`
- L12382 `color`: `#fff`
- L12599 `background`: `rgba(0, 0, 0, 0.62)`
- L12615 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L12818 `background`: `rgba(0, 0, 0, 0.62)`
- L12833 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L13015 `color`: `#fff`
- L13203 `box-shadow`: `rgba(0, 0, 0, 0.45)`
- L15178 `color`: `#fff`
- L15353 `background`: `rgba(0, 0, 0, 0.55)`
- L15354 `color`: `#fff`
- L15413 `background`: `rgba(0, 0, 0, 0.85)`
- L15432 `color`: `#fff`
- L15450 `color`: `#fff`
- L15456 `color`: `#fff`
- L15519 `background`: `rgba(0, 0, 0, 0.45)`
- L15840 `background`: `rgba(0, 0, 0, 0.62)`

### Movement

| value | uses |
| --- | --- |
| `--dur-fast` | 59 |
| `--dur` | 35 |
| `0.25s` | 1 |
| `0.35s` | 1 |
| `0.42s` | 1 |
| `1.6s` | 1 |
| `1s` | 1 |
| `220ms` | 1 |
| `240ms` | 1 |
| `260ms` | 1 |
| `500ms` | 1 |

### Keyframes

| value | uses |
| --- | --- |
| `clock-pulse` | 1 |
| `detail-in` | 1 |
| `detail-scrim-in` | 1 |
| `empty-state-in` | 1 |
| `explain-in` | 1 |
| `float-in` | 1 |
| `focus-bar-in` | 1 |
| `north-open` | 1 |
| `pop` | 1 |
| `popover-in` | 1 |
| `reminder-in` | 1 |
| `sheet-in` | 1 |
| `task-enter` | 1 |
| `task-leave` | 1 |
| `tick-draw` | 1 |
| `time-picker-in` | 1 |
| `tour-card-in` | 1 |
| `tour-tick-burst` | 1 |
| `undo-in` | 1 |
| `update-notice-in` | 1 |

### The accent, line by line

- L379 `radial-gradient(1100px 460px at 50% -10%, color-mix(in srgb, var(--accent) var(--vignette), transparent), tran`
- L655 `background: var(--accent);`
- L660 `outline: 2px solid var(--accent);`
- L797 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L803 `outline: 2px solid var(--accent);`
- L913 `--pick: var(--swatch, var(--accent));`
- L953 `box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--pick, var(--accent));`
- L970 `outline: 2px solid var(--accent);`
- L977 `background: linear-gradient(135deg, var(--accent) 0 48%, var(--surface-raised) 48% 52%, var(--accent) 52% 100%`
- L996 `background: var(--accent);`
- L997 `border-color: var(--accent);`
- L1018 `outline: 2px solid var(--accent);`
- L1077 `background: var(--accent);`
- L1125 `border-color: var(--accent);`
- L1126 `box-shadow: 0 0 0 2px var(--accent);`
- L1130 `outline: 2px solid var(--accent);`
- L1467 `background: var(--accent);`
- L1600 `border: 1px solid color-mix(in srgb, var(--chip, var(--accent)) 45%, var(--border));`
- L1602 `background: color-mix(in srgb, var(--chip, var(--accent)) 12%, var(--surface));`
- L1658 `.timeline-toggle[aria-expanded='true'] { border-color: var(--accent); }`
- L1863 `outline: 2px solid var(--accent);`
- L1873 `border: 1.5px solid var(--accent);`
- L1874 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L2338 `.day-future .timeline-gap { background: color-mix(in srgb, var(--accent) 6%, transparent); }`
- L2423 `border-top: 1px dashed var(--accent);`
- L2439 `border: 1px solid var(--accent);`
- L2442 `color: var(--accent);`
- L2520 `outline: 2px solid var(--accent);`
- L2557 `outline: 2px solid var(--accent);`
- L2580 `color: var(--accent);`
- L2585 `outline: 2px solid var(--accent);`
- L2600 `outline: 2px solid var(--accent);`
- L2872 `outline: 2px solid var(--accent);`
- L2874 `border-color: var(--accent);`
- L2933 `border-color: var(--accent);`
- L2934 `outline: 2px solid var(--accent);`
- L3097 `background: var(--accent);`
- L3109 `outline: 2px solid var(--accent);`
- L3173 `.setting-quiet:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L3175 `.setting-remove:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L3215 `outline: 2px solid var(--accent);`
- L3217 `border-color: var(--accent);`
- L3241 `.time-stepper:focus-within { border-color: var(--accent); }`
- L3259 `.time-stepper:focus-within { outline: 2px solid var(--accent); outline-offset: -1px; }`
- L3328 `.time-step:active { background: color-mix(in srgb, var(--accent) 20%, transparent); }`
- L3331 `outline: 2px solid var(--accent);`
- L3453 `outline: 2px solid var(--accent);`
- L3558 `.category-edit:hover { border-color: var(--accent); color: var(--text); }`
- L3598 `outline: 2px solid var(--accent);`
- L3826 `background: var(--accent);`
- L3827 `border-color: var(--accent);`
- L3833 `outline: 2px solid var(--accent);`
- L3855 `background: var(--accent);`
- L3856 `border-color: var(--accent);`
- L3866 `outline: 2px solid var(--accent);`
- L4006 `outline: 2px solid var(--accent);`
- L4017 `background: color-mix(in srgb, var(--accent) 16%, transparent);`
- L4018 `outline: 1.5px solid var(--accent);`
- L4068 `outline: 2px solid var(--accent);`
- L4140 `outline: 2px solid var(--accent);`
- L4182 `outline: 2px solid var(--accent);`
- L4283 `outline: 2px solid var(--accent);`
- L4310 `background: var(--accent);`
- L4384 `outline: 2px solid var(--accent);`
- L4407 `outline: 2px solid var(--accent);`
- L4480 `outline: 2px solid var(--accent);`
- L4652 `background: var(--accent);`
- L4653 `border-color: var(--accent);`
- L4686 `background: var(--accent);`
- L4687 `border-color: var(--accent);`
- L4896 `outline: 2px solid var(--accent);`
- L4943 `outline: 2px solid var(--accent);`
- L4997 `outline: 2px solid var(--accent);`
- L5000 `.cell.staged { outline: 2px dashed var(--accent); outline-offset: -2px; }`
- L5003 `outline: 2px solid var(--accent);`
- L5019 `background: color-mix(in srgb, var(--chip, var(--accent)) 16%, var(--surface));`
- L5020 `box-shadow: inset 0 3px 0 var(--chip, var(--accent));`
- L5181 `outline: 2px solid var(--accent);`
- L5231 `outline: 2px solid var(--accent);`
- L5306 `outline: 2px solid var(--accent);`
- L5353 `outline: 2px solid var(--accent);`
- L5377 `color: var(--accent);`
- L5382 `outline: 2px solid var(--accent);`
- L5438 `outline: 2px solid var(--accent);`
- L5483 `stroke: var(--cat, var(--accent));`
- L5582 `background: color-mix(in srgb, var(--accent) 18%, transparent);`
- L5589 `.undo-toast-button:hover { background: color-mix(in srgb, var(--accent) 32%, transparent); }`
- L5592 `outline: 2px solid var(--accent);`
- L5770 `outline: 2px solid var(--accent);`
- L5845 `.clock-preset:hover { border-color: var(--accent); }`
- L5851 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L5852 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L5856 `outline: 2px solid var(--accent);`
- L6024 `.clock-volume input[type='range'] { flex: 1 1 auto; min-width: 0; accent-color: var(--accent); }`
- L6176 `outline: 2px solid var(--accent);`
- L6203 `stroke: var(--accent);`
- L6265 `background: var(--accent);`
- L6266 `border-color: var(--accent);`
- L6272 `outline: 2px solid var(--accent);`
- L6345 `background: color-mix(in srgb, var(--accent) 20%, transparent);`
- L6366 `background: color-mix(in srgb, var(--accent) 16%, transparent);`
- L6392 `border: 1px solid color-mix(in srgb, var(--cat, var(--accent)) 35%, var(--border));`
- L6393 `border-left: 4px solid var(--cat, var(--accent));`
- L6395 `background: color-mix(in srgb, var(--cat, var(--accent)) 8%, var(--surface));`
- L6418 `stroke: var(--cat, var(--accent));`
- L6426 `color: color-mix(in srgb, var(--cat, var(--accent)) 30%, var(--muted));`
- L6478 `outline: 2px solid var(--accent);`
- L6524 `background: var(--accent);`
- L6525 `border-color: var(--accent);`
- L6539 `background: color-mix(in srgb, var(--accent) 25%, var(--surface));`
- L6546 `button.primary:hover { background: color-mix(in srgb, var(--accent) 84%, #fff); }`
- L6601 `outline: 2px solid var(--accent);`
- L6696 `background: var(--accent);`
- L6705 `outline: 2px solid var(--accent);`
- L7168 `background: color-mix(in srgb, var(--accent) 18%, transparent);`
- L7677 `.mini-cell.today { border-color: var(--accent); border-width: 2px; }`
- L7682 `.mini-cell.viewing { outline: 2px dashed var(--accent); outline-offset: -2px; }`
- L7688 `background: color-mix(in srgb, var(--chip, var(--accent)) 30%, var(--surface));`
- L7689 `box-shadow: inset 0 2px 0 var(--chip, var(--accent));`
- L7693 `outline: 2px solid var(--accent);`
- L8038 `.library-amount:focus-within { border-color: var(--accent); }`
- L8124 `.library-item-grip:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L8136 `.library-item.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L8171 `background: var(--accent);`
- L8250 `.library-schedule button:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }`
- L8360 `.block-add-open:hover { border-color: var(--accent); color: var(--text); }`
- L8363 `outline: 2px solid var(--accent);`
- L8391 `outline: 2px solid var(--accent);`
- L8472 `.library-quick-word:hover { border-color: var(--accent); color: var(--text); }`
- L8476 `outline: 2px solid var(--accent);`
- L8950 `.note-section-button:hover { border-color: var(--accent); }`
- L9003 `.note-reader-tab.is-on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transp`
- L9020 `.task-library { background: color-mix(in srgb, var(--accent) 16%, transparent); }`
- L9138 `background: var(--chip, var(--accent));`
- L9142 `.template-chip:hover { border-color: color-mix(in srgb, var(--chip, var(--accent)) 60%, var(--border)); }`
- L9146 `border-color: color-mix(in srgb, var(--chip, var(--accent)) 70%, var(--border));`
- L9147 `background: color-mix(in srgb, var(--chip, var(--accent)) 14%, var(--surface));`
- L9152 `outline: 2px solid var(--accent);`
- L9699 `.review-bar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L9719 `.review-bar-done { background: color-mix(in srgb, var(--accent) 70%, transparent); }`
- L9840 `.palette-row.is-selected { background: color-mix(in srgb, var(--accent) 20%, transparent); }`
- L9996 `outline: 2px solid var(--accent);`
- L10169 `border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));`
- L10170 `border-left: 3px solid color-mix(in srgb, var(--accent) 55%, var(--border));`
- L10172 `background: color-mix(in srgb, var(--accent) 6%, var(--surface));`
- L10228 `.north-card-ok:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L10350 `.north-compose-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L10465 `outline: 2px solid var(--accent);`
- L11021 `.category-row.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L11082 `.category-wheel:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; }`
- L11293 `background: var(--accent);`
- L11355 `.cell-tone-mid .cell-bar-fill { background: color-mix(in srgb, var(--accent) 70%, var(--muted)); }`
- L11547 `.week-col.is-today .week-col-day { color: var(--accent); }`
- L11548 `.week-col.is-today .week-col-date { color: var(--accent); }`
- L11612 `.week-col-template.is-offer:hover { border-color: var(--accent); color: var(--text); }`
- L11714 `border-color: color-mix(in srgb, var(--accent) 45%, transparent);`
- L11715 `background: color-mix(in srgb, var(--accent) 5%, var(--surface));`
- L11734 `background: var(--accent);`
- L11762 `background: color-mix(in srgb, var(--block, var(--accent)) 32%, var(--surface));`
- L11763 `border-left: 2px solid var(--block, var(--accent));`
- L11777 `.week-block:hover { background: color-mix(in srgb, var(--block, var(--accent)) 46%, var(--surface)); }`
- L11782 `background: color-mix(in srgb, var(--block, var(--accent)) 12%, var(--surface));`
- L11791 `.week-block.is-key { box-shadow: inset 0 0 0 1px var(--accent); }`
- L12057 `border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);`
- L12059 `background: color-mix(in srgb, var(--accent) 10%, var(--surface));`
- L12068 `background: var(--accent);`
- L12082 `color: var(--accent);`
- L12115 `color: var(--accent);`
- L12322 `border: 2px solid var(--accent);`
- L12324 `box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);`
- L12381 `background: var(--accent);`
- L12397 `border-color: var(--good, var(--accent));`
- L12398 `box-shadow: 0 0 0 6px color-mix(in srgb, var(--good, var(--accent)) 30%, transparent);`
- L12418 `.tour-dot.is-past { background: color-mix(in srgb, var(--accent) 55%, var(--border)); }`
- L12419 `.tour-dot.is-now { background: var(--accent); transform: scale(1.35); }`
- L12686 `.scratch-note.is-pinned { background: color-mix(in srgb, var(--accent) 8%, transparent); }`
- L12698 `color: var(--accent);`
- L12898 `.replan-choice:hover { border-color: var(--accent); }`
- L12932 `.replan-key { color: var(--accent); margin-right: var(--s1); font-weight: 700; }`
- L13013 `background: var(--accent);`
- L13014 `border-color: var(--accent);`
- L13075 `.replan-row-button[aria-expanded='true'] { border-color: var(--accent); }`
- L13175 `outline: 2px solid var(--accent);`
- L13245 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13246 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L13292 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13293 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L13422 `.later-item.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L13476 `.later-item-plan:hover { color: var(--text); border-color: var(--accent); }`
- L13504 `outline: 2px solid var(--accent);`
- L13594 `.library-chip:hover { border-color: var(--accent); }`
- L13660 `.library-preset:hover { border-color: var(--accent); }`
- L13692 `--pick: var(--dot, var(--accent));`
- L13717 `.library-item-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(-`
- L13966 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13967 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L14492 `background: var(--accent);`
- L14493 `border-color: var(--accent);`
- L14509 `outline: 2px solid var(--accent);`
- L14626 `outline: 2px solid var(--accent);`
- L14642 `background: var(--accent);`
- L14720 `.agenda-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L14810 `border-color: var(--accent);`
- L14814 `.later-strip-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L14888 `.wt-column.is-active { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }`
- L14910 `.wt-day:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L15047 `.wt-col.is-active .week-track { background: color-mix(in srgb, var(--accent) 5%, transparent); }`
- L15054 `border: 1px dashed color-mix(in srgb, var(--block, var(--accent)) 70%, transparent);`
- L15056 `background: color-mix(in srgb, var(--block, var(--accent)) 18%, transparent);`
- L15100 `.wt-untimed-block.is-open { border-style: solid; border-color: var(--accent); color: var(--text); }`
- L15104 `.week-block.is-open { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L15176 `border-color: var(--accent);`
- L15177 `background: var(--accent);`
- L15285 `background: color-mix(in srgb, var(--accent) 55%, var(--border));`
- L15494 `color: var(--accent);`
- L15564 `.scratch-note-action.is-linked { color: var(--accent); }`
- L15965 `outline: 2px solid var(--accent);`
