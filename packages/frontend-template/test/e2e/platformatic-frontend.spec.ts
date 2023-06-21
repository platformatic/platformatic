import { test, expect } from '@playwright/test'

test('The generated Platformatic frontend template works as expected', async ({ page }) => {
  await page.goto('http://localhost:5173/')

  await page.getByRole('button', { name: 'Create movie' }).click()

  await expect(await page.getByText('Title: Harry potter')).toBeVisible()

  await page.getByRole('button', { name: 'Update movie' }).click()

  await expect(await page.getByText('Title: The Lord of the Rings')).toBeVisible()
})
