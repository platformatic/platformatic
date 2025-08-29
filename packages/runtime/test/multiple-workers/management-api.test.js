import { features } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'
import { prepareRuntime } from './helper.js'

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

  // Sort for consistent order
  json.applications.sort((a, b) => a.id.localeCompare(b.id))

  deepStrictEqual(json.applications[0].id, 'composer')
  deepStrictEqual(json.applications[0].workers, features.node.reusePort ? 3 : 1)
  deepStrictEqual(json.applications[1].id, 'node')
  deepStrictEqual(json.applications[1].workers, 5)
  deepStrictEqual(json.applications[2].id, 'service')
  deepStrictEqual(json.applications[2].workers, 3)
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

  // Sort for consistent order
  json.applications.sort((a, b) => a.id.localeCompare(b.id))

  deepStrictEqual(json.applications[0].id, 'composer')
  ok(!('workers' in json.applications[0]))
  deepStrictEqual(json.applications[1].id, 'node')
  ok(!('workers' in json.applications[1]))
  deepStrictEqual(json.applications[2].id, 'service')
  ok(!('workers' in json.applications[2]))
})
