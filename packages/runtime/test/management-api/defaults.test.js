import { strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { configurationFileIn, createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should enable the management API by default', async t => {
  const projectDir = join(fixturesDir, 'management-api-defaults')
  const configFile = configurationFileIn(join(projectDir, 'default'))
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

  /*
    Any endpoint the management API serves answers the question this test asks, which is whether it
    is listening at all. It used to ask `/api/v1/config`, which v4 removed -- and the runtime's
    metadata is a better probe anyway, since it is what the commands that talk to a running runtime
    actually read.
  */
  const { statusCode, body } = await client.request({ method: 'GET', path: '/api/v1/metadata' })
  strictEqual(statusCode, 200)

  const metadata = await body.json()
  strictEqual(typeof metadata.projectDir, 'string')
})

test('should disable the management API if requested to', async t => {
  const projectDir = join(fixturesDir, 'management-api-defaults')
  const configFile = join(projectDir, 'no-api', 'watt.config.mjs')
  const app = await createRuntime(configFile)

  await app.start()

  strictEqual(app.getManagementApiUrl(), null)

  t.after(() => app.close())
})
