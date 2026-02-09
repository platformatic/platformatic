import { createServer } from 'http'
import { strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, isCIOnWindows } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

async function getPort () {
  if (isCIOnWindows) {
    const getPort = await import('get-port')
    return getPort.default({ port: getPort.portNumbers(3000, 3100) })
  }

  return 0
}

async function setupAndStartRuntime (configFile) {
  const runtime = await createRuntime(configFile, null, { start: true })
  const address = await runtime.getUrl()

  return { address, runtime }
}

test('can increase port when starting a runtime with a port allocated', async t => {
  const dummyServer = createServer(function (req, res) {
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
  strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})

test('can increase port when starting applications without runtime config and port set via environment variable', async t => {
  const dummyServer = createServer(function (req, res) {
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
  strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})

// This situation should not happen in practice, but we are testing the different combinations of configurations
test('can increase port when starting applications without runtime config and no port set at all', async t => {
  const dummyServer = createServer(function (req, res) {
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
  strictEqual(Number(url.port), dummyPort + 1)
  await runtime.close()
})
