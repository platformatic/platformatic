import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { once } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { getLogsFromFile, prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

function collectEvents (runtime, endEvent = 'closed') {
  const events = []
  const { promise, resolve } = Promise.withResolvers()

  const originalEmit = runtime.emit.bind(runtime)

  runtime.emit = (event, ...payload) => {
    events.push({ event, payload })

    if (event === endEvent) {
      resolve(events)
    }

    return originalEmit(event, ...payload)
  }

  return promise
}

test('startup failure preserves its error and completes async cleanup and SIGINT', async t => {
  const { runtime } = await prepareRuntime(t, 'failed-start-cleanup')
  const steps = []
  runtime.on('application:worker:event:startup:cleanup', step => steps.push(step))
  await rejects(runtime.start(), { code: 'TEST_START_FAILED' })
  await runtime.close()
  deepStrictEqual(steps, ['callback', 'signal'])
})

for (const mode of ['normal', 'stop-error', 'child-hang', 'open-resource', 'worker-hang', 'worker-busy', 'worker-slow']) {
  test(`CP shutdown supervises child and keeps worker cleanup separate: ${mode}`, async t => {
    const { runtime } = await prepareRuntime(t, 'cp-shutdown', false, null, async (root, config) => {
      config.applications[0].env = { SHUTDOWN_MODE: mode }
    })
    const steps = []
    let exitTimeout = false
    runtime.on('application:worker:exit:timeout', () => { exitTimeout = true })
    runtime.on('application:worker:event:shutdown:step', step => steps.push(step))
    const url = await startRuntime(t, runtime)
    const { pid } = await (await fetch(url)).json()
    t.after(() => {
      try { process.kill(pid, 'SIGKILL') } catch (error) {
        if (error.code !== 'ESRCH') { throw error }
      }
    })
    await runtime.close()
    // Reaping the killed child can complete just after the worker exit event.
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        process.kill(pid, 0)
      } catch (error) {
        if (error.code === 'ESRCH') { break }
        throw error
      }
      await sleep(10)
    }
    if (mode === 'worker-busy' && process.platform !== 'win32') {
      try {
        process.kill(pid, 0)
        const { stdout } = await promisify(execFile)('ps', ['-o', 'stat=', '-p', String(pid)])
        ok(stdout.trim().startsWith('Z'), 'the child must be dead, even if its blocked owner could not reap it')
      } catch (error) {
        if (error.code !== 'ESRCH') { throw error }
      }
    } else {
      throws(() => process.kill(pid, 0), { code: 'ESRCH' })
    }
    if (mode === 'normal' || mode === 'stop-error') {
      deepStrictEqual(steps, ['child:callback', 'worker:callback', 'worker:signal'])
    }
    if (mode === 'worker-slow') {
      strictEqual(exitTimeout, false, 'an acknowledgement received during cleanup must not be lost')
    }
  })
}

async function checkWarningEmitted (root, expected) {
  const message = 'Please export a "close" function or register a "close" event handler via getEvents() for application "frontend" to make sure resources have been closed properly and avoid exit timeouts.'
  const logs = await getLogsFromFile(root)
  deepStrictEqual(
    logs.some(m => m.msg === message),
    expected
  )
}

test('should invoke fastify onClose hooks', async t => {
  const { root, runtime } = await prepareRuntime(t, 'fastify-with-build-standalone', false)
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:fastify:close'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should invoke Symbol.asyncDispose on the app if defined', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-standalone-with-async-dispose')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:asyncDispose'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should close a non-listening raw HTTP server', async t => {
  const { runtime } = await prepareRuntime(t, 'close-non-listening-server')
  const eventsPromise = collectEvents(runtime)

  await startRuntime(t, runtime)
  await runtime.close()

  const events = await eventsPromise
  ok(!events.find(m => m.event === 'application:worker:stop:error'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
})

test('should log stop errors without hanging runtime close', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-throws')
  const eventsPromise = collectEvents(runtime)

  await startRuntime(t, runtime)
  await runtime.close()

  const events = await eventsPromise
  ok(events.find(m => m.event === 'application:worker:stop:error'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))

  const logs = await getLogsFromFile(root)
  const stopErrorLog = logs.find(
    m => m.level === 50 && m.msg?.includes('Failed to stop worker 0 of the application "frontend"')
  )
  ok(stopErrorLog)
  strictEqual(stopErrorLog.err?.code, 'PLT_RUNTIME_APPLICATION_SHUTDOWN')
  ok(stopErrorLog.err?.message.includes('boom while closing'))
  ok(stopErrorLog.err?.message.includes('boom while callback'))
})

test('should invoke Symbol.asyncDispose for custom objects returned by create', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-standalone-with-custom-object-async-dispose')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:custom:asyncDispose'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should invoke close function for apps without create', async t => {
  const { runtime } = await prepareRuntime(t, 'close-standalone-with-close')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:close:function'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
})

