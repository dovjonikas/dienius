import { actions, getData } from './store'
import { clockTools } from './clockTools'
import { STARTER_TEMPLATES, starterTemplateInput } from './starterTemplates'
import { tourTask, type TourEvent } from './tour'

/**
 * The way out of a step that will not end.
 *
 * Every step in this tour waits for a real action, which is what makes it a
 * tour of the app rather than a slideshow about it - and is also the one way
 * it can trap somebody. A control moved behind a menu, a viewport where the
 * thing is off screen, a predicate watching for a write the feature stopped
 * making: any of those leave a person pressing at a spotlight that never
 * clears. Nobody sits there working out that the tour is broken. They close
 * the app.
 *
 * So after twenty seconds of nothing, the card offers to do the step itself.
 * These are the same store actions the controls call - not a fake, not a
 * pretend tick: the day really is stamped, the task really is added, and the
 * person carries on from a state that is genuinely the one the next step
 * expects. The alternative, skipping straight ahead, is offered beside it and
 * is what happens when there is nothing sensible to do on somebody's behalf.
 *
 * Returns whether it did anything, so the caller can fall back to skipping
 * the step outright.
 */
export function assistWith(event: TourEvent, today: string): boolean {
  switch (event) {
    case 'stamped': {
      // The same one tap on a starter offer does: a real, editable template,
      // stamped onto the day being looked at.
      const starter = STARTER_TEMPLATES.find(s => s.id === 'working-day')
      if (!starter) return false
      const template = actions.addTemplate(starterTemplateInput(starter))
      actions.stamp({ [today]: template.id })
      return true
    }
    case 'task-added': {
      // Walk, because that is the word every later step names. Placed at the
      // current minute so it is the running task, which is what the Focus
      // step two on depends on.
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      actions.addTask(today, 'Walk', time)
      const added = getData().days[today]?.tasks.at(-1)
      if (added) actions.setTaskMinutes(today, added.id, 30)
      return true
    }
    case 'key-marked': {
      const task = tourTask(getData(), today)
      if (!task) return false
      actions.toggleTaskHighlight(today, task.id)
      return true
    }
    case 'focus-started': {
      const task = tourTask(getData(), today)
      if (!task) return false
      clockTools.startFocus(today, task.id)
      return true
    }
    case 'task-done': {
      const task = tourTask(getData(), today)
      if (!task) return false
      actions.toggleTask(today, task.id)
      return true
    }
    case 'list-added': {
      actions.addLibraryList({ name: 'Books', unit: 'chapter' })
      return true
    }
    case 'goal-added': {
      actions.addGoal({ title: 'Be someone who finishes things', why: 'Because starting was never the hard part' }, today)
      return true
    }
    // The two ends have nothing to do on anybody's behalf: one is a button
    // that is already there, and the other is a choice only the person can
    // make.
    case 'start':
    case 'finish':
      return false
  }
}
