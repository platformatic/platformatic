import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { version as pltVersion } from '../../lib/schema.js'
import { createFromConfig } from '../helper.js'

test('get application info via capability api', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    gateway: {
      applications: []
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    }
  }

  const capability = await createFromConfig(t, config)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const capabilityInfo = await capability.getInfo()
  assert.deepStrictEqual(capabilityInfo, {
    type: 'gateway',
    version: pltVersion
  })
})
