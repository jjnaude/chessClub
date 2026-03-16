import { expect, test } from '@playwright/test'

test('admin publishes, player submits, admin finalizes', async ({ page }) => {
  await page.goto('/#/session-lifecycle-sandbox')

  await page.getByRole('button', { name: 'Mark attendance' }).click()
  await page.getByRole('button', { name: 'Pair round' }).click()
  await page.getByRole('button', { name: 'Publish pairings' }).click()

  await expect(page.getByText('Role in control:')).toContainText('player + admin')

  await page.getByRole('button', { name: 'Submit result' }).click()
  await page.getByRole('button', { name: 'Finalize round' }).click()

  await expect(page.getByTestId('session-phase')).toContainText('finalized')
})
