import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareApplication } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('gateway entrypoint should keep the same port after restart triggered by addApplications', async t => {
  const configFile = join(fixturesDir, 'gateway-restart-port')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  const url = await runtime.start()
  const originalUrl = new URL(url)
  const originalPort = originalUrl.port

  // Verify initial routes work through the gateway proxy
  {
    const res = await request(url + '/backend/hello')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'backend' })
  }

  {
    const res = await request(url + '/frontend/hello')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'frontend' })
  }

  // Add a new application - this should trigger application:added → gateway request:restart
  const restartPromise = once(runtime, 'application:restarted')
  const addPromise = once(runtime, 'application:started')

  await runtime.addApplications(
    [
      await prepareApplication(runtime.getRuntimeConfig(true), {
        id: 'extra-service',
        path: './extra-service'
      })
    ],
    true
  )

  await addPromise
  await restartPromise

  // The gateway should have restarted on the SAME port
  const newUrl = runtime.getUrl()
  const newParsed = new URL(newUrl)

  strictEqual(
    newParsed.port,
    originalPort,
    `Port changed from ${originalPort} to ${newParsed.port} after gateway restart - port leak detected`
  )

  // All proxy routes should work after the restart, including the new service
  {
    const res = await request(newUrl + '/backend/hello')
    strictEqual(res.statusCode, 200, 'backend route should work after restart')
    deepStrictEqual(await res.body.json(), { from: 'backend' })
  }

  {
    const res = await request(newUrl + '/frontend/hello')
    strictEqual(res.statusCode, 200, 'frontend route should work after restart')
    deepStrictEqual(await res.body.json(), { from: 'frontend' })
  }

  {
    const res = await request(newUrl + '/extra-service/hello')
    strictEqual(res.statusCode, 200, 'extra-service route should work after restart')
    deepStrictEqual(await res.body.json(), { from: 'extra-service' })
  }
})

test('gateway entrypoint should not exit prematurely when restartApplication is called during startup', async t => {
  const configFile = join(fixturesDir, 'gateway-restart-port')
  const runtime = await createRuntime(configFile, null)

  t.after(async () => {
    await runtime.close()
  })

  // Hook into the gateway worker starting event. When the gateway worker
  // is being started, immediately trigger a restartApplication to simulate
  // the race condition where application:added events cause a restart
  // before the start() phase completes.
  let prematureExitDetected = false
  let restartDuringStartTriggered = false

  runtime.on('application:worker:starting', ({ application }) => {
    if (application === 'gateway' && !restartDuringStartTriggered) {
      restartDuringStartTriggered = true

      // Fire restartApplication asynchronously - this races with the ongoing start
      runtime.restartApplication('gateway').catch(() => {
        // Restart may fail if the worker hasn't been fully registered yet,
        // that's acceptable. What we need to verify is no premature exit.
      })
    }
  })

  runtime.on('application:worker:error', ({ application }) => {
    if (application === 'gateway') {
      prematureExitDetected = true
    }
  })

  const url = await runtime.start()
  ok(url, 'runtime should start successfully')

  // Give time for any concurrent restart to settle
  await new Promise(resolve => setTimeout(resolve, 3000))

  strictEqual(
    prematureExitDetected,
    false,
    'Gateway worker should not exit prematurely when restart races with startup'
  )

  // The runtime should be functional - gateway routes should work
  const currentUrl = runtime.getUrl()
  ok(currentUrl, 'runtime should have a valid URL')

  {
    const res = await request(currentUrl + '/backend/hello')
    strictEqual(res.statusCode, 200, 'backend route should work after startup race condition')
  }

  {
    const res = await request(currentUrl + '/frontend/hello')
    strictEqual(res.statusCode, 200, 'frontend route should work after startup race condition')
  }
})
