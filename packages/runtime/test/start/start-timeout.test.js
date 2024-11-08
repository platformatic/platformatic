'use strict'

const { ok, rejects } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { openLogsWebsocket, waitForLogs } = require('../helpers')

test('can start timeout when applications dont start', async (t) => {
  const configFile = join(fixturesDir, 'start-timeout/platformatic.json')
  const app = await buildServer(configFile)

  const managementApiWebsocket = await openLogsWebsocket(app)

  t.after(async () => {
    await app.close()
    managementApiWebsocket.terminate()
  })

  const waitPromise = waitForLogs(
    managementApiWebsocket,
    'Starting the service "node"...',
    'The service "node" failed to start in 500ms. Forcefully killing the thread.'
  )

  await rejects(() => app.start())
  await waitPromise

  const messages = (await waitPromise).map((m) => m.msg)

  ok(messages.includes('Starting the service "node"...'))
  ok(messages.includes('The service "node" failed to start in 500ms. Forcefully killing the thread.'))

  await app.stop()
})
