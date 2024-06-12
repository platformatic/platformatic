'use strict'
const assert = require('node:assert')
// const { platformaticRuntime } = require('../..')
// const { join } = require('node:path')
const { test } = require('node:test')
// const { loadConfig } = require('@platformatic/config')
// const fixturesDir = join(__dirname, '..', '..', 'fixtures')
// const { buildRuntime } = require('../../lib/start')
const http = require('http')
const { startCommand } = require('@platformatic/runtime')

let dummyPort = 0

test.beforeEach(() => {
  const dummyServer = http.createServer(function (req, res) {
    console.log('Server starting!')
    res.write('test')
    res.end()
  })

  dummyServer.listen(0, () => {
    dummyPort = dummyServer.address().port
    process.env.PORT = dummyPort
  })
})

test('startes with port +1 when current port is allocated', async () => {
  // const configFile = join(fixturesDir, 'configs', 'service-with-env-port.json')
  // const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  await startCommand([])
  console.log(dummyPort)
  assert.strictEqual(process.env.PORT, 1)
})
