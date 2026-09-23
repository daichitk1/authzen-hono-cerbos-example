import { expect, test, type Page } from '@playwright/test'

const evidencePath = (fileName: string) => `docs/evidence/${fileName}`
const updateRoute = '**/api/demo/documents/document-123/actions/update'

const evaluate = async (page: Page) => {
  await page.getByRole('button', { name: 'この条件で判定する' }).click()
}

test('captures article screenshots from the real demo flow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  await page.screenshot({
    path: evidencePath('initial.png'),
    fullPage: true,
  })

  await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('許可されました')
  await page.getByText('技術情報を見る').click()
  await expect(page.getByText('HTTP 200')).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'AuthZEN リクエスト' }),
  ).toContainText('"ownerId": "yuki"')
  await expect(page.getByRole('region', { name: 'PDP の応答' })).toContainText(
    '"decision": true',
  )
  await page.locator('.main-grid').scrollIntoViewIfNeeded()

  await page.screenshot({
    path: evidencePath('allow.png'),
    fullPage: false,
  })
  await page.screenshot({
    path: evidencePath('evaluation-tool.png'),
    fullPage: true,
  })

  await page.getByLabel('操作する利用者').selectOption('ren')
  await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('拒否されました')
  await expect(page.getByText('HTTP 403')).toBeVisible()
  await page.screenshot({
    path: evidencePath('deny.png'),
    fullPage: true,
  })

  await page.getByLabel('操作する利用者').selectOption('admin')
  await page.getByRole('radio', { name: '削除する' }).check()
  await evaluate(page)
  await expect(page.getByTestId('decision')).toHaveText('許可されました')
  await expect(page.getByText('HTTP 200')).toBeVisible()
  await page.screenshot({
    path: evidencePath('optional-admin.png'),
    fullPage: true,
  })
})

test('captures the fail-closed state', async ({ page }) => {
  await page.route(updateRoute, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: 'NOT_EVALUATED',
        reason: 'PDP_UNAVAILABLE',
        requestId: 'evidence-pdp-unavailable',
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

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await evaluate(page)

  await expect(page.getByTestId('decision')).toHaveText('判定できませんでした')
  await expect(page.getByText('操作を中止します')).toBeVisible()

  await page.screenshot({
    path: evidencePath('failure.png'),
    fullPage: true,
  })
})
