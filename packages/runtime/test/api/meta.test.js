import { deepStrictEqual, ok } from 'node:assert'
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

test('should retry meta retrieval when the selected worker exits', async t => {
  const configFile = join(fixturesDir, 'meta-worker-exit', 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Two calls guarantee that round-robin selects worker 0, whose fixture
  // exits while handling getApplicationMeta. The retry should use worker 1.
  for (let i = 0; i < 2; i++) {
    const meta = await app.getApplicationMeta('service')
    ok(meta.gateway)
  }
})
