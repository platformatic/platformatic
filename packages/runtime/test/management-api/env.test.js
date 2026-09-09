import { deepEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { configurationFileIn, createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get the runtime process env', async t => {
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
    path: '/api/v1/env'
  })

  strictEqual(statusCode, 200)

  const runtimeEnv = await body.json()

  // v4 injects none of v3's PLT_ROOT, PLT_DEV or PLT_ENVIRONMENT, so this is the process env as-is.
  deepEqual(runtimeEnv, { ...process.env })
})
