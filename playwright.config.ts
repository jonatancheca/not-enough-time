import { defineConfig } from '@playwright/test'

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '4173', 10)
const basePath = normalizeBasePath(process.env.PLAYWRIGHT_BASE_PATH ?? '/not-enough-time/')
const baseURL = `http://127.0.0.1:${port}${basePath}`

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'playwright-output',
  reporter: 'line',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/e2e',
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node scripts/serve-pages-artifact.mjs',
    env: {
      PAGES_BASE_PATH: basePath,
      PORT: String(port)
    },
    reuseExistingServer: false,
    url: baseURL
  },
  workers: 1
})

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}
