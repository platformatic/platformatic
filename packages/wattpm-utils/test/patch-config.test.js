import { safeRemove, saveConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, updateFile } from '../../basic/test/helper.js'
import { fixturesDir, wattpmUtils } from './helper.js'

test('patch-config - should patch requested runtime and applications config', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpmUtils('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-1.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, { ...runtimeConfigOriginal, restartOnError: true, entrypoint: 'alternate' })
  deepStrictEqual(mainApplicationConfigPatched, {
    $schema: mainApplicationConfigOriginal.$schema,
    application: { basePath: '/' }
  })
  deepStrictEqual(alternateApplicationConfigPatched, alternateApplicationConfigOriginal)
})

test('patch-config - should work when executed from an application file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  await safeRemove(resolve(buildDir, 'watt.json'))
  await saveConfigurationFile(resolve(applicationDir, 'watt.json'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json',
    runtime: {
      watch: false,
      restartOnError: true,
      logger: {
        level: 'error'
      }
    }
  })

  const mainApplicationConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpmUtils('patch-config', applicationDir, resolve(fixturesDir, 'patches/patch-1.js'))

  const mainApplicationConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(mainApplicationConfigPatched, {
    $schema: mainApplicationConfigOriginal.$schema,
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
  deepStrictEqual(alternateApplicationConfigPatched, alternateApplicationConfigOriginal)
})

test('patch-config - should apply patch when the config is not set in the main configuration file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json', async root => {
    await updateFile(resolve(root, 'watt.json'), content => {
      const config = JSON.parse(content)
      config.autoload = undefined
      config.applications = [{ id: 'main', path: 'web/main' }]
      return JSON.stringify(config, null, 2)
    })
  })

  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpmUtils('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-1.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, { ...runtimeConfigOriginal, restartOnError: true, entrypoint: 'alternate' })
  deepStrictEqual(mainApplicationConfigPatched, {
    $schema: mainApplicationConfigOriginal.$schema,
    application: { basePath: '/' }
  })
  deepStrictEqual(alternateApplicationConfigPatched, alternateApplicationConfigOriginal)
})

test('patch-config - should do nothing when the patch is empty', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpmUtils('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-2.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, runtimeConfigOriginal)
  deepStrictEqual(mainApplicationConfigPatched, mainApplicationConfigOriginal)
  deepStrictEqual(alternateApplicationConfigPatched, alternateApplicationConfigOriginal)
})

test('patch-config - should do nothing when the patch contains invalid objects', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigOriginal = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigOriginal = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await wattpmUtils('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-3.js'))

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'watt.json'), 'utf-8'))
  const mainApplicationConfigPatched = JSON.parse(await readFile(resolve(buildDir, 'web/main/watt.json'), 'utf-8'))
  const alternateApplicationConfigPatched = JSON.parse(
    await readFile(resolve(buildDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, runtimeConfigOriginal)
  deepStrictEqual(mainApplicationConfigPatched, mainApplicationConfigOriginal)
  deepStrictEqual(alternateApplicationConfigPatched, alternateApplicationConfigOriginal)
})

test('patch-config - should throw an error when the patch file does not export a function', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  const patchProcess = await wattpmUtils('patch-config', buildDir, resolve(fixturesDir, 'patches/patch-4.js'), {
    reject: false
  })

  deepStrictEqual(patchProcess.exitCode, 1)
  ok(patchProcess.stdout.includes('Patch file must export a function.'))
})

test('patch-config - should throw an error when the patch file is non existent', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  const patchProcess = await wattpmUtils('patch-config', buildDir, resolve(fixturesDir, 'patches/non-existent.js'), {
    reject: false
  })

  deepStrictEqual(patchProcess.exitCode, 1)
  ok(patchProcess.stdout.includes('Cannot find module'))
})
