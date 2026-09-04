import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: a real Chromium against the built app.
 *
 * Everything else in this repo is unit or jsdom-level, which is exactly the
 * level at which the tour's spotlight, the two-device sync and the evening
 * close cannot be seen - jsdom has no layout, no second tab and no clock
 * that anything paints against. These run the production build the way a
 * person meets it: `vite preview` on the same port and path the deployed
 * site uses, one browser per test, storage wiped between them.
 *
 * `npm run e2e` locally; CI runs the same command in its own job and the
 * deploy does not wait for it. Flakes here must never hold a release, and a
 * real failure shows red where it can be read.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4190/dienius/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    // The owner is an iPhone user: the tour is walked on a phone's viewport
    // too, in the phone's words, with the sheets it uses there.
    { name: 'phone', testMatch: /tour\.e2e\.ts/, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4190 --strictPort',
    url: 'http://localhost:4190/dienius/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
