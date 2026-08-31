# Dienius MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dienius MVP - a modular, ADHD-friendly day planner with day templates stamped onto a calendar, a frictionless day view, and GitHub Pages deployment.

**Architecture:** Static React SPA. All state lives in a single store module persisted through a storage abstraction over localStorage. Pure logic (dates, stamping, parsing, sorting) is separated from React components and unit tested. Views: Day, Calendar (with template stamping), Templates, Settings.

**Tech Stack:** React 19, Vite, TypeScript, Vitest + Testing Library (jsdom), GitHub Actions + GitHub Pages.

## Global Constraints

- Repo is PUBLIC portfolio work. Everything must look professional and human-written.
- NEVER use an em-dash or en-dash anywhere (code, comments, UI copy, commits, docs). Always plain "-".
- Commit messages: conventional style (`feat:`, `fix:`, `chore:`, `test:`), short, imperative. NO Co-Authored-By trailers, no AI mentions.
- All repo text (code, comments, UI copy) in English.
- App ships empty: no seed templates, no demo tasks.
- Vite `base` must be `/dienius/` (GitHub Pages project site).
- Design: minimal and calm. Generous whitespace, soft colors, one accent color, light + dark mode.
- Working directory: `D:\Claude Code\Planner` (repo root, remote `https://github.com/Quicasha/dienius`).

**Cross-platform requirements (iOS Safari, Android Chrome, desktop):**

- Mobile-first CSS. Every view must be usable at 375px width without horizontal scroll.
- All interactive controls are at least 44x44px on touch screens.
- All text inputs use `font-size: 16px` or larger, otherwise iOS Safari zooms the page on focus.
- Respect safe-area insets so content clears the iPhone notch and home indicator: the viewport meta tag must include `viewport-fit=cover` and layout padding must use `env(safe-area-inset-*)`.
- No interaction may depend on hover alone; anything revealed on hover must also be reachable on touch.
- Use pointer events (not mouse events) for the calendar drag, with `touch-action: none` on draggable cells so iOS does not scroll instead of stamping.
- Use `-webkit-tap-highlight-color: transparent` and `overscroll-behavior-y: contain` so the app does not feel like a web page on iOS.

---

## File Structure

```
index.html
package.json
tsconfig.json
vite.config.ts
.gitignore
.github/workflows/deploy.yml
src/
  main.tsx              entry, mounts App
  App.tsx               shell: header, nav tabs, view switching, theme
  styles.css            design tokens (light/dark) + all component styles
  test/setup.ts         jest-dom setup
  lib/
    types.ts            Template, TemplateBlock, Task, DayPlan, Settings, AppData
    dates.ts            dateKey, todayKey, addDays, monthGrid, formatDayTitle
    storage.ts          load/save/validate/export/import over localStorage
    stamping.ts         applyStamps pure logic
    store.ts            app state + actions + useAppData hook
  widgets/
    registry.ts         widget registry (MVP: day-plan)
    day-plan/
      parse.ts          parseQuickAdd
      sort.ts           sortTasks
      DayView.tsx       day view component
  views/
    CalendarView.tsx    month grid + template stamping
    TemplatesView.tsx   create/edit/delete templates
    SettingsView.tsx    theme toggle, export/import, storage warning
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/test/setup.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: running Vite app rendering `App` with header text "Dienius", working `npm test` (Vitest + Testing Library), `npm run build`

- [ ] **Step 1: Write config and entry files**

`package.json`:

```json
{
  "name": "dienius",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

`.gitignore`:

```
node_modules
dist
*.local
.DS_Store
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="A modular day planner built around reusable day templates." />
    <meta name="theme-color" content="#fafaf8" />
    <title>Dienius</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/dienius/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Note: `"build": "tsc -b"` requires project references; since we use a single tsconfig with `noEmit`, change build script to `"build": "tsc --noEmit && vite build"` instead. Use that exact script.

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` (placeholder shell, replaced in Task 6):

```tsx
export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Dienius</span>
      </header>
    </div>
  )
}
```

`src/styles.css` (tokens only for now, full styles in Task 6):

```css
:root {
  --bg: #fafaf8;
  --surface: #ffffff;
  --text: #2b2b2b;
  --muted: #8a8a85;
  --border: #e8e6e1;
  --accent: #5b7cfa;
  --danger: #d96c6c;
  --radius: 10px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

[data-theme='dark'] {
  --bg: #191a1d;
  --surface: #222327;
  --text: #e8e8e5;
  --muted: #85858a;
  --border: #33343a;
  --accent: #7c94ff;
  --danger: #e08a8a;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

* { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: contain;
}

input,
button,
textarea {
  font-family: inherit;
  font-size: 16px;
}
```

The `font-size: 16px` floor on inputs is deliberate: iOS Safari zooms the whole page when a focused input is smaller than that.

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom
```

- [ ] **Step 3: Write smoke test**

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

test('renders the app brand', () => {
  render(<App />)
  expect(screen.getByText('Dienius')).toBeInTheDocument()
})
```

- [ ] **Step 4: Verify test and build pass**

Run: `npm test -- --run` - Expected: 1 test PASS.
Run: `npm run build` - Expected: builds `dist/` without errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TypeScript app with Vitest"
```

---

### Task 2: Types and date helpers

**Files:**
- Create: `src/lib/types.ts`, `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `types.ts`: `TemplateBlock { id: string; time?: string; title: string }`, `Template { id: string; name: string; color: string; blocks: TemplateBlock[] }`, `Task { id: string; time?: string; title: string; done: boolean; fromTemplate?: boolean }`, `DayPlan { date: string; templateId?: string; tasks: Task[] }`, `Settings { theme: 'light' | 'dark'; enabledWidgets: string[] }`, `AppData { templates: Template[]; days: Record<string, DayPlan>; settings: Settings }`
  - `dates.ts`: `dateKey(d: Date): string`, `todayKey(): string`, `addDays(key: string, n: number): string`, `monthGrid(year: number, month: number): MonthCell[]` where `MonthCell { key: string; inMonth: boolean }` (42 cells, Monday first), `formatDayTitle(key: string): string`

- [ ] **Step 1: Write failing tests**

`src/lib/dates.test.ts`:

```ts
import { dateKey, addDays, monthGrid, formatDayTitle } from './dates'

test('dateKey formats local date as YYYY-MM-DD', () => {
  expect(dateKey(new Date(2026, 8, 1))).toBe('2026-09-01')
})

test('addDays crosses month boundaries', () => {
  expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
})

test('monthGrid returns 42 cells starting on Monday', () => {
  const cells = monthGrid(2026, 8) // September 2026, Tuesday the 1st
  expect(cells).toHaveLength(42)
  expect(cells[0]).toEqual({ key: '2026-08-31', inMonth: false }) // Monday
  expect(cells[1]).toEqual({ key: '2026-09-01', inMonth: true })
})

test('formatDayTitle renders a readable title', () => {
  expect(formatDayTitle('2026-09-01')).toBe('Tuesday, September 1')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/dates.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement types and dates**

`src/lib/types.ts`:

```ts
export interface TemplateBlock {
  id: string
  time?: string
  title: string
}

export interface Template {
  id: string
  name: string
  color: string
  blocks: TemplateBlock[]
}

export interface Task {
  id: string
  time?: string
  title: string
  done: boolean
  fromTemplate?: boolean
}

export interface DayPlan {
  date: string
  templateId?: string
  tasks: Task[]
}

export interface Settings {
  theme: 'light' | 'dark'
  enabledWidgets: string[]
}

export interface AppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Settings
}
```

`src/lib/dates.ts`:

```ts
export interface MonthCell {
  key: string
  inMonth: boolean
}

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d + n))
}

