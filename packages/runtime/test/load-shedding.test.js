import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
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