test('should not invoke close handler for apps without create and without close', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-standalone-without-close')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(!events.find(m => m.event === 'application:worker:event:close:handler'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should invoke close function for background apps', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-background-with-close')
  await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  runtime.emitAndNotify('background:start')
  await once(runtime, 'application:worker:event:work')
  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:work'))
  ok(events.find(m => m.event === 'application:worker:event:close:function'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should not invoke close handler for background apps without close', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-background-without-close')
  await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  runtime.emitAndNotify('background:start')
  await once(runtime, 'application:worker:event:work')
  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:work'))
  ok(!events.find(m => m.event === 'application:worker:event:close:handler'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should support factory returned background apps', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-background-with-factory')
  const eventsPromise = collectEvents(runtime)

  const url = await startRuntime(t, runtime)
  strictEqual(url, undefined)

  await runtime.close()
  const events = await eventsPromise
  const logs = await getLogsFromFile(root)

  deepStrictEqual(events.filter(m => m.event === 'application:worker:event:create').length, 1)

  const closeAppEvent = events.find(m => m.event === 'application:worker:event:close:app')
  strictEqual(closeAppEvent.payload[0], 'factory-background-app')
  ok(events.some(m => m.event === 'application:worker:event:background:callback'))
  ok(!events.find(m => m.event === 'application:worker:event:close:module'))

  ok(!logs.find(m => m.msg === 'Platformatic is now listening at undefined'))
  await checkWarningEmitted(root, false)
})

test('should invoke registered close callbacks for custom commands apps', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-command-with-handler')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(!events.find(m => m.event === 'application:worker:event:close:handler'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  deepStrictEqual(
    events
      .filter(m => m.event.startsWith('application:worker:event:close:callback:'))
      .map(m => m.event),
    [
      'application:worker:event:close:callback:second',
      'application:worker:event:close:callback:first'
    ]
  )
  await checkWarningEmitted(root, false)
})

test('should not emit a warning when an app without create has no close handler', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-standalone-without-closing')
  const url = await startRuntime(t, runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()

  await checkWarningEmitted(root, false)
})

test('should not emit a warning when an background app has no close handler', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-background-without-closing')
  await startRuntime(t, runtime)

  runtime.emitAndNotify('background:start')
  await once(runtime, 'application:worker:event:work')
  await runtime.close()

  await checkWarningEmitted(root, false)
})

for (const duplicate of [false, true, 'failure']) {
  test(`should await reverse callbacks and invoke SIGINT after server shutdown (duplicates: ${duplicate})`, async t => {
    const { runtime } = await prepareRuntime(t, 'close-callbacks', false)
    const url = await startRuntime(t, runtime)
    const eventsPromise = collectEvents(runtime)

    if (duplicate) {
      const finished = once(runtime, 'application:worker:event:duplicates:finished')
      await fetch(`${url}/duplicates${duplicate === 'failure' ? '-fail' : ''}`)
      await finished
    }

    await runtime.close()
    const events = await eventsPromise
    const callbackEvents = events
      .filter(m => m.event.startsWith('application:worker:event:callback:') || m.event === 'application:worker:event:signal')
      .map(m => m.event)

    deepStrictEqual(callbackEvents, [
      'application:worker:event:callback:second',
      'application:worker:event:callback:first',
      'application:worker:event:signal'
    ])
    strictEqual(events.some(m => m.event === 'application:worker:stop:error'), duplicate === 'failure')
  })
}
