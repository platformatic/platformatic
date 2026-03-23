import { createServer } from 'http'
import { rejects } from 'node:assert'
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

test('fails when starting a runtime with a port already allocated', async t => {
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
  t.after(() => {
    delete process.env.PORT
  })

  const configFile = join(fixturesDir, 'configs', 'service-with-env-port.json')
  await rejects(() => createRuntime(configFile, null, { start: true }), { code: 'EADDRINUSE' })
})
