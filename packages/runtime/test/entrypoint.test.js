'use strict'

const { deepStrictEqual, ifError, rejects } = require('node:assert')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')
const { Runtime } = require('../lib/runtime')
const { getRuntimeLogsDir } = require('../lib/utils')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('should automatically detect the entrypoint if it there is only a single service', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-single-service.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const raw = JSON.parse(await readFile(configFile, 'utf-8'))
  ifError(raw.entrypoint)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { entrypoint } = await runtime.getServices()

  deepStrictEqual(config.configManager.current.entrypoint, 'main')
  deepStrictEqual(config.configManager.current.services[0].entrypoint, true)
  deepStrictEqual(entrypoint, 'main')
})

test('should automatically detect the entrypoint if it there exacty a composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-with-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const dirname = config.configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const raw = JSON.parse(await readFile(configFile, 'utf-8'))
  ifError(raw.entrypoint)

  const runtime = new Runtime(config.configManager, runtimeLogsDir, process.env)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()
  const { entrypoint } = await runtime.getServices()

  deepStrictEqual(config.configManager.current.entrypoint, 'composer')
  deepStrictEqual(config.configManager.current.services.find(s => s.id === 'composer').entrypoint, true)
  deepStrictEqual(entrypoint, 'composer')
})

test('should throw an exception if there is no composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-multiple-composers.json')

  await rejects(
    () => loadConfig({}, ['-c', configFile], platformaticRuntime),
    /Cannot parse config file. Missing application entrypoint./
  )
})

test('should throw an exception if there are multiple composer', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-no-composers.json')

  await rejects(
    () => loadConfig({}, ['-c', configFile], platformaticRuntime),
    /Cannot parse config file. Missing application entrypoint./
  )
})
