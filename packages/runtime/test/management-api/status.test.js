import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get the runtime status', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)
  await app.init()

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
    await Promise.all([client.close(), app.close()])
  })

  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/status'
    })

    strictEqual(statusCode, 200)
    const { status } = await body.json()
    strictEqual(status, 'init')
  }

  const startPromise = app.start()

  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/status'
    })

    strictEqual(statusCode, 200)
    const { status } = await body.json()
    strictEqual(status, 'starting')
  }

  await startPromise

  {
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/status'
    })

    strictEqual(statusCode, 200)
    const { status } = await body.json()
    strictEqual(status, 'started')
  }
})
