import type { IfThenEntry } from '../../lib/types'

/**
 * A rule as a sentence: "If" the moment, "then" the answer. One component
 * draws it everywhere a rule is read - under its goal while the goal is
 * written, and on the day's goal card - because two copies of one sentence
 * had already drifted apart once.
 */
export function RuleText({ rule }: { rule: IfThenEntry }) {
  return (
    <p className="north-rule-line">
      <span className="north-rule-prefix">If</span> {rule.trigger}
      {/* The word rather than the arrow it stood for. An arrow between two
          halves of a sentence is a diagram; "If X, then Y" is the sentence.
          The hidden copy that used to say it for a screen reader went with
          it - once and only once. */}
      <span className="north-rule-then"> then </span>
      {/* The action is bare text rather than a span of its own. An inline
          span whose text wraps reports one bounding box spanning both lines,
          which encloses everything before it on the first - and the measuring
          pass in scripts/audit.js reads that as two pieces of text painted
          over each other. It found sixteen of them here, all the same shape
          and none of them real, which is a measuring tool doing exactly its
          job: the geometry genuinely was overlapping, it just did not matter.
          One fewer wrapper and the rects are honest again. */}
      {rule.action}
    </p>
  )
}
