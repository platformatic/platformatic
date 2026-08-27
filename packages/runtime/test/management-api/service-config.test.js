import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { configurationFileIn, createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get application config', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = configurationFileIn(projectDir)
  const app = await createRuntime(configFile)

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
    await Promise.all([client.close(), app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/applications/service-1/config'
  })

  strictEqual(statusCode, 200)

  const applicationConfig = await body.json()

  /*
    No $schema: a v4 configuration is code, and the capability it selects is named by `module`,
    which the loader consumes rather than passing on to the worker.
  */
  deepStrictEqual(applicationConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      trustProxy: true,
      logger: {
        level: 'trace'
      }
    },
    application: {},
    service: { openapi: true },
    plugins: {
      paths: [join(projectDir, 'services', 'service-1', 'plugin.js')]
    },
    watch: {
      enabled: true
    }
  })
})
