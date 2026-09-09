import { safeRemove } from '@platformatic/foundation'
import { ok, strictEqual } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { enableCompileCache } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

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

// The CLI enables the compile cache for the runtime process, which Node.js would only write to disk
// when the process exits. This test emulates the CLI by enabling the cache in the test process.
test('compileCache - the compile cache of the runtime process is flushed when the runtime starts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'plt-compile-cache-'))
  const cacheDir = join(root, 'compile-cache')

  t.after(() => {
    return safeRemove(root)
  })

  strictEqual(enableCompileCache(cacheDir).directory, cacheDir)

  // Load a module which has never been loaded before, so that the cache has something to store.
  const modulePath = join(root, 'module.mjs')
  await writeFile(modulePath, 'export function sum (a, b) {\n  return a + b\n}\n', 'utf-8')
  await import(pathToFileURL(modulePath))

  strictEqual(countCacheEntries(cacheDir), 0, 'The compile cache has not been written to disk yet')

  process.env.PORT = 0
  const app = await createRuntime(join(fixturesDir, 'compile-cache', 'platformatic.runtime.json'))
  await app.start()

  t.after(() => {
    return app.close()
  })

  ok(await waitForCacheEntries(cacheDir), 'Compile cache has been flushed while the runtime is running')
})
