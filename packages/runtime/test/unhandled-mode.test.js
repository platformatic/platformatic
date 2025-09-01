'use strict'

const { ok, strictEqual } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { buildServer, loadConfig } = require('..')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { request } = require('undici')
const { setTimeout: sleep } = require('node:timers/promises')

test('should allow application to self-manage uncaught exceptions', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({ app: config.app, ...config.configManager.current })

  const url = await server.start()

  let exited = false
  server.once('service:worker:exited', (code, signal) => {
    exited = true
  })

  t.after(() => {
    return server.close()
  })

  const res = await request(url + '/service/trigger')
  strictEqual(res.statusCode, 200)

  // Wait for the unhandled exception to be thrown
  await sleep(2000)

  // The service should not have exited
  ok(!exited)
})

test('should allow application to self-manage unhandled rejections', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.json')
  const config = await loadConfig({}, ['-c', configFile])

  const server = await buildServer({ app: config.app, ...config.configManager.current })

  const url = await server.start()

  let exited = false
  server.once('service:worker:exited', (code, signal) => {
    exited = true
  })

  t.after(() => {
    return server.close()
  })

  const res = await request(url + '/node/trigger')
  strictEqual(res.statusCode, 200)

  // Wait for the unhandled rejection to be thrown
  await sleep(2000)

  // The service should not have exited
  ok(!exited)
})
