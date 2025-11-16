import { deepStrictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareApplication } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should skip devOnly applications when runtime is in production mode', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')

  // Create runtime in production mode
  const runtime = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with devOnly flag
  const devOnlyApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'dev-only-app',
    path: './application-1',
    devOnly: true
  })

  // Add the application
  await runtime.addApplications([devOnlyApp], false)

  // Verify the application was NOT added
  const applicationsIds = runtime.getApplicationsIds()
  const devOnlyAppExists = applicationsIds.includes('dev-only-app')

  deepStrictEqual(devOnlyAppExists, false, 'devOnly application should not be added in production mode')
})

test('should include devOnly applications when runtime is in development mode', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')

  // Create runtime in development mode (default)
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with devOnly flag
  const devOnlyApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'dev-only-app',
    path: './application-1',
    devOnly: true
  })

  // Add the application
  await runtime.addApplications([devOnlyApp], false)

  // Verify the application WAS added
  const applicationsIds = runtime.getApplicationsIds()
  const devOnlyAppExists = applicationsIds.includes('dev-only-app')

  ok(devOnlyAppExists, 'devOnly application should be added in development mode')
})

test('should include regular applications in production mode', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')

  // Create runtime in production mode
  const runtime = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare a regular application without devOnly flag
  const regularApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'regular-app',
    path: './application-1'
  })

  // Add the application
  await runtime.addApplications([regularApp], false)

  // Verify the application WAS added
  const applicationsIds = runtime.getApplicationsIds()
  const regularAppExists = applicationsIds.includes('regular-app')

  ok(regularAppExists, 'regular application should be added in production mode')
})

test('should include application with devOnly: false in production mode', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')

  // Create runtime in production mode
  const runtime = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with devOnly explicitly set to false
  const app = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'non-dev-only-app',
    path: './application-1',
    devOnly: false
  })

  // Add the application
  await runtime.addApplications([app], false)

  // Verify the application WAS added
  const applicationsIds = runtime.getApplicationsIds()
  const appExists = applicationsIds.includes('non-dev-only-app')

  ok(appExists, 'application with devOnly: false should be added in production mode')
})

test('should handle mixed devOnly and regular applications in production', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')

  // Create runtime in production mode
  const runtime = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare multiple applications with different devOnly settings
  const apps = [
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'dev-only-1',
      path: './application-1',
      devOnly: true
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'regular-1',
      path: './application-1'
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'dev-only-2',
      path: './application-2',
      devOnly: true
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'regular-2',
      path: './application-2',
      devOnly: false
    })
  ]

  // Add all applications at once
  await runtime.addApplications(apps, false)

  // Verify only regular applications were added
  const applicationsIds = runtime.getApplicationsIds()

  deepStrictEqual(
    applicationsIds.includes('dev-only-1'),
    false,
    'dev-only-1 should not be added in production'
  )

  ok(
    applicationsIds.includes('regular-1'),
    'regular-1 should be added in production'
  )

  deepStrictEqual(
    applicationsIds.includes('dev-only-2'),
    false,
    'dev-only-2 should not be added in production'
  )

  ok(
    applicationsIds.includes('regular-2'),
    'regular-2 should be added in production'
  )
})

test('should use production context property to determine production mode', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')

  // Create runtime using the 'production' property instead of 'isProduction'
  const runtime = await createRuntime(configFile, null, { production: true })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with devOnly flag
  const devOnlyApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'dev-only-app-2',
    path: './application-1',
    devOnly: true
  })

  // Add the application
  await runtime.addApplications([devOnlyApp], false)

  // Verify the application was NOT added (production mode)
  const applicationsIds = runtime.getApplicationsIds()
  const devOnlyAppExists = applicationsIds.includes('dev-only-app-2')

  deepStrictEqual(devOnlyAppExists, false, 'devOnly application should not be added when context.production is true')
})
