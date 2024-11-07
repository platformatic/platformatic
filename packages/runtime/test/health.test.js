'use strict'

const { ok } = require('node:assert')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { buildServer, loadConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { openLogsWebsocket, waitForLogs } = require('./helpers')

test('should continously monitor workers health', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-healthy.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  await server.start()

  t.after(() => {
    return server.close()
  })

  for (let i = 0; i < 3; i++) {
    await once(server, 'health')
  }
})

test('should restart the process if it exceeded maximum threshold', async t => {
  const configFile = join(fixturesDir, 'configs', 'health-unhealthy.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({
    app: config.app,
    ...config.configManager.current
  })

  const managementApiWebsocket = await openLogsWebsocket(server)

  t.after(async () => {
    await server.close()
    managementApiWebsocket.terminate()
  })

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Platformatic is now listening',
    'The service "db-app" is unhealthy. Forcefully terminating it ...',
    'The service "serviceApp" is unhealthy. Forcefully terminating it ...',
    'The service "with-logger" is unhealthy. Forcefully terminating it ...',
    'The service "multi-plugin-service" is unhealthy. Forcefully terminating it ...',
    'The service "db-app" unexpectedly exited with code 1.',
    'The service "serviceApp" unexpectedly exited with code 1.',
    'The service "with-logger" unexpectedly exited with code 1.',
    'The service "multi-plugin-service" unexpectedly exited with code 1.'
  )
  await server.start()

  const messages = (await waitPromise).map(m => m.msg)

  for (const service of ['db-app', 'serviceApp', 'with-logger', 'multi-plugin-service']) {
    ok(messages.includes(`The service "${service}" is unhealthy. Forcefully terminating it ...`))
    ok(messages.includes(`The service "${service}" unexpectedly exited with code 1.`))
  }
})
