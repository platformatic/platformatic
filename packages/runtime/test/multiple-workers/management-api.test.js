'use strict'

const { ok, deepStrictEqual } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { features } = require('@platformatic/utils')
const { buildServer, platformaticRuntime } = require('../..')
const { prepareRuntime } = require('./helper')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('return workers information in the management API when starting in production mode', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const res = await client.request({ method: 'GET', path: '/api/v1/services' })
  const json = await res.body.json()

  deepStrictEqual(json.services[0].id, 'node')
  deepStrictEqual(json.services[0].workers, 5)
  deepStrictEqual(json.services[1].id, 'service')
  deepStrictEqual(json.services[1].workers, 3)
  deepStrictEqual(json.services[2].id, 'composer')
  deepStrictEqual(json.services[2].workers, features.node.reusePort ? 3 : 1)
})

test('return no workers information in the management API when starting in development mode', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const res = await client.request({ method: 'GET', path: '/api/v1/services' })
  const json = await res.body.json()

  deepStrictEqual(json.services[0].id, 'node')
  ok(!('workers' in json.services[1]))
  deepStrictEqual(json.services[1].id, 'service')
  ok(!('workers' in json.services[1]))
  deepStrictEqual(json.services[2].id, 'composer')
  ok(!('workers' in json.services[2]))
})
