import { useRef, useState } from 'react'
import { useClickAway } from '../lib/useClickAway'

export interface ColorSwatchPickerProps {
  colors: string[]
  value: string
  onChange: (color: string) => void
  /** What the colour is *of*, for the button's accessible name. */
  label: string
  /** A readable name for the chosen colour, where the palette has one. */
  nameOf?: (color: string) => string
}

/**
 * One colour, chosen from eight, without eight of them on screen.
 *
 * The template editor opened with a row of eight 32px balls above the name
 * field. They were the largest and most saturated thing on a form whose
 * subject is a day's worth of blocks, they were the first thing the eye
 * landed on every time, and seven of the eight were answers nobody had
 * chosen. A colour on a template is decoration on top of a name that already
 * carries the meaning - ARCHITECTURE section 8 says so about the shared
 * swatch rule - and decoration does not open the form.
 *
 * So: the answer, at the size of a bullet, beside the name it decorates. The
 * other seven are one press away and gone again as soon as one is picked.
 * The same shape quick-add's duration control already uses, for the same
 * reason: a control opens holding an answer, and the alternatives are behind
 * it rather than beside it.
 */
export function ColorSwatchPicker({ colors, value, onChange, label, nameOf }: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickAway(ref, open, () => setOpen(false))

  const chosen = nameOf?.(value) ?? value

  return (
    <div className="swatch-picker" ref={ref}>
      <button
        type="button"
        className="swatch swatch-picker-value"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${label}: ${chosen}. Change it.`}
        style={{ background: value, ['--pick' as string]: value } as React.CSSProperties}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <div className="swatch-picker-panel color-palette" role="group" aria-label={label}>
          {colors.map(color => (
            <button
              key={color}
              type="button"
              aria-label={nameOf?.(color) ?? color}
              aria-pressed={value === color}
              className={value === color ? 'swatch selected' : 'swatch'}
              style={{ background: color, ['--pick' as string]: color } as React.CSSProperties}
              onClick={() => {
                onChange(color)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
