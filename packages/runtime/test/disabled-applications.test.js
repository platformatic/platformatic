import { deepStrictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareApplication } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should skip applications with enable: false', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with enable: false
  const disabledApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'disabled-app',
    path: './application-1',
    enable: false
  })

  // Add the application
  await runtime.addApplications([disabledApp], false)

  // Verify the application was NOT added
  const applicationsIds = runtime.getApplicationsIds()
  const disabledAppExists = applicationsIds.includes('disabled-app')

  deepStrictEqual(disabledAppExists, false, 'disabled application should not be added when enable is false')
})

test('should include applications with enable: true', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with enable: true
  const enabledApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'enabled-app',
    path: './application-1',
    enable: true
  })

  // Add the application
  await runtime.addApplications([enabledApp], false)

  // Verify the application WAS added
  const applicationsIds = runtime.getApplicationsIds()
  const enabledAppExists = applicationsIds.includes('enabled-app')

  ok(enabledAppExists, 'application with enable: true should be added')
})

test('should include applications when enable is not specified (default behavior)', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application without enable property
  const defaultApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'default-app',
    path: './application-1'
  })

  // Add the application
  await runtime.addApplications([defaultApp], false)

  // Verify the application WAS added
  const applicationsIds = runtime.getApplicationsIds()
  const defaultAppExists = applicationsIds.includes('default-app')

  ok(defaultAppExists, 'application without enable property should be added by default')
})

test('should handle mixed enabled and disabled applications', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare multiple applications with different enable settings
  const apps = [
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'disabled-1',
      path: './application-1',
      enable: false
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'enabled-1',
      path: './application-1',
      enable: true
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'disabled-2',
      path: './application-2',
      enable: false
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'enabled-2',
      path: './application-2'
    })
  ]

  // Add all applications at once
  await runtime.addApplications(apps, false)

  // Verify only enabled applications were added
  const applicationsIds = runtime.getApplicationsIds()

  deepStrictEqual(
    applicationsIds.includes('disabled-1'),
    false,
    'disabled-1 should not be added'
  )

  ok(
    applicationsIds.includes('enabled-1'),
    'enabled-1 should be added'
  )

  deepStrictEqual(
    applicationsIds.includes('disabled-2'),
    false,
    'disabled-2 should not be added'
  )

  ok(
    applicationsIds.includes('enabled-2'),
    'enabled-2 should be added'
  )
})

test('should not add disabled applications even when start is true', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare a disabled application
  const disabledApp = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'disabled-app-no-start',
    path: './application-1',
    enable: false
  })

  // Add the application with start=true
  await runtime.addApplications([disabledApp], true)

  // Verify the application was NOT added
  const applicationsIds = runtime.getApplicationsIds()
  const disabledAppExists = applicationsIds.includes('disabled-app-no-start')

  deepStrictEqual(disabledAppExists, false, 'disabled application should not be added even when start is true')
})

test('should treat enable: undefined as enabled (truthy check)', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with enable: undefined
  const app = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'undefined-enable-app',
    path: './application-1',
    enable: undefined
  })

  // Add the application
  await runtime.addApplications([app], false)

  // Verify the application WAS added (undefined is not === false)
  const applicationsIds = runtime.getApplicationsIds()
  const appExists = applicationsIds.includes('undefined-enable-app')

  ok(appExists, 'application with enable: undefined should be added (not strictly false)')
})

test('should treat enable: null as enabled (not strictly false)', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with enable: null
  const app = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'null-enable-app',
    path: './application-1',
    enable: null
  })

  // Add the application
  await runtime.addApplications([app], false)

  // Verify the application WAS added (null is not === false)
  const applicationsIds = runtime.getApplicationsIds()
  const appExists = applicationsIds.includes('null-enable-app')

  ok(appExists, 'application with enable: null should be added (not strictly false)')
})

test('should treat enable: 0 as enabled (not strictly false)', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare an application with enable: 0
  const app = await prepareApplication(runtime.getRuntimeConfig(true), {
    id: 'zero-enable-app',
    path: './application-1',
    enable: 0
  })

  // Add the application
  await runtime.addApplications([app], false)

  // Verify the application WAS added (0 is not === false)
  const applicationsIds = runtime.getApplicationsIds()
  const appExists = applicationsIds.includes('zero-enable-app')

  ok(appExists, 'application with enable: 0 should be added (not strictly false)')
})

test('should only skip when enable is exactly false (strict equality)', async t => {
  const configFile = join(fixturesDir, 'dynamic-applications')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Prepare applications with various falsy values
  const apps = [
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'app-false',
      path: './application-1',
      enable: false
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'app-empty-string',
      path: './application-1',
      enable: ''
    }),
    await prepareApplication(runtime.getRuntimeConfig(true), {
      id: 'app-zero',
      path: './application-1',
      enable: 0
    })
  ]

  // Add all applications
  await runtime.addApplications(apps, false)

  const applicationsIds = runtime.getApplicationsIds()

  // Only enable: false should be skipped
  deepStrictEqual(
    applicationsIds.includes('app-false'),
    false,
    'app with enable: false should not be added'
  )

  ok(
    applicationsIds.includes('app-empty-string'),
    'app with enable: "" should be added (not strictly false)'
  )

  ok(
    applicationsIds.includes('app-zero'),
    'app with enable: 0 should be added (not strictly false)'
  )
})
