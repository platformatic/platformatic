'use strict'

const { ok, strictEqual } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { buildServer, loadConfig } = require('..')
const { getTempDir } = require('./helpers.js')
const fixturesDir = join(__dirname, '..', 'fixtures')
const { request } = require('undici')
const { readFile } = require('node:fs/promises')
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

test('should show warnings when installing a uncaughtException or unhandledRejection handler when exitOnUnhandledErrors is true', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.handled.json')
  const logsPath = join(await getTempDir(), 'logs.txt')

  const config = await loadConfig({}, ['-c', configFile])
  config.configManager.current.logger = {
    level: 'debug',
    transport: {
      target: 'pino/file',
      options: {
        destination: logsPath
      }
    }
  }

  const server = await buildServer({ app: config.app, ...config.configManager.current })

  await server.start()
  await server.close()

  const rawLogs = await readFile(logsPath, 'utf-8')
  const logs = rawLogs.trim().split('\n').map(JSON.parse)

  ok(
    logs.find(
      entry =>
        entry.level === 40 &&
        entry.name === 'service' &&
        entry.msg.startsWith(
          'A listener has been added for the "process.uncaughtException" event. This listener will be never triggered as Watt default behavior will kill the process before.'
        )
    )
  )

  ok(
    logs.find(
      entry =>
        entry.level === 40 &&
        entry.name === 'node' &&
        entry.msg.startsWith(
          'A listener has been added for the "process.unhandledRejection" event. This listener will be never triggered as Watt default behavior will kill the process before.'
        )
    )
  )
})
