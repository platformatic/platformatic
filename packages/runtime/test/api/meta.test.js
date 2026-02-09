import { deepStrictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get meta for db applications in runtime schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const dbMeta = await app.getApplicationMeta('db-app')
  const database = join(fixturesDir, 'monorepo', 'dbApp', 'db.sqlite')
  deepStrictEqual(dbMeta, {
    gateway: {
      needsRootTrailingSlash: false,
      prefix: '/db-app/',
      wantsAbsoluteUrls: false,
      tcp: false,
      url: undefined
    },
    connectionStrings: [`sqlite://${database}`]
  })
})