export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i)
    cells.push({ key: dateKey(d), inMonth: d.getMonth() === month })
  }
  return cells
}

export function formatDayTitle(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/dates.test.ts` - Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add core types and date helpers"
```

---

### Task 3: Storage layer

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `AppData` from `types.ts`
- Produces: `STORAGE_KEY = 'dienius:data'`, `defaultData(): AppData`, `validate(x: unknown): x is AppData`, `loadData(): AppData`, `saveData(data: AppData): boolean` (false when localStorage throws), `exportJson(data: AppData): string`, `importJson(text: string): AppData` (throws `Error('Invalid Dienius backup file')` on bad input)

- [ ] **Step 1: Write failing tests**

`src/lib/storage.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest'
import { defaultData, loadData, saveData, importJson, exportJson, STORAGE_KEY } from './storage'

beforeEach(() => localStorage.clear())

test('loadData returns default data when storage is empty', () => {
  const data = loadData()
  expect(data.templates).toEqual([])
  expect(data.days).toEqual({})
  expect(data.settings.theme).toBe('light')
})

test('saveData then loadData round-trips', () => {
  const data = defaultData()
  data.templates.push({ id: 't1', name: 'Work day', color: '#8ab6f9', blocks: [] })
  expect(saveData(data)).toBe(true)
  expect(loadData().templates[0].name).toBe('Work day')
})

test('loadData falls back to defaults on corrupt JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')
  expect(loadData().templates).toEqual([])
})

test('importJson round-trips through exportJson', () => {
  const data = defaultData()
  data.days['2026-09-01'] = { date: '2026-09-01', tasks: [] }
  const imported = importJson(exportJson(data))
  expect(imported.days['2026-09-01'].date).toBe('2026-09-01')
})

test('importJson rejects invalid payloads', () => {
  expect(() => importJson('{"hello": 1}')).toThrow('Invalid Dienius backup file')
  expect(() => importJson('not json')).toThrow('Invalid Dienius backup file')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/storage.test.ts` - Expected: FAIL (module not found).

- [ ] **Step 3: Implement storage**

`src/lib/storage.ts`:

```ts
import type { AppData } from './types'

export const STORAGE_KEY = 'dienius:data'

export function defaultData(): AppData {
  return {
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  }
}

export function validate(x: unknown): x is AppData {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    Array.isArray(o.templates) &&
    typeof o.days === 'object' && o.days !== null && !Array.isArray(o.days) &&
    typeof o.settings === 'object' && o.settings !== null
  )
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : defaultData()
  } catch {
    return defaultData()
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importJson(text: string): AppData {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!validate(parsed)) throw new Error('invalid')
    return parsed
  } catch {
    throw new Error('Invalid Dienius backup file')
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/storage.test.ts` - Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add localStorage-backed storage layer with import and export"
```

---

### Task 4: Template stamping logic

**Files:**
- Create: `src/lib/stamping.ts`
- Test: `src/lib/stamping.test.ts`

**Interfaces:**
- Consumes: `DayPlan`, `Task`, `Template` from `types.ts`
- Produces: `applyStamps(days: Record<string, DayPlan>, templates: Template[], stamps: Record<string, string | null>): Record<string, DayPlan>`. A stamp value of a template id applies that template (copies blocks as tasks with `fromTemplate: true`, keeps manual tasks); `null` removes the template (keeps manual tasks). Re-applying replaces previous template tasks. Input `days` is never mutated.

- [ ] **Step 1: Write failing tests**

`src/lib/stamping.test.ts`:

```ts
import { applyStamps } from './stamping'
import type { DayPlan, Template } from './types'

const workDay: Template = {
  id: 't1',
  name: 'Work day',
  color: '#8ab6f9',
  blocks: [
    { id: 'b1', time: '09:00', title: 'Gym' },
    { id: 'b2', time: '10:00', title: 'Deep work' },
  ],
}

test('applying a template copies its blocks as tasks', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const day = days['2026-09-01']
  expect(day.templateId).toBe('t1')
  expect(day.tasks).toHaveLength(2)
  expect(day.tasks[0]).toMatchObject({ time: '09:00', title: 'Gym', done: false, fromTemplate: true })
})

test('applying keeps manual tasks and replaces old template tasks', () => {
  const existing: DayPlan = {
    date: '2026-09-01',
    templateId: 'old',
    tasks: [
      { id: 'x1', title: 'Old block', done: false, fromTemplate: true },
      { id: 'x2', title: 'Call mom', done: false },
    ],
  }
  const days = applyStamps({ '2026-09-01': existing }, [workDay], { '2026-09-01': 't1' })
  const titles = days['2026-09-01'].tasks.map(t => t.title)
  expect(titles).toEqual(['Gym', 'Deep work', 'Call mom'])
})

