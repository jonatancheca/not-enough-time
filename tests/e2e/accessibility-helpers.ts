import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const viewports = [
  { height: 800, name: 'desktop', width: 1280 },
  { height: 844, name: 'mobile-390', width: 390 },
  { height: 800, name: 'mobile-320', width: 320 }
]

export async function blockExternalTestRequests(page: Page) {
  await page.route('https://accounts.google.com/**', async (route) => {
    await route.fulfill({ body: '', contentType: 'text/javascript', status: 200 })
  })
  await page.route('https://images.unsplash.com/**', async (route) => {
    await route.fulfill({ body: '', contentType: 'image/jpeg', status: 200 })
  })
}

export async function expectAccessiblePage(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('nuxt-devtools-frame')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations).toEqual([])
}

export async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    offenders: [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => ({
        bounds: element.getBoundingClientRect(),
        className: element.className,
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 80)
      }))
      .filter(({ bounds }) => bounds.left < -1 || bounds.right > window.innerWidth + 1)
      .slice(0, 10)
      .map(({ bounds, className, tag, text }) => ({
        className: typeof className === 'string' ? className : '',
        left: bounds.left,
        right: bounds.right,
        tag,
        text
      })),
    viewportWidth: window.innerWidth
  }))

  expect(geometry.documentWidth, JSON.stringify(geometry.offenders, null, 2))
    .toBeLessThanOrEqual(geometry.viewportWidth + 1)
}

export async function expectMinimumInteractiveTargets(page: Page) {
  const undersized = await page.locator('a[href], button, input, select, textarea, summary')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const bounds = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      const hidden = style.display === 'none'
        || style.visibility === 'hidden'
        || bounds.width === 0
        || bounds.height === 0

      if (hidden || (bounds.width >= 24 && bounds.height >= 24)) {
        return []
      }

      return [{
        height: bounds.height,
        name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
        tag: element.tagName,
        width: bounds.width
      }]
    }))

  expect(undersized).toEqual([])
}
