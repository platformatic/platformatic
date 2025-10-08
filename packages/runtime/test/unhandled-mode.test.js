import { ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, readLogs } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should allow application to self-manage uncaught exceptions', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.json')
  const server = await createRuntime(configFile)
  const url = await server.start()

  let exited = false
  server.once('application:worker:exited', (code, signal) => {
    exited = true
  })

  t.after(() => {
    return server.close()
  })

  const res = await request(url + '/service/trigger')
  strictEqual(res.statusCode, 200)

  // Wait for the unhandled exception to be thrown
  await once(server, 'application:worker:event:uncaughtException')

  // The service should not have exited
  ok(!exited)
})

test('should allow application to self-manage unhandled rejections', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.json')
  const server = await createRuntime(configFile)

  const url = await server.start()

  let exited = false
  server.once('application:worker:exited', (code, signal) => {
    exited = true
  })

  t.after(() => {
    return server.close()
  })

  const res = await request(url + '/node/trigger')
  strictEqual(res.statusCode, 200)

  // Wait for the unhandled exception to be thrown
  await once(server, 'application:worker:event:unhandledRejection')

  // The service should not have exited
  ok(!exited)
})

test.only('should show warnings when installing a uncaughtException or unhandledRejection handler when exitOnUnhandledErrors is true', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.handled.json')
  const server = await createRuntime(configFile, null, context)

  await server.start()
  await server.close()

  const logs = await readLogs(context.logsPath, 0)

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
