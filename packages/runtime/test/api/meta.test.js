const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should get meta for db services in runtime schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await create(configFile)

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
