import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

function cleanExtensionGlobals () {
  globalThis.__pltExtensionEvents = []
  globalThis.__pltExtensionItc = undefined
  globalThis.__pltExtensionSharedContext = undefined
}

test('extensions receive the runtime, the ITC facade, the logger, the options and the root', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  const res = await request(entryUrl + '/context')
  strictEqual(res.statusCode, 200)

  const context = await res.body.json()
  deepStrictEqual(context.options, { greeting: 'hello' })
  strictEqual(context.root, join(fixturesDir, 'extensions'))
  strictEqual(context.hasRuntime, true)
  strictEqual(context.hasLogger, true)
  strictEqual(context.hasSharedContext, true)
  strictEqual(context.hasMetrics, true)
  deepStrictEqual(context.applications, ['a'])
})

test('workers can invoke custom commands registered by extensions, also after a restart', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  {
    const res = await request(entryUrl + '/sum?x=1&y=2')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { result: 3 })
  }

  // Restarted workers must see the custom handlers as well
  await app.restartApplication('a')

  {
    // The entrypoint may listen on a different port after the restart
    const res = await request(app.getUrl() + '/sum?x=4&y=5')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { result: 9 })
  }
})

test('extensions can notify workers', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  await globalThis.__pltExtensionItc.notify('a', 'extension:ping', { value: 42 })

  // The notification is fire-and-forget, poll for the result
  for (let i = 0; i < 10; i++) {
    const res = await request(entryUrl + '/pings')
    strictEqual(res.statusCode, 200)
    const pings = await res.body.json()

    if (pings.length > 0) {
      deepStrictEqual(pings, [{ value: 42 }])
      return
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('The worker never received the notification')
})

test('extensions start, stop and close in registration and reverse order', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  await app.start()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'first' },
    { event: 'setup', extension: 'second' },
    { event: 'start', extension: 'first' },
    { event: 'start', extension: 'second' }
  ])

  await app.close()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'first' },
    { event: 'setup', extension: 'second' },
    { event: 'start', extension: 'first' },
    { event: 'start', extension: 'second' },
    { event: 'stop', extension: 'second' },
    { event: 'stop', extension: 'first' },
    { event: 'close', extension: 'second' },
    { event: 'close', extension: 'first' }
  ])
})

test('close-only extensions keep their current behavior', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-close-only.json')
  const app = await createRuntime(configFile)
  await app.start()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'close-only' }
  ])

  await app.close()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'close-only' },
    { event: 'close', extension: 'close-only' }
  ])
})

test('entrypoint stops before extension stop, remaining applications stop after', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-lifecycle.json')
  const app = await createRuntime(configFile)
  await app.start()

  await app.close()

  const events = globalThis.__pltExtensionEvents
  const entrypointStopped = events.findIndex(e => e.event === 'application:stopped' && e.application === 'a')
  const extensionStop = events.findIndex(e => e.event === 'stop' && e.extension === 'tracker')
  const remainingStopped = events.findIndex(e => e.event === 'application:stopped' && e.application === 'b')

  ok(entrypointStopped !== -1)
  ok(extensionStop !== -1)
  ok(remainingStopped !== -1)
  ok(entrypointStopped < extensionStop)
  ok(extensionStop < remainingStopped)
})

test('dynamic application started by an extension is not started twice', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-dynamic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => app.close())

  const startedB = globalThis.__pltExtensionEvents.filter(
    e => e.event === 'application:started' && e.application === 'b'
  )
  strictEqual(startedB.length, 1)

  deepStrictEqual(app.getApplicationsIds().toSorted(), ['a', 'b'])

  const details = await app.getApplicationDetails('b')
  strictEqual(details.status, 'started')
  ok(entryUrl)
})

test('configured application started by an extension is not started twice', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-start-configured.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => app.close())

  const startedA = globalThis.__pltExtensionEvents.filter(
    e => e.event === 'application:started' && e.application === 'a'
  )
  strictEqual(startedA.length, 1)
  ok(globalThis.__pltExtensionEvents.some(e => e.event === 'started-configured' && e.application === 'a'))
})

