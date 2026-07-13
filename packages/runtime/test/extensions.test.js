import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

function cleanExtensionGlobals () {
  globalThis.__pltExtensionEvents = []
  globalThis.__pltExtensionItc = undefined
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

test('extensions are closed in reverse order when the runtime is closed', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  await app.start()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'first' },
    { event: 'setup', extension: 'second' }
  ])

  await app.close()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'first' },
    { event: 'setup', extension: 'second' },
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

  const profile = await app.getApplicationLastProfile(event.id, { type: event.type })
  ok(profile instanceof Uint8Array || Buffer.isBuffer(profile))
  ok(profile.length > 0)

  // Profiling must be re-enabled on the replacement worker after a restart.
  // Truncate the array in place since the extension captured its reference.
  await app.restartApplication('a')
  globalThis.__pltExtensionProfileEvents.length = 0

  const eventAfterRestart = await waitForCapturedProfiles()
  strictEqual(eventAfterRestart.application, 'a')

  await app.stopApplicationProfiling(eventAfterRestart.id, { type: 'cpu' })
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
