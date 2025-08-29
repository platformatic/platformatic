import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get runtime config', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
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
    path: '/api/v1/config'
  })

  strictEqual(statusCode, 200)

  const runtimeConfig = await body.json()
  strictEqual(runtimeConfig.entrypoint, 'service-1')
  strictEqual(runtimeConfig.watch, false)
  deepStrictEqual(runtimeConfig.autoload, {
    path: join(projectDir, 'services'),
    exclude: []
  })
  deepStrictEqual(runtimeConfig.managementApi, {
    logs: { maxSize: 6 }
  })
})
