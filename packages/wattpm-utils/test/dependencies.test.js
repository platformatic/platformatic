import { safeRemove } from '@platformatic/foundation'
import { updateConfigFile } from '@platformatic/runtime/test/helpers.js'
import { readFile } from 'node:fs/promises'
import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { prepareRuntime } from '../../basic/test/helper.js'
import { executeCommand, wattpmUtils, wattUtilsCliPath } from './helper.js'

test('install - should install dependencies of autoloaded applications', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  // Introduce a validation error: with an invalid configuration the transform is never invoked.
  await updateConfigFile(resolve(rootDir, 'watt.config.mjs'), config => {
    config.logger = { level: 'invalid' }
  })

  const installProcess = await wattpmUtils('install', rootDir)

  ok(installProcess.stdout.includes('Installing dependencies for the project using npm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the application main using npm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the application alternative using npm ...'))
})

test('install - should install dependencies when loaded vian application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  // The root is gone, so web/main's own configuration is the only one there is.
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))

  const installProcess = await wattpmUtils('install', resolve(rootDir, 'web/main'))

  ok(installProcess.stdout.includes('Installing dependencies for the project using npm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the application main using npm ...'))
  ok(!installProcess.stdout.includes('Installing dependencies for the application alternative using npm ...'))
})

test('install - should install dependencies of application and its applications using npm by default', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpmUtils('install', rootDir)

  ok(installProcess.stdout.includes('Installing dependencies for the project using npm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the application main using npm ...'))
})

test('install - should install dependencies of application and its applications using npm by default', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpmUtils('install', rootDir, '-p')

  ok(installProcess.stdout.includes('Installing production dependencies for the project using npm ...'))
  ok(installProcess.stdout.includes('Installing production dependencies for the application main using npm ...'))
})

test('install - should install dependencies of application and its applications using a specific package manager', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpmUtils('install', rootDir, '-P', 'pnpm')

  ok(installProcess.stdout.includes('Installing dependencies for the project using pnpm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the application main using pnpm ...'))
})

test('install - should setup package version to 0.1.0 when using yarn', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const originalPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/alternative/package.json'), 'utf-8'))
  ok(typeof originalPackageJson.version === 'undefined')
  const installProcess = await wattpmUtils('install', rootDir, '-P', 'yarn')

  ok(
    installProcess.stdout.includes(
      'The package.json of the application main is missing the version field, which is required by yarn version. Setting version to 0.1.0 ...'
    )
  )
  ok(
    installProcess.stdout.includes(
      'The package.json of the application alternative is missing the version field, which is required by yarn version. Setting version to 0.1.0 ...'
    )
  )

  const updatePackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/alternative/package.json'), 'utf-8'))
  deepStrictEqual(updatePackageJson.version, '0.1.0')
})

test('install - should respect the application package manager, if any', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  await updateConfigFile(resolve(rootDir, 'watt.config.mjs'), config => {
    config.applications = [
      {
        id: 'main',
        path: 'web/main',
        packageManager: 'npm'
      }
    ]
  })

  const installProcess = await wattpmUtils('install', rootDir, '-P', 'pnpm')

  ok(installProcess.stdout.includes('Installing dependencies for the project using pnpm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the application main using npm ...'))
})

test('install - should install production dependencies only', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpmUtils('install', rootDir, '-p', '-P', 'pnpm')

  ok(installProcess.stdout.includes('Installing production dependencies for the project using pnpm ...'))
  ok(installProcess.stdout.includes('Installing production dependencies for the application main using pnpm ...'))
})

test('update - should update version in package.json files', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, null)

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  const updateProcess = await executeCommand('node', '--import', loader, wattUtilsCliPath, 'update', '-f', rootDir)

  const rootPackageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf-8'))

  deepStrictEqual(rootPackageJson.dependencies, {
    wattpm: '^3.55.0',
    '@platformatic/runtime': '^3.55.0'
  })

  const mainPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/main/package.json'), 'utf-8'))

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/node': '^3.55.0',
    '@platformatic/remix': '~2.5.5',
    '@platformatic/db': '~1.15.1',
    '@platformatic/vite': '3.55.0'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/telemetry': '^3.55.0'
  })

  const anotherPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/another/package.json'), 'utf-8'))

  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^3.55.0',
    '@platformatic/db': '^1.53.4',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/gateway': '^99.0.0'
  })

  ok(
    updateProcess.stdout.includes(
      'Updating dependency @platformatic/runtime of the application from ^3.0.0 to ^3.55.0 ...'
    )
  )

  ok(
    !updateProcess.stdout.includes(
      'Updating dependency @platformatic/node of the application main from ^3.55.0 to ^3.55.0 ...'
    )
  )

  ok(
    updateProcess.stdout.includes(
      'Updating dependency @platformatic/service of the application another from ^3.0.0 to ^3.55.0 ...'
    )
  )
  ok(updateProcess.stdout.includes('All dependencies have been updated.'))
})

