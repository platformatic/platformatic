'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { readFile, rm } = require('node:fs/promises')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('can restart the runtime apps', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await buildServer(configFile)
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

test('do not restart if service is not started', async (t) => {
  const configPath = join(fixturesDir, 'crash-on-bootstrap', 'platformatic.runtime.json')
  const { configManager } = await loadConfig({}, ['-c', configPath], platformaticRuntime)

  const config = configManager.current

  const logsPath = join(tmpdir(), 'platformatic-crash-logs.txt')
  await rm(logsPath, { force: true })

  config.server.logger = {
    level: 'trace',
    transport: {
      target: 'pino/file',
      options: { destination: logsPath },
    },
  }

  const app = await buildServer(config)

  try {
    await app.start()
    assert.fail('expected an error')
  } catch (err) {
    assert.strictEqual(err.message, 'The service service-2 exited prematurely with error code 1')
  }

  const logs = await readFile(logsPath, 'utf8')
  assert.ok(logs.includes('Service \\"service-2\\" unexpectedly exited with code 1.'))

  assert.ok(logs.includes('Starting a service \\"service-2\\" in 100ms. Attempt 1 of 5...'))
  assert.ok(logs.includes('Starting a service \\"service-2\\" in 100ms. Attempt 2 of 5...'))
  assert.ok(logs.includes('Starting a service \\"service-2\\" in 100ms. Attempt 3 of 5...'))
  assert.ok(logs.includes('Starting a service \\"service-2\\" in 100ms. Attempt 4 of 5...'))
  assert.ok(logs.includes('Starting a service \\"service-2\\" in 100ms. Attempt 5 of 5...'))

  assert.ok(logs.includes('Failed to start service \\"service-2\\" after 5 attempts.'))
  assert.ok(logs.includes('Service \\"service-2\\" unexpectedly exited with code 1.'))
  assert.ok(logs.includes('Stopping service \\"service-1\\"...'))
})
