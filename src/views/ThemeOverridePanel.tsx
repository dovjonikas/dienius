import { useId, useState } from 'react'
import { resolveMode, resolveVariant } from '../lib/theme'
import { EDGE_OPTIONS, FONT_BODY_OPTIONS, RULE_STYLE_OPTIONS, clampOpacityPercent, clampRuleSize, colorOpacityPercent, optionIdForValue, parseRuleSize, withOpacityPercent } from '../lib/theme-override-options'
import { contrastWarnings } from '../lib/theme-override-warnings'
import { findPreset } from '../lib/themes'
import type { ThemeTokens } from '../lib/themes'
import { useSystemPrefersDark } from '../lib/useSystemPrefersDark'
import { actions, useAppData } from '../lib/store'

interface ColorFieldSpec {
  token: keyof ThemeTokens
  label: string
}

const COLOR_FIELDS: ColorFieldSpec[] = [
  { token: 'accent', label: 'Accent' },
  { token: 'mark', label: 'Highlight' },
  { token: 'bg', label: 'Paper' },
  { token: 'text', label: 'Text' },
]

/**
 * "Adjust this theme", docs/THEMES.md section 3. Collapsed by default so
 * picking a room in the gallery above stays the one-tap normal path -
 * opening this reveals only the tokens actually worth changing, grouped so
 * it reads as a few decisions rather than the wall of controls that gets a
 * settings screen abandoned by an ADHD reader: Colors (four swatches in one
 * small grid), Ruling (style, with spacing and opacity appearing only once
 * ruling is actually on), Corners, and Type.
 *
 * Every control writes exactly one token into overrides, scoped to the
 * currently active preset - actions.setThemeOverride/resetThemeOverrides
 * already key by preset id, so switching rooms and coming back always finds
 * this preset's own patch exactly as it was left, never another preset's.
 */
