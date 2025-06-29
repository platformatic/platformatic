const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get meta for db services in runtime schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const dbMeta = await app.getServiceMeta('db-app')
  const database = join(fixturesDir, 'monorepo', 'dbApp', 'db.sqlite')
  assert.deepStrictEqual(dbMeta, {
    composer: {
      needsRootTrailingSlash: false,
      prefix: '/db-app/',
      wantsAbsoluteUrls: false,
      tcp: false,
      url: undefined
    },
    connectionStrings: [`sqlite://${database}`]
  })
})
