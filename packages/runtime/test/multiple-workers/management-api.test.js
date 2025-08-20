'use strict'

const { ok, deepStrictEqual } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { features } = require('@platformatic/foundation')
const { createRuntime } = require('../helpers.js')
const { prepareRuntime } = require('./helper')

test('return workers information in the management API when starting in production mode', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })

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

  const res = await client.request({ method: 'GET', path: '/api/v1/applications' })
  const json = await res.body.json()

  deepStrictEqual(json.applications[0].id, 'node')
  deepStrictEqual(json.applications[0].workers, 5)
  deepStrictEqual(json.applications[1].id, 'service')
  deepStrictEqual(json.applications[1].workers, 3)
  deepStrictEqual(json.applications[2].id, 'composer')
  deepStrictEqual(json.applications[2].workers, features.node.reusePort ? 3 : 1)
})

test('return no workers information in the management API when starting in development mode', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null)

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

  const res = await client.request({ method: 'GET', path: '/api/v1/applications' })
  const json = await res.body.json()

  deepStrictEqual(json.applications[0].id, 'node')
  ok(!('workers' in json.applications[1]))
  deepStrictEqual(json.applications[1].id, 'service')
  ok(!('workers' in json.applications[1]))
  deepStrictEqual(json.applications[2].id, 'composer')
  ok(!('workers' in json.applications[2]))
})
