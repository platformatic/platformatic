import { safeRemove, saveConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('build - should build the application', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  await wattpm('build', buildDir)

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
})

test('build - should build the application from an application file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  await safeRemove(resolve(buildDir, 'watt.json'))
  await saveConfigurationFile(resolve(applicationDir, 'watt.json'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json'
  })

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  await wattpm('build', applicationDir)

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
})

test('build - should handle build errors', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build-error', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'web/main/dist'))
  })

  const result = await wattpm('build', buildDir, { reject: false })
  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes('Building application "main" has failed with exit code 1.'))

  ok(!existsSync(resolve(applicationDir, 'dist/index.js')))
})

test('build - should build with custom env file', async t => {
  const { writeFile } = await import('node:fs/promises')
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  // Create a custom env file
  const customEnvFile = resolve(buildDir, 'custom-build.env')
  await writeFile(customEnvFile, 'BUILD_CUSTOM_VAR=from_custom_build\nBUILD_TEST=xyz789', 'utf8')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'dist'))
  })

  await wattpm('build', buildDir, '--env', customEnvFile)

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
})
