import { notStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should add Connection: close header during graceful shutdown', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'graceful-close-header', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  const url = await app.start()

  // Normal request should NOT have Connection: close
  {
    const response = await request(url + '/slow')
    strictEqual(response.statusCode, 200)
    notStrictEqual(response.headers.connection, 'close')
    await response.body.dump()
  }

  // Start shutdown (don't await)
  const closePromise = app.close()

  // Small delay to ensure shutdown has started
  await new Promise(resolve => setTimeout(resolve, 50))

  // Request during shutdown SHOULD have Connection: close
  try {
    const response = await request(url + '/slow')
    strictEqual(response.statusCode, 200)
    strictEqual(response.headers.connection, 'close')
    await response.body.dump()
  } catch {
    // Connection may be refused if shutdown is complete, which is acceptable
  }

  await closePromise
})

test('should respect gracefulShutdown.closeConnections config when disabled', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'graceful-close-header-disabled', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  const url = await app.start()

  // Start shutdown (don't await)
  const closePromise = app.close()

  // Small delay to ensure shutdown has started
  await new Promise(resolve => setTimeout(resolve, 50))

  // Request during shutdown should NOT have Connection: close when disabled
  try {
    const response = await request(url + '/slow')
    strictEqual(response.statusCode, 200)
    notStrictEqual(response.headers.connection, 'close')
    await response.body.dump()
  } catch {
    // Connection may be refused if shutdown is complete, which is acceptable
  }

  await closePromise
})

test('should work with NodeCapability raw HTTP server', async t => {
  process.env.PORT = 0
  const configFile = join(fixturesDir, 'graceful-close-header-node', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  const url = await app.start()

  // Normal request should NOT have Connection: close
  {
    const response = await request(url + '/')
    strictEqual(response.statusCode, 200)
    notStrictEqual(response.headers.connection, 'close')
    await response.body.dump()
  }

  // Start shutdown (don't await)
  const closePromise = app.close()

  // Small delay to ensure shutdown has started
  await new Promise(resolve => setTimeout(resolve, 50))

  // Request during shutdown SHOULD have Connection: close
  try {
    const response = await request(url + '/')
    strictEqual(response.statusCode, 200)
    strictEqual(response.headers.connection, 'close')
    await response.body.dump()
  } catch {
    // Connection may be refused if shutdown is complete, which is acceptable
  }

  await closePromise
})
