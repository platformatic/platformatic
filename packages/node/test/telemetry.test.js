import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should set telemetry in config on all the node applications', async t => {
  const { runtime } = await createRuntime(t, 'express-api-with-telemetry')

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: runtime.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/applications/api/config'
  })

  assert.strictEqual(statusCode, 200)

  const applicationConfig = await body.json()
  assert.deepEqual(applicationConfig.telemetry, {
    applicationName: 'test-application-api',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  })
})
