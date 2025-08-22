import { devices } from '@playwright/test'

const isCI = process.env.CI === 'true'

export default {
  testDir: '.',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: [
    {
      command: 'npm run e2e:server',
      url: 'http://127.0.0.1:9999',
      timeout: 120_000
    },
    {
      command: 'npm run e2e:dev',
      url: 'http://localhost:5173/'
    }
  ]
}
