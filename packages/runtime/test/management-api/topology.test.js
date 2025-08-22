import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { version } from '../../lib/version.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get applications topology', async t => {
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
    path: '/api/v1/applications'
  })

  strictEqual(statusCode, 200)

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await body.json()

  deepStrictEqual(topology, {
    entrypoint: 'service-1',
    production: false,
    applications: [
      {
        id: 'service-1',
        type: 'service',
        status: 'started',
        version,
        entrypoint: true,
        url: entrypointDetails.url,
        localUrl: 'http://service-1.plt.local',
        dependencies: []
      },
      {
        id: 'service-2',
        type: 'service',
        status: 'started',
        version,
        entrypoint: false,
        localUrl: 'http://service-2.plt.local',
        dependencies: []
      },
      {
        id: 'service-db',
        type: 'db',
        status: 'started',
        version,
        entrypoint: false,
        localUrl: 'http://service-db.plt.local',
        dependencies: []
      }
    ]
  })
})
