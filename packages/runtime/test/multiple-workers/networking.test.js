import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime, updateConfigFile } from '../helpers.js'
import { prepareRuntime, testRoundRobin, verifyInject } from './helper.js'

function addIngress (contents) {
  contents.services.push({
    id: 'ingress',
    path: './node',
    config: 'platformatic.json',
    workers: 1
  })
}

test('the mesh network works with default exposure', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  await updateConfigFile(configFile, addIngress)
  const app = await createRuntime(configFile, null, { isProduction: true })
  const { 'ingress:0': ingressUrl } = await app.start()

  t.after(async () => {
    await app.close()
  })

  await testRoundRobin(ingressUrl, [
    { name: 'service', workerCount: 3, expectedSocket: 'Socket' },
    { name: 'node', workerCount: 5, expectedSocket: 'MockSocket' }
  ])
})

test('the mesh network works with the HTTP applications when using ITC', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    addIngress(contents)
    contents.services[0].exposed = true
    contents.services.push({
      id: 'service',
      path: './service',
      config: 'platformatic.json',
      exposed: true,
      workers: 3
    })
  })

  const app = await createRuntime(configFile, null, { isProduction: true })
  const { 'ingress:0': ingressUrl } = await app.start()
  const ports = await Promise.all(
    [0, 1, 2].map(async worker => {
      const meta = await app.getApplicationMeta(`service:${worker}`)
      return new URL(meta.gateway.url).port
    })
  )

  t.after(async () => {
    await app.close()
  })

  await testRoundRobin(ingressUrl, [
    {
      name: 'service',
      workerCount: 3,
      expectedSocket: 'Socket',
      verifyAdditional: (res, workerId) => {
        deepStrictEqual(res.headers['x-plt-port'], ports[workerId])
      }
    },
    { name: 'node', workerCount: 5, expectedSocket: 'MockSocket' }
  ])
})

test('the mesh network works with the HTTP applications when using HTTP', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateConfigFile(configFile, contents => {
    addIngress(contents)
    contents.services[0].exposed = true
    contents.services.push({
      id: 'service',
      path: './service',
      config: 'platformatic.json',
      exposed: true,
      workers: 3
    })
  })

  await updateConfigFile(resolve(root, './node/platformatic.json'), contents => {
    contents.node = { dispatchViaHttp: true }
  })

  const app = await createRuntime(configFile, null, { isProduction: true })
  const { 'ingress:0': ingressUrl } = await app.start()
  const ports = await Promise.all(
    [0, 1, 2].map(async worker => {
      const meta = await app.getApplicationMeta(`service:${worker}`)
      return new URL(meta.gateway.url).port
    })
  )

  t.after(async () => {
    await app.close()
  })

  await testRoundRobin(ingressUrl, [
    {
      name: 'service',
      workerCount: 3,
      expectedSocket: 'Socket',
      verifyAdditional: (res, workerId) => {
        deepStrictEqual(res.headers['x-plt-port'], ports[workerId])
      }
    },
    { name: 'node', workerCount: 5, expectedSocket: 'Socket' }
  ])
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
    const res = await client.request({ method: 'GET', path: '/api/v1/applications/node/proxy/hello' })
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
