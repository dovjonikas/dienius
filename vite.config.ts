/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { generateServiceWorker } from './scripts/generate-sw.mjs'

const BASE = '/dienius/'

/**
 * Fills in the service worker's precache list and cache version once the
 * production build has finished. Runs in `closeBundle`, the point at which
 * Vite has already copied `public/` into the output directory, so the
 * generated list can see every file - including the ones Vite itself never
 * touches. Reads `base` from the resolved config instead of a value typed
 * out a second time, so the deployed subpath has exactly one source of
 * truth in the whole repo.
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = ''
  return {
    name: 'dienius-generate-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const { version, precacheUrls } = generateServiceWorker({ distDir: outDir, base: BASE })
      console.log(`generate-sw: cache dienius-${version} with ${precacheUrls.length} precached files`)
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  base: BASE,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
