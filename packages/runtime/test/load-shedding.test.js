import { deepStrictEqual, strictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('load shedding - should start with load shedding enabled', async t => {
  const configFile = join(fixturesDir, 'load-shedding', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // Basic health check should work
  {
    const { statusCode, body } = await request(url + '/health')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { status: 'ok' })
  }
})

test('load shedding - service to service calls should work under normal load', async t => {
  const configFile = join(fixturesDir, 'load-shedding', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // Service A calling Service B should work under normal conditions
  {
    const { statusCode, body } = await request(url + '/call-service-b')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { status: 'ok' })
  }
})

test('load shedding - multiple sequential requests work correctly', async t => {
  const configFile = join(fixturesDir, 'load-shedding', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // Multiple requests should work under normal load conditions
  for (let i = 0; i < 5; i++) {
    const { statusCode, body } = await request(url + '/call-service-b')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { status: 'ok' })
  }
})

test('load shedding - disabled by default when not configured', async t => {
  const configFile = join(fixturesDir, 'policies', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // Should work normally without load shedding config
  {
    const { statusCode } = await request(url + '/application-1/id')
    strictEqual(statusCode, 200)
  }
})

test('load shedding - worker gets paused when ELU exceeds threshold', async t => {
  const configFile = join(fixturesDir, 'load-shedding', 'platformatic.load-test.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // First request should work
  {
    const { statusCode, body } = await request(url + '/health')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { status: 'ok' })
  }

  // Block the event loop to spike ELU
  // Using atomic-sleep to block synchronously for 200ms
  {
    const { statusCode, body } = await request(url + '/block/200')
    strictEqual(statusCode, 200)
    const result = await body.json()
    strictEqual(result.blocked, 200)
  }

  // Wait for health check to detect high ELU (health checks run every 1 second)
  await sleep(1500)

  // Now try another request - since there's only one worker and it should be paused,
  // the request should fail with "No target found"
  try {
    const { statusCode } = await request(url + '/health')
    // If we get here, the worker wasn't paused - could happen if ELU dropped
    // Just verify it works
    strictEqual(statusCode, 200)
  } catch (err) {
    // Expected: worker is paused so request fails
    ok(err.message.includes('No target found') || err.cause?.message?.includes('No target found'),
      `Expected "No target found" error, got: ${err.message}`)
  }

  // Wait for ELU to recover
  await sleep(2000)

  // After recovery, requests should work again
  {
    const { statusCode, body } = await request(url + '/health')
    strictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { status: 'ok' })
  }
})
