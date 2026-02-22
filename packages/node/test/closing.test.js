import { deepStrictEqual, ok } from 'node:assert'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { test } from 'node:test'
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

async function checkWarningEmitted (root, expected, custom = false) {
  const message = custom
    ? 'Please register a "close" event handler in globalThis.platformatic.events for application "frontend" to make sure resources have been closed properly and avoid exit timeouts.'
    : 'Please export a "close" function or register a "close" event handler in globalThis.platformatic.events for application "frontend" to make sure resources have been closed properly and avoid exit timeouts.'

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

test('should invoke close handler for apps without create and without close', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-standalone-without-close')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:close:handler'))
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

test('should invoke close handler for background apps without close', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-background-without-close')
  await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  runtime.emitAndNotify('background:start')
  await once(runtime, 'application:worker:event:work')
  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:work'))
  ok(events.find(m => m.event === 'application:worker:event:close:handler'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should invoke close handler for custom commands apps', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-command-with-handler')
  const url = await startRuntime(t, runtime)
  const eventsPromise = collectEvents(runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()
  const events = await eventsPromise

  ok(events.find(m => m.event === 'application:worker:event:close:handler'))
  ok(!events.find(m => m.event === 'application:worker:exit:timeout'))
  await checkWarningEmitted(root, false)
})

test('should emit a warning when an app without create has no function and no close handler', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-standalone-without-closing')
  const url = await startRuntime(t, runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()

  await checkWarningEmitted(root, true)
})

test('should emit a warning when an background app has no function and no close handler', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-background-without-closing')
  await startRuntime(t, runtime)

  runtime.emitAndNotify('background:start')
  await once(runtime, 'application:worker:event:work')
  await runtime.close()

  await checkWarningEmitted(root, true)
})

test('should emit a warning when a custom commands app has no no close handler', async t => {
  const { root, runtime } = await prepareRuntime(t, 'close-command-without-closing')
  const url = await startRuntime(t, runtime)

  const res = await fetch(url)
  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()

  await checkWarningEmitted(root, false, true)
})
