import { ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, createTemporaryDirectory, updateConfigFile } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

for (const command of [false, true]) {
  for (const customDirectory of [false, true]) {
    test(`compileCache - cache writes do not reload (command: ${command}, custom: ${customDirectory})`, async t => {
      const root = await createTemporaryDirectory(t, 'compile-cache-watch')
      await cp(join(fixturesDir, 'compile-cache-command'), root, {
        recursive: true,
        filter: source => !source.split(/[\\/]/).includes('.plt')
      })
      const platformaticModules = join(root, 'node_modules', '@platformatic')
      await mkdir(platformaticModules, { recursive: true })
      await symlink(join(import.meta.dirname, '../../node'), join(platformaticModules, 'node'), 'dir')
      const applicationDir = join(root, 'services', 'main')
      const cacheDir = join(applicationDir, customDirectory ? 'cache[1]' : '.plt/compile-cache')
      const configFile = join(root, 'watt.config.js')
      await updateConfigFile(configFile, config => {
        config.watch = true
        // Exercise the default-enabled path without the optional startup barrier.
        delete config.compileCache
        if (customDirectory) {
          config.compileCache = { enabled: true, directory: cacheDir }
        }
      })
      if (!command) {
        await updateConfigFile(join(applicationDir, 'watt.config.mjs'), config => {
          delete config.application.commands
        })
      }

      const app = await createRuntime(configFile)
      t.after(() => app.close())
      let restarts = 0
      app.on('application:worker:changed', () => { restarts++ })
      const flushed = once(app, 'application:worker:compile-cache:flushed', { signal: AbortSignal.timeout(10000) })
      await Promise.all([app.start(), flushed])
      ok(await waitForCacheEntries(cacheDir), 'Startup flushed the cache to disk')

      // A late cache write must not reload the application either.
      await writeFile(join(cacheDir, 'cache-write'), 'cache')
      await sleep(1000)
      strictEqual(restarts, 0)
      const response = await app.inject('main', '/')
      strictEqual(response.statusCode, 200)
      strictEqual(JSON.parse(response.body).hello, 'world')

      const sourceFile = join(applicationDir, 'index.mjs')
      const restarted = once(app, 'application:worker:reloaded', { signal: AbortSignal.timeout(15000) })
      const source = await readFile(sourceFile, 'utf8')
      await writeFile(sourceFile, source.replace("hello: 'world'", "hello: 'updated'"))
      await restarted
      strictEqual(restarts, 1)
      const updated = await app.inject('main', '/')
      strictEqual(updated.statusCode, 200)
      strictEqual(JSON.parse(updated.body).hello, 'updated')
    })
  }
}

// Check if compile cache API is available (Node.js 22.1.0+)
async function isCompileCacheAvailable () {
  try {
    const mod = await import('node:module')
    return typeof mod.enableCompileCache === 'function'
  } catch {
    return false
  }
}

function countCacheEntries (cacheDir) {
  if (!existsSync(cacheDir)) {
    return 0
  }

  return readdirSync(cacheDir).flatMap(subdirectory => readdirSync(join(cacheDir, subdirectory))).length
}

async function waitForCacheEntries (cacheDir, timeout = 10000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const entries = countCacheEntries(cacheDir)
    if (entries > 0) {
      return entries
    }

    await sleep(100)
  }

  return 0
}

test('compileCache - runtime starts with compile cache enabled', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'compile-cache', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  const { 'a:0': url } = await app.start()

  t.after(() => {
    return app.close()
  })

  // Verify the runtime works correctly
  const res = await request(url + '/hello')
  strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  strictEqual(body.hello, 'world')
})

test('compileCache - waits for the worker flush before completing startup', async t => {
  const compileCacheAvailable = await isCompileCacheAvailable()

  if (!compileCacheAvailable) {
    t.skip('Compile cache API not available on this Node.js version')
    return
  }

  process.env.PORT = 0
  const configFile = join(fixturesDir, 'compile-cache', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)
  let flushSeen = false
  app.once('application:worker:compile-cache:flushed', () => {
    flushSeen = true
  })

  t.after(() => {
    return app.close()
  })

  await app.start()
  strictEqual(flushSeen, true)
})

test('compileCache - preserves runtime awaitFirstWorker with an application override', async t => {
  const compileCacheAvailable = await isCompileCacheAvailable()

  if (!compileCacheAvailable) {
    t.skip('Compile cache API not available on this Node.js version')
    return
  }

  process.env.PORT = 0
  const configFile = join(fixturesDir, 'compile-cache-app-override', 'watt.config.js')
  const app = await createRuntime(configFile)
  let flushSeen = false
  app.once('application:worker:compile-cache:flushed', () => {
    flushSeen = true
  })

  t.after(() => {
    return app.close()
  })

  await app.start()
  strictEqual(flushSeen, true)
})

test('compileCache - does not block startup when Node disables the cache', async t => {
  const previousValue = process.env.NODE_DISABLE_COMPILE_CACHE
  process.env.NODE_DISABLE_COMPILE_CACHE = '1'

  t.after(() => {
    if (previousValue === undefined) {
      delete process.env.NODE_DISABLE_COMPILE_CACHE
    } else {
      process.env.NODE_DISABLE_COMPILE_CACHE = previousValue
    }
  })

  process.env.PORT = 0
  const configFile = join(fixturesDir, 'compile-cache', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  t.after(() => {
    return app.close()
  })

  await app.start()
})

test('compileCache - the cache is flushed to disk once the application has started', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'compile-cache', 'platformatic.runtime.json')
  const applicationDir = join(fixturesDir, 'compile-cache', 'services', 'a')
  const cacheDir = join(applicationDir, '.plt', 'compile-cache')

  rmSync(cacheDir, { recursive: true, force: true })

  const app = await createRuntime(configFile)
  const { 'a:0': url } = await app.start()

  t.after(() => {
    return app.close()
  })

  const res = await request(url + '/hello')
  strictEqual(res.statusCode, 200)
  await res.body.dump()

  ok(await waitForCacheEntries(cacheDir), 'Compile cache has been flushed while the application is running')
})

test('compileCache - the cache of an application running as a command is flushed to disk', async t => {
  const configFile = join(fixturesDir, 'compile-cache-command', 'platformatic.json')
  const applicationDir = join(fixturesDir, 'compile-cache-command', 'services', 'main')
  const cacheDir = join(applicationDir, '.plt', 'compile-cache')

  rmSync(cacheDir, { recursive: true, force: true })

  const app = await createRuntime(configFile)
  let flushSource
  app.on('application:worker:compile-cache:flushed', event => {
    if (event.source === 'child-process') {
      flushSource = event.source
    }
  })
  const { 'main:0': url } = await app.start()

  t.after(() => {
    return app.close()
  })

  const res = await request(url + '/')
  strictEqual(res.statusCode, 200)
  await res.body.dump()

  ok(await waitForCacheEntries(cacheDir), 'Compile cache has been flushed while the application is running')
  strictEqual(flushSource, 'child-process')

  await app.stopApplication('main')

  let restartedFlushSource
  app.on('application:worker:compile-cache:flushed', event => {
    if (event.source === 'child-process') {
      restartedFlushSource = event.source
    }
  })
  await app.startApplication('main')
  strictEqual(restartedFlushSource, 'child-process')
})
