import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { version as pltVersion } from '../../lib/schema.js'
import { createFromConfig } from '../helper.js'

test('get service info via stackable api', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    composer: {
      services: []
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    }
  }

  const stackable = await createFromConfig(t, config)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, {
    type: 'composer',
    version: pltVersion
  })
})