test('stamping null removes template tasks but keeps manual tasks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks.push({ id: 'm1', title: 'Manual', done: false })
  const cleared = applyStamps(stamped, [workDay], { '2026-09-01': null })
  expect(cleared['2026-09-01'].templateId).toBeUndefined()
  expect(cleared['2026-09-01'].tasks.map(t => t.title)).toEqual(['Manual'])
})

test('does not mutate the input days object', () => {
  const days: Record<string, DayPlan> = {}
  applyStamps(days, [workDay], { '2026-09-01': 't1' })
  expect(days).toEqual({})
})

test('unknown template id leaves the day untouched', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 'missing' })
  expect(days['2026-09-01']).toBeUndefined()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/stamping.test.ts` - Expected: FAIL.

- [ ] **Step 3: Implement stamping**

`src/lib/stamping.ts`:

```ts
import type { DayPlan, Task, Template } from './types'

export function applyStamps(
  days: Record<string, DayPlan>,
  templates: Template[],
  stamps: Record<string, string | null>,
): Record<string, DayPlan> {
  const next = { ...days }
  for (const [date, templateId] of Object.entries(stamps)) {
    const existing = next[date] ?? { date, tasks: [] }
    const manual = existing.tasks.filter(t => !t.fromTemplate)
    if (templateId === null) {
      next[date] = { date, tasks: manual }
      continue
    }
    const template = templates.find(t => t.id === templateId)
    if (!template) continue
    const templateTasks: Task[] = template.blocks.map(b => ({
      id: crypto.randomUUID(),
      time: b.time,
      title: b.title,
      done: false,
      fromTemplate: true,
    }))
    next[date] = { date, templateId, tasks: [...templateTasks, ...manual] }
  }
  return next
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/stamping.test.ts` - Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stamping.ts src/lib/stamping.test.ts
git commit -m "feat: add template stamping logic"
```

---

### Task 5: Store with actions

**Files:**
- Create: `src/lib/store.ts`
- Test: `src/lib/store.test.ts`

**Interfaces:**
- Consumes: `loadData`, `saveData`, `importJson` from `storage.ts`; `applyStamps` from `stamping.ts`; `addDays` from `dates.ts`; types
- Produces:
  - `getData(): AppData`, `subscribe(fn: () => void): () => void`, `getSaveOk(): boolean`
  - `useAppData(): AppData` (React hook via `useSyncExternalStore`)
  - `actions`: `addTask(date: string, title: string, time?: string): void`, `toggleTask(date: string, taskId: string): void`, `deleteTask(date: string, taskId: string): void`, `rolloverUnfinished(date: string): number`, `addTemplate(input: { name: string; color: string; blocks: { time?: string; title: string }[] }): Template`, `updateTemplate(t: Template): void`, `deleteTemplate(id: string): void`, `stamp(stamps: Record<string, string | null>): void`, `setTheme(theme: 'light' | 'dark'): void`, `importData(text: string): void` (throws on invalid), `resetForTests(data: AppData): void`

- [ ] **Step 1: Write failing tests**

`src/lib/store.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('addTask adds a task to the given day', () => {
  actions.addTask('2026-09-01', 'Call mom', '14:00')
  const day = getData().days['2026-09-01']
  expect(day.tasks).toHaveLength(1)
  expect(day.tasks[0]).toMatchObject({ title: 'Call mom', time: '14:00', done: false })
})

test('toggleTask flips done', () => {
  actions.addTask('2026-09-01', 'Gym')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.toggleTask('2026-09-01', id)
  expect(getData().days['2026-09-01'].tasks[0].done).toBe(true)
  actions.toggleTask('2026-09-01', id)
  expect(getData().days['2026-09-01'].tasks[0].done).toBe(false)
})

test('rolloverUnfinished moves unfinished tasks to the next day', () => {
  actions.addTask('2026-09-01', 'Done thing')
  actions.addTask('2026-09-01', 'Not done')
  const doneId = getData().days['2026-09-01'].tasks[0].id
  actions.toggleTask('2026-09-01', doneId)
  const moved = actions.rolloverUnfinished('2026-09-01')
  expect(moved).toBe(1)
  expect(getData().days['2026-09-01'].tasks.map(t => t.title)).toEqual(['Done thing'])
  expect(getData().days['2026-09-02'].tasks.map(t => t.title)).toEqual(['Not done'])
})

test('addTemplate assigns ids and stamp applies it', () => {
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  actions.stamp({ '2026-09-01': t.id })
  expect(getData().days['2026-09-01'].templateId).toBe(t.id)
  expect(getData().days['2026-09-01'].tasks[0].title).toBe('Gym')
})

test('deleteTemplate removes the template but keeps stamped days', () => {
  const t = actions.addTemplate({ name: 'X', color: '#f9d48a', blocks: [] })
  actions.stamp({ '2026-09-01': t.id })
  actions.deleteTemplate(t.id)
  expect(getData().templates).toHaveLength(0)
  expect(getData().days['2026-09-01']).toBeDefined()
})

test('state persists to localStorage', () => {
  actions.addTask('2026-09-01', 'Persist me')
  const raw = localStorage.getItem('dienius:data')!
  expect(raw).toContain('Persist me')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/store.test.ts` - Expected: FAIL.

- [ ] **Step 3: Implement store**

`src/lib/store.ts`:

```ts
import { useSyncExternalStore } from 'react'
import type { AppData, DayPlan, Template } from './types'
import { importJson, loadData, saveData } from './storage'
import { applyStamps } from './stamping'
import { addDays } from './dates'

let data: AppData = loadData()
let saveOk = true
const listeners = new Set<() => void>()

function commit(next: AppData): void {
  data = next
  saveOk = saveData(data)
  listeners.forEach(fn => fn())
}

export function getData(): AppData {
  return data
}

export function getSaveOk(): boolean {
  return saveOk
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData)
}

function dayOf(date: string): DayPlan {
  return data.days[date] ?? { date, tasks: [] }
}

function withDay(date: string, day: DayPlan): AppData {
  return { ...data, days: { ...data.days, [date]: day } }
}

export const actions = {
  addTask(date: string, title: string, time?: string): void {
    const day = dayOf(date)
    const task = { id: crypto.randomUUID(), title, time, done: false }
    commit(withDay(date, { ...day, tasks: [...day.tasks, task] }))
  },

  toggleTask(date: string, taskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t)),
    }))
  },

  deleteTask(date: string, taskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, { ...day, tasks: day.tasks.filter(t => t.id !== taskId) }))
  },

  rolloverUnfinished(date: string): number {
    const day = data.days[date]
    if (!day) return 0
    const unfinished = day.tasks.filter(t => !t.done)
    if (unfinished.length === 0) return 0
    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    const moved = unfinished.map(t => ({ ...t, fromTemplate: false }))
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day, tasks: day.tasks.filter(t => t.done) },
        [targetDate]: { ...target, tasks: [...target.tasks, ...moved] },
      },
    })
    return moved.length
  },

  addTemplate(input: { name: string; color: string; blocks: { time?: string; title: string }[] }): Template {
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      blocks: input.blocks.map(b => ({ id: crypto.randomUUID(), time: b.time, title: b.title })),
    }
    commit({ ...data, templates: [...data.templates, template] })
    return template
  },

  updateTemplate(template: Template): void {
    commit({
      ...data,
      templates: data.templates.map(t => (t.id === template.id ? template : t)),
    })
  },

  deleteTemplate(id: string): void {
    commit({ ...data, templates: data.templates.filter(t => t.id !== id) })
  },

  stamp(stamps: Record<string, string | null>): void {
    commit({ ...data, days: applyStamps(data.days, data.templates, stamps) })
  },

  setTheme(theme: 'light' | 'dark'): void {
    commit({ ...data, settings: { ...data.settings, theme } })
  },

  importData(text: string): void {
    commit(importJson(text))
  },

  resetForTests(next: AppData): void {
    data = next
    saveOk = true
    listeners.forEach(fn => fn())
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/store.test.ts` - Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: add app store with task, template and stamping actions"
```

---

### Task 6: App shell, widget registry, settings view, full styles

**Files:**
- Create: `src/widgets/registry.ts`, `src/views/SettingsView.tsx`
- Modify: `src/App.tsx`, `src/styles.css`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `useAppData`, `actions`, `getSaveOk` from `store.ts`; `todayKey` from `dates.ts`
- Produces:
  - `registry.ts`: `WidgetDef { id: string; title: string }`, `WIDGETS: WidgetDef[]` containing `{ id: 'day-plan', title: 'Day plan' }`
  - `App` renders header (brand + nav tabs Today / Calendar / Templates / Settings) and switches views. It owns `view` and `selectedDate` state and passes `date`/`onDateChange` to `DayView`, `onOpenDay` to `CalendarView`. Until Tasks 7-9 land, it renders placeholder `<p>` elements for day/calendar/templates views; each later task swaps its placeholder for the real component.
  - Theme applied via `document.documentElement.dataset.theme`

- [ ] **Step 1: Write failing tests**

Replace `src/App.test.tsx`:

```tsx
import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { actions } from './lib/store'
import { defaultData } from './lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('renders brand and nav tabs', () => {
  render(<App />)
  expect(screen.getByText('Dienius')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
})

