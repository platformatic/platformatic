'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get db info for db services in runtime schema', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const dbInfo = await app.getServiceDBInfo('db-app')
  const database = join(fixturesDir, 'monorepo', 'dbApp', 'db.sqlite')
  assert.deepStrictEqual(dbInfo, {
    connectionInfo: {
      database,
      host: undefined,
      port: undefined,
      user: undefined,
      isPg: undefined,
      isMySql: undefined,
      isSQLite: true,
      dbSystem: 'sqlite',
    },
    dbschema: [],
  })
})

test('should get null if not db', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const dbInfo = await app.getServiceDBInfo('with-logger')
  console.log('dbInfo', dbInfo)
  assert.deepStrictEqual(dbInfo, null)
})
