import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const evaluationPath = '/api/demo/documents/document-123/actions/'
const updateRoute = '**/api/demo/documents/document-123/actions/update'

const apiResponseForNextEvaluation = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(evaluationPath),
  )

const readRequestId = (value: unknown): string | undefined => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'requestId' in value &&
    typeof value.requestId === 'string'
  ) {
    return value.requestId
  }

  return undefined
}

const evaluate = async (page: Page) => {
  const responsePromise = apiResponseForNextEvaluation(page)
  await page.getByRole('button', { name: 'この条件で判定する' }).click()
  const response = await responsePromise
  const body: unknown = await response.json()

  return { body, response }
}

test('matches request IDs across ALLOW and DENY', async ({ page }) => {
  await page.goto('/')

  const yuki = await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('許可されました')
  await page.getByText('技術情報を見る').click()
  await expect(page.getByText('HTTP 200')).toBeVisible()
  const yukiRequestId = readRequestId(yuki.body)
  expect(yukiRequestId).toBeTruthy()
  await expect(page.locator('.request-id')).toHaveText(yukiRequestId ?? '')

  await page.getByLabel('操作する利用者').selectOption('ren')
  const ren = await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('拒否されました')
  await expect(page.getByText('HTTP 403')).toBeVisible()
  const renRequestId = readRequestId(ren.body)
  expect(renRequestId).toBeTruthy()
  await expect(page.locator('.request-id')).toHaveText(renRequestId ?? '')
  await expect(page.getByRole('region', { name: 'PDP の応答' })).toContainText(
    '"decision": false',
  )

  await page.getByLabel('操作する利用者').selectOption('admin')
  await page.getByRole('radio', { name: '削除する' }).check()
  const admin = await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('許可されました')
  await expect(page.getByText('HTTP 200')).toBeVisible()
  const adminRequestId = readRequestId(admin.body)
  expect(adminRequestId).toBeTruthy()
  await expect(page.locator('.request-id')).toHaveText(adminRequestId ?? '')
})

test('supports keyboard-only evaluation', async ({ page }) => {
  await page.goto('/')

  const subject = page.getByLabel('操作する利用者')
  await page.keyboard.press('Tab')
  await expect(subject).toBeFocused()

  await page.keyboard.type('Ren')
  await expect(subject).toHaveValue('ren')

  await page.keyboard.press('Tab')
  const update = page.getByRole('radio', { name: '編集する' })
  await expect(update).toBeFocused()

  await page.keyboard.press('ArrowRight')
  const deleteAction = page.getByRole('radio', { name: '削除する' })
  await expect(deleteAction).toBeChecked()
  await expect(deleteAction).toBeFocused()

  await page.keyboard.press('Tab')
  const evaluateButton = page.getByRole('button', {
    name: 'この条件で判定する',
  })
  await expect(evaluateButton).toBeFocused()

  const responsePromise = apiResponseForNextEvaluation(page)
  await page.keyboard.press('Enter')
  await responsePromise

  await expect(page.getByTestId('decision')).toHaveText('拒否されました')
})

test('has no serious or critical axe violations before and after evaluation', async ({
  page,
}) => {
  await page.goto('/')

  const findSeriousViolations = async () => {
    const results = await new AxeBuilder({ page }).analyze()

    return results.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    )
  }

  expect(await findSeriousViolations()).toEqual([])

  await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('許可されました')

  expect(await findSeriousViolations()).toEqual([])
})

