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
- transition and animation declarations: **96**, in **3** distinct durations
- keyframes: **19**

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

- L1049 `background`: `#fff`
- L1112 `color`: `#fff`
- L2149 `color`: `rgba(0, 0, 0, 0.7)`
- L2499 `background`: `rgba(0, 0, 0, 0.35)`
- L3038 `box-shadow`: `rgba(0, 0, 0, 0.45)`
- L3132 `color`: `#fff`
- L3140 `background`: `#fff`
- L4347 `color`: `#fff`
- L4688 `color`: `#fff`
- L4722 `color`: `#fff`
- L4969 `color`: `rgba(0, 0, 0, 0.65)`
- L5157 `background`: `rgba(0, 0, 0, 0.35)`
- L5282 `background`: `rgba(0, 0, 0, 0.35)`
- L6305 `color`: `#fff`
- L6564 `color`: `#fff`
- L6584 `background`: `#fff`
- L6623 `color`: `#fff`
- L6626 `background`: `#000`
- L6737 `color`: `#fff`
- L8631 `background`: `rgba(0, 0, 0, 0.62)`
- L8662 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L8844 `box-shadow`: `rgba(0, 0, 0, 0.55)`
- L9303 `background`: `rgba(0, 0, 0, 0.45)`
- L9321 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L9815 `background`: `rgba(0, 0, 0, 0.45)`
- L9831 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L10187 `background`: `rgba(0, 0, 0, 0.62)`
- L10212 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L10790 `color`: `#fff`
- L11102 `background`: `#d9705f`
- L11102 `background`: `#bd7f30`
- L11102 `background`: `#8a9439`
- L11102 `background`: `#4fa46a`
- L11102 `background`: `#3f9fae`
- L11102 `background`: `#5b8ae6`
- L11102 `background`: `#9b7bd8`
- L11102 `background`: `#d1698f`
- L11102 `background`: `#d9705f`
- L12420 `color`: `#fff`
- L12637 `background`: `rgba(0, 0, 0, 0.62)`
- L12653 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L12856 `background`: `rgba(0, 0, 0, 0.62)`
- L12871 `box-shadow`: `rgba(0, 0, 0, 0.6)`
- L13053 `color`: `#fff`
- L13241 `box-shadow`: `rgba(0, 0, 0, 0.45)`
- L15216 `color`: `#fff`
- L15391 `background`: `rgba(0, 0, 0, 0.55)`
- L15392 `color`: `#fff`
- L15451 `background`: `rgba(0, 0, 0, 0.85)`
- L15470 `color`: `#fff`
- L15488 `color`: `#fff`
- L15494 `color`: `#fff`
- L15557 `background`: `rgba(0, 0, 0, 0.45)`
- L15878 `background`: `rgba(0, 0, 0, 0.62)`

### Movement

| value | uses |
| --- | --- |
| `--dur-fast` | 59 |
| `--dur` | 41 |
| `--dur-sweep` | 2 |

### Keyframes

| value | uses |
| --- | --- |
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

