import { loadConfigurationFile as loadRawConfigurationFile, saveConfigurationFile } from '@platformatic/config'
import { safeRemove } from '@platformatic/utils'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { prepareRuntime } from '../../basic/test/helper.js'
import { cliPath, executeCommand, wattpm } from './helper.js'

test('build - should build the application', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  await wattpm('build', buildDir)

  ok(existsSync(resolve(serviceDir, 'dist/index.js')))
})

test('build - should handle build errors', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build-error', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'web/main/dist'))
  })

  const result = await wattpm('build', buildDir, { reject: false })
  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes('Building service "main" has failed with exit code 1.'))

  ok(!existsSync(resolve(serviceDir, 'dist/index.js')))
})

test('install - should install dependencies of autoloaded services', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  // Introduce a validation error. In that case with invalid configuration, the transformConfig will not be invoked.
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)
  originalFileContents.logger = { level: 'invalid' }
  await saveConfigurationFile(configurationFile, originalFileContents)

  const installProcess = await wattpm('install', rootDir)

  ok(installProcess.stdout.includes('Installing dependencies for the application using npm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the service main using npm ...'))
})

test('install - should install dependencies of application and its services using npm by default', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpm('install', rootDir)

  ok(installProcess.stdout.includes('Installing dependencies for the application using npm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the service main using npm ...'))
})

test('install - should install dependencies of application and its services using npm by default', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpm('install', rootDir, '-p')

  ok(installProcess.stdout.includes('Installing production dependencies for the application using npm ...'))
  ok(installProcess.stdout.includes('Installing production dependencies for the service main using npm ...'))
})

test('install - should install dependencies of application and its services using a specific package manager', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpm('install', rootDir, '-P', 'pnpm')

  ok(installProcess.stdout.includes('Installing dependencies for the application using pnpm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the service main using pnpm ...'))
})

test('install - should respect the service package manager, if any', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)
  originalFileContents.services = [
    {
      id: 'main',
      path: 'web/main',
      packageManager: 'npm'
    }
  ]
  await saveConfigurationFile(configurationFile, originalFileContents)

  const installProcess = await wattpm('install', rootDir, '-P', 'pnpm')

  ok(installProcess.stdout.includes('Installing dependencies for the application using pnpm ...'))
  ok(installProcess.stdout.includes('Installing dependencies for the service main using npm ...'))
})

test('install - should install production dependencies only', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await safeRemove(resolve(root, 'node_modules'))
    await safeRemove(resolve(root, 'web/main/node_modules'))
  })

  const installProcess = await wattpm('install', rootDir, '-p', '-P', 'pnpm')

  ok(installProcess.stdout.includes('Installing production dependencies for the application using pnpm ...'))
  ok(installProcess.stdout.includes('Installing production dependencies for the service main using pnpm ...'))
})

test('update - should update version in package.json files', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, 'watt.json')

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  const updateProcess = await executeCommand('node', '--import', loader, cliPath, 'update', '-f', rootDir)

  const rootPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'package.json'))

  deepStrictEqual(rootPackageJson.dependencies, {
    wattpm: '^2.41.0',
    '@platformatic/runtime': '^2.41.0'
  })

  const mainPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'web/main/package.json'))

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/node': '^2.41.0',
    '@platformatic/remix': '~2.5.5',
    '@platformatic/db': '~1.15.1',
    '@platformatic/vite': '2.41.0'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/config': '^2.41.0'
  })

  const anotherPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'web/another/package.json'))

  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^2.41.0',
    '@platformatic/db': '^1.53.4',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/composer': '^99.0.0'
  })

  ok(
    updateProcess.stdout.includes(
      'Updating dependency @platformatic/runtime of the application from ^2.1.0 to ^2.41.0 ...'
    )
  )

  ok(
    updateProcess.stdout.includes(
      'Updating dependency @platformatic/service of the service another from ^2.0.0 to ^2.41.0 ...'
    )
  )
  ok(updateProcess.stdout.includes('All dependencies have been updated.'))
})

test('update - should work when executed inside a service folder', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, 'watt.json')

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  // Note that web/main folder contains a watt.json which will be considered as the root of the project.
  const updateProcess = await executeCommand(
    'node',
    '--import',
    loader,
    cliPath,
    'update',
    '-f',
    resolve(rootDir, 'web/main')
  )

  const mainPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'web/main/package.json'))
  const anotherPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'web/another/package.json'))

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/node': '^2.41.0',
    '@platformatic/remix': '~2.5.5',
    '@platformatic/db': '~1.15.1',
    '@platformatic/vite': '2.41.0'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/config': '^2.41.0'
  })

  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^2.41.0',
    '@platformatic/db': '^1.53.4',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/composer': '^99.0.0'
  })

  ok(
    updateProcess.stdout.includes(
      'Updating dependency @platformatic/service of the service another from ^2.0.0 to ^2.41.0 ...'
    )
  )
  ok(updateProcess.stdout.includes('All dependencies have been updated.'))
})

test('update - should fail when a dependency cannot be updated', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, 'watt.json')

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry.mjs')).href

  const updateProcess = await executeCommand(process.argv[0], '--import', loader, cliPath, 'update', rootDir, {
    reject: false
  })
  const rootPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'package.json'))
  const mainPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'web/main/package.json'))
  const anotherPackageJson = await loadRawConfigurationFile(resolve(rootDir, 'web/another/package.json'))

  deepStrictEqual(rootPackageJson.dependencies, {
    wattpm: '^2.41.0',
    '@platformatic/runtime': '^2.41.0'
  })

  deepStrictEqual(mainPackageJson.dependencies, {
    '@platformatic/db': '~1.1.0 || ~1.15.0',
    '@platformatic/node': '^2.0.0',
    '@platformatic/remix': '~2.5.0',
    '@platformatic/vite': '>1'
  })

  deepStrictEqual(mainPackageJson.devDependencies, {
    '@platformatic/config': '^2.0.0'
  })

  deepStrictEqual(anotherPackageJson.dependencies, {
    '@platformatic/service': '^2.41.0',
    '@platformatic/db': '^1.53.4',
    '@platformatic/db-dashboard': '^0.1.0',
    '@platformatic/composer': '^99.0.0'
  })

  ok(
    updateProcess.stdout.includes(
      'Dependency @platformatic/vite of the service main requires a non-updatable range >1. Try again with -f/--force to update to the latest version.'
    )
  )
})

test('update - should fail when NPM is not responsing', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'update', false, 'watt.json')

  const loader = pathToFileURL(resolve(rootDir, 'mock-registry-fail.mjs')).href

  const updateProcess = await executeCommand(process.argv[0], '--import', loader, cliPath, 'update', rootDir, {
    reject: false
  })

  ok(updateProcess.stdout.includes('Unable to fetch version information.'))
})
