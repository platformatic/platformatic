'use strict'

const { ok } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { buildServer, loadConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { openLogsWebsocket, waitForLogs } = require('./helpers')

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
    'The service "db-app" is unhealthy. Replacing it ...',
    'The service "serviceApp" is unhealthy. Replacing it ...',
    'The service "with-logger" is unhealthy. Replacing it ...',
    'The service "multi-plugin-service" is unhealthy. Replacing it ...'
  )
  await server.start()

  const messages = (await waitPromise).map(m => m.msg)

  for (const service of ['db-app', 'serviceApp', 'with-logger', 'multi-plugin-service']) {
    const eluMatcher = new RegExp(
      `The service "${service}" has an ELU of \\d+\\.\\d+ %, above the maximum allowed usage of \\d+\\.\\d+ %\\.`
    )
    const memoryMatcher = new RegExp(
      `The service "${service}" is using \\d+\\.\\d+ % of the memory, above the maximum allowed usage of \\d+\\.\\d+ %\\.`
    )

    ok(messages.some(m => eluMatcher.test(m)))
    ok(messages.some(m => memoryMatcher.test(m)))
    ok(messages.includes(`The service "${service}" is unhealthy. Replacing it ...`))
  }
})
