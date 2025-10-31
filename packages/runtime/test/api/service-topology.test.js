import { deepStrictEqual } from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { version } from '../../lib/version.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get applications topology', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const monorepo = resolve(configFile, '../../monorepo/')
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
        config: resolve(monorepo, 'dbApp', 'platformatic.db.json'),
        path: resolve(monorepo, 'dbApp'),
        version,
        entrypoint: false,
        localUrl: 'http://db-app.plt.local',
        dependencies: []
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceApp', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceApp'),
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
        config: resolve(monorepo, 'serviceAppWithLogger', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithLogger'),
        version,
        entrypoint: false,
        localUrl: 'http://with-logger.plt.local',
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithMultiplePlugins', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithMultiplePlugins'),
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
  const monorepo = resolve(configFile, '../../monorepo/')
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
        config: resolve(monorepo, 'composerApp', 'platformatic.composer.json'),
        path: resolve(monorepo, 'composerApp'),
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
        config: resolve(monorepo, 'dbApp', 'platformatic.db.json'),
        path: resolve(monorepo, 'dbApp'),
        version,
        entrypoint: false,
        localUrl: 'http://dbApp.plt.local',
        dependencies: []
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceApp', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceApp'),
        version,
        entrypoint: false,
        localUrl: 'http://serviceApp.plt.local',
        dependencies: []
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithLogger', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithLogger'),
        version,
        entrypoint: false,
        localUrl: 'http://with-logger.plt.local',
        dependencies: []
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithMultiplePlugins', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithMultiplePlugins'),
        version,
        entrypoint: false,
        localUrl: 'http://multi-plugin-service.plt.local',
        dependencies: []
      }
    ],
    entrypoint: 'composerApp'
  })
})
