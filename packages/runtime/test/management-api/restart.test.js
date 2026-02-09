import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should restart all applications with a management api', async t => {
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
    method: 'POST',
    path: '/api/v1/restart'
  })
  await body.text()

  strictEqual(statusCode, 200)

  {
    const applicationDetails = await app.getApplicationDetails('service-1')
    strictEqual(applicationDetails.status, 'started')
  }

  {
    const applicationDetails = await app.getApplicationDetails('service-2')
    strictEqual(applicationDetails.status, 'started')
  }
})
