import { defineConfig } from '@playwright/test'

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '4173', 10)
const fixturePort = Number.parseInt(process.env.PLAYWRIGHT_FIXTURE_PORT ?? '4174', 10)
const basePath = normalizeBasePath(process.env.PLAYWRIGHT_BASE_PATH ?? '/not-enough-time/')
const baseURL = `http://127.0.0.1:${port}${basePath}`
const fixtureBaseURL = `http://127.0.0.1:${fixturePort}${basePath}`

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'playwright-output',
  reporter: 'line',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/e2e',
  projects: [
    {
      name: 'pages',
      testMatch: ['**/pages-smoke.spec.ts', '**/pages-accessibility.spec.ts'],
      use: { baseURL }
    },
    {
      name: 'dashboard-fixture',
      testMatch: '**/dashboard-accessibility.spec.ts',
      use: { baseURL: fixtureBaseURL }
    }
  ],
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node scripts/serve-pages-artifact.mjs',
      env: {
        PAGES_BASE_PATH: basePath,
        PORT: String(port)
      },
      reuseExistingServer: false,
      url: baseURL
    },
    {
      command: `pnpm dev --host 127.0.0.1 --port ${fixturePort}`,
      env: {
        NUXT_APP_BASE_URL: basePath,
        NUXT_PUBLIC_GOOGLE_CLIENT_ID: '',
        NUXT_PUBLIC_USE_YOUTUBE_MOCK: 'true'
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: fixtureBaseURL
    }
  ],
  workers: 1
})

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}
