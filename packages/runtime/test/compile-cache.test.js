import { ok, strictEqual } from 'node:assert'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

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
  const configFile = join(fixturesDir, 'compile-cache', 'watt.config.js')
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

test('compileCache - the cache is flushed to disk once the application has started', async t => {
  const compileCacheAvailable = await isCompileCacheAvailable()

  if (!compileCacheAvailable) {
    t.skip('Compile cache API not available on this Node.js version')
    return
  }

  process.env.PORT = 0
  const configFile = join(fixturesDir, 'compile-cache', 'watt.config.js')
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
  const compileCacheAvailable = await isCompileCacheAvailable()

  if (!compileCacheAvailable) {
    t.skip('Compile cache API not available on this Node.js version')
    return
  }

  const configFile = join(fixturesDir, 'compile-cache-command', 'watt.config.js')
  const applicationDir = join(fixturesDir, 'compile-cache-command', 'services', 'main')
  const cacheDir = join(applicationDir, '.plt', 'compile-cache')

  rmSync(cacheDir, { recursive: true, force: true })

  const app = await createRuntime(configFile)
  const { 'main:0': url } = await app.start()

  t.after(() => {
    return app.close()
  })

  const res = await request(url + '/')
  strictEqual(res.statusCode, 200)
  await res.body.dump()

  ok(await waitForCacheEntries(cacheDir), 'Compile cache has been flushed while the application is running')
})
