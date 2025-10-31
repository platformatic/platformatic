import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should send a custom health signal', async t => {
  const configFile = join(fixturesDir, 'health-signals', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  const healthChecks = []
  app.on('application:worker:health:metrics', (health) => {
    healthChecks.push(health)
  })

  t.after(() => app.close())

  const { statusCode } = await request(entryUrl + '/custom-health-signal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'custom',
      value: 0.42,
      description: 'custom health signal'
    })
  })
  assert.strictEqual(statusCode, 200)

  await sleep(2000)

  const healthChecksWithSignals = healthChecks.filter(
    c => c.healthSignals.length > 0
  )
  assert.strictEqual(healthChecksWithSignals.length, 1)

  const healthCheck = healthChecksWithSignals[0]
  assert.strictEqual(healthCheck.id, 'service-1:0')
  assert.strictEqual(healthCheck.application, 'service-1')
  assert.strictEqual(healthCheck.healthSignals.length, 1)

  const signal = healthCheck.healthSignals[0]
  assert.strictEqual(signal.type, 'custom')
  assert.strictEqual(signal.value, 0.42)
  assert.strictEqual(signal.description, 'custom health signal')
  assert.strictEqual(typeof signal.timestamp, 'number')
})

test('should send a batch of custom health signal', async t => {
  const configFile = join(fixturesDir, 'health-signals', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  const healthSignals = []
  app.on('application:worker:health:metrics', (health) => {
    healthSignals.push(...health.healthSignals)
  })

  t.after(() => app.close())

  {
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        request(entryUrl + '/custom-health-signal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: `custom-${i}`,
            value: 0.42,
            description: 'custom health signal'
          })
        })
      )
    }
    await Promise.all(promises)
  }

  await sleep(2000)

  {
    const promises = []
    for (let i = 10; i < 20; i++) {
      promises.push(
        request(entryUrl + '/custom-health-signal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: `custom-${i}`,
            value: 0.42,
            description: 'custom health signal'
          })
        })
      )
    }
    await Promise.all(promises)
  }

  await sleep(2000)

  assert.strictEqual(healthSignals.length, 20)

  for (let i = 0; i < 20; i++) {
    const signal = healthSignals.find(s => s.type === `custom-${i}`)
    assert.strictEqual(signal.type, `custom-${i}`)
    assert.strictEqual(signal.value, 0.42)
    assert.strictEqual(signal.description, 'custom health signal')
    assert.strictEqual(typeof signal.timestamp, 'number')
  }
})

test('should throw if signal type is not a string', async t => {
  const configFile = join(fixturesDir, 'health-signals', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  const receivedSignals = []
  app.on('application:worker:health:metrics', (health) => {
    receivedSignals.push(...health.healthSignals)
  })

  t.after(() => app.close())

  {
    const { statusCode, body } = await request(entryUrl + '/custom-health-signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: 0.42,
        description: 'custom health signal'
      })
    })
    assert.strictEqual(statusCode, 500)

    const error = await body.json()
    assert.deepStrictEqual(error, {
      statusCode: 500,
      code: 'PLT_RUNTIME_HEALTH_SIGNAL_TYPE_MUST_BE_STRING',
      error: 'Internal Server Error',
      message: 'Health signal type must be a string, received "undefined"'
    })
  }

  {
    const { statusCode, body } = await request(entryUrl + '/custom-health-signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 42,
        value: 0.42,
        description: 'custom health signal'
      })
    })
    assert.strictEqual(statusCode, 500)

    const error = await body.json()
    assert.deepStrictEqual(error, {
      statusCode: 500,
      code: 'PLT_RUNTIME_HEALTH_SIGNAL_TYPE_MUST_BE_STRING',
      error: 'Internal Server Error',
      message: 'Health signal type must be a string, received "42"'
    })
  }
})
