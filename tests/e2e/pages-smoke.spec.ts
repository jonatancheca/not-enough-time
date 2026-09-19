import { expect, test } from '@playwright/test'

const basePath = normalizeBasePath(process.env.PLAYWRIGHT_BASE_PATH ?? '/not-enough-time/')
const viewports = [
  { height: 800, name: 'desktop', width: 1280 },
  { height: 844, name: 'mobile-390', width: 390 },
  { height: 800, name: 'mobile-320', width: 320 }
]

test('generated Pages site loads from its subpath without real OAuth or YouTube calls', async ({ page }) => {
  const youtubeRequests = []

  page.on('request', (request) => {
    if (request.url().startsWith('https://www.googleapis.com/youtube/')) {
      youtubeRequests.push(request.url())
    }
  })
  await page.route('https://accounts.google.com/**', async (route) => {
    await route.fulfill({ body: '', contentType: 'text/javascript', status: 200 })
  })

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width })
      const response = await page.goto('./', { waitUntil: 'networkidle' })

      expect(response?.ok()).toBe(true)
      await expect(page.getByRole('heading', {
        name: 'Horas publicadas por tus suscripciones'
      })).toBeVisible()
      await expect(page.getByRole('heading', {
        name: 'Acceso de solo lectura a YouTube'
      })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Aviso de privacidad' }))
        .toHaveAttribute('href', `${basePath}privacy/`)

      const geometry = await page.evaluate(() => {
        const main = document.querySelector('main')
        const bounds = main?.getBoundingClientRect()

        return {
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          left: bounds?.left ?? -1,
          right: bounds?.right ?? Number.POSITIVE_INFINITY,
          viewportWidth: window.innerWidth
        }
      })

      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
      expect(geometry.left).toBeGreaterThanOrEqual(0)
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1)

      const misplacedResources = await page.evaluate((expectedBasePath) => {
        return performance.getEntriesByType('resource')
          .map((entry) => new URL(entry.name))
          .filter((url) => url.origin === window.location.origin)
          .filter((url) => !url.pathname.startsWith(expectedBasePath))
          .map((url) => url.pathname)
      }, basePath)

      expect(misplacedResources).toEqual([])
    })
  }

  expect(youtubeRequests).toEqual([])
})

test('privacy notice is generated, public and usable from the Pages subpath', async ({ page }) => {
  await page.route('https://accounts.google.com/**', async (route) => {
    await route.fulfill({ body: '', contentType: 'text/javascript', status: 200 })
  })

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width })
      const response = await page.goto('./privacy/', { waitUntil: 'networkidle' })

      expect(response?.ok()).toBe(true)
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(basePath)}privacy/$`))
      await expect(page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }))
        .toBeVisible()
      await expect(page.getByText('Este aviso no supone que Google o YouTube hayan aprobado'))
        .toBeVisible()
      await expect(page.getByRole('link', { name: 'Volver a Not Enough Time' }))
        .toHaveAttribute('href', basePath)
      await expect(page.getByRole('link', { name: 'repositorio de Not Enough Time' }))
        .toHaveAttribute('href', 'https://github.com/jonatancheca/not-enough-time/issues')

      const geometry = await page.evaluate(() => ({
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        viewportWidth: window.innerWidth
      }))

      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
    })
  }
})

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