test('settings view toggles theme', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('button', { name: 'Dark' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx` - Expected: FAIL.

- [ ] **Step 3: Implement registry, shell and settings**

`src/widgets/registry.ts`:

```ts
export interface WidgetDef {
  id: string
  title: string
}

export const WIDGETS: WidgetDef[] = [
  { id: 'day-plan', title: 'Day plan' },
]
```

`src/views/SettingsView.tsx`:

```tsx
import { useRef, useState } from 'react'
import { actions, getSaveOk, useAppData } from '../lib/store'
import { exportJson } from '../lib/storage'

export function SettingsView() {
  const data = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')

  function handleExport() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dienius-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    try {
      actions.importData(await file.text())
      setImportError('')
    } catch {
      setImportError('That file is not a valid Dienius backup.')
    }
  }

  return (
    <section className="settings">
      <h2>Settings</h2>
      {!getSaveOk() && (
        <p className="warning">Saving to this browser failed. Your changes only live in memory - export a backup.</p>
      )}
      <div className="settings-group">
        <h3>Theme</h3>
        <div className="segmented">
          <button
            className={data.settings.theme === 'light' ? 'active' : ''}
            onClick={() => actions.setTheme('light')}
          >
            Light
          </button>
          <button
            className={data.settings.theme === 'dark' ? 'active' : ''}
            onClick={() => actions.setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>
      <div className="settings-group">
        <h3>Data</h3>
        <div className="row">
          <button onClick={handleExport}>Export backup</button>
          <button onClick={() => fileRef.current?.click()}>Import backup</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={e => handleImport(e.target.files?.[0])}
        />
        {importError && <p className="warning">{importError}</p>}
      </div>
    </section>
  )
}
```

Replace `src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { todayKey } from './lib/dates'
import { useAppData } from './lib/store'
import { SettingsView } from './views/SettingsView'

type View = 'day' | 'calendar' | 'templates' | 'settings'

const TABS: { view: View; label: string }[] = [
  { view: 'day', label: 'Today' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'templates', label: 'Templates' },
  { view: 'settings', label: 'Settings' },
]

export function App() {
  const data = useAppData()
  const [view, setView] = useState<View>('day')
  const [selectedDate, setSelectedDate] = useState(todayKey())

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme
  }, [data.settings.theme])

  function openDay(date: string) {
    setSelectedDate(date)
    setView('day')
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Dienius</span>
        <nav>
          {TABS.map(tab => (
            <button
              key={tab.view}
              className={view === tab.view ? 'active' : ''}
              onClick={() => (tab.view === 'day' ? openDay(todayKey()) : setView(tab.view))}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {view === 'day' && <p>Day view coming soon for {selectedDate}</p>}
        {view === 'calendar' && <p>Calendar coming soon</p>}
        {view === 'templates' && <p>Templates coming soon</p>}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
```

Append to `src/styles.css` (after the token block from Task 1):

```css
.app {
  max-width: 760px;
  margin: 0 auto;
  padding-inline: max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right));
  padding-bottom: calc(64px + env(safe-area-inset-bottom));
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: calc(20px + env(safe-area-inset-top));
  padding-bottom: 16px;
}

.brand {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

nav {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: flex-end;
}

nav button {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 15px;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
}

nav button:hover { color: var(--text); }

nav button.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}

button {
  cursor: pointer;
  min-height: 44px;
}

h2 { font-size: 20px; margin: 8px 0 16px; }
h3 { font-size: 14px; color: var(--muted); margin: 0 0 8px; font-weight: 600; }

.settings-group { margin-bottom: 28px; }

.segmented {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.segmented button {
  border: none;
  background: none;
  color: var(--muted);
  padding: 8px 16px;
}

.segmented button.active {
  background: var(--accent);
  color: #fff;
}

.row { display: flex; gap: 8px; flex-wrap: wrap; }

.row button,
.settings-group > button {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 8px 14px;
}

.warning {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 14px;
}
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test -- --run` - Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add app shell with navigation, settings view and theme support"
```

---

### Task 7: Day plan widget (quick add, sorting, check-off, rollover)

**Files:**
- Create: `src/widgets/day-plan/parse.ts`, `src/widgets/day-plan/sort.ts`, `src/widgets/day-plan/DayView.tsx`
- Test: `src/widgets/day-plan/parse.test.ts`, `src/widgets/day-plan/sort.test.ts`, `src/widgets/day-plan/DayView.test.tsx`
- Modify: `src/App.tsx` (replace day placeholder), `src/styles.css`

**Interfaces:**
- Consumes: `actions`, `useAppData` from `store.ts`; `addDays`, `formatDayTitle`, `todayKey` from `dates.ts`; `Task` type
- Produces:
  - `parseQuickAdd(input: string): { title: string; time?: string } | null`
  - `sortTasks(tasks: Task[]): Task[]` (timed first ascending, untimed after, stable)
  - `DayView({ date, onDateChange }: { date: string; onDateChange: (date: string) => void })`

- [ ] **Step 1: Write failing logic tests**

`src/widgets/day-plan/parse.test.ts`:

```ts
import { parseQuickAdd } from './parse'

test('parses a leading HH:MM time', () => {
  expect(parseQuickAdd('14:00 Call mom')).toEqual({ time: '14:00', title: 'Call mom' })
})

test('pads single digit hours', () => {
  expect(parseQuickAdd('9:30 Gym')).toEqual({ time: '09:30', title: 'Gym' })
})

test('treats plain text as an untimed task', () => {
  expect(parseQuickAdd('Buy milk')).toEqual({ title: 'Buy milk' })
})

test('returns null for empty input', () => {
  expect(parseQuickAdd('   ')).toBeNull()
})
```

`src/widgets/day-plan/sort.test.ts`:

```ts
import { sortTasks } from './sort'
import type { Task } from '../../lib/types'

function task(title: string, time?: string): Task {
  return { id: title, title, time, done: false }
}

test('sorts timed tasks ascending with untimed at the bottom', () => {
  const sorted = sortTasks([task('c'), task('b', '14:00'), task('a', '09:00'), task('d')])
  expect(sorted.map(t => t.title)).toEqual(['a', 'b', 'c', 'd'])
})

test('does not mutate the input', () => {
  const input = [task('b', '14:00'), task('a', '09:00')]
  sortTasks(input)
  expect(input[0].title).toBe('b')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/widgets` - Expected: FAIL.

- [ ] **Step 3: Implement parse and sort**

`src/widgets/day-plan/parse.ts`:

```ts
export function parseQuickAdd(input: string): { title: string; time?: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = /^([01]?\d|2[0-3]):([0-5]\d)\s+(.+)$/.exec(trimmed)
  if (match) {
    return { time: `${match[1].padStart(2, '0')}:${match[2]}`, title: match[3] }
  }
  return { title: trimmed }
}
```

`src/widgets/day-plan/sort.ts`:

```ts
import type { Task } from '../../lib/types'

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return 0
  })
}
```

Run: `npm test -- --run src/widgets` - Expected: parse and sort tests PASS.

- [ ] **Step 4: Write failing component test**

`src/widgets/day-plan/DayView.test.tsx`:

```tsx
import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from './DayView'
import { actions } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('quick add creates a task on Enter', async () => {
  const user = userEvent.setup()
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.type(screen.getByPlaceholderText(/add a task/i), '14:00 Call mom{Enter}')
  expect(screen.getByText('Call mom')).toBeInTheDocument()
  expect(screen.getByText('14:00')).toBeInTheDocument()
})

test('clicking a task toggles done', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Gym')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('checkbox', { name: /gym/i }))
  expect(screen.getByRole('checkbox', { name: /gym/i })).toBeChecked()
})

test('rollover button moves unfinished tasks to tomorrow', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Unfinished')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: /move .* to tomorrow/i }))
  expect(screen.queryByText('Unfinished')).not.toBeInTheDocument()
})

test('arrows navigate between days', async () => {
  const user = userEvent.setup()
  let navigated = ''
  render(<DayView date="2026-09-01" onDateChange={d => (navigated = d)} />)
  await user.click(screen.getByRole('button', { name: 'Next day' }))
  expect(navigated).toBe('2026-09-02')
})
```

Run: `npm test -- --run src/widgets/day-plan/DayView.test.tsx` - Expected: FAIL.

- [ ] **Step 5: Implement DayView**

`src/widgets/day-plan/DayView.tsx`:

```tsx
import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { parseQuickAdd } from './parse'
import { sortTasks } from './sort'

interface DayViewProps {
  date: string
  onDateChange: (date: string) => void
}

export function DayView({ date, onDateChange }: DayViewProps) {
  const data = useAppData()
  const [input, setInput] = useState('')
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = day?.templateId
    ? data.templates.find(t => t.id === day.templateId)
    : undefined
  const unfinished = tasks.filter(t => !t.done).length
  const isToday = date === todayKey()

  function handleAdd() {
    const parsed = parseQuickAdd(input)
    if (!parsed) return
    actions.addTask(date, parsed.title, parsed.time)
    setInput('')
  }

  return (
    <section className="day-view">
      <div className="day-nav">
        <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
          &larr;
        </button>
        <div className="day-title">
          <h2>{isToday ? 'Today' : formatDayTitle(date)}</h2>
          {isToday && <span className="day-subtitle">{formatDayTitle(date)}</span>}
          {template && (
            <span className="day-template" style={{ background: template.color }}>
              {template.name}
            </span>
          )}
        </div>
        <button aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
          &rarr;
        </button>
      </div>

      <input
        className="quick-add"
        placeholder="Add a task... try 14:00 Call mom"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />

      {tasks.length === 0 && <p className="empty">Nothing planned. Add a task above or stamp a template from the calendar.</p>}

      <ul className="task-list">
        {tasks.map(task => (
          <li key={task.id} className={task.done ? 'task done' : 'task'}>
            <label>
              <input
                type="checkbox"
                checked={task.done}
                aria-label={task.title}
                onChange={() => actions.toggleTask(date, task.id)}
              />
              <span className="check" aria-hidden="true" />
              {task.time && <span className="task-time">{task.time}</span>}
              <span className="task-title">{task.title}</span>
            </label>
            <button
              className="task-delete"
              aria-label={`Delete ${task.title}`}
              onClick={() => actions.deleteTask(date, task.id)}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      {unfinished > 0 && (
        <button className="rollover" onClick={() => actions.rolloverUnfinished(date)}>
          Move {unfinished} unfinished to tomorrow
        </button>
      )}
    </section>
  )
}
```

In `src/App.tsx`: add `import { DayView } from './widgets/day-plan/DayView'` and replace the day placeholder line with:

```tsx
{view === 'day' && <DayView date={selectedDate} onDateChange={setSelectedDate} />}
```

Append to `src/styles.css`:

```css
.day-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.day-nav > button {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  width: 38px;
  height: 38px;
  font-size: 16px;
}

.day-title { text-align: center; }
.day-title h2 { margin: 0; }
.day-subtitle { color: var(--muted); font-size: 13px; }

.day-template {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.quick-add {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 13px 16px;
  margin-bottom: 16px;
}

.quick-add:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.empty { color: var(--muted); text-align: center; padding: 32px 0; }

.task-list { list-style: none; margin: 0; padding: 0; }

.task {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  padding: 0 8px 0 14px;
  box-shadow: var(--shadow);
}

.task label {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  padding: 12px 0;
  cursor: pointer;
}

.task input[type='checkbox'] {
  position: absolute;
  opacity: 0;
  width: 0;
}

.check {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: 2px solid var(--border);
  border-radius: 6px;
  transition: background 0.15s, border-color 0.15s;
}

.task input:checked + .check {
  background: var(--accent);
  border-color: var(--accent);
  animation: pop 0.25s ease;
}

@keyframes pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

.task-time { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.task-title { transition: opacity 0.2s; }
.task.done .task-title { text-decoration: line-through; opacity: 0.45; }

.task-delete {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 20px;
  min-width: 44px;
  padding: 8px;
}

/* Fade the delete button in on hover only where a real pointer exists.
   On touch devices it stays visible, since there is no hover state. */
@media (hover: hover) and (pointer: fine) {
  .task-delete { opacity: 0; transition: opacity 0.15s; }
  .task:hover .task-delete,
  .task-delete:focus-visible { opacity: 1; }
}

.rollover {
  width: 100%;
  margin-top: 12px;
  background: none;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--muted);
  padding: 10px;
}

.rollover:hover { color: var(--text); border-color: var(--muted); }
```

- [ ] **Step 6: Run all tests to verify they pass**

Run: `npm test -- --run` - Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add day plan view with quick add, check-off and rollover"
```

---

### Task 8: Templates view

**Files:**
- Create: `src/views/TemplatesView.tsx`
- Test: `src/views/TemplatesView.test.tsx`
- Modify: `src/App.tsx` (replace templates placeholder), `src/styles.css`

**Interfaces:**
- Consumes: `actions`, `useAppData` from `store.ts`; `Template` type
- Produces: `TemplatesView()` component; exported `TEMPLATE_COLORS: string[]` palette (template colors are stored on the template itself, so other views read `template.color`)

- [ ] **Step 1: Write failing test**

`src/views/TemplatesView.test.tsx`:

```tsx
import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesView } from './TemplatesView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('creates a template with a block', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Work day')
  expect(saved[0].blocks[0]).toMatchObject({ time: '09:00', title: 'Gym' })
})

test('deletes a template', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Delete Old' }))
  expect(getData().templates).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/views/TemplatesView.test.tsx` - Expected: FAIL.

- [ ] **Step 3: Implement TemplatesView**

`src/views/TemplatesView.tsx`:

```tsx
import { useState } from 'react'
import { actions, useAppData } from '../lib/store'
import type { Template } from '../lib/types'

export const TEMPLATE_COLORS = [
  '#a7c4f5', '#f5b0a7', '#a7e3bd', '#f5db9e',
  '#c9b3f0', '#f0b3d5', '#9ed9e8', '#cde39e',
]

interface DraftBlock {
  time: string
  title: string
}

interface Draft {
  id?: string
  name: string
  color: string
  blocks: DraftBlock[]
}

const emptyDraft = (): Draft => ({ name: '', color: TEMPLATE_COLORS[0], blocks: [] })

export function TemplatesView() {
  const data = useAppData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')

  function startEdit(t: Template) {
    setDraft({
      id: t.id,
      name: t.name,
      color: t.color,
      blocks: t.blocks.map(b => ({ time: b.time ?? '', title: b.title })),
    })
  }

  function addBlock() {
    if (!draft || !blockTitle.trim()) return
    setDraft({
      ...draft,
      blocks: [...draft.blocks, { time: blockTime.trim(), title: blockTitle.trim() }],
    })
    setBlockTime('')
    setBlockTitle('')
  }

  function removeBlock(index: number) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) })
  }

  function save() {
    if (!draft || !draft.name.trim()) return
    const blocks = draft.blocks.map(b => ({
      time: b.time || undefined,
      title: b.title,
    }))
    if (draft.id) {
      const existing = data.templates.find(t => t.id === draft.id)
      if (existing) {
        actions.updateTemplate({
          ...existing,
          name: draft.name.trim(),
          color: draft.color,
          blocks: blocks.map(b => ({ id: crypto.randomUUID(), ...b })),
        })
      }
    } else {
      actions.addTemplate({ name: draft.name.trim(), color: draft.color, blocks })
    }
    setDraft(null)
  }

  return (
    <section className="templates">
      <div className="templates-header">
        <h2>Templates</h2>
        {!draft && (
          <button className="primary" onClick={() => setDraft(emptyDraft())}>
            New template
          </button>
        )}
      </div>

      {draft && (
        <div className="template-editor">
          <input
            placeholder="Template name"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="palette">
            {TEMPLATE_COLORS.map(color => (
              <button
                key={color}
                aria-label={`Color ${color}`}
                className={draft.color === color ? 'swatch selected' : 'swatch'}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, color })}
              />
            ))}
          </div>
          <ul className="block-list">
            {draft.blocks.map((b, i) => (
              <li key={i}>
                <span className="task-time">{b.time || '--:--'}</span>
                <span>{b.title}</span>
                <button aria-label={`Remove ${b.title}`} onClick={() => removeBlock(i)}>
                  &times;
                </button>
              </li>
            ))}
          </ul>
          <div className="block-add">
            <input
              className="time-input"
              placeholder="09:00"
              value={blockTime}
              onChange={e => setBlockTime(e.target.value)}
            />
            <input
              placeholder="What happens"
              value={blockTitle}
              onChange={e => setBlockTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBlock()}
            />
            <button onClick={addBlock}>Add block</button>
          </div>
          <div className="row">
            <button className="primary" onClick={save}>Save template</button>
            <button onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!draft && data.templates.length === 0 && (
        <p className="empty">No templates yet. Create one, then stamp it onto days in the calendar.</p>
      )}

      <ul className="template-list">
        {data.templates.map(t => (
          <li key={t.id} className="template-card">
            <span className="dot" style={{ background: t.color }} />
            <div className="template-info">
              <strong>{t.name}</strong>
              <span className="muted">
                {t.blocks.length} {t.blocks.length === 1 ? 'block' : 'blocks'}
              </span>
            </div>
            <button onClick={() => startEdit(t)}>Edit</button>
            <button aria-label={`Delete ${t.name}`} onClick={() => actions.deleteTemplate(t.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

In `src/App.tsx`: import `TemplatesView` and replace the templates placeholder with `{view === 'templates' && <TemplatesView />}`.

Append to `src/styles.css`:

```css
.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

button.primary {
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  color: #fff;
  padding: 9px 16px;
}

.template-editor {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-editor input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 11px 12px;
  min-width: 0;
}

.palette { display: flex; gap: 10px; flex-wrap: wrap; }

.swatch {
  width: 32px;
  height: 32px;
  min-height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
}

.swatch.selected { border-color: var(--text); }

.block-list { list-style: none; margin: 0; padding: 0; }

.block-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.block-list button {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 16px;
}

.block-add { display: flex; gap: 8px; flex-wrap: wrap; }
.block-add input { flex: 1 1 120px; }
.block-add .time-input { flex: 0 0 82px; }
.block-add button {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0 12px;
  white-space: nowrap;
}

.template-list { list-style: none; margin: 0; padding: 0; }

.template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 8px;
}

.template-card .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.template-info { display: flex; flex-direction: column; flex: 1; }
.muted { color: var(--muted); font-size: 13px; }

.template-card button {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--muted);
  padding: 6px 12px;
}

.template-card button:hover { color: var(--text); }
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test -- --run` - Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add templates view with editor and color palette"
```

---

### Task 9: Calendar view with template stamping

**Files:**
- Create: `src/views/CalendarView.tsx`
- Test: `src/views/CalendarView.test.tsx`
- Modify: `src/App.tsx` (replace calendar placeholder, pass `onOpenDay`), `src/styles.css`

**Interfaces:**
- Consumes: `actions`, `useAppData` from `store.ts`; `monthGrid`, `todayKey` from `dates.ts`
- Produces: `CalendarView({ onOpenDay }: { onOpenDay: (date: string) => void })`
- Behavior:
  - Month grid with prev/next month buttons and month title (e.g. "September 2026")
  - Template chips above grid; clicking a chip enters stamp mode (click again to exit)
  - In stamp mode: clicking a day toggles the selected template on it (staged, not saved); pointer-drag across days applies the template to each day entered (drag from an already-stamped-with-same-template day erases instead)
  - Staged changes show immediately via cell color; Save and Cancel buttons appear when staged changes exist; Save calls `actions.stamp(staged)`
  - Outside stamp mode, clicking a day calls `onOpenDay(date)`
  - Cells show day number and, when a template applies, its color as background and name below the number

- [ ] **Step 1: Write failing test**

`src/views/CalendarView.test.tsx`:

```tsx
import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from './CalendarView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('clicking a day outside stamp mode opens it', async () => {
  const user = userEvent.setup()
  let opened = ''
  render(<CalendarView onOpenDay={d => (opened = d)} />)
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(opened).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('stamping a day stages it and save commits it', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({
    name: 'Work day',
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: 'Gym' }],
  })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  await user.click(screen.getAllByRole('gridcell')[10])
  expect(getData().days).toEqual({})
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const stamped = Object.values(getData().days)
  expect(stamped).toHaveLength(1)
  expect(stamped[0].templateId).toBe(t.id)
  expect(stamped[0].tasks[0].title).toBe('Gym')
})

test('clicking a stamped day again stages removal', async () => {
  const user = userEvent.setup()
  const t = actions.addTemplate({ name: 'Work day', color: '#a7c4f5', blocks: [] })
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  const cell = screen.getAllByRole('gridcell')[10]
  await user.click(cell)
  await user.click(cell)
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const days = Object.values(getData().days)
  expect(days.every(d => d.templateId !== t.id)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/views/CalendarView.test.tsx` - Expected: FAIL.

- [ ] **Step 3: Implement CalendarView**

`src/views/CalendarView.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { monthGrid, todayKey } from '../lib/dates'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CalendarViewProps {
  onOpenDay: (date: string) => void
}

export function CalendarView({ onOpenDay }: CalendarViewProps) {
  const data = useAppData()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [stampTemplateId, setStampTemplateId] = useState<string | null>(null)
  const [staged, setStaged] = useState<Record<string, string | null>>({})
  const painting = useRef<'apply' | 'erase' | null>(null)

  const cells = useMemo(() => monthGrid(year, month), [year, month])
  const today = todayKey()

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function effectiveTemplateId(date: string): string | null {
    if (date in staged) return staged[date]
    return data.days[date]?.templateId ?? null
  }

  function stampCell(date: string, mode: 'apply' | 'erase') {
    if (!stampTemplateId) return
    setStaged(prev => ({ ...prev, [date]: mode === 'apply' ? stampTemplateId : null }))
  }

  function handlePointerDown(date: string) {
    if (!stampTemplateId) return
    const mode = effectiveTemplateId(date) === stampTemplateId ? 'erase' : 'apply'
    painting.current = mode
    stampCell(date, mode)
  }

  function handlePointerEnter(date: string) {
    if (painting.current) stampCell(date, painting.current)
  }

  function endPainting() {
    painting.current = null
  }

  function selectTemplate(id: string) {
    setStampTemplateId(prev => (prev === id ? null : id))
  }

  function save() {
    actions.stamp(staged)
    setStaged({})
    setStampTemplateId(null)
  }

  function cancel() {
    setStaged({})
    setStampTemplateId(null)
  }

  const hasChanges = Object.keys(staged).length > 0

  return (
    <section className="calendar" onPointerUp={endPainting} onPointerLeave={endPainting}>
      <div className="calendar-nav">
        <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>&larr;</button>
        <h2>{MONTHS[month]} {year}</h2>
        <button aria-label="Next month" onClick={() => shiftMonth(1)}>&rarr;</button>
      </div>

      {data.templates.length > 0 && (
        <div className="stamp-bar">
          <span className="muted">Stamp:</span>
          {data.templates.map(t => (
            <button
              key={t.id}
              className={stampTemplateId === t.id ? 'chip selected' : 'chip'}
              style={{ background: t.color }}
              onClick={() => selectTemplate(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="calendar-grid" role="grid">
        {WEEKDAYS.map(d => (
          <span key={d} className="weekday">{d}</span>
        ))}
        {cells.map(cell => {
          const templateId = effectiveTemplateId(cell.key)
          const template = templateId ? data.templates.find(t => t.id === templateId) : undefined
          const classes = [
            'cell',
            cell.inMonth ? '' : 'outside',
            cell.key === today ? 'today' : '',
            cell.key in staged ? 'staged' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={cell.key}
              role="gridcell"
              className={classes}
              style={template ? { background: template.color } : undefined}
              onPointerDown={() => handlePointerDown(cell.key)}
              onPointerEnter={() => handlePointerEnter(cell.key)}
              onClick={() => !stampTemplateId && onOpenDay(cell.key)}
            >
              <span className="cell-num">{Number(cell.key.slice(8))}</span>
              {template && <span className="cell-template">{template.name}</span>}
            </button>
          )
        })}
      </div>

      {hasChanges && (
        <div className="stamp-actions">
          <button className="primary" onClick={save}>Save</button>
          <button onClick={cancel}>Cancel</button>
        </div>
      )}

      {stampTemplateId && !hasChanges && (
        <p className="muted stamp-hint">Click or drag across days to stamp. Click a stamped day to clear it.</p>
      )}
    </section>
  )
}
```

In `src/App.tsx`: import `CalendarView` and replace the calendar placeholder with `{view === 'calendar' && <CalendarView onOpenDay={openDay} />}`.

Append to `src/styles.css`:

```css
.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.calendar-nav button {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  width: 38px;
  height: 38px;
  font-size: 16px;
}

.calendar-nav h2 { margin: 0; }

.stamp-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.chip {
  border: 2px solid transparent;
  border-radius: 999px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  padding: 5px 12px;
}

.chip.selected { border-color: var(--text); }

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday {
  color: var(--muted);
  font-size: 12px;
  text-align: center;
  padding: 4px 0;
}

.cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 6px 2px;
  overflow: hidden;
  touch-action: none;
}

.cell.outside { opacity: 0.35; }
.cell.today { border-color: var(--accent); border-width: 2px; }
.cell.staged { outline: 2px dashed var(--accent); outline-offset: -2px; }

.cell-num { font-size: 13px; font-weight: 600; }

.cell-template {
  font-size: 10px;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.6);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* On narrow phones the template name does not fit inside a calendar cell,
   so the cell color carries the meaning and the name is hidden. */
@media (max-width: 420px) {
  .calendar-grid { gap: 3px; }
  .cell { padding: 5px 1px; }
  .cell-template { display: none; }
}

.stamp-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}

.stamp-actions button {
  border-radius: var(--radius);
  padding: 9px 24px;
}

.stamp-actions button:not(.primary) {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}

.stamp-hint { text-align: center; margin-top: 12px; }
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test -- --run` - Expected: all PASS.

- [ ] **Step 5: Manual smoke test**

Run the dev server and verify in the browser at desktop width:
- Create a template with 2 blocks in Templates
- Calendar: select the chip, click 3 days, drag across a week, Save
- Days show the color and name; open a day, tasks are there
- Check off a task (animation plays), add "14:00 Test" via quick add
- Toggle dark mode in Settings

Then switch the browser to a 375x812 mobile viewport (iPhone size) and verify:
- No horizontal scrolling on any view
- The delete button on a task is visible without hovering
- Dragging across calendar cells stamps them instead of scrolling the page
- Tapping a text input does not zoom the page

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add calendar view with template stamping"
```

---

### Task 10: GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run build` from Task 1
- Produces: live site at `https://quicasha.github.io/dienius/`, deployed on every push to `main`

- [ ] **Step 1: Write the workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test -- --run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Enable Pages via workflow build type**

Run:

```bash
gh api -X POST repos/Quicasha/dienius/pages -f build_type=workflow
```

If it returns "already exists", run instead:

```bash
gh api -X PUT repos/Quicasha/dienius/pages -f build_type=workflow
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy to GitHub Pages on push to main"
git push
```

- [ ] **Step 4: Verify deployment**

Run: `gh run watch` (or `gh run list --limit 1`) until the workflow succeeds.
Then open `https://quicasha.github.io/dienius/` and confirm the app loads, a task can be added, and refresh keeps the data.

---

## Post-MVP backlog (not in this plan)

README with screenshots, habit tracker widget, journal widget, kanban widget, desktop app, cross-device sync.
