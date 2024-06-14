'use strict'
const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const { once } = require('node:events')
const http = require('http')

test('startes with port +1 when current port is allocated', async () => {
  const dummyServer = http.createServer(function (req, res) {
    console.log('Server starting!')
    res.write('test')
    res.end()
  })

  dummyServer.listen(0, '127.0.0.1')
  await once(dummyServer, 'listening')

  const dummyPort = dummyServer.address().port
  console.log(dummyPort)
  process.env.PORT = dummyPort
  const configFile = join(fixturesDir, 'configs', 'service-with-env-port.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  const address = await server.start()

  console.log('Server started on:', address)
})
