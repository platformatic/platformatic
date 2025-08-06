import { safeRemove, saveConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, updateFile } from '../../basic/test/helper.js'
import { fixturesDir, wattpm } from './helper.js'

test('patch-config - should patch requested runtime and services config', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpm('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-1.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, { ...runtimeConfigOriginal, restartOnError: true, entrypoint: 'alternate' })
  deepStrictEqual(mainServiceConfigPatched, {
    $schema: mainServiceConfigOriginal.$schema,
    application: { basePath: '/' }
  })
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should work when executed from a service file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  await safeRemove(resolve(buildDir, 'watt.json'))
  await saveConfigurationFile(resolve(serviceDir, 'watt.json'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json',
    runtime: {
      watch: false,
      restartOnError: true,
      logger: {
        level: 'error'
      }
    }
  })

  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpm('patch-config', serviceDir, resolve(fixturesDir, 'patches/patch-1.js'))

  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(mainServiceConfigPatched, {
    $schema: mainServiceConfigOriginal.$schema,
    application: { basePath: '/' },
    runtime: {
      watch: false,
      restartOnError: true,
      entrypoint: 'alternate',
      logger: {
        level: 'error'
      }
    }
  })
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should apply patch when the config is not set in the main configuration file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await updateFile(resolve(root, 'watt.json'), content => {
      const config = JSON.parse(content)
      config.autoload = undefined
      config.services = [{ id: 'main', path: 'web/main' }]
      return JSON.stringify(config, null, 2)
    })
  })

  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpm('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-1.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, { ...runtimeConfigOriginal, restartOnError: true, entrypoint: 'alternate' })
  deepStrictEqual(mainServiceConfigPatched, {
    $schema: mainServiceConfigOriginal.$schema,
    application: { basePath: '/' }
  })
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should do nothing when the patch is empty', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpm('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-2.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, runtimeConfigOriginal)
  deepStrictEqual(mainServiceConfigPatched, mainServiceConfigOriginal)
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should do nothing when the patch contains invalid objects', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpm('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-3.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, runtimeConfigOriginal)
  deepStrictEqual(mainServiceConfigPatched, mainServiceConfigOriginal)
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should throw an error when the patch file does not export a function', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const patchProcess = await wattpm('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-4.js'), {
    reject: false
  })

  deepStrictEqual(patchProcess.exitCode, 1)
  ok(patchProcess.stdout.includes('Patch file must export a function.'))
})

test('patch-config - should throw an error when the patch file is non existent', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const patchProcess = await wattpm('patch-config', buildDir, resolve(fixturesDir, 'patches/non-existent.js'), {
    reject: false
  })

  deepStrictEqual(patchProcess.exitCode, 1)
  ok(patchProcess.stdout.includes('Cannot find module'))
})
