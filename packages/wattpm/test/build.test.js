import { safeRemove, saveConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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

  await wattpm('build', buildDir, { timeout: 60_000 })

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
  deepStrictEqual(
    (await readFile(resolve(buildDir, 'build-hooks.log'), 'utf8')).trim().split('\n'),
    [
      'preBuild:main',
      'onBuild:before:main',
      'onBuild:after:main',
      'postBuild:main'
    ]
  )
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

  await wattpm('build', applicationDir, { timeout: 60_000 })

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
})

test('build - should handle build errors', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build-error', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(applicationDir, 'web/main/dist'))
  })

  const result = await wattpm('build', buildDir, { reject: false, timeout: 60_000 })
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

  await wattpm('build', buildDir, '--env', customEnvFile, { timeout: 60_000 })

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
})

test('build - should not resolve the configuration of an application from a discovered .env file with a custom env file', async t => {
  const { writeFile } = await import('node:fs/promises')
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  const applicationDir = resolve(buildDir, 'web/main')

  // The output folder of the build comes from a placeholder that the custom env file leaves unset and that a .env
  // file above the application sets: the build must ignore that file, as the custom env file replaces it.
  await saveConfigurationFile(resolve(applicationDir, 'watt.json'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json',
    application: {
      commands: {
        build: 'npm run build -- --outDir dist{PLT_BUILD_OUTPUT_SUFFIX}'
      }
    }
  })
  await writeFile(resolve(buildDir, '.env'), 'PLT_BUILD_OUTPUT_SUFFIX=-from-discovered-env', 'utf8')
  await writeFile(resolve(buildDir, 'custom-build.env'), 'BUILD_CUSTOM_VAR=from_custom_build', 'utf8')

  // The command inherits the variables of the test process, which would win over both files: the variable is
  // removed for the duration of the test and restored afterwards.
  const originalSuffix = process.env.PLT_BUILD_OUTPUT_SUFFIX
  delete process.env.PLT_BUILD_OUTPUT_SUFFIX

  t.after(async () => {
    if (typeof originalSuffix === 'string') {
      process.env.PLT_BUILD_OUTPUT_SUFFIX = originalSuffix
    }

    await safeRemove(resolve(applicationDir, 'dist'))
    await safeRemove(resolve(applicationDir, 'dist-from-discovered-env'))
  })

  await wattpm('build', buildDir, '--env', resolve(buildDir, 'custom-build.env'), { timeout: 60_000 })

  ok(existsSync(resolve(applicationDir, 'dist/index.js')))
  ok(!existsSync(resolve(applicationDir, 'dist-from-discovered-env')))
})
