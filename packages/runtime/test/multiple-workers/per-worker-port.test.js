import { deepStrictEqual, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, updateConfigFile } from '../helpers.js'
import { prepareRuntime, waitForEvents } from './helper.js'

const HOST = '127.0.0.1'

async function getBasePort () {
  const getPort = await import('get-port')
  return getPort.default({ host: HOST })
}

async function preparePerWorkerPortRuntime (t, { application = 'node', workerCount = 5 } = {}) {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const basePort = await getBasePort()

  await updateConfigFile(configFile, contents => {
    contents.server = {
      hostname: HOST,
      port: basePort,
      portAssignment: 'perWorkerIncrement'
    }
    contents.autoload = undefined
    contents.entrypoint = application

    let applicationConfig = contents.services.find(service => service.id === application)
    if (!applicationConfig) {
      applicationConfig = {
        id: application,
        path: `./${application}`,
        config: 'platformatic.json'
      }
      contents.services.push(applicationConfig)
    }

    applicationConfig.workers = workerCount
  })

  if (application === 'service') {
    await updateConfigFile(resolve(root, 'service/platformatic.json'), contents => {
      contents.plugins.paths.push('./crash-plugin.js')
    })
  }

  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  return { app, basePort }
}

async function requestWorkerPort (port, expectedFrom = 'node') {
  const res = await request(`http://${HOST}:${port}/hello`, {
    headersTimeout: 2000,
    bodyTimeout: 2000
  })
  const json = await res.body.json()

  strictEqual(res.statusCode, 200)
  strictEqual(json.from, expectedFrom)
  strictEqual(res.headers['x-plt-port'], port.toString())

  return Number(res.headers['x-plt-worker-id'])
}

async function assertPortsRespond (basePort, offsets, expectedFrom = 'node') {
  const workerIds = []

  for (const offset of offsets) {
    workerIds.push(await requestWorkerPort(basePort + offset, expectedFrom))
  }

  return workerIds
}

async function waitForWorkerOnPort (port, expectedWorkerId, expectedFrom = 'node') {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const workerId = await requestWorkerPort(port, expectedFrom)
      if (workerId === expectedWorkerId) {
        return workerId
      }
    } catch {}

    await sleep(100)
  }

  throw new Error(`Port ${port} did not switch to worker ${expectedWorkerId}`)
}

async function assertPortClosed (port) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await request(`http://${HOST}:${port}/hello`, {
        headersTimeout: 200,
        bodyTimeout: 200
      })
      await res.body.text()
    } catch {
      return
    }

    await sleep(100)
  }

  throw new Error(`Port ${port} is still accepting requests`)
}

test('assigns one incremental port per entrypoint worker', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()

  for (let offset = 0; offset < 5; offset++) {
    strictEqual(await requestWorkerPort(basePort + offset), offset)
  }
})

test('assigns new incremental ports when scaling up and stops highest ports when scaling down', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  let report = await app.updateApplicationsResources([{ application: 'node', workers: 7 }])
  strictEqual(report.length, 1)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4, 5, 6]), [0, 1, 2, 3, 4, 5, 6])

  report = await app.updateApplicationsResources([{ application: 'node', workers: 3 }])
  strictEqual(report.length, 1)
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2]), [0, 1, 2])

  await assertPortClosed(basePort + 3)
  await assertPortClosed(basePort + 4)
  await assertPortClosed(basePort + 5)
  await assertPortClosed(basePort + 6)
})

test('preserves incremental ports when restarting an application', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  await app.restartApplication('node')

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [5, 6, 7, 8, 9])
})

test('preserves incremental ports when replacing workers after a health update', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t)

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4])

  await app.updateApplicationsResources([
    {
      application: 'node',
      workers: 5,
      health: { maxHeapTotal: '512MB' }
    }
  ])

  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2, 3, 4]), [5, 6, 7, 8, 9])
})

test('preserves incremental port when restarting a crashed worker', async t => {
  const { app, basePort } = await preparePerWorkerPortRuntime(t, { application: 'service', workerCount: 3 })

  await app.start()
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2], 'service'), [0, 1, 2])

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'service', worker: 0 },
    20_000
  )

  const res = await request(`http://${HOST}:${basePort}/crash`, { method: 'POST' })
  await res.body.text()
  await eventsPromise

  await waitForWorkerOnPort(basePort, 3, 'service')
  deepStrictEqual(await assertPortsRespond(basePort, [0, 1, 2], 'service'), [3, 1, 2])
})
