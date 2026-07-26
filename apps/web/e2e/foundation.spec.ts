import { expect, test } from '@playwright/test'

const routes = [
  '/',
  '/create',
  '/generating',
  '/story/mock_test/preview',
  '/story/mock_test/play',
  '/story/mock_test/inventory',
  '/story/mock_test/journal',
  '/story/mock_test/result',
  '/history',
  '/settings',
  '/offline',
]

for (const route of routes) {
  test(`route ${route}`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('.phone-canvas')).toBeVisible()
  })
}

for (const width of [360, 375, 390, 430]) {
  test(`mobile canvas ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    await page.goto('/')
    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      buttonHeight: document
        .querySelector<HTMLAnchorElement>('.button--primary')!
        .getBoundingClientRect().height,
    }))
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth)
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(48)
  })
}

test('home actions and 404', async ({ page }) => {
  await page.goto('/')
  await page.locator('a[href="/create"]').first().click()
  await expect(page).toHaveURL(/\/create$/)
  await page.goto('/history')
  await expect(page.getByText('ARCHIVE INDEX')).toBeVisible()
  await page.goto('/not-a-real-archive')
  await expect(page.getByText('404 / NOT FOUND')).toBeVisible()
})