test('start-hook rejection performs partial cleanup', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-start-fail.json')
  const app = await createRuntime(configFile)

  await rejects(
    () => app.start(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_FAILED_TO_START_EXTENSION')
      ok(err.message.includes('start intentionally failed'))
      strictEqual(err.cause.message, 'start intentionally failed')
      return true
    }
  )

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'first' },
    { event: 'setup', extension: 'start-fail' },
    { event: 'start', extension: 'first' },
    { event: 'start', extension: 'start-fail' },
    { event: 'stop', extension: 'first' },
    { event: 'close', extension: 'start-fail' },
    { event: 'close', extension: 'first' }
  ])
})

test('application startup rejection performs extension cleanup', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-app-fail.json')
  const app = await createRuntime(configFile)

  await rejects(() => app.start())

  ok(globalThis.__pltExtensionEvents.some(e => e.event === 'start' && e.extension === 'first'))
  ok(globalThis.__pltExtensionEvents.some(e => e.event === 'stop' && e.extension === 'first'))
  ok(globalThis.__pltExtensionEvents.some(e => e.event === 'close' && e.extension === 'first'))

  const startIdx = globalThis.__pltExtensionEvents.findIndex(e => e.event === 'start' && e.extension === 'first')
  const stopIdx = globalThis.__pltExtensionEvents.findIndex(e => e.event === 'stop' && e.extension === 'first')
  const closeIdx = globalThis.__pltExtensionEvents.findIndex(e => e.event === 'close' && e.extension === 'first')
  ok(startIdx < stopIdx)
  ok(stopIdx < closeIdx)
})

test('repeated stop and close are idempotent for extension hooks', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  await app.start()

  await app.stop()
  await app.stop()
  await app.close()
  await app.close()

  const stops = globalThis.__pltExtensionEvents.filter(e => e.event === 'stop')
  const closes = globalThis.__pltExtensionEvents.filter(e => e.event === 'close')

  deepStrictEqual(stops, [
    { event: 'stop', extension: 'second' },
    { event: 'stop', extension: 'first' }
  ])
  deepStrictEqual(closes, [
    { event: 'close', extension: 'second' },
    { event: 'close', extension: 'first' }
  ])
})

test('extensions can be written in TypeScript', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-ts.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  const res = await request(entryUrl + '/ts')
  strictEqual(res.statusCode, 200)
  deepStrictEqual(await res.body.json(), { language: 'typescript', options: {} })
})

