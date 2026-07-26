import { expect, test } from '@playwright/test'
import { createReleaseGenerationResult } from './release-fixture'

test('MVP 1.0 完整移动端发布流程', async ({ page, context }) => {
  test.setTimeout(90_000)
  const result = createReleaseGenerationResult()
  let feedbackBody: unknown
  let rerouteCount = 0

  await page.route('**/v1/routes/plan', (route) =>
    route.fulfill({ json: { routePlan: result.routePlan } }),
  )
  await page.route('**/v1/stories/generate', (route) =>
    route.fulfill({ json: result.story }),
  )
  await page.route('**/v1/stories/*/reroute', async (route) => {
    rerouteCount += 1
    await route.fulfill({
      json: {
        routePlan: result.routePlan,
        storyGraph: result.story.storyGraph,
      },
    })
  })
  await page.route('**/v1/feedback', async (route) => {
    feedbackBody = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { accepted: true } })
  })
  await page.route('**/v1/events', (route) =>
    route.fulfill({ status: 202, json: { accepted: true } }),
  )
  await page.route('**/v1/stories/*/completion', (route) =>
    route.fulfill({ status: 202, json: { accepted: true } }),
  )

  await page.goto('/')
  await expect(page.locator('.phone-canvas')).toBeVisible()
  await page.locator('a[href="/create"]').first().click()
  await expect(page).toHaveURL(/\/create$/)

  await page.locator('input[type="radio"]').first().check()
  await page.locator('.form-actions button:not([type="submit"])').last().click()
  await page.locator('.form-actions button:not([type="submit"])').last().click()
  await page.locator('.form-actions button:not([type="submit"])').last().click()
  await page.locator('input[type="checkbox"]').first().check()
  await page.locator('.form-actions button:not([type="submit"])').last().click()
  await page.locator('.form-actions button:not([type="submit"])').last().click()
  await page.locator('.form-actions button:not([type="submit"])').last().click()
  await page.locator('.form-actions button:not([type="submit"])').last().click()

  await expect(page).toHaveURL(/\/story\/story_release_e2e\/preview$/)
  await expect(
    page.getByRole('heading', { name: '发布前的最后一条暗线' }),
  ).toBeVisible()
  await page.locator('a[href$="/play"]').click()

  await page.getByRole('button', { name: '开始前往第一站' }).click()
  await page.locator('.poi-unavailable button').first().click()
  await expect.poll(() => rerouteCount).toBe(1)

  await context.setOffline(true)
  await expect(page.locator('.offline-banner')).toBeVisible()
  await page.getByRole('button', { name: '我已到达' }).click()
  await page.getByRole('button', { name: '阅读剧情' }).click()
  await page.getByRole('button', { name: '继续' }).click()
  await page.locator('.gameplay-stage input[type="checkbox"]').check()
  await page.getByRole('button', { name: '完成观察' }).click()
  await expect(page.getByText('clue_observe')).not.toBeVisible()

  await context.setOffline(false)
  await expect(page.locator('.offline-banner')).toBeHidden()
  await page.getByRole('button', { name: '前往下一站' }).click()
  await page.getByRole('button', { name: '我已到达' }).click()
  await page.getByRole('button', { name: '阅读剧情' }).click()
  await page.getByRole('button', { name: '继续' }).click()
  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context2d = canvas.getContext('2d')!
    context2d.fillStyle = '#335c67'
    context2d.fillRect(0, 0, 8, 8)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'release-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(imageBase64, 'base64'),
  })
  await page.locator('.gameplay-stage input[type="checkbox"]').check()
  await page.getByRole('button', { name: '保存本地照片' }).click()
  await expect(page.getByRole('button', { name: '前往下一站' })).toBeVisible()

  await page.getByRole('link', { name: '线索背包' }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(page.getByRole('heading', { name: '观察记录' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '本地影像' })).toBeVisible()
  await page.goBack()

  await page.getByRole('button', { name: '前往下一站' }).click()
  await page.getByRole('button', { name: '我已到达' }).click()
  await page.getByRole('button', { name: '阅读剧情' }).click()
  await page.getByRole('button', { name: '继续' }).click()
  await page
    .getByRole('button', { name: '继续沿安全路线追踪' })
    .click()
  await page.getByRole('button', { name: '前往下一站' }).click()
  await page.getByRole('button', { name: '我已到达' }).click()
  await page.getByRole('button', { name: '阅读剧情' }).click()
  await page.getByRole('button', { name: '继续' }).click()
  await page.getByRole('button', { name: '前往下一站' }).click()
  await expect(page.getByRole('heading', { name: '质量守门人' })).toBeVisible()
  await page.getByRole('button', { name: '收录结局' }).click()
  await page.locator('a[href$="/result"]').click()

  await expect(page).toHaveURL(/\/result$/)
  const privacyToggles = page.locator('.poster-controls input[type="checkbox"]')
  await expect(privacyToggles).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    await expect(privacyToggles.nth(index)).not.toBeChecked()
  }

  const downloadPromise = page.waitForEvent('download')
  await page.locator('.poster-controls button').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('1080x1440.png')

  const feedbackResponse = page.waitForResponse('**/v1/feedback')
  await page.locator('.feedback-form button').click()
  expect((await feedbackResponse).status()).toBe(201)
  expect(feedbackBody).toMatchObject({
    storyId: 'story_release_e2e',
    routePackId: result.routePlan.routePackId,
    overallRating: 5,
    fallbackUsed: false,
  })
})
