import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should enable the management API by default', async t => {
  const projectDir = join(fixturesDir, 'management-api-defaults')
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

  const { statusCode, body } = await client.request({ method: 'GET', path: '/api/v1/config' })
  strictEqual(statusCode, 200)

  const runtimeConfig = await body.json()
  strictEqual(runtimeConfig.entrypoint, 'main')
})

test('should disable the management API if requested to', async t => {
  const projectDir = join(fixturesDir, 'management-api-defaults')
  const configFile = join(projectDir, 'platformatic-no-api.json')
  const app = await createRuntime(configFile)

  await app.start()

  strictEqual(app.getManagementApiUrl(), null)

  t.after(() => app.close())
})
