import { deepStrictEqual, strictEqual } from 'node:assert'
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

  const topology = await app.getApplications()
  const applications = topology.applications.map(({ url, urls, ...application }) => {
    deepStrictEqual(urls, [url])
    strictEqual(new URL(url).protocol, 'http:')
    return application
  })

  deepStrictEqual({ ...topology, applications }, {
    production: false,
    applications: [
      {
        id: 'db-app',
        type: 'db',
        status: 'started',
        config: resolve(monorepo, 'dbApp', 'platformatic.db.json'),
        path: resolve(monorepo, 'dbApp'),
        version,
        localUrl: 'http://db-app.plt.local',
        dependencies: [],
        sourceMaps: false
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceApp', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceApp'),
        version,
        localUrl: 'http://serviceApp.plt.local',
        dependencies: [],
        sourceMaps: false
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithLogger', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithLogger'),
        version,
        localUrl: 'http://with-logger.plt.local',
        dependencies: [],
        sourceMaps: false
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithMultiplePlugins', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithMultiplePlugins'),
        version,
        localUrl: 'http://multi-plugin-service.plt.local',
        dependencies: [],
        sourceMaps: false
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

  const topology = await app.getApplications()
  const applications = topology.applications.map(({ url, urls, ...application }) => {
    deepStrictEqual(urls, [url])
    strictEqual(new URL(url).protocol, 'http:')
    return application
  })

  deepStrictEqual({ ...topology, applications }, {
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
        dependencies: ['with-logger', 'multi-plugin-service', 'serviceApp'],
        sourceMaps: false
      },
      {
        id: 'dbApp',
        type: 'db',
        status: 'started',
        config: resolve(monorepo, 'dbApp', 'platformatic.db.json'),
        path: resolve(monorepo, 'dbApp'),
        version,
        localUrl: 'http://dbApp.plt.local',
        dependencies: [],
        sourceMaps: false
      },
      {
        id: 'serviceApp',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceApp', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceApp'),
        version,
        localUrl: 'http://serviceApp.plt.local',
        dependencies: [],
        sourceMaps: false
      },
      {
        id: 'with-logger',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithLogger', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithLogger'),
        version,
        localUrl: 'http://with-logger.plt.local',
        dependencies: [],
        sourceMaps: false
      },
      {
        id: 'multi-plugin-service',
        type: 'service',
        status: 'started',
        config: resolve(monorepo, 'serviceAppWithMultiplePlugins', 'platformatic.service.json'),
        path: resolve(monorepo, 'serviceAppWithMultiplePlugins'),
        version,
        localUrl: 'http://multi-plugin-service.plt.local',
        dependencies: [],
        sourceMaps: false
      }
    ]
  })
})
