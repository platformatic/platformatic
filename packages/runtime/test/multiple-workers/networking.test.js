'use strict'

const { deepStrictEqual } = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')
const { createRuntime } = require('../helpers.js')
const { updateConfigFile } = require('../helpers')
const { prepareRuntime, verifyResponse, verifyInject } = require('./helper')

test('the mesh network works with the internal dispatcher', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const app = await createRuntime(configFile, null, { isProduction: true })
  const entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  await verifyResponse(entryUrl, 'service', 0, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 0, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 1, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 1, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 2, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 2, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 0, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 3, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 1, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 4, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 2, 'MockSocket')
  await verifyResponse(entryUrl, 'node', 0, 'MockSocket')
})

test('the mesh network works with the HTTP services when using ITC', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    contents.services[0].useHttp = true
    contents.services.push({
      id: 'service',
      path: './service',
      config: 'platformatic.json',
      useHttp: true,
      workers: 3
    })
  })

  const app = await createRuntime(configFile, null, { isProduction: true })
  const entryUrl = await app.start()
  const ports = await Promise.all(
    [0, 1, 2].map(async worker => {
      const meta = await app.getServiceMeta(`service:${worker}`)
      return new URL(meta.composer.url).port
    })
  )

  t.after(async () => {
    await app.close()
  })

  function verifySource (port, res) {
    deepStrictEqual(res.headers['x-plt-port'], port)
  }

  await verifyResponse(entryUrl, 'service', 0, 'Socket', verifySource.bind(null, ports[0]))
  await verifyResponse(entryUrl, 'node', 0, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket', verifySource.bind(null, ports[1]))
  await verifyResponse(entryUrl, 'node', 1, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket', verifySource.bind(null, ports[2]))
  await verifyResponse(entryUrl, 'node', 2, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 0, 'Socket', verifySource.bind(null, ports[0]))
  await verifyResponse(entryUrl, 'node', 3, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket', verifySource.bind(null, ports[1]))
  await verifyResponse(entryUrl, 'node', 4, 'MockSocket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket', verifySource.bind(null, ports[2]))
  await verifyResponse(entryUrl, 'node', 0, 'MockSocket')
})

test('the mesh network works with the HTTP services when using HTTP', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    contents.services[0].useHttp = true
    contents.services.push({
      id: 'service',
      path: './service',
      config: 'platformatic.json',
      useHttp: true,
      workers: 3
    })
  })

  await updateConfigFile(resolve(root, './node/platformatic.json'), contents => {
    contents.node = { dispatchViaHttp: true }
  })

  const app = await createRuntime(configFile, null, { isProduction: true })
  const entryUrl = await app.start()
  const ports = await Promise.all(
    [0, 1, 2].map(async worker => {
      const meta = await app.getServiceMeta(`service:${worker}`)
      return new URL(meta.composer.url).port
    })
  )

  t.after(async () => {
    await app.close()
  })

  function verifySource (port, res) {
    deepStrictEqual(res.headers['x-plt-port'], port)
  }

  await verifyResponse(entryUrl, 'service', 0, 'Socket', verifySource.bind(null, ports[0]))
  await verifyResponse(entryUrl, 'node', 0, 'Socket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket', verifySource.bind(null, ports[1]))
  await verifyResponse(entryUrl, 'node', 1, 'Socket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket', verifySource.bind(null, ports[2]))
  await verifyResponse(entryUrl, 'node', 2, 'Socket')

  await verifyResponse(entryUrl, 'service', 0, 'Socket', verifySource.bind(null, ports[0]))
  await verifyResponse(entryUrl, 'node', 3, 'Socket')

  await verifyResponse(entryUrl, 'service', 1, 'Socket', verifySource.bind(null, ports[1]))
  await verifyResponse(entryUrl, 'node', 4, 'Socket')

  await verifyResponse(entryUrl, 'service', 2, 'Socket', verifySource.bind(null, ports[2]))
  await verifyResponse(entryUrl, 'node', 0, 'Socket')
})

test('can inject on a worker', async t => {
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

  let nextWorker

  {
    const res = await client.request({ method: 'GET', path: '/api/v1/services/node/proxy/hello' })
    nextWorker = parseInt(res.headers['x-plt-worker-id']) + 1
  }

  await verifyInject(client, 'node', nextWorker)
  await verifyInject(client, 'node', (nextWorker + 1) % 5)
  await verifyInject(client, 'node', (nextWorker + 2) % 5)
  await verifyInject(client, 'node', (nextWorker + 3) % 5)
  await verifyInject(client, 'node', (nextWorker + 4) % 5)
  await verifyInject(client, 'node', nextWorker)
  await client.close()
})
