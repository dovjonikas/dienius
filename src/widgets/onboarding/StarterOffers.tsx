import { STARTER_TEMPLATES, type StarterTemplate } from '../../lib/starterTemplates'
import { formatDuration } from '../day-plan/capacity'

export interface StarterOffersProps {
  /**
   * Called with the tapped starter. Nothing here creates or stamps
   * anything itself - see docs/DECISIONS.md, "offer without installing" -
   * the caller decides what a tap actually does: the day view both adds
   * the template and stamps it onto the day being viewed, the templates
   * list only adds it, since it has no date to stamp.
   */
  onUse: (starter: StarterTemplate) => void
}

/**
 * A grid of example templates, each with its real blocks visible - not a
 * generic "Task 1, Task 2" placeholder, since this is what a new person
 * will assume the app is for. Nothing here touches storage on its own;
 * every card is inert until its own button is tapped.
 */
export function StarterOffers({ onUse }: StarterOffersProps) {
  return (
    <ul className="starter-offers">
      {STARTER_TEMPLATES.map(starter => (
        <li key={starter.id} className="starter-card" style={{ borderColor: starter.color }}>
          <div className="starter-card-head">
            <span className="dot" style={{ background: starter.color }} aria-hidden="true" />
            <strong>{starter.name}</strong>
          </div>
          <p className="muted">{starter.description}</p>
          <ul className="starter-blocks">
            {starter.blocks.map((block, i) => (
              <li key={i}>
                {block.time && <span className="task-time">{block.time}</span>}
                <span className="starter-block-title">{block.title}</span>
                {block.minutes !== undefined && (
                  <span className="task-size">{formatDuration(block.minutes)}</span>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="primary"
            data-tour={`starter-${starter.id}`}
            aria-label={`Use the ${starter.name} template`}
            onClick={() => onUse(starter)}
          >
            Use this template
          </button>
        </li>
      ))}
    </ul>
  )
}
