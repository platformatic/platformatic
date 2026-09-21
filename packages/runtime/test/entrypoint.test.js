import { deepStrictEqual, ifError, rejects } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should automatically detect the entrypoint if it there is only a single application', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-single-service.json')
  const runtime = await createRuntime(configFile)

  const raw = JSON.parse(await readFile(configFile, 'utf-8'))
  ifError(raw.entrypoint)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { entrypoint } = await runtime.getApplications()

  const config = await runtime.getRuntimeConfig()
  deepStrictEqual(config.entrypoint, 'main')
  deepStrictEqual(config.applications[0].entrypoint, true)
  deepStrictEqual(entrypoint, 'main')
})

test('should automatically detect the entrypoint if it there exacty a gateway', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-with-composer.json')
  const runtime = await createRuntime(configFile)

  const raw = JSON.parse(await readFile(configFile, 'utf-8'))
  ifError(raw.entrypoint)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { entrypoint } = await runtime.getApplications()

  const config = await runtime.getRuntimeConfig()
  deepStrictEqual(config.entrypoint, 'composer')
  deepStrictEqual(config.applications.find(s => s.id === 'composer').entrypoint, true)
  deepStrictEqual(entrypoint, 'composer')
})

test('should allow no entrypoint if one cannot be automatically detected', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-no-composers.json')
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start(true)
  ifError(url)
  const { entrypoint } = await runtime.getApplications()

  const config = await runtime.getRuntimeConfig()
  ifError(config.entrypoint)
  deepStrictEqual(config.applications.some(s => s.entrypoint), false)
  ifError(entrypoint)
})

test('should allow no entrypoint if there are multiple gateways', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-multiple-composers.json')
  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start(true)
  ifError(url)
  const { entrypoint } = await runtime.getApplications()

  const config = await runtime.getRuntimeConfig()
  ifError(config.entrypoint)
  deepStrictEqual(config.applications.some(s => s.entrypoint), false)
  ifError(entrypoint)
})

test('should not throw if there are no applications', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-services-no-entrypoint.config.json')

  await createRuntime(configFile)
})

test('should throw an exception if there is an entrypoint with no applications', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-services.config.json')

  await rejects(
    () => createRuntime(configFile),
    /Cannot parse config file. Invalid entrypoint: 'doesNotExist' does not exist/
  )
})
