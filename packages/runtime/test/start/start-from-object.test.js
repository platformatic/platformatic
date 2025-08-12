'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { transform, loadConfiguration, Runtime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { createTemporaryRoot } = require('../helpers.js')

test('can start applications programmatically from object', async t => {
  const root = await createTemporaryRoot()
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfiguration(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      config.logger ??= {}
      config.logger.transport ??= {
        target: 'pino/file',
        options: { destination: join(root, 'logs.txt') }
      }

      return config
    }
  })
  const app = new Runtime(config)

  const entryUrl = await app.start()

  t.after(async () => {
    process.exitCode = 0
    await app.close()
  })

  const res = await request(entryUrl)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
})
