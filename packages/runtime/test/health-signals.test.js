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

  const receivedSignals = []
  app.on('application:worker:health-signals', (signals) => {
    receivedSignals.push(...signals)
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

  assert.strictEqual(receivedSignals.length, 1)

  const signal = receivedSignals[0]
  assert.strictEqual(signal.application, 'service-1')
  assert.strictEqual(signal.workerId, 'service-1:0')
  assert.strictEqual(signal.type, 'custom')
  assert.strictEqual(signal.value, 0.42)
  assert.strictEqual(signal.description, 'custom health signal')
  assert.strictEqual(typeof signal.timestamp, 'number')
})

test('should send a batch of custom health signal', async t => {
  const configFile = join(fixturesDir, 'health-signals', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  const receivedBatches = []
  app.on('application:worker:health-signals', (signals) => {
    receivedBatches.push(signals)
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

  await sleep(1000)

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
            value: 0.43,
            description: 'custom health signal'
          })
        })
      )
    }
    await Promise.all(promises)
  }

  assert.strictEqual(receivedBatches.length, 2)

  const batch1 = receivedBatches[0]
  const batch2 = receivedBatches[1]

  assert.strictEqual(batch1.length, 10)
  assert.strictEqual(batch2.length, 10)

  for (let i = 0; i < 10; i++) {
    const signal = batch1.find(s => s.type === `custom-${i}`)
    assert.strictEqual(signal.type, `custom-${i}`)
    assert.strictEqual(signal.value, 0.42)
    assert.strictEqual(signal.description, 'custom health signal')
    assert.strictEqual(typeof signal.timestamp, 'number')
  }

  for (let i = 0; i < 10; i++) {
    const signal = batch2.find(s => s.type === `custom-${i}`)
    assert.strictEqual(signal.type, `custom-${i}`)
    assert.strictEqual(signal.value, 0.43)
    assert.strictEqual(signal.description, 'custom health signal')
    assert.strictEqual(typeof signal.timestamp, 'number')
  }
})

test('should send elu health signal', async t => {
  const configFile = join(fixturesDir, 'health-signals', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  const receivedSignals = []
  app.on('application:worker:health-signals', (signals) => {
    receivedSignals.push(...signals)
  })

  t.after(() => app.close())

  const { statusCode, body } = await request(entryUrl + '/service-2/cpu-intensive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ timeout: 1000 })
  })
  const error = await body.text()
  assert.strictEqual(statusCode, 200, error)

  assert.strictEqual(receivedSignals.length, 1)

  const signal = receivedSignals[0]
  assert.strictEqual(signal.application, 'service-2')
  assert.strictEqual(signal.workerId, 'service-2:0')
  assert.strictEqual(signal.type, 'elu')
  assert.ok(signal.value > 0.9)
  assert.strictEqual(typeof signal.timestamp, 'number')
})

test('should throw if signal type is not a string', async t => {
  const configFile = join(fixturesDir, 'health-signals', 'platformatic.json')
  const app = await createRuntime(configFile)
  const entryUrl = await app.start()

  const receivedSignals = []
  app.on('application:worker:health-signals', (signals) => {
    receivedSignals.push(...signals)
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