- L413 `radial-gradient(1100px 460px at 50% -10%, color-mix(in srgb, var(--accent) var(--vignette), transparent), tran`
- L689 `background: var(--accent);`
- L694 `outline: 2px solid var(--accent);`
- L831 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L837 `outline: 2px solid var(--accent);`
- L947 `--pick: var(--swatch, var(--accent));`
- L987 `box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--pick, var(--accent));`
- L1004 `outline: 2px solid var(--accent);`
- L1011 `background: linear-gradient(135deg, var(--accent) 0 48%, var(--surface-raised) 48% 52%, var(--accent) 52% 100%`
- L1030 `background: var(--accent);`
- L1031 `border-color: var(--accent);`
- L1052 `outline: 2px solid var(--accent);`
- L1111 `background: var(--accent);`
- L1159 `border-color: var(--accent);`
- L1160 `box-shadow: 0 0 0 2px var(--accent);`
- L1164 `outline: 2px solid var(--accent);`
- L1501 `background: var(--accent);`
- L1634 `border: 1px solid color-mix(in srgb, var(--chip, var(--accent)) 45%, var(--border));`
- L1636 `background: color-mix(in srgb, var(--chip, var(--accent)) 12%, var(--surface));`
- L1692 `.timeline-toggle[aria-expanded='true'] { border-color: var(--accent); }`
- L1897 `outline: 2px solid var(--accent);`
- L1907 `border: 1.5px solid var(--accent);`
- L1908 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L2372 `.day-future .timeline-gap { background: color-mix(in srgb, var(--accent) 6%, transparent); }`
- L2457 `border-top: 1px dashed var(--accent);`
- L2473 `border: 1px solid var(--accent);`
- L2476 `color: var(--accent);`
- L2554 `outline: 2px solid var(--accent);`
- L2591 `outline: 2px solid var(--accent);`
- L2614 `color: var(--accent);`
- L2619 `outline: 2px solid var(--accent);`
- L2634 `outline: 2px solid var(--accent);`
- L2906 `outline: 2px solid var(--accent);`
- L2908 `border-color: var(--accent);`
- L2967 `border-color: var(--accent);`
- L2968 `outline: 2px solid var(--accent);`
- L3131 `background: var(--accent);`
- L3143 `outline: 2px solid var(--accent);`
- L3207 `.setting-quiet:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L3209 `.setting-remove:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L3249 `outline: 2px solid var(--accent);`
- L3251 `border-color: var(--accent);`
- L3275 `.time-stepper:focus-within { border-color: var(--accent); }`
- L3293 `.time-stepper:focus-within { outline: 2px solid var(--accent); outline-offset: -1px; }`
- L3362 `.time-step:active { background: color-mix(in srgb, var(--accent) 20%, transparent); }`
- L3365 `outline: 2px solid var(--accent);`
- L3487 `outline: 2px solid var(--accent);`
- L3592 `.category-edit:hover { border-color: var(--accent); color: var(--text); }`
- L3632 `outline: 2px solid var(--accent);`
- L3860 `background: var(--accent);`
- L3861 `border-color: var(--accent);`
- L3867 `outline: 2px solid var(--accent);`
- L3889 `background: var(--accent);`
- L3890 `border-color: var(--accent);`
- L3900 `outline: 2px solid var(--accent);`
- L4040 `outline: 2px solid var(--accent);`
- L4051 `background: color-mix(in srgb, var(--accent) 16%, transparent);`
- L4052 `outline: 1.5px solid var(--accent);`
- L4102 `outline: 2px solid var(--accent);`
- L4174 `outline: 2px solid var(--accent);`
- L4216 `outline: 2px solid var(--accent);`
- L4317 `outline: 2px solid var(--accent);`
- L4344 `background: var(--accent);`
- L4418 `outline: 2px solid var(--accent);`
- L4441 `outline: 2px solid var(--accent);`
- L4514 `outline: 2px solid var(--accent);`
- L4686 `background: var(--accent);`
- L4687 `border-color: var(--accent);`
- L4720 `background: var(--accent);`
- L4721 `border-color: var(--accent);`
- L4930 `outline: 2px solid var(--accent);`
- L4977 `outline: 2px solid var(--accent);`
- L5031 `outline: 2px solid var(--accent);`
- L5034 `.cell.staged { outline: 2px dashed var(--accent); outline-offset: -2px; }`
- L5037 `outline: 2px solid var(--accent);`
- L5053 `background: color-mix(in srgb, var(--chip, var(--accent)) 16%, var(--surface));`
- L5054 `box-shadow: inset 0 3px 0 var(--chip, var(--accent));`
- L5215 `outline: 2px solid var(--accent);`
- L5265 `outline: 2px solid var(--accent);`
- L5340 `outline: 2px solid var(--accent);`
- L5387 `outline: 2px solid var(--accent);`
- L5411 `color: var(--accent);`
- L5416 `outline: 2px solid var(--accent);`
- L5472 `outline: 2px solid var(--accent);`
- L5517 `stroke: var(--cat, var(--accent));`
- L5616 `background: color-mix(in srgb, var(--accent) 18%, transparent);`
- L5623 `.undo-toast-button:hover { background: color-mix(in srgb, var(--accent) 32%, transparent); }`
- L5626 `outline: 2px solid var(--accent);`
- L5804 `outline: 2px solid var(--accent);`
- L5879 `.clock-preset:hover { border-color: var(--accent); }`
- L5885 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L5886 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L5890 `outline: 2px solid var(--accent);`
- L6058 `.clock-volume input[type='range'] { flex: 1 1 auto; min-width: 0; accent-color: var(--accent); }`
- L6207 `outline: 2px solid var(--accent);`
- L6234 `stroke: var(--accent);`
- L6303 `background: var(--accent);`
- L6304 `border-color: var(--accent);`
- L6310 `outline: 2px solid var(--accent);`
- L6383 `background: color-mix(in srgb, var(--accent) 20%, transparent);`
- L6404 `background: color-mix(in srgb, var(--accent) 16%, transparent);`
- L6430 `border: 1px solid color-mix(in srgb, var(--cat, var(--accent)) 35%, var(--border));`
- L6431 `border-left: 4px solid var(--cat, var(--accent));`
- L6433 `background: color-mix(in srgb, var(--cat, var(--accent)) 8%, var(--surface));`
- L6456 `stroke: var(--cat, var(--accent));`
- L6464 `color: color-mix(in srgb, var(--cat, var(--accent)) 30%, var(--muted));`
- L6516 `outline: 2px solid var(--accent);`
- L6562 `background: var(--accent);`
- L6563 `border-color: var(--accent);`
- L6577 `background: color-mix(in srgb, var(--accent) 25%, var(--surface));`
- L6584 `button.primary:hover { background: color-mix(in srgb, var(--accent) 84%, #fff); }`
- L6639 `outline: 2px solid var(--accent);`
- L6734 `background: var(--accent);`
- L6743 `outline: 2px solid var(--accent);`
- L7206 `background: color-mix(in srgb, var(--accent) 18%, transparent);`
- L7715 `.mini-cell.today { border-color: var(--accent); border-width: 2px; }`
- L7720 `.mini-cell.viewing { outline: 2px dashed var(--accent); outline-offset: -2px; }`
- L7726 `background: color-mix(in srgb, var(--chip, var(--accent)) 30%, var(--surface));`
- L7727 `box-shadow: inset 0 2px 0 var(--chip, var(--accent));`
- L7731 `outline: 2px solid var(--accent);`
- L8076 `.library-amount:focus-within { border-color: var(--accent); }`
- L8162 `.library-item-grip:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L8174 `.library-item.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L8209 `background: var(--accent);`
- L8288 `.library-schedule button:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }`
- L8398 `.block-add-open:hover { border-color: var(--accent); color: var(--text); }`
- L8401 `outline: 2px solid var(--accent);`
- L8429 `outline: 2px solid var(--accent);`
- L8510 `.library-quick-word:hover { border-color: var(--accent); color: var(--text); }`
- L8514 `outline: 2px solid var(--accent);`
- L8988 `.note-section-button:hover { border-color: var(--accent); }`
- L9041 `.note-reader-tab.is-on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transp`
- L9058 `.task-library { background: color-mix(in srgb, var(--accent) 16%, transparent); }`
- L9176 `background: var(--chip, var(--accent));`
- L9180 `.template-chip:hover { border-color: color-mix(in srgb, var(--chip, var(--accent)) 60%, var(--border)); }`
- L9184 `border-color: color-mix(in srgb, var(--chip, var(--accent)) 70%, var(--border));`
- L9185 `background: color-mix(in srgb, var(--chip, var(--accent)) 14%, var(--surface));`
- L9190 `outline: 2px solid var(--accent);`
- L9737 `.review-bar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L9757 `.review-bar-done { background: color-mix(in srgb, var(--accent) 70%, transparent); }`
- L9878 `.palette-row.is-selected { background: color-mix(in srgb, var(--accent) 20%, transparent); }`
- L10034 `outline: 2px solid var(--accent);`
- L10207 `border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));`
- L10208 `border-left: 3px solid color-mix(in srgb, var(--accent) 55%, var(--border));`
- L10210 `background: color-mix(in srgb, var(--accent) 6%, var(--surface));`
- L10266 `.north-card-ok:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L10388 `.north-compose-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L10503 `outline: 2px solid var(--accent);`
- L11059 `.category-row.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L11120 `.category-wheel:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; }`
- L11331 `background: var(--accent);`
- L11393 `.cell-tone-mid .cell-bar-fill { background: color-mix(in srgb, var(--accent) 70%, var(--muted)); }`
- L11585 `.week-col.is-today .week-col-day { color: var(--accent); }`
- L11586 `.week-col.is-today .week-col-date { color: var(--accent); }`
- L11650 `.week-col-template.is-offer:hover { border-color: var(--accent); color: var(--text); }`
- L11752 `border-color: color-mix(in srgb, var(--accent) 45%, transparent);`
- L11753 `background: color-mix(in srgb, var(--accent) 5%, var(--surface));`
- L11772 `background: var(--accent);`
- L11800 `background: color-mix(in srgb, var(--block, var(--accent)) 32%, var(--surface));`
- L11801 `border-left: 2px solid var(--block, var(--accent));`
- L11815 `.week-block:hover { background: color-mix(in srgb, var(--block, var(--accent)) 46%, var(--surface)); }`
- L11820 `background: color-mix(in srgb, var(--block, var(--accent)) 12%, var(--surface));`
- L11829 `.week-block.is-key { box-shadow: inset 0 0 0 1px var(--accent); }`
- L12095 `border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);`
- L12097 `background: color-mix(in srgb, var(--accent) 10%, var(--surface));`
- L12106 `background: var(--accent);`
- L12120 `color: var(--accent);`
- L12153 `color: var(--accent);`
- L12360 `border: 2px solid var(--accent);`
- L12362 `box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);`
- L12419 `background: var(--accent);`
- L12435 `border-color: var(--good, var(--accent));`
- L12436 `box-shadow: 0 0 0 6px color-mix(in srgb, var(--good, var(--accent)) 30%, transparent);`
- L12456 `.tour-dot.is-past { background: color-mix(in srgb, var(--accent) 55%, var(--border)); }`
- L12457 `.tour-dot.is-now { background: var(--accent); transform: scale(1.35); }`
- L12724 `.scratch-note.is-pinned { background: color-mix(in srgb, var(--accent) 8%, transparent); }`
- L12736 `color: var(--accent);`
- L12936 `.replan-choice:hover { border-color: var(--accent); }`
- L12970 `.replan-key { color: var(--accent); margin-right: var(--s1); font-weight: 700; }`
- L13051 `background: var(--accent);`
- L13052 `border-color: var(--accent);`
- L13113 `.replan-row-button[aria-expanded='true'] { border-color: var(--accent); }`
- L13213 `outline: 2px solid var(--accent);`
- L13283 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13284 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L13330 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L13331 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L13460 `.later-item.is-over { box-shadow: inset 0 2px 0 var(--accent); }`
- L13514 `.later-item-plan:hover { color: var(--text); border-color: var(--accent); }`
- L13542 `outline: 2px solid var(--accent);`
- L13632 `.library-chip:hover { border-color: var(--accent); }`
- L13698 `.library-preset:hover { border-color: var(--accent); }`
- L13730 `--pick: var(--dot, var(--accent));`
- L13755 `.library-item-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(-`
- L14004 `border-color: color-mix(in srgb, var(--accent) 45%, var(--border));`
- L14005 `background: color-mix(in srgb, var(--accent) 14%, transparent);`
- L14530 `background: var(--accent);`
- L14531 `border-color: var(--accent);`
- L14547 `outline: 2px solid var(--accent);`
- L14664 `outline: 2px solid var(--accent);`
- L14680 `background: var(--accent);`
- L14758 `.agenda-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L14848 `border-color: var(--accent);`
- L14852 `.later-strip-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L14926 `.wt-column.is-active { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }`
- L14948 `.wt-day:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
- L15085 `.wt-col.is-active .week-track { background: color-mix(in srgb, var(--accent) 5%, transparent); }`
- L15092 `border: 1px dashed color-mix(in srgb, var(--block, var(--accent)) 70%, transparent);`
- L15094 `background: color-mix(in srgb, var(--block, var(--accent)) 18%, transparent);`
- L15138 `.wt-untimed-block.is-open { border-style: solid; border-color: var(--accent); color: var(--text); }`
- L15142 `.week-block.is-open { outline: 2px solid var(--accent); outline-offset: -2px; }`
- L15214 `border-color: var(--accent);`
- L15215 `background: var(--accent);`
- L15323 `background: color-mix(in srgb, var(--accent) 55%, var(--border));`
- L15532 `color: var(--accent);`
- L15602 `.scratch-note-action.is-linked { color: var(--accent); }`
- L16003 `outline: 2px solid var(--accent);`
