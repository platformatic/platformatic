import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'

test('get service config via stackable api', async t => {
  const projectRoot = join(import.meta.dirname, '..', 'fixtures', 'directories')

  const stackable = await create(projectRoot)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      },
      keepAliveTimeout: 5000,
      trustProxy: true
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'fixtures', 'directories', 'routes')]
    },
    watch: {
      enabled: false
    }
  })
})
