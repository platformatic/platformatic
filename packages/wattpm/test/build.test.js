import { safeRemove } from '@platformatic/utils'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { ensureDependency, fixturesDir, wattpm } from './helper.js'

test('build - should build the application', async t => {
  const buildDir = await resolve(fixturesDir, 'build')
  const serviceDir = await resolve(buildDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  await wattpm('build', buildDir)

  ok(existsSync(resolve(serviceDir, 'dist/index.js')))
})

test('build - should handle build errors', async t => {
  const buildDir = await resolve(fixturesDir, 'build-error')
  const serviceDir = await resolve(buildDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'web/main/dist'))
  })

  const result = await wattpm('build', buildDir, { reject: false })
  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes('Building service "main" has failed with exit code 1.'))

  ok(!existsSync(resolve(serviceDir, 'dist/index.js')))
})
