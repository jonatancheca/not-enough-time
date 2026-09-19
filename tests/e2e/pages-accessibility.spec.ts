import { expect, test } from '@playwright/test'
import {
  blockExternalTestRequests,
  expectAccessiblePage,
  expectMinimumInteractiveTargets,
  expectNoHorizontalOverflow,
  viewports
} from './accessibility-helpers'

test.beforeEach(async ({ page }) => {
  await blockExternalTestRequests(page)
})

test('missing OAuth configuration is accessible and responsive', async ({ page }) => {
  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport)
      await page.goto('./', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('html')).toHaveAttribute('lang', 'es')
      await expect(page.getByText('Configuración ausente')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Conectar cuenta' })).toBeDisabled()
      await expectAccessiblePage(page)
      await expectMinimumInteractiveTargets(page)
      await expectNoHorizontalOverflow(page)
    })
  }
})

test('disconnected OAuth state is accessible without contacting Google or YouTube', async ({ page }) => {
  const youtubeRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://www.googleapis.com/youtube/')) {
      youtubeRequests.push(request.url())
    }
  })
  await page.route('**/not-enough-time/', async (route) => {
    const response = await route.fetch()
    const body = (await response.text()).replace(
      'googleClientId:""',
      'googleClientId:"browser-test.apps.googleusercontent.com"'
    )
    await route.fulfill({ response, body })
  })

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport)
      await page.goto('./', { waitUntil: 'domcontentloaded' })

      await expect(page.getByText('Desconectado', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Conectar cuenta' })).toBeVisible()
      await expectAccessiblePage(page)
      await expectMinimumInteractiveTargets(page)
      await expectNoHorizontalOverflow(page)
    })
  }

  expect(youtubeRequests).toEqual([])
})

test('privacy notice is accessible and responsive', async ({ page }) => {
  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport)
      await page.goto('./privacy/', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('html')).toHaveAttribute('lang', 'es')
      await expect(page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }))
        .toBeVisible()
      await expect(page.getByRole('region', { name: 'Resumen de datos guardados' }))
        .toBeVisible()
      await expectAccessiblePage(page)
      await expectMinimumInteractiveTargets(page)
      await expectNoHorizontalOverflow(page)
    })
  }
})
