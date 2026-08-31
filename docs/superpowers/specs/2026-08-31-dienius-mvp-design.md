# Dienius — MVP Design

**Date:** 2026-08-31
**Status:** Approved

## What is Dienius

A modular, ADHD-friendly day planner. Users build their own day templates, stamp them onto the calendar, and check off their day with zero friction. Web app hosted on GitHub Pages; portfolio project and daily-use tool.

**One-liner (repo description):**
> Dienius — a modular, ADHD-friendly day planner. Build your own day templates, stamp them on the calendar, and actually enjoy planning.

## Design principles (research-backed)

1. **Time must be visible.** ADHD "time blindness" research: a visual day plan works as external working memory. The plan for today is always one glance away.
2. **Decisions are made once.** Templates mean the "what do I do now" decision was already made when the template was created. Time blocking reduces activation energy.
3. **Instant dopamine.** Checking off a task gives a satisfying micro-animation immediately — not a promise of feeling good in 30 days.
4. **< 10 second rule.** Any everyday action (add task, check off, stamp a template) takes under 10 seconds and no forms.
5. **Forgiveness.** A missed day is a blip, not a failure. Unfinished tasks roll to tomorrow with one click, no guilt UI.
6. **No maintenance burden.** The reason people quit Notion/Todoist is upkeep. Dienius has nothing to maintain: no projects to groom, no dashboards to update. Setup once (templates), use forever.
7. **Nothing pre-filled.** The app ships empty. The user assembles their own system — modules and templates. No clutter they didn't ask for.

## Architecture

- **React + Vite + TypeScript**, static SPA.
- **Widget registry:** every module (MVP: Day Plan; later: Habits, Journal, Kanban) is a self-contained widget in its own folder, registered in a central registry. The dashboard renders whatever the user has enabled.
- **Storage layer:** a single `storage.ts` abstraction over `localStorage`, plus JSON export/import for backup. Modules never touch `localStorage` directly, so sync/desktop can be added later without touching modules.
- **Deploy:** GitHub repo `dienius`, GitHub Actions → GitHub Pages on every push to `main`.

## MVP features

### 1. Templates (core feature)

- User creates a **day template**: a named, colored list of time blocks (e.g. "Work day": 09:00 Gym, 10:00 Deep work, 13:00 Lunch...). Blocks have optional times.
- **Stamping:** in the calendar view, select a template → click dates to apply it (click again to remove) → or drag across a range (e.g. two whole weeks) → press Save. No extra buttons or dialogs.
- Stamped dates are outlined/filled with the template's color and show its name.
- Switching to another template and stamping more dates works in the same session; Save commits everything.
- A day without a template is fine — it starts empty and is filled by hand.
- Applying a template copies its blocks into that day's plan; editing the day afterwards does not change the template.

### 2. Day view

- Shows today's plan: blocks from the template plus manually added tasks, sorted by time (untimed tasks at the bottom).
- **Quick add:** one input field, type and press Enter. Optional time via natural prefix (e.g. "14:00 Call mom").
- **Check-off:** one tap, satisfying micro-animation.
- **Roll over:** one button moves all unfinished tasks to tomorrow.
- Navigation: ← yesterday / today / tomorrow →, plus jump to any date from the calendar.

### 3. Calendar (month view)

- Month grid; days colored by their template, template name visible.
- Click a day → open its Day view.
- Template stamping mode lives here (see above).

### 4. UI

- Minimal & calm: generous whitespace, soft colors, one accent color. Notion / Things 3 feeling.
- Light + dark mode.
- Responsive: works on phone and desktop browser.

## Data model (localStorage)

```ts
Template = { id, name, color, blocks: [{ id, time?, title }] }
DayPlan  = { date, templateId?, tasks: [{ id, time?, title, done }] }
Settings = { theme, enabledWidgets }
```

## Error handling

- Storage writes are wrapped; if localStorage is unavailable or full, the app shows a non-blocking warning and keeps working in memory.
- JSON import validates the schema and refuses corrupt files without destroying existing data.

## Testing

- Vitest unit tests for the storage layer and template-stamping logic (apply/remove/range).
- Manual smoke test checklist for UI flows before each release.

## Out of scope (post-MVP)

Habit tracker, Journal, Kanban board, desktop app (Tauri), cross-device sync, notifications, accounts.