test('update - scopes to the application when executed inside its folder', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, null)

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  /*
    web/main has its own package.json, and the configuration search stops at the nearest one --
    because it executes what it finds, and a configuration above your package belongs to something
    else. So this updates the application rather than the runtime above it. v3 ignored package
    boundaries and walked up, which is what this test used to assert.
  */
  const updateProcess = await executeCommand(
    'node',
    '--import',
    loader,
    wattUtilsCliPath,
    'update',
    '-f',
    resolve(rootDir, 'web/main')
  )

  const mainPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/main/package.json'), 'utf-8'))
  const anotherPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/another/package.json'), 'utf-8'))

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/node': '^3.55.0',
    '@platformatic/remix': '~2.5.5',
    '@platformatic/db': '~1.15.1',
    '@platformatic/vite': '3.55.0'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/telemetry': '^3.55.0'
  })

  // Untouched: it belongs to the runtime above the boundary, which this invocation is not
  // scoped to.
  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^3.0.0',
    '@platformatic/db': '^1.0.0',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/gateway': '^99.0.0'
  })

  ok(!updateProcess.stdout.includes('of the application another'))
  ok(updateProcess.stdout.includes('All dependencies have been updated.'))
})

test('update - should work when loaded from an application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, null)
  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  // The root is gone, so web/main's own configuration is the only one there is, and it is what
  // this command treats as the project.
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))
  const updateProcess = await executeCommand(
    'node',
    '--import',
    loader,
    wattUtilsCliPath,
    'update',
    '-f',
    resolve(rootDir, 'web/main')
  )

  const mainPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/main/package.json'), 'utf-8'))
  const anotherPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/another/package.json'), 'utf-8'))

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/node': '^3.55.0',
    '@platformatic/remix': '~2.5.5',
    '@platformatic/db': '~1.15.1',
    '@platformatic/vite': '3.55.0'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/telemetry': '^3.55.0'
  })

  // The another application is not updated, because it is not considered as part of the project.
  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^3.0.0',
    '@platformatic/db': '^1.0.0',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/gateway': '^99.0.0'
  })

  ok(
    updateProcess.stdout.includes(
      'Updating dependency @platformatic/node of the application main from ^3.55.0 to ^3.55.0 ...'
    )
  )

  ok(
    !updateProcess.stdout.includes(
      'Updating dependency @platformatic/service of the application another from ^3.0.0 to ^3.55.0 ...'
    )
  )
  ok(updateProcess.stdout.includes('All dependencies have been updated.'))
})

test('update - should fail when a dependency cannot be updated', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, null)

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  const updateProcess = await executeCommand(process.argv[0], '--import', loader, wattUtilsCliPath, 'update', rootDir, {
    reject: false
  })
  const rootPackageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf-8'))
  const mainPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/main/package.json'), 'utf-8'))
  const anotherPackageJson = JSON.parse(await readFile(resolve(rootDir, 'web/another/package.json'), 'utf-8'))

  deepStrictEqual(rootPackageJson.dependencies, {
    wattpm: '^3.55.0',
    '@platformatic/runtime': '^3.55.0'
  })

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/db': '~1.1.0 || ~1.15.0',
    '@platformatic/node': '^3.0.0',
    '@platformatic/remix': '~2.5.0',
    '@platformatic/vite': '>1'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/telemetry': '^3.0.0'
  })

  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^3.55.0',
    '@platformatic/db': '^1.53.4',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/gateway': '^99.0.0'
  })

  ok(
    updateProcess.stdout.includes(
      'Dependency @platformatic/vite of the application main requires a non-updatable range >1. Try again with -f/--force to update to the latest version.'
    )
  )
})

test('update - should fail when NPM is not responsing', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, null)

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry-fail.mjs')).href

  const updateProcess = await executeCommand(process.argv[0], '--import', loader, wattUtilsCliPath, 'update', rootDir, {
    reject: false
  })

  ok(updateProcess.stdout.includes('Unable to fetch version information.'))
})
