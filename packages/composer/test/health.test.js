'use strict'

const assert = require('assert/strict')
const { resolve: pathResolve } = require('node:path')
const { symlink } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { test } = require('node:test')
const { request } = require('undici')

const { createComposerInRuntime, REFRESH_TIMEOUT } = require('./helper')
const { safeRemove, createDirectory, withResolvers } = require('@platformatic/utils')

function ensureCleanup (t, folders) {
  function cleanup () {
    return Promise.all(folders.map(safeRemove))
  }

  t.after(cleanup)
  return cleanup()
}

function waitEventOnAllServices (runtime, services, event) {
  const pending = new Set()

  for (const [service, workers] of Object.entries(services)) {
    for (let i = 0; i < workers; i++) {
      pending.add(`${service}:${i}`)
    }
  }

  const { promise, resolve } = withResolvers()

  function listener ({ service, worker }) {
    pending.delete(`${service}:${worker}`)

    if (pending.size === 0) {
      runtime.off(event, listener)
      resolve()
    }
  }

  runtime.on(event, listener)
  return promise
}

test('should properly report as failed on the health check route when all dependent services crash', async t => {
  const nodeModulesRoot = pathResolve(__dirname, './health-check/fixtures/node-with-failure/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(pathResolve(nodeModulesRoot, '@platformatic'))
  await symlink(pathResolve(__dirname, '../../node'), pathResolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const broadcaster = new BroadcastChannel('plt.runtime.events')
  const runtime = await createComposerInRuntime(
    t,
    'base-path-no-configuration',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT
      },
      server: {
        healthCheck: {
          interval: 500
        }
      }
    },
    [
      {
        id: 'first',
        path: pathResolve(__dirname, './health-check/fixtures/node-with-failure'),
        workers: 2
      },
      {
        id: 'second',
        path: pathResolve(__dirname, './health-check/fixtures/node-with-failure'),
        workers: 3
      },
      {
        id: 'third',
        path: pathResolve(__dirname, './health-check/fixtures/node-with-failure')
      }
    ],
    null,
    {
      logger: {
        level: 'info'
      },
      restartOnError: 2000
    },
    true
  )

  const services = {
    first: 2,
    second: 3,
    third: 1
  }

  t.after(async () => {
    await runtime.close()
    broadcaster.close()
  })

  const url = await runtime.start()

  // Right away, the health check and all services should be successful.
  {
    const { statusCode } = await request(`${url}/status`)
    assert.strictEqual(statusCode, 200)
  }

  for (const [service, workers] of Object.entries(services)) {
    for (let i = 0; i < workers; i++) {
      const { statusCode, body } = await request(`${url}/${service}/api`)

      assert.strictEqual(statusCode, 200)
      assert.deepStrictEqual(await body.json(), { ok: true })
    }
  }

  // Wait for all processes to crash and then for the health check to report the failure.
  await waitEventOnAllServices(runtime, services, 'service:worker:error')
  await sleep(1000)

  // Verify health check
  {
    const { statusCode } = await request(`${url}/status`)
    assert.strictEqual(statusCode, 503)
  }

  // Wait for services to restart and the health check to report the success.
  await waitEventOnAllServices(runtime, services, 'service:worker:started')
  await sleep(1000)

  // Verify health check
  {
    const { statusCode } = await request(`${url}/status`)
    assert.strictEqual(statusCode, 200)
  }
})
