import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig } from '../helper.js'

test('inject request into application capability', async t => {
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

  const { statusCode, body } = await capability.inject('/custom')
  assert.strictEqual(statusCode, 200, 'status code')

  const data = JSON.parse(body)
  assert.deepStrictEqual(data, { hello: 'world' })
})
