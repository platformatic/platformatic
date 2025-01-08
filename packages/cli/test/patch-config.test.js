import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { deepStrictEqual, ok } from 'node:assert'
import { cp, mkdtemp, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { cliPath } from './helper.js'

async function prepareRuntime (t) {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/runtime-patch-config'), rootDir, {
    recursive: true
  })
  t.after(() => safeRemove(rootDir))

  await createDirectory(resolve(rootDir, 'node_modules/@platformatic'))
  await symlink(
    fileURLToPath(new URL('../../node', import.meta.url)),
    resolve(rootDir, 'node_modules/@platformatic/node')
  )

  return rootDir
}

test('patch-config - should patch requested runtime and services config', async t => {
  const rootDir = await prepareRuntime(t)

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(rootDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(rootDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await execa('node', [cliPath, 'patch-config', '-p', resolve(rootDir, 'patch-1.js')], {
    cwd: rootDir,
    env: { NO_COLOR: 'true' }
  })

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(rootDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(rootDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, { ...runtimeConfigOriginal, restartOnError: true, entrypoint: 'alternate' })
  deepStrictEqual(mainServiceConfigPatched, {
    $schema: mainServiceConfigOriginal.$schema,
    application: { basePath: '/' }
  })

  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should do nothing when the patch is empty', async t => {
  const rootDir = await prepareRuntime(t)

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(rootDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(rootDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await execa('node', [cliPath, 'patch-config', '-p', resolve(rootDir, 'patch-2.js')], {
    cwd: rootDir,
    env: { NO_COLOR: 'true' }
  })

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(rootDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(rootDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, runtimeConfigOriginal)
  deepStrictEqual(mainServiceConfigPatched, mainServiceConfigOriginal)
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should do nothing when the patch contains invalid objects', async t => {
  const rootDir = await prepareRuntime(t)

  const runtimeConfigOriginal = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigOriginal = JSON.parse(await readFile(resolve(rootDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigOriginal = JSON.parse(
    await readFile(resolve(rootDir, 'web/alternative/watt.json'), 'utf-8')
  )

  await execa('node', [cliPath, 'patch-config', '-p', resolve(rootDir, 'patch-3.js')], {
    cwd: rootDir,
    env: { NO_COLOR: 'true' }
  })

  const runtimeConfigPatched = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  const mainServiceConfigPatched = JSON.parse(await readFile(resolve(rootDir, 'web/main/watt.json'), 'utf-8'))
  const alternateServiceConfigPatched = JSON.parse(
    await readFile(resolve(rootDir, 'web/alternative/watt.json'), 'utf-8')
  )

  deepStrictEqual(runtimeConfigPatched, runtimeConfigOriginal)
  deepStrictEqual(mainServiceConfigPatched, mainServiceConfigOriginal)
  deepStrictEqual(alternateServiceConfigPatched, alternateServiceConfigOriginal)
})

test('patch-config - should throw an error when the patch file does not export a function', async t => {
  const rootDir = await prepareRuntime(t)

  const serviceDir = resolve(rootDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const patchProcess = await execa('node', [cliPath, 'patch-config', '-p', resolve(rootDir, 'patch-4.js')], {
    cwd: rootDir,
    env: { NO_COLOR: 'true' },
    reject: false
  })

  deepStrictEqual(patchProcess.exitCode, 1)
  ok(patchProcess.stdout.includes('Patch file must export a function.'))
})

test('patch-config - should throw an error when the patch file is non existent', async t => {
  const rootDir = await prepareRuntime(t)
  const serviceDir = resolve(rootDir, 'web/main')

  t.after(async () => {
    await safeRemove(resolve(serviceDir, 'dist'))
  })

  const patchProcess = await execa('node', [cliPath, 'patch-config', '-p', resolve(rootDir, 'non-existent.js')], {
    cwd: rootDir,
    env: { NO_COLOR: 'true' },
    reject: false
  })

  deepStrictEqual(patchProcess.exitCode, 1)
  ok(patchProcess.stdout.includes('Cannot find module'))
})
