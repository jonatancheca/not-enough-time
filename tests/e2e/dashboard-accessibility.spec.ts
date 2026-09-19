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

test('dashboard fixture is accessible and responsive without real YouTube requests', async ({ page }) => {
  const youtubeRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://www.googleapis.com/youtube/')) {
      youtubeRequests.push(request.url())
    }
  })

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport)
      await page.goto('./', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Fixture de desarrollo')).toBeVisible()
      await expect(page.getByRole('heading', {
        name: 'Uso personal y usuarios de prueba autorizados'
      })).toBeVisible()
      await expect(page.getByText(/son métricas propias de Not Enough Time/)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Vídeos recientes' })).toBeVisible()

      const periods = page.getByRole('group', {
        name: 'Periodo de publicación de los vídeos recientes'
      })
      await expect(periods.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true')
      await expect(periods.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'false')
      await expect(page.getByRole('link', {
        name: /Ver Arquitectura limpia en un proyecto Nuxt real de Dev Pragmático en YouTube \(se abre en una pestaña nueva\)/
      })).toBeVisible()

      await expectAccessiblePage(page)
      await expectMinimumInteractiveTargets(page)
      await expectNoHorizontalOverflow(page)
    })
  }

  expect(youtubeRequests).toEqual([])
})

test('period and incremental list work fully from keyboard with useful focus and announcements', async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1280 })
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Fixture de desarrollo')).toBeVisible()

  const periodGroup = page.getByRole('group', {
    name: 'Periodo de publicación de los vídeos recientes'
  })
  const weekButton = periodGroup.getByRole('button', { name: '7 días' })
  await weekButton.focus()
  await page.keyboard.press('Space')
  await expect(weekButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#video-list-status')).toContainText('de los últimos 7 días')

  const monthButton = periodGroup.getByRole('button', { name: '30 días' })
  await monthButton.focus()
  await page.keyboard.press('Enter')
  await expect(monthButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[id^="video-"][tabindex="-1"]')).toHaveCount(10)

  const loadMore = page.getByRole('button', { name: 'Cargar 10 más' })
  await loadMore.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[id^="video-"][tabindex="-1"]')).toHaveCount(16)
  await expect(page.locator('#video-list-status')).toHaveText(
    'Mostrando 16 de 16 vídeos de los últimos 30 días.'
  )
  await expect(page.locator('[id^="video-"][tabindex="-1"]').nth(10)).toBeFocused()

  await monthButton.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[id^="video-"][tabindex="-1"]')).toHaveCount(16)

  await weekButton.focus()
  await page.keyboard.press('Space')
  await monthButton.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[id^="video-"][tabindex="-1"]')).toHaveCount(10)
  await expect(page.locator('#video-list-status')).toHaveText(
    'Mostrando 10 de 16 vídeos de los últimos 30 días.'
  )
})
