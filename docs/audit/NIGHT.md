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
- distinct border-radius values: **12**
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
| `var(--r-mark)` | 37 |
| `0` | 11 |
| `var(--r-card) var(--r-card) 0 0` | 8 |
| `inherit` | 2 |
| `0 0 var(--r-card) var(--r-card)` | 1 |
| `0 var(--r-mark) var(--r-mark) 0` | 1 |
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

- L1035 `background`: `#fff`
- L1098 `color`: `#fff`
- L2135 `color`: `rgba(0, 0, 0, 0.7)`
- L2485 `background`: `rgba(0, 0, 0, 0.35)`
- L3024 `box-shadow`: `rgba(0, 0, 0, 0.45)`
- L3118 `color`: `#fff`
- L3126 `background`: `#fff`
- L4333 `color`: `#fff`
- L4674 `color`: `#fff`
- L4708 `color`: `#fff`
- L4955 `color`: `rgba(0, 0, 0, 0.65)`
- L5143 `background`: `rgba(0, 0, 0, 0.35)`
- L5268 `background`: `rgba(0, 0, 0, 0.35)`
- L6287 `color`: `#fff`
- L6546 `color`: `#fff`
- L6566 `background`: `#fff`
- L6605 `color`: `#fff`
- L6608 `background`: `#000`
- L6719 `color`: `#fff`
- L8613 `background`: `rgba(0, 0, 0, 0.62)`
- L8644 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L8826 `box-shadow`: `rgba(0, 0, 0, 0.55)`
- L9285 `background`: `rgba(0, 0, 0, 0.45)`
- L9303 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L9797 `background`: `rgba(0, 0, 0, 0.45)`
- L9813 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L10169 `background`: `rgba(0, 0, 0, 0.62)`
- L10194 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L10772 `color`: `#fff`
- L11084 `background`: `#d9705f`
- L11084 `background`: `#bd7f30`
- L11084 `background`: `#8a9439`
- L11084 `background`: `#4fa46a`
- L11084 `background`: `#3f9fae`
- L11084 `background`: `#5b8ae6`
- L11084 `background`: `#9b7bd8`
- L11084 `background`: `#d1698f`
- L11084 `background`: `#d9705f`
- L12402 `color`: `#fff`
- L12619 `background`: `rgba(0, 0, 0, 0.62)`
- L12635 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L12838 `background`: `rgba(0, 0, 0, 0.62)`
- L12853 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L13035 `color`: `#fff`
- L13223 `box-shadow`: `rgba(0, 0, 0, 0.45)`
- L15198 `color`: `#fff`
- L15373 `background`: `rgba(0, 0, 0, 0.55)`
- L15374 `color`: `#fff`
- L15433 `background`: `rgba(0, 0, 0, 0.85)`
- L15452 `color`: `#fff`
- L15470 `color`: `#fff`
- L15476 `color`: `#fff`
- L15539 `background`: `rgba(0, 0, 0, 0.45)`
- L15860 `background`: `rgba(0, 0, 0, 0.62)`

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

