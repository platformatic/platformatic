import { test, expect } from '@playwright/test'

test.skip('login box should appear', async ({ page }) => {
  await page.goto('http://localhost:3042/')

  await expect(page).toHaveTitle(/Platformatic DB/)

  await page.locator('input[type=password]').fill('basegraph')
  const loginButton = page.locator('.box button')
  await loginButton.click()
  await page.waitForTimeout(2000)

  const mainTitle = await page.locator('main h1.title').innerHTML()
  expect(mainTitle).toBe('Welcome to Platformatic DB!')
})

test.skip('graphiql is loading', async ({ page }) => {
  await page.goto('http://localhost:3042/')
  await page.locator('input[type=password]').fill('basegraph')
  const loginButton = page.locator('.box button')
  await loginButton.click()
  await page.waitForTimeout(2000)

  await page.locator('a[href="/giql"]').click()
  const graphiQLContainer = await page.locator('.graphiql-container')
  await expect(graphiQLContainer).toBeVisible()
})
