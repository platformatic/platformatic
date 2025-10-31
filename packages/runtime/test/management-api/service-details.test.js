import { deepStrictEqual, strictEqual } from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { version } from '../../lib/version.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get application details', async t => {
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
    path: '/api/v1/applications/service-1'
  })

  strictEqual(statusCode, 200)

  const entrypointDetails = await app.getEntrypointDetails()
  const applicationDetails = await body.json()
  deepStrictEqual(applicationDetails, {
    id: 'service-1',
    type: 'service',
    status: 'started',
    version,
    entrypoint: true,
    url: entrypointDetails.url,
    localUrl: 'http://service-1.plt.local',
    config: resolve(configFile, '../../management-api/services/service-1/platformatic.json'),
    path: resolve(configFile, '../../management-api/services/service-1'),
    dependencies: []
  })
})
