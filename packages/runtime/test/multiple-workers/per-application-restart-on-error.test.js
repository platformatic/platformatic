import { deepStrictEqual, ok } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from 'undici'
import { createRuntime, updateFile } from '../helpers.js'
import { prepareRuntime, waitForEvents } from './helper.js'

async function prepareCrashableRuntime (t, { runtimeRestartOnError, applicationRestartOnError }) {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  const config = JSON.parse(await readFile(configFile, 'utf-8'))
  config.workers = 1
  config.restartOnError = runtimeRestartOnError
  config.services[0].workers = 1

  if (typeof applicationRestartOnError !== 'undefined') {
    config.services[0].restartOnError = applicationRestartOnError
  }

  await writeFile(configFile, JSON.stringify(config, null, 2))

  // Add a route which crashes the worker when invoked
  await updateFile(resolve(root, 'node/index.mjs'), contents => {
    return contents.replace(
      "app.get('/hello'",
      `app.get('/crash', async () => {
    setImmediate(() => {
      throw new Error('kaboom')
    })

    return { ok: true }
  })

  app.get('/hello'`
    )
  })

  const app = await createRuntime(configFile)

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

  t.after(async () => {
    await client.close()
  })

  return { root, app, client }
}

test('per-application restartOnError=0 quarantines a crashed application while the runtime keeps running', async t => {
  const { app, client } = await prepareCrashableRuntime(t, {
    runtimeRestartOnError: 500,
    applicationRestartOnError: 0
  })

  const started = []
  app.on('application:worker:started', payload => {
    started.push(payload)
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'node', worker: 0 },
    { event: 'application:worker:unvailable', application: 'node', worker: 0 }
  )

  // Crash the only worker of the "node" application
  {
    const res = await client.request({ method: 'GET', path: '/api/v1/applications/node/proxy/crash' })
    await res.body.dump()
    deepStrictEqual(res.statusCode, 200)
  }

  await eventsPromise

  // Give a potential (unwanted) restart the time to happen, then verify it did not
  await sleep(2000)
  deepStrictEqual(
    started.filter(e => e.application === 'node'),
    [],
    'the crashed application should not be restarted'
  )

  // The runtime and the sibling applications must still serve requests
  const res = await client.request({ method: 'GET', path: '/api/v1/applications/service/proxy/hello' })
  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(await res.body.json(), { from: 'service' })
})

test('per-application restartOnError overrides a runtime which disabled restarts', async t => {
  const { app, client } = await prepareCrashableRuntime(t, {
    runtimeRestartOnError: 0,
    applicationRestartOnError: 100
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'node', worker: 0 },
    // Restarted workers get a new unique index
    { event: 'application:worker:started', application: 'node', worker: 1 }
  )

  const res = await client.request({ method: 'GET', path: '/api/v1/applications/node/proxy/crash' })
  await res.body.dump()
  deepStrictEqual(res.statusCode, 200)

  await eventsPromise

  // The restarted application must serve requests again
  const verify = await client.request({ method: 'GET', path: '/api/v1/applications/node/proxy/hello' })
  deepStrictEqual(verify.statusCode, 200)
  deepStrictEqual(await verify.body.json(), { from: 'node' })
})

test('the runtime-level restartOnError is used when the application does not define one', async t => {
  const { app, client } = await prepareCrashableRuntime(t, {
    runtimeRestartOnError: 0
  })

  const started = []
  app.on('application:worker:started', payload => {
    started.push(payload)
  })

  const eventsPromise = waitForEvents(
    app,
    { event: 'application:worker:error', application: 'node', worker: 0 },
    { event: 'application:worker:unvailable', application: 'node', worker: 0 }
  )

  const res = await client.request({ method: 'GET', path: '/api/v1/applications/node/proxy/crash' })
  await res.body.dump()
  deepStrictEqual(res.statusCode, 200)

  await eventsPromise

  await sleep(2000)
  ok(!started.some(e => e.application === 'node'), 'the crashed application should not be restarted')
})
