import { safeRemove, saveConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('build - should build the application', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  await wattpm('build', buildDir)

  ok(existsSync(resolve(serviceDir, 'dist/index.js')))
})

test('build - should build the application from a service file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const serviceDir = resolve(buildDir, 'web/main')

  await safeRemove(resolve(buildDir, 'watt.json'))
  await saveConfigurationFile(resolve(serviceDir, 'watt.json'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json'
  })

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  await wattpm('build', serviceDir)

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
