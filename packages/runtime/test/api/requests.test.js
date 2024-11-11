'use strict'

const { ok, deepStrictEqual } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const { openLogsWebsocket, waitForLogs } = require('../helpers')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should handle a lot of runtime api requests', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const promises = []
  for (let i = 0; i < 100; i++) {
    promises.push(app.getServiceDetails('with-logger'))
  }

  await Promise.all(promises)
})

test('should handle service mesh timeouts', async (t) => {
  const configFile = join(fixturesDir, 'network-timeout', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
  })

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Platformatic is now listening',
    'fetch failed'
  )

  const url = await app.start()
  const response = await fetch(url + '/')

  const messages = await waitPromise
  deepStrictEqual(response.status, 500)
  deepStrictEqual(await response.json(), { statusCode: 500, error: 'Internal Server Error', message: 'fetch failed' })
  ok(messages.find(m => m.err?.message === 'fetch failed: Timeout while waiting from a response from service-2.plt.local'))
})