test('extensions subscribed to health metrics receive them even without health checks enabled', async t => {
  cleanExtensionGlobals()
  globalThis.__pltExtensionHealthEvents = []
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-health.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => {
    return app.close()
  })

  // Health metrics are collected every second, poll for the first event
  for (let i = 0; i < 50; i++) {
    const events = globalThis.__pltExtensionHealthEvents

    if (events.length > 0) {
      strictEqual(events[0].application, 'a')
      strictEqual(events[0].worker, 0)
      ok(events[0].currentHealth)
      return
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('The extension never received health metrics')
})

test('extensions receive the profiles captured by the continuous profiler, also after a restart', async t => {
  cleanExtensionGlobals()
  globalThis.__pltExtensionProfileEvents = []
  process.env.PORT = 0

  // The fixture extension enables continuous profiling on every worker via
  // the application:worker:started event, as shown in the documentation
  const configFile = join(fixturesDir, 'extensions', 'platformatic-profiles.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => {
    return app.close()
  })

  async function waitForCapturedProfiles () {
    // Wait for at least two rotations
    for (let i = 0; i < 100; i++) {
      const events = globalThis.__pltExtensionProfileEvents

      if (events.length > 1) {
        return events[0]
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error('The extension never received the captured profiles')
  }

  const event = await waitForCapturedProfiles()
  strictEqual(event.id, 'a:0')
  strictEqual(event.application, 'a')
  strictEqual(event.worker, 0)
  strictEqual(event.type, 'cpu')
  strictEqual(typeof event.timestamp, 'number')

  // The event only carries metadata, the profile is retrieved on demand
  strictEqual(event.profile, undefined)

  const { profile, timestamp, preserved } = await app.getApplicationLastProfile(event.id, { type: event.type })
  ok(profile instanceof Uint8Array || Buffer.isBuffer(profile))
  ok(profile.length > 0)
  strictEqual(typeof timestamp, 'number')
  strictEqual(preserved, false)

  // Profiling must be re-enabled on the replacement worker after a restart.
  // Truncate the array in place since the extension captured its reference.
  await app.restartApplication('a')
  globalThis.__pltExtensionProfileEvents.length = 0

  const eventAfterRestart = await waitForCapturedProfiles()
  strictEqual(eventAfterRestart.application, 'a')

  await app.stopApplicationProfiling(eventAfterRestart.id, { type: 'cpu' })
})

test('extensions can read and update the shared context, including newly started workers', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  t.after(() => {
    return app.close()
  })

  const sharedContext = globalThis.__pltExtensionSharedContext
  ok(sharedContext)

  // Initial snapshot is empty
  deepStrictEqual(sharedContext.get(), {})
  deepStrictEqual(app.getSharedContext(), {})

  // Merge update is visible to the runtime and existing workers
  await sharedContext.update({ foo: 'bar' })
  deepStrictEqual(sharedContext.get(), { foo: 'bar' })
  deepStrictEqual(app.getSharedContext(), { foo: 'bar' })

  {
    const res = await request(entryUrl + '/shared-context')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { foo: 'bar' })
  }

  // Second merge keeps previous keys
  await sharedContext.update({ bar: 'baz' })
  deepStrictEqual(sharedContext.get(), { foo: 'bar', bar: 'baz' })

  {
    const res = await request(app.getUrl() + '/shared-context')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { foo: 'bar', bar: 'baz' })
  }

  // Overwrite replaces the snapshot. The positional update wins over a
  // same-named untyped options property, as it does in the worker API.
  await sharedContext.update({ only: true }, { context: { ignored: true }, overwrite: true })
  deepStrictEqual(sharedContext.get(), { only: true })
  deepStrictEqual(app.getSharedContext(), { only: true })

  {
    const res = await request(app.getUrl() + '/shared-context')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { only: true })
  }

  // get() returns an isolated deep snapshot, so nested mutations do not
  // silently change the main-thread context without a worker broadcast.
  await sharedContext.update({ nested: { value: 1 } }, { overwrite: true })
  const snapshot = sharedContext.get()
  snapshot.nested.value = 2
  deepStrictEqual(sharedContext.get(), { nested: { value: 1 } })
  deepStrictEqual(app.getSharedContext(), { nested: { value: 1 } })

  {
    const res = await request(app.getUrl() + '/shared-context')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { nested: { value: 1 } })
  }

  // Concurrent updates are applied in invocation order and reach workers.
  await sharedContext.update({ order: 0 }, { overwrite: true })
  await Promise.all([
    sharedContext.update({ order: 1, first: true }),
    sharedContext.update({ order: 2, second: true })
  ])
  deepStrictEqual(sharedContext.get(), { order: 2, first: true, second: true })

  // Newly started (restarted) workers observe the latest snapshot
  await app.restartApplication('a')

  {
    const res = await request(app.getUrl() + '/shared-context')
    strictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { order: 2, first: true, second: true })
  }

  // After stop, get/update still work on the main-thread snapshot
  await app.stop()
  deepStrictEqual(sharedContext.get(), { order: 2, first: true, second: true })
  await sharedContext.update({ afterStop: true })
  deepStrictEqual(sharedContext.get(), { order: 2, first: true, second: true, afterStop: true })
  deepStrictEqual(app.getSharedContext(), { order: 2, first: true, second: true, afterStop: true })

  // The facade retains the main-thread snapshot after close; with no workers,
  // updates remain local and do not attempt an ITC broadcast.
  await app.close()
  await sharedContext.update({ afterClose: true })
  deepStrictEqual(sharedContext.get(), { order: 2, first: true, second: true, afterStop: true, afterClose: true })
})

test('extensions cannot register reserved ITC commands', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-reserved.json')
  const app = await createRuntime(configFile)

  t.after(() => {
    return app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
      strictEqual(err.cause.code, 'PLT_RUNTIME_RESERVED_ITC_HANDLER_NAME')
      ok(err.message.includes('reserved'))
      return true
    }
  )
})

test('extensions cannot register the same ITC command twice', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-duplicate.json')
  const app = await createRuntime(configFile)

  t.after(() => {
    return app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
      strictEqual(err.cause.code, 'PLT_RUNTIME_DUPLICATE_ITC_HANDLER_NAME')
      return true
    }
  )
})

test('a missing extension file fails the startup', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-missing.json')
  const app = await createRuntime(configFile)

  t.after(() => {
    return app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
      return true
    }
  )
})

test('an extension without a default exported function fails the startup', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-invalid.json')
  const app = await createRuntime(configFile)

  t.after(() => {
    return app.close()
  })

  await rejects(
    () => app.init(),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_INVALID_EXTENSION')
      return true
    }
  )
})
