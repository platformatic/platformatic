import { equal, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { version } from '../../lib/version.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get the runtime metadata', async t => {
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
    path: '/api/v1/metadata'
  })

  strictEqual(statusCode, 200)

  const entrypoint = await app.getEntrypointDetails()

  const metadata = await body.json()
  equal(metadata.pid, process.pid)
  equal(metadata.cwd, process.cwd())
  equal(metadata.execPath, process.execPath)
  equal(metadata.nodeVersion, process.version)
  equal(metadata.packageName, 'test-runtime-package')
  equal(metadata.packageVersion, '1.0.42')
  equal(metadata.projectDir, projectDir)
  equal(metadata.url, entrypoint.url)
  equal(metadata.platformaticVersion, version)

  ok(metadata.uptimeSeconds >= 0)
  ok(metadata.uptimeSeconds < 10)
})
