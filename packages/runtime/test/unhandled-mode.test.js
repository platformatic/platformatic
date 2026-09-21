import { ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { exitCodes } from '../lib/errors.js'
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

test('should invoke tracked uncaughtException listeners when exitOnUnhandledErrors is true', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.handled.json')
  const server = await createRuntime(configFile, null, context)
  const url = await server.start()

  t.after(() => {
    return server.close()
  })

  const listeners = await request(url + '/service/listeners')
  strictEqual(listeners.statusCode, 200)
  strictEqual((await listeners.body.json()).count, 1)

  const unhandled = once(server, 'application:worker:event:uncaughtException')
  const exited = once(server, 'application:worker:exited')

  const res = await request(url + '/service/trigger')
  strictEqual(res.statusCode, 200)

  await unhandled
  await exited

  const logs = await readLogs(context.logsPath, 0)
  ok(
    !logs.find(entry =>
      entry.msg?.startsWith(
        'A listener has been added for the "process.uncaughtException" event. This listener will be never triggered as Watt default behavior will kill the process before.'
      )
    )
  )
})

test('should invoke tracked unhandledRejection listeners when exitOnUnhandledErrors is true', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.handled.json')
  const server = await createRuntime(configFile, null, context)
  const url = await server.start()

  t.after(() => {
    return server.close()
  })

  const listeners = await request(url + '/node/listeners')
  strictEqual(listeners.statusCode, 200)
  strictEqual((await listeners.body.json()).count, 1)

  const unhandled = once(server, 'application:worker:event:unhandledRejection')
  const exited = once(server, 'application:worker:exited')

  const res = await request(url + '/node/trigger')
  strictEqual(res.statusCode, 200)

  await unhandled
  await exited

  const logs = await readLogs(context.logsPath, 0)

  ok(
    !logs.find(entry =>
      entry.msg?.startsWith(
        'A listener has been added for the "process.unhandledRejection" event. This listener will be never triggered as Watt default behavior will kill the process before.'
      )
    )
  )
})

test('should exit with the PROCESS_UNHANDLED_ERROR code on uncaught exceptions raised after initialization', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.handled.json')
  const server = await createRuntime(configFile)
  const url = await server.start()

  t.after(() => {
    return server.close()
  })

  // Listen before triggering, the worker exits about 100ms after the error is raised
  const errored = once(server, 'application:worker:error')

  const res = await request(url + '/service/trigger')
  strictEqual(res.statusCode, 200)

  const [payload] = await errored

  strictEqual(payload.application, 'service')
  strictEqual(payload.code, exitCodes.PROCESS_UNHANDLED_ERROR)
})

test('should exit with the PROCESS_UNHANDLED_ERROR code on unhandled rejections raised while starting', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.starting.json')
  const server = await createRuntime(configFile, null, context)

  t.after(() => {
    return server.close()
  })

  // The application raises the rejection and then never finishes starting, so the worker handles it
  // while its controller is still in the "starting" state. Stopping a controller in that state
  // rejects, and an unobserved rejection there is delivered right back to the unhandled error
  // handler: the worker would then spin instead of exiting, until the runtime gave up on the start
  // timeout or the heap was exhausted.
  //
  // The fixture pins startTimeout and restartOnError on purpose. The timeout does not bound the
  // boot, which is over before the runtime starts that clock; it bounds how long a regression here
  // is allowed to spin, and raising it only lets the spin exhaust the heap instead. The restart
  // count keeps the worker named in the message asserted below stable.
  const startError = await server.start().then(
    () => null,
    error => error
  )

  // Assert that the fixture reached the defect before asserting how the worker died, so that a
  // fixture which stops booting for an unrelated reason says so instead of looking like a
  // regression of the fix. The default readLogs delay is deliberate: the record still has to travel
  // through the file transport and there is no event left to wait on once the start has failed.
  const logs = await readLogs(context.logsPath)
  ok(
    logs.some(entry => entry.msg?.endsWith('threw an unhandledRejection event.')),
    'the worker should have reported the unhandled rejection'
  )

  ok(startError, 'starting the runtime should have failed')
  strictEqual(startError.code, 'PLT_RUNTIME_APPLICATION_EXIT')
  strictEqual(
    startError.message,
    `The application "starting:0" exited prematurely with error code ${exitCodes.PROCESS_UNHANDLED_ERROR}`
  )

  // The fixture runs at debug level so that this record exists. It is the only evidence that the
  // stop was attempted at all and that its rejection was handled rather than never raised, so it
  // pins the shape of the fix and not only the exit code above.
  ok(
    logs.some(entry => entry.msg?.endsWith('after the unhandledRejection event failed.')),
    'the worker should have reported the failed stop'
  )
})

test('should exit with the PROCESS_UNHANDLED_ERROR code when an unhandled rejection follows a stop', async t => {
  const configFile = join(fixturesDir, 'unhandled-mode', 'platformatic.handled.json')
  const server = await createRuntime(configFile)
  const url = await server.start()

  t.after(() => {
    return server.close()
  })

  // The same defect outside the starting state: the first rejection stops the application, which
  // leaves its controller no longer started, so the stop attempted for the second one rejects. A
  // started application therefore hangs on a second unhandled error raised inside the exit grace
  // period, rather than exiting. Listen before triggering, the worker exits about 100ms after the
  // error is raised.
  const errored = once(server, 'application:worker:error', { signal: AbortSignal.timeout(30000) }).catch(cause => {
    throw new Error('The worker did not exit after the second unhandled rejection.', { cause })
  })

  const res = await request(url + '/service/trigger-rejections')
  strictEqual(res.statusCode, 200)

  const [payload] = await errored

  strictEqual(payload.application, 'service')
  strictEqual(payload.code, exitCodes.PROCESS_UNHANDLED_ERROR)
})
