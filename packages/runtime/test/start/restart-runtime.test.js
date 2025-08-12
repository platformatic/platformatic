'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { readFile, rm } = require('node:fs/promises')
const { request } = require('undici')

const { createRuntime } = require('../helpers.js')
const { transform } = require('../../lib/config')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('can restart the runtime apps', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  let entryUrl = await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const res = await request(entryUrl + '/upstream')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }

  entryUrl = await app.restart()

  {
    const res = await request(entryUrl + '/upstream')

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(await res.body.json(), { hello: 'world' })
  }
  process.exitCode = 0
})

test('do not restart if service is not started', async t => {
  const logsPath = join(tmpdir(), 'platformatic-crash-logs.txt')
  await rm(logsPath, { force: true })

  const configPath = join(fixturesDir, 'crash-on-bootstrap', 'platformatic.runtime.json')

  const app = await createRuntime(configPath, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      config.logger = {
        ...config.logger,
        level: 'trace',
        transport: {
          target: 'pino/file',
          options: { destination: logsPath }
        }
      }

      return config
    }
  })

  try {
    await app.start()
    assert.fail('expected an error')
  } catch (err) {
    assert.strictEqual(err.message, 'The service "service-2" exited prematurely with error code 1')
  }

  const logs = await readFile(logsPath, 'utf8')

  assert.ok(logs.includes('Attempt 1 of 5 to start the service \\"service-2\\" again will be performed in 100ms ...'))
  assert.ok(logs.includes('Attempt 2 of 5 to start the service \\"service-2\\" again will be performed in 100ms ...'))
  assert.ok(logs.includes('Attempt 3 of 5 to start the service \\"service-2\\" again will be performed in 100ms ...'))
  assert.ok(logs.includes('Attempt 4 of 5 to start the service \\"service-2\\" again will be performed in 100ms ...'))
  assert.ok(logs.includes('Attempt 5 of 5 to start the service \\"service-2\\" again will be performed in 100ms ...'))

  assert.ok(logs.includes('Failed to start service \\"service-2\\" after 5 attempts.'))
  assert.ok(logs.includes('Stopping the service \\"service-1\\"...'))
})
