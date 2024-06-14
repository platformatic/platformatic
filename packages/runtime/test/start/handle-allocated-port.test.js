'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('../..')
const { setupAndStartRuntime } = require('../../lib/start')
const { once } = require('node:events')
const http = require('http')

test('startes with port +1 when current port is allocated', async (t) => {
  const dummyServer = http.createServer(function (req, res) {
    console.log('Server starting!')
    res.write('test')
    res.end()
  })

  dummyServer.listen(0, '127.0.0.1')
  await once(dummyServer, 'listening')
  t.after(async () => {
    await new Promise((resolve) => dummyServer.close(resolve))
  })

  const dummyPort = dummyServer.address().port
  process.env.PORT = dummyPort
  const configFile = join(fixturesDir, 'configs', 'service-with-env-port.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  const { address, runtime } = await setupAndStartRuntime(config)

  console.log('Server started on:', address)

  const url = new URL(address)
  assert.strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})