- L399 `radial-gradient(1100px 460px at 50% -10%, color-mix(in srgb, var(--accent) var(--vignette), transparent), tran`
- L675 `background: var(--accent);`
- L680 `outline: 2px solid var(--accent);`
- L817 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L823 `outline: 2px solid var(--accent);`
- L933 `--pick: var(--swatch, var(--accent));`
- L973 `box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--pick, var(--accent));`
- L990 `outline: 2px solid var(--accent);`
- L997 `background: linear-gradient(135deg, var(--accent) 0 48%, var(--surface-raised) 48% 52%, var(--accent) 52% 100%`
- L1016 `background: var(--accent);`
- L1017 `border-color: var(--accent);`
- L1038 `outline: 2px solid var(--accent);`
- L1097 `background: var(--accent);`
- L1145 `border-color: var(--accent);`
- L1146 `box-shadow: 0 0 0 2px var(--accent);`
- L1150 `outline: 2px solid var(--accent);`
- L1487 `background: var(--accent);`
- L1620 `border: 1px solid color-mix(in srgb, var(--chip, var(--accent)) 45%, var(--border));`
- L1622 `background: color-mix(in srgb, var(--chip, var(--accent)) 12%, var(--surface));`
- L1678 `.timeline-toggle[aria-expanded='true'] { border-color: var(--accent); }`
- L1883 `outline: 2px solid var(--accent);`
- L1893 `border: 1.5px solid var(--accent);`
- L1894 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L2358 `.day-future .timeline-gap { background: color-mix(in srgb, var(--accent) 6%, transparent); }`
- L2443 `border-top: 1px dashed var(--accent);`
- L2459 `border: 1px solid var(--accent);`
- L2462 `color: var(--accent);`
- L2540 `outline: 2px solid var(--accent);`
- L2577 `outline: 2px solid var(--accent);`
- L2600 `color: var(--accent);`
- L2605 `outline: 2px solid var(--accent);`
- L2620 `outline: 2px solid var(--accent);`
- L2892 `outline: 2px solid var(--accent);`
- L2894 `border-color: var(--accent);`
- L2953 `border-color: var(--accent);`
- L2954 `outline: 2px solid var(--accent);`
- L3117 `background: var(--accent);`
- L3129 `outline: 2px solid var(--accent);`
- L3193 `.setting-quiet:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L3195 `.setting-remove:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L3235 `outline: 2px solid var(--accent);`
- L3237 `border-color: var(--accent);`
- L3261 `.time-stepper:focus-within { border-color: var(--accent); }`
- L3279 `.time-stepper:focus-within { outline: 2px solid var(--accent); outline-offset: -1px; }`
- L3348 `.time-step:active { background: color-mix(in srgb, var(--accent) 20%, transparent); }`
- L3351 `outline: 2px solid var(--accent);`
- L3473 `outline: 2px solid var(--accent);`
- L3578 `.category-edit:hover { border-color: var(--accent); color: var(--text); }`
- L3618 `outline: 2px solid var(--accent);`
- L3846 `background: var(--accent);`
- L3847 `border-color: var(--accent);`
- L3853 `outline: 2px solid var(--accent);`
- L3875 `background: var(--accent);`
- L3876 `border-color: var(--accent);`
- L3886 `outline: 2px solid var(--accent);`
- L4026 `outline: 2px solid var(--accent);`
- L4037 `background: color-mix(in srgb, var(--accent) 16%, transparent);`
- L4038 `outline: 1.5px solid var(--accent);`
- L4088 `outline: 2px solid var(--accent);`
- L4160 `outline: 2px solid var(--accent);`
- L4202 `outline: 2px solid var(--accent);`
- L4303 `outline: 2px solid var(--accent);`
- L4330 `background: var(--accent);`
- L4404 `outline: 2px solid var(--accent);`
- L4427 `outline: 2px solid var(--accent);`
- L4500 `outline: 2px solid var(--accent);`
- L4672 `background: var(--accent);`
- L4673 `border-color: var(--accent);`
- L4706 `background: var(--accent);`
- L4707 `border-color: var(--accent);`
- L4916 `outline: 2px solid var(--accent);`
- L4963 `outline: 2px solid var(--accent);`
- L5017 `outline: 2px solid var(--accent);`
- L5020 `.cell.staged { outline: 2px dashed var(--accent); outline-offset: -2px; }`
- L5023 `outline: 2px solid var(--accent);`
- L5039 `background: color-mix(in srgb, var(--chip, var(--accent)) 16%, var(--surface));`
- L5040 `box-shadow: inset 0 3px 0 var(--chip, var(--accent));`
- L5201 `outline: 2px solid var(--accent);`
- L5251 `outline: 2px solid var(--accent);`
- L5326 `outline: 2px solid var(--accent);`
- L5373 `outline: 2px solid var(--accent);`
- L5397 `color: var(--accent);`
- L5402 `outline: 2px solid var(--accent);`
- L5458 `outline: 2px solid var(--accent);`
- L5503 `stroke: var(--cat, var(--accent));`
- L5602 `background: color-mix(in srgb, var(--accent) 18%, transparent);`
- L5609 `.undo-toast-button:hover { background: color-mix(in srgb, var(--accent) 32%, transparent); }`
- L5612 `outline: 2px solid var(--accent);`
- L5790 `outline: 2px solid var(--accent);`
- L5865 `.clock-preset:hover { border-color: var(--accent); }`
- L5871 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L5872 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L5876 `outline: 2px solid var(--accent);`
- L6044 `.clock-volume input[type='range'] { flex: 1 1 auto; min-width: 0; accent-color: var(--accent); }`
- L6196 `outline: 2px solid var(--accent);`
- L6223 `stroke: var(--accent);`
- L6285 `background: var(--accent);`
- L6286 `border-color: var(--accent);`
- L6292 `outline: 2px solid var(--accent);`
- L6365 `background: color-mix(in srgb, var(--accent) 20%, transparent);`
- L6386 `background: color-mix(in srgb, var(--accent) 16%, transparent);`
- L6412 `border: 1px solid color-mix(in srgb, var(--cat, var(--accent)) 35%, var(--border));`
- L6413 `border-left: 4px solid var(--cat, var(--accent));`
- L6415 `background: color-mix(in srgb, var(--cat, var(--accent)) 8%, var(--surface));`
- L6438 `stroke: var(--cat, var(--accent));`
- L6446 `color: color-mix(in srgb, var(--cat, var(--accent)) 30%, var(--muted));`
- L6498 `outline: 2px solid var(--accent);`
- L6544 `background: var(--accent);`
- L6545 `border-color: var(--accent);`
- L6559 `background: color-mix(in srgb, var(--accent) 25%, var(--surface));`
- L6566 `button.primary:hover { background: color-mix(in srgb, var(--accent) 84%, #fff); }`
- L6621 `outline: 2px solid var(--accent);`
- L6716 `background: var(--accent);`
- L6725 `outline: 2px solid var(--accent);`
- L7188 `background: color-mix(in srgb, var(--accent) 18%, transparent);`
- L7697 `.mini-cell.today { border-color: var(--accent); border-width: 2px; }`
- L7702 `.mini-cell.viewing { outline: 2px dashed var(--accent); outline-offset: -2px; }`
- L7708 `background: color-mix(in srgb, var(--chip, var(--accent)) 30%, var(--surface));`
- L7709 `box-shadow: inset 0 2px 0 var(--chip, var(--accent));`
- L7713 `outline: 2px solid var(--accent);`
- L8058 `.library-amount:focus-within { border-color: var(--accent); }`
- L8144 `.library-item-grip:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L8156 `.library-item.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L8191 `background: var(--accent);`
- L8270 `.library-schedule button:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }`
- L8380 `.block-add-open:hover { border-color: var(--accent); color: var(--text); }`
- L8383 `outline: 2px solid var(--accent);`
- L8411 `outline: 2px solid var(--accent);`
- L8492 `.library-quick-word:hover { border-color: var(--accent); color: var(--text); }`
- L8496 `outline: 2px solid var(--accent);`
- L8970 `.note-section-button:hover { border-color: var(--accent); }`
- L9023 `.note-reader-tab.is-on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transp`
- L9040 `.task-library { background: color-mix(in srgb, var(--accent) 16%, transparent); }`
- L9158 `background: var(--chip, var(--accent));`
- L9162 `.template-chip:hover { border-color: color-mix(in srgb, var(--chip, var(--accent)) 60%, var(--border)); }`
- L9166 `border-color: color-mix(in srgb, var(--chip, var(--accent)) 70%, var(--border));`
- L9167 `background: color-mix(in srgb, var(--chip, var(--accent)) 14%, var(--surface));`
- L9172 `outline: 2px solid var(--accent);`
- L9719 `.review-bar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L9739 `.review-bar-done { background: color-mix(in srgb, var(--accent) 70%, transparent); }`
- L9860 `.palette-row.is-selected { background: color-mix(in srgb, var(--accent) 20%, transparent); }`
- L10016 `outline: 2px solid var(--accent);`
- L10189 `border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));`
- L10190 `border-left: 3px solid color-mix(in srgb, var(--accent) 55%, var(--border));`
- L10192 `background: color-mix(in srgb, var(--accent) 6%, var(--surface));`
- L10248 `.north-card-ok:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L10370 `.north-compose-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L10485 `outline: 2px solid var(--accent);`
- L11041 `.category-row.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L11102 `.category-wheel:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; }`
- L11313 `background: var(--accent);`
- L11375 `.cell-tone-mid .cell-bar-fill { background: color-mix(in srgb, var(--accent) 70%, var(--muted)); }`
- L11567 `.week-col.is-today .week-col-day { color: var(--accent); }`
- L11568 `.week-col.is-today .week-col-date { color: var(--accent); }`
- L11632 `.week-col-template.is-offer:hover { border-color: var(--accent); color: var(--text); }`
- L11734 `border-color: color-mix(in srgb, var(--accent) 45%, transparent);`
- L11735 `background: color-mix(in srgb, var(--accent) 5%, var(--surface));`
- L11754 `background: var(--accent);`
- L11782 `background: color-mix(in srgb, var(--block, var(--accent)) 32%, var(--surface));`
- L11783 `border-left: 2px solid var(--block, var(--accent));`
- L11797 `.week-block:hover { background: color-mix(in srgb, var(--block, var(--accent)) 46%, var(--surface)); }`
- L11802 `background: color-mix(in srgb, var(--block, var(--accent)) 12%, var(--surface));`
- L11811 `.week-block.is-key { box-shadow: inset 0 0 0 1px var(--accent); }`
- L12077 `border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);`
- L12079 `background: color-mix(in srgb, var(--accent) 10%, var(--surface));`
- L12088 `background: var(--accent);`
- L12102 `color: var(--accent);`
- L12135 `color: var(--accent);`
- L12342 `border: 2px solid var(--accent);`
- L12344 `box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);`
- L12401 `background: var(--accent);`
- L12417 `border-color: var(--good, var(--accent));`
- L12418 `box-shadow: 0 0 0 6px color-mix(in srgb, var(--good, var(--accent)) 30%, transparent);`
- L12438 `.tour-dot.is-past { background: color-mix(in srgb, var(--accent) 55%, var(--border)); }`
- L12439 `.tour-dot.is-now { background: var(--accent); transform: scale(1.35); }`
- L12706 `.scratch-note.is-pinned { background: color-mix(in srgb, var(--accent) 8%, transparent); }`
- L12718 `color: var(--accent);`
- L12918 `.replan-choice:hover { border-color: var(--accent); }`
- L12952 `.replan-key { color: var(--accent); margin-right: var(--s1); font-weight: 700; }`
- L13033 `background: var(--accent);`
- L13034 `border-color: var(--accent);`
- L13095 `.replan-row-button[aria-expanded='true'] { border-color: var(--accent); }`
- L13195 `outline: 2px solid var(--accent);`
- L13265 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13266 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L13312 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13313 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L13442 `.later-item.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L13496 `.later-item-plan:hover { color: var(--text); border-color: var(--accent); }`
- L13524 `outline: 2px solid var(--accent);`
- L13614 `.library-chip:hover { border-color: var(--accent); }`
- L13680 `.library-preset:hover { border-color: var(--accent); }`
- L13712 `--pick: var(--dot, var(--accent));`
- L13737 `.library-item-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(-`
- L13986 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13987 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L14512 `background: var(--accent);`
- L14513 `border-color: var(--accent);`
- L14529 `outline: 2px solid var(--accent);`
- L14646 `outline: 2px solid var(--accent);`
- L14662 `background: var(--accent);`
- L14740 `.agenda-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L14830 `border-color: var(--accent);`
- L14834 `.later-strip-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L14908 `.wt-column.is-active { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }`
- L14930 `.wt-day:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L15067 `.wt-col.is-active .week-track { background: color-mix(in srgb, var(--accent) 5%, transparent); }`
- L15074 `border: 1px dashed color-mix(in srgb, var(--block, var(--accent)) 70%, transparent);`
- L15076 `background: color-mix(in srgb, var(--block, var(--accent)) 18%, transparent);`
- L15120 `.wt-untimed-block.is-open { border-style: solid; border-color: var(--accent); color: var(--text); }`
- L15124 `.week-block.is-open { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L15196 `border-color: var(--accent);`
- L15197 `background: var(--accent);`
- L15305 `background: color-mix(in srgb, var(--accent) 55%, var(--border));`
- L15514 `color: var(--accent);`
- L15584 `.scratch-note-action.is-linked { color: var(--accent); }`
- L15985 `outline: 2px solid var(--accent);`