test('moves visual emphasis from the action to the decision', async ({
  page,
}) => {
  await page.goto('/')

  const policyHeading = page.getByRole('heading', { name: '許可される条件' })
  const inputHeading = page.getByRole('heading', {
    name: '条件を選んで判定',
  })
  const selectionText = page.locator('.selection-summary p')
  const policyText = page.getByTestId('policy-rule-read').locator('p')
  const button = page.getByRole('button', { name: 'この条件で判定する' })
  const readFontSize = (locator: typeof policyHeading) =>
    locator.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )

  expect(await readFontSize(inputHeading)).toBeGreaterThan(
    await readFontSize(policyHeading),
  )
  expect(await readFontSize(selectionText)).toBeGreaterThan(
    await readFontSize(policyText),
  )
  await expect(button).not.toHaveClass(/is-secondary/)
  await expect(page.getByTestId('decision')).toHaveCount(0)

  await evaluate(page)
  const decision = page.getByTestId('decision')

  await expect(decision).toHaveText('許可されました')
  expect(await readFontSize(decision)).toBeGreaterThan(
    await readFontSize(inputHeading),
  )
  await expect(button).toHaveClass(/is-secondary/)
  await expect(page.getByText('この判定に対応')).toBeVisible()

  await page.getByLabel('操作する利用者').selectOption('ren')

  await expect(decision).toHaveCount(0)
  await expect(button).not.toHaveClass(/is-secondary/)
  await expect(page.getByText('この判定に対応')).toHaveCount(0)
})

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
  { width: 320, height: 700 },
]) {
  test(`no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await evaluate(page)
    await expect(page.getByTestId('decision')).toHaveText('許可されました')

    const hasHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )

    expect(hasHorizontalOverflow).toBe(false)
  })
}

test('orders policy, input, result, and technical details on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  const policyTop = await page
    .getByRole('heading', { name: '許可される条件' })
    .evaluate((element) => element.getBoundingClientRect().top)
  const inputTop = await page
    .getByRole('heading', { name: '条件を選んで判定' })
    .evaluate((element) => element.getBoundingClientRect().top)
  const button = page.getByRole('button', { name: 'この条件で判定する' })
  const buttonTop = await button.evaluate(
    (element) => element.getBoundingClientRect().top,
  )

  expect(policyTop).toBeLessThan(inputTop)
  expect(inputTop).toBeLessThan(buttonTop)
  await expect(page.getByTestId('decision')).toHaveCount(0)

  await evaluate(page)

  const buttonTopAfterEvaluation = await button.evaluate(
    (element) => element.getBoundingClientRect().top,
  )
  const resultTop = await page
    .getByRole('heading', { name: '判定結果' })
    .evaluate((element) => element.getBoundingClientRect().top)
  const detailsTop = await page
    .getByRole('heading', { name: '技術情報を見る' })
    .evaluate((element) => element.getBoundingClientRect().top)

  expect(buttonTopAfterEvaluation).toBeLessThan(resultTop)
  expect(resultTop).toBeLessThan(detailsTop)
})

test('shows NOT EVALUATED for PDP unavailable', async ({ page }) => {
  await page.route(updateRoute, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: 'NOT_EVALUATED',
        reason: 'PDP_UNAVAILABLE',
        requestId: 'e2e-pdp-unavailable',
        authzenRequest: {
          subject: {
            type: 'user',
            id: 'yuki',
            properties: {
              'cerbos.roles': ['user'],
            },
          },
          action: {
            name: 'update',
          },
          resource: {
            type: 'document',
            id: 'document-123',
            properties: {
              ownerId: 'yuki',
            },
          },
        },
      }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'この条件で判定する' }).click()

  await expect(page.getByTestId('decision')).toHaveText('判定できませんでした')
  await page.getByText('技術情報を見る').click()
  await expect(page.getByText('HTTP 503')).toBeVisible()
  await expect(
    page.getByText('操作を中止します', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('判定サービスに接続できませんでした'),
  ).toBeVisible()
})

test('disables Evaluate while a request is pending', async ({ page }) => {
  let releaseRequest: (() => void) | undefined
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  let requestCount = 0

  await page.route(updateRoute, async (route) => {
    requestCount += 1
    await requestGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: 'ALLOW',
        requestId: 'e2e-loading',
        authzenRequest: {
          subject: {
            type: 'user',
            id: 'yuki',
            properties: {
              'cerbos.roles': ['user'],
            },
          },
          action: {
            name: 'update',
          },
          resource: {
            type: 'document',
            id: 'document-123',
            properties: {
              ownerId: 'yuki',
            },
          },
        },
        authzenResponse: {
          decision: true,
        },
        simulatedOperation: {
          subject: 'yuki',
          action: 'update',
          resource: 'document-123',
          status: 'simulated',
        },
      }),
    })
  })

  await page.goto('/')
  const evaluateButton = page.getByRole('button', {
    name: 'この条件で判定する',
  })
  await evaluateButton.click()

  await expect(evaluateButton).toBeDisabled()
  await expect(evaluateButton).toHaveText('判定しています…')
  await expect(page.getByTestId('decision')).toHaveCount(0)
  expect(requestCount).toBe(1)

  releaseRequest?.()
  await expect(page.getByTestId('decision')).toHaveText('許可されました')
  await expect(evaluateButton).toBeEnabled()
  expect(requestCount).toBe(1)
})
