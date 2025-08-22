import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'assert/strict'
import { once } from 'node:events'
import { symlink } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createComposerInRuntime, REFRESH_TIMEOUT } from './helper.js'

function ensureCleanup (t, folders) {
  function cleanup () {
    return Promise.all(folders.map(safeRemove))
  }

  t.after(cleanup)
  return cleanup()
}

function waitEventOnAllApplications (runtime, applications, event) {
  const pending = new Set()

  for (const [application, workers] of Object.entries(applications)) {
    for (let i = 0; i < workers; i++) {
      pending.add(`${application}:${i}`)
    }
  }

  const { promise, resolve } = Promise.withResolvers()

  function listener ({ application, worker }) {
    pending.delete(`${application}:${worker}`)

    if (pending.size === 0) {
      runtime.off(event, listener)
      resolve()
    }
  }

  runtime.on(event, listener)
  return promise
}

test('should properly report as failed on the health check route when all dependent applications crash', async t => {
  const nodeModulesRoot = resolvePath(import.meta.dirname, './health-check/fixtures/node-with-failure/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolvePath(nodeModulesRoot, '@platformatic'))
  await symlink(
    resolvePath(import.meta.dirname, '../../node'),
    resolvePath(nodeModulesRoot, '@platformatic/node'),
    'dir'
  )

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
          interval: 100
        }
      }
    },
    [
      {
        id: 'first',
        path: resolvePath(import.meta.dirname, './health-check/fixtures/node-with-failure'),
        workers: 2
      },
      {
        id: 'second',
        path: resolvePath(import.meta.dirname, './health-check/fixtures/node-with-failure'),
        workers: 3
      },
      {
        id: 'third',
        path: resolvePath(import.meta.dirname, './health-check/fixtures/node-with-failure')
      }
    ],
    null,
    {
      logger: {
        level: 'fatal'
      },
      restartOnError: 2000
    },
    true
  )

  const applications = {
    first: 2,
    second: 3,
    third: 1
  }

  t.after(() => {
    broadcaster.close()
  })

  const url = await runtime.start()

  // Right away, the health check and all applications should be successful.
  {
    const { statusCode } = await request(`${url}/status`)
    assert.strictEqual(statusCode, 200)
  }

  for (const [application, workers] of Object.entries(applications)) {
    for (let i = 0; i < workers; i++) {
      const { statusCode, body } = await request(`${url}/${application}/api`)

      assert.strictEqual(statusCode, 200)
      assert.deepStrictEqual(await body.json(), { ok: true })
    }
  }

  // Wait for all processes to crash and then for the health check to report the failure.
  await waitEventOnAllApplications(runtime, applications, 'application:worker:error')
  await once(runtime, 'application:worker:event:unhealthy')

  // Verify health check
  {
    const { statusCode } = await request(`${url}/status`)
    assert.strictEqual(statusCode, 503)
  }

  // Wait for applications to restart and the health check to report the success.
  await waitEventOnAllApplications(runtime, applications, 'application:worker:started')
  await once(runtime, 'application:worker:event:healthy')

  // Verify health check
  {
    const { statusCode } = await request(`${url}/status`)
    assert.strictEqual(statusCode, 200)
  }
})
