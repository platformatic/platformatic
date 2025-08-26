import { deepStrictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { version } from '../../lib/version.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get applications topology', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await app.getApplications()

  deepStrictEqual(topology, {
    entrypoint: 'serviceApp',
    production: false,
    applications: [
      {
        id: 'db-app',
        type: 'db',
        status: 'started',
        version,
        entrypoint: false,
        localUrl: 'http://db-app.plt.local',
        dependencies: []
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        version,
        entrypoint: true,
        url: entrypointDetails.url,
        localUrl: 'http://serviceApp.plt.local',
        dependencies: []
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        version,
        entrypoint: false,
        localUrl: 'http://with-logger.plt.local',
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        version,
        entrypoint: false,
        localUrl: 'http://multi-plugin-service.plt.local',
        dependencies: []
      }
    ]
  })
})

test('should get applications topology (gateway)', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const entrypointDetails = await app.getEntrypointDetails()
  const topology = await app.getApplications()

  deepStrictEqual(topology, {
    production: false,
    applications: [
      {
        id: 'composerApp',
        type: 'gateway',
        status: 'started',
        version,
        localUrl: 'http://composerApp.plt.local',
        entrypoint: true,
        dependencies: ['with-logger', 'multi-plugin-service', 'serviceApp'],
        url: entrypointDetails.url
      },
      {
        id: 'dbApp',
        type: 'db',
        status: 'started',
        version,
        localUrl: 'http://dbApp.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        version,
        localUrl: 'http://serviceApp.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        version,
        localUrl: 'http://with-logger.plt.local',
        entrypoint: false,
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        version,
        localUrl: 'http://multi-plugin-service.plt.local',
        entrypoint: false,
        dependencies: []
      }
    ],
    entrypoint: 'composerApp'
  })
})
