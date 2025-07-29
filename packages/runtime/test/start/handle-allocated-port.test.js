'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { create } = require('../..')
const { isCIOnWindows } = require('../helpers')
const { once } = require('node:events')
const http = require('http')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

async function getPort () {
  if (isCIOnWindows) {
    const getPort = await import('get-port')
    return getPort.default({ port: getPort.portNumbers(3000, 3100) })
  }

  return 0
}

async function setupAndStartRuntime (configFile) {
  const runtime = await create(configFile, null, { start: true })
  const address = await runtime.getUrl()

  return { address, runtime }
}

test('can increase port when starting a runtime with a port allocated', async t => {
  const dummyServer = http.createServer(function (req, res) {
    res.write('test')
    res.end()
  })
  const port = await getPort()

  dummyServer.listen(port, '127.0.0.1')
  await once(dummyServer, 'listening')
  t.after(async () => {
    await new Promise(resolve => dummyServer.close(resolve))
  })

  const dummyPort = dummyServer.address().port
  process.env.PORT = dummyPort

  const configFile = join(fixturesDir, 'configs', 'service-with-env-port.json')
  const { address, runtime } = await setupAndStartRuntime(configFile)

  const url = new URL(address)
  assert.strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})

test('can increase port when starting services without runtime config and port set via environment variable', async t => {
  const dummyServer = http.createServer(function (req, res) {
    res.write('test')
    res.end()
  })

  const port = await getPort()

  dummyServer.listen(port, '127.0.0.1')
  await once(dummyServer, 'listening')
  t.after(async () => {
    await new Promise(resolve => dummyServer.close(resolve))
  })

  const dummyPort = dummyServer.address().port
  process.env.PORT = dummyPort

  const configFile = join(fixturesDir, 'configs', 'service-only-with-env-port.json')
  const { address, runtime } = await setupAndStartRuntime(configFile)

  const url = new URL(address)
  assert.strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})

// This situation should not happen in practice, but we are testing the different combinations of configurations
test('can increase port when starting services without runtime config and no port set at all', async t => {
  const dummyServer = http.createServer(function (req, res) {
    res.write('test')
    res.end()
  })

  const port = await getPort()

  dummyServer.listen(port, '127.0.0.1')
  await once(dummyServer, 'listening')
  t.after(async () => {
    await new Promise(resolve => dummyServer.close(resolve))
  })

  const dummyPort = dummyServer.address().port
  process.env.DUMMY_PORT = dummyPort

  const configFile = join(fixturesDir, 'configs', 'service-only-with-no-port.json')
  const { address, runtime } = await setupAndStartRuntime(configFile)

  const url = new URL(address)
  assert.strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})
