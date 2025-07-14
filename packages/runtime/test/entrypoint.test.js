'use strict'

const { deepStrictEqual, ifError, rejects } = require('node:assert')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { test } = require('node:test')
const { create } = require('../index.js')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('should automatically detect the entrypoint if it there is only a single service', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-single-service.json')
  const runtime = await create(configFile)

  const raw = JSON.parse(await readFile(configFile, 'utf-8'))
  ifError(raw.entrypoint)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { entrypoint } = await runtime.getServices()

  const config = await runtime.getRuntimeConfig()
  deepStrictEqual(config.entrypoint, 'main')
  deepStrictEqual(config.services[0].entrypoint, true)
  deepStrictEqual(entrypoint, 'main')
})

test('should automatically detect the entrypoint if it there exacty a composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-with-composer.json')
  const runtime = await create(configFile)

  const raw = JSON.parse(await readFile(configFile, 'utf-8'))
  ifError(raw.entrypoint)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { entrypoint } = await runtime.getServices()

  const config = await runtime.getRuntimeConfig()
  deepStrictEqual(config.entrypoint, 'composer')
  deepStrictEqual(config.services.find(s => s.id === 'composer').entrypoint, true)
  deepStrictEqual(entrypoint, 'composer')
})

test('should throw an exception if there is no composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-no-composers.json')

  await rejects(() => create(configFile), /Cannot parse config file. Missing application entrypoint./)
})

test('should throw an exception if there are multiple composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-multiple-composers.json')

  await rejects(() => create(configFile), /Cannot parse config file. Missing application entrypoint./)
})

test('should not throw if there are no services', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-services-no-entrypoint.config.json')

  await create(configFile)
})

test('should throw an exception if there is an entrypoint with no services', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-services.config.json')

  await rejects(() => create(configFile), /Cannot parse config file. Invalid entrypoint: 'doesNotExist' does not exist/)
})