export function ThemeOverridePanel() {
  const data = useAppData()
  const theme = data.settings.theme
  const prefersDark = useSystemPrefersDark()
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const preset = findPreset(theme.presetId)
  const mode = resolveMode(theme, prefersDark, preset.modes)
  const variant = mode === 'dark' ? preset.dark : preset.light
  const patch = theme.overrides[theme.presetId] ?? {}
  const changedCount = Object.keys(patch).length

  if (!variant) return null
  // A plain, non-optional alias - narrowing the union above does not carry
  // through into the nested function declarations below, so this gives
  // setToken a value TypeScript (and a reader) can trust is always present.
  const activeVariant = variant
  const { tokens, ruleStyle } = resolveVariant(activeVariant, patch)
  const warnings = contrastWarnings(tokens)

  // A write that lands back on exactly the preset's own stock value is not
  // actually a change - unsetting the key instead keeps the patch sparse
  // and keeps the changed-token dot honest (see finding 3: without this, a
  // round trip like Mono then back to System left a no-op fontBody entry
  // in the patch, with the dot still lit on a token that was not, in fact,
  // changed anymore).
  function setToken(token: string, value: string) {
    const stock = token === 'ruleStyle' ? activeVariant.ruleStyle : activeVariant.tokens[token as keyof ThemeTokens]
    if (stock === value) {
      actions.unsetThemeOverride(theme.presetId, token)
    } else {
      actions.setThemeOverride(theme.presetId, token, value)
    }
  }

  function isChanged(token: string): boolean {
    return Object.prototype.hasOwnProperty.call(patch, token)
  }

  return (
    <div className="theme-overrides">
      <button
        type="button"
        className="theme-overrides-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
      >
        Adjust this theme
        {changedCount > 0 && <span className="theme-overrides-count"> · {changedCount} changed</span>}
      </button>

      {open && (
        <div id={panelId} className="theme-overrides-panel">
          <fieldset className="override-group">
            <legend>Colors</legend>
            <div className="override-color-grid">
              {COLOR_FIELDS.map(field => (
                <ColorField
                  key={field.token}
                  label={field.label}
                  value={tokens[field.token]}
                  changed={isChanged(field.token)}
                  onChange={value => setToken(field.token, value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="override-group" role="group" aria-label="Ruling">
            <legend>Ruling</legend>
            <SegmentedField
              options={RULE_STYLE_OPTIONS.map(o => ({ id: o.id, label: o.label }))}
              selectedId={ruleStyle}
              changed={isChanged('ruleStyle')}
              onSelect={id => setToken('ruleStyle', id)}
            />
            {ruleStyle !== 'none' && (
              <div className="override-ruling-detail">
                <RangeField
                  label="Ruling spacing"
                  min={20}
                  max={40}
                  step={2}
                  value={parseRuleSize(tokens.ruleSize)}
                  unit="px"
                  changed={isChanged('ruleSize')}
                  onChange={n => setToken('ruleSize', `${clampRuleSize(n)}px`)}
                />
                <RangeField
                  label="Ruling opacity"
                  min={0}
                  max={40}
                  step={2}
                  value={colorOpacityPercent(tokens.rule)}
                  unit="%"
                  changed={isChanged('rule')}
                  onChange={n => setToken('rule', withOpacityPercent(tokens.rule, clampOpacityPercent(n)))}
                />
              </div>
            )}
          </fieldset>

          <fieldset className="override-group" role="group" aria-label="Corners">
            <legend>Corners</legend>
            <SegmentedField
              options={EDGE_OPTIONS}
              selectedId={optionIdForValue(EDGE_OPTIONS, tokens.edge)}
              changed={isChanged('edge')}
              onSelect={id => {
                const option = EDGE_OPTIONS.find(o => o.id === id)
                if (option) setToken('edge', option.value)
              }}
            />
          </fieldset>

          <fieldset className="override-group" role="group" aria-label="Type">
            <legend>Type</legend>
            <SegmentedField
              options={FONT_BODY_OPTIONS}
              selectedId={optionIdForValue(FONT_BODY_OPTIONS, tokens.fontBody)}
              changed={isChanged('fontBody')}
              onSelect={id => {
                const option = FONT_BODY_OPTIONS.find(o => o.id === id)
                if (option) setToken('fontBody', option.value)
              }}
            />
          </fieldset>

          {warnings.length > 0 && (
            <p className="override-warning" role="status">
              {warnings.map(w => w.message).join(' ')}
            </p>
          )}

          <button type="button" onClick={() => actions.resetThemeOverrides(theme.presetId)} disabled={changedCount === 0}>
            Reset to preset
          </button>
        </div>
      )}
    </div>
  )
}

interface ColorFieldProps {
  label: string
  value: string
  changed: boolean
  onChange: (value: string) => void
}

/**
 * A native `<input type="color">` per docs/THEMES.md's color controls. This
 * is a real, standard form control on iOS Safari - it opens the system
 * color picker and reports back a plain #rrggbb string, which is exactly
 * the format every color token in themes.ts already uses, so no conversion
 * is needed either way.
 */
function ColorField({ label, value, changed, onChange }: ColorFieldProps) {
  const inputId = useId()
  const descId = useId()
  return (
    <div className="override-field">
      <label htmlFor={inputId}>
        {label}
        {changed && <span className="override-dot" aria-hidden="true" />}
      </label>
      <input
        id={inputId}
        type="color"
        value={value}
        aria-describedby={changed ? descId : undefined}
        onChange={e => onChange(e.target.value)}
      />
      {changed && (
        <span id={descId} className="visually-hidden">
          Changed from the preset default
        </span>
      )}
    </div>
  )
}

interface SegmentedFieldProps {
  options: { id: string; label: string }[]
  selectedId: string | undefined
  changed: boolean
  onSelect: (id: string) => void
}

function SegmentedField({ options, selectedId, changed, onSelect }: SegmentedFieldProps) {
  const descId = useId()
  // A resolved value that matches none of the fixed options - not reachable
  // through this panel's own three Corners/Type choices today, but possible
  // from a hand-edited backup, or a future preset shipping a stock value
  // this option set has not caught up with yet (see finding 2). Leaving
  // every button unpressed in that case would silently claim "nothing is
  // set" when something certainly is - naming it as custom instead is
  // honest about what tapping an option would actually change.
  const isCustom = selectedId === undefined
  return (
    <div className="override-segmented-wrap">
      <div className="segmented" aria-describedby={changed ? descId : undefined}>
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            className={option.id === selectedId ? 'active' : ''}
            aria-pressed={option.id === selectedId}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
            {changed && option.id === selectedId && <span className="override-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {isCustom && <p className="override-custom-note">Currently a custom value, not one of these.</p>}
      {changed && (
        <span id={descId} className="visually-hidden">
          Changed from the preset default
        </span>
      )}
    </div>
  )
}

interface RangeFieldProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  unit: string
  changed: boolean
  onChange: (value: number) => void
}

function RangeField({ label, min, max, step, value, unit, changed, onChange }: RangeFieldProps) {
  const inputId = useId()
  const descId = useId()
  return (
    <div className="override-field override-range">
      <label htmlFor={inputId}>
        {label}
        {changed && <span className="override-dot" aria-hidden="true" />}
      </label>
      {/* A sibling, not nested in the label - the input itself is a native
          slider, whose current value is already announced by assistive
          tech through its own numeric semantics, so this stays a purely
          visible readout rather than doubling up on the label's name. */}
      <span className="override-range-value" aria-hidden="true">
        {value}
        {unit}
      </span>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={changed ? descId : undefined}
        onChange={e => onChange(Number(e.target.value))}
      />
      {changed && (
        <span id={descId} className="visually-hidden">
          Changed from the preset default
        </span>
      )}
    </div>
  )
}
