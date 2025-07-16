'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should update shared context via runtime API', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  const url = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Check the initial state of the shared context
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, {})
  }
  {
    const { statusCode, body } = await request(url + '/service-app/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, {})
  }

  const contextUpdate1 = { foo: 'bar' }
  await app.updateSharedContext({ context: contextUpdate1 })

  // Check that the shared context with a first update
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, contextUpdate1)
  }
  {
    const { statusCode, body } = await request(url + '/service-app/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, contextUpdate1)
  }

  const contextUpdate2 = { bar: 'baz' }
  await app.updateSharedContext({ context: contextUpdate2 })

  // Check that the shared context with a second update
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, { ...contextUpdate1, ...contextUpdate2 })
  }
  {
    const { statusCode, body } = await request(url + '/service-app/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, { ...contextUpdate1, ...contextUpdate2 })
  }

  const contextUpdate3 = { baz: 'qux' }
  await app.updateSharedContext({ context: contextUpdate3, overwrite: true })

  // Check that the shared after an overwrite
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, contextUpdate3)
  }
  {
    const { statusCode, body } = await request(url + '/service-app/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, contextUpdate3)
  }
})

test('should update shared context from one of the services', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  const url = await app.start()

  t.after(async () => {
    await app.close()
  })

  // Check the initial state of the shared context
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, {})
  }
  {
    const { statusCode, body } = await request(url + '/service-app/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, {})
  }

  // Update the shared context
  const contextUpdate1 = { foo: 'bar' }
  {
    const { statusCode } = await request(url + '/service-app/shared-context', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context: contextUpdate1 })
    })
    assert.strictEqual(statusCode, 200)
  }

  // Check that the shared context with a first update
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, contextUpdate1)
  }
  {
    const { statusCode, body } = await request(url + '/with-logger/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, contextUpdate1)
  }

  // Update shared context
  const contextUpdate2 = { bar: 'baz' }
  {
    const { statusCode } = await request(url + '/with-logger/shared-context', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context: contextUpdate2 }),
    })
    assert.strictEqual(statusCode, 200)
  }

  // Check that the shared context with a second update
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, { ...contextUpdate1, ...contextUpdate2 })
  }
  {
    const { statusCode, body } = await request(url + '/service-app/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, { ...contextUpdate1, ...contextUpdate2 })
  }

  // Overwrite shared context
  const contextUpdate3 = { baz: 'qux' }
  {
    const { statusCode } = await request(url + '/service-app/shared-context', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context: contextUpdate3, overwrite: true }),
    })
    assert.strictEqual(statusCode, 200)
  }

  // Check that the shared after an overwrite
  {
    const sharedContext = await app.getSharedContext()
    assert.deepStrictEqual(sharedContext, contextUpdate3)
  }
  {
    const { statusCode, body } = await request(url + '/with-logger/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()
    assert.deepStrictEqual(sharedContext, contextUpdate3)
  }
})
