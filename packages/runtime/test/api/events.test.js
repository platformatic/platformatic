'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('emits an exhaustive list of events', async t => {
  const configFile = join(fixturesDir, 'configs', 'service-events.json')
  const app = await createRuntime(configFile)
  await app.init()

  // Patch the runtime event method to being able to intercept ALL events
  const events = []
  const originalEmit = app.emit
  app.emit = function (event, payload) {
    originalEmit.call(app, event, payload)
    events.push({ event, payload })
  }

  t.after(async () => {
    await app.close()
  })

  await assert.rejects(async () => {
    await app.start()
  }, /boom/)

  // Normalize errors
  for (const event of events) {
    if (event.event === 'errored') {
      event.message = event.payload.message
      delete event.payload
    }

    if (event.payload?.error) {
      event.payload.error = event.payload.error.message
    }
  }

  const basePayload = { service: 'serviceThrowsOnStart', worker: 0, workersCount: 1 }
  const errorPayload = {
    service: 'serviceThrowsOnStart',
    worker: 0,
    workersCount: 1,
    error: 'boom'
  }

  assert.deepStrictEqual(events, [
    { event: 'starting', payload: undefined },
    { event: 'service:starting', payload: 'serviceThrowsOnStart' },
    { event: 'service:worker:starting', payload: basePayload },
    { event: 'service:worker:start:error', payload: errorPayload },
    { event: 'service:worker:init', payload: basePayload },
    { event: 'service:worker:starting', payload: basePayload },
    { event: 'service:worker:start:error', payload: errorPayload },
    { event: 'service:worker:init', payload: basePayload },
    { event: 'service:worker:starting', payload: basePayload },
    { event: 'service:worker:start:error', payload: errorPayload },
    { event: 'service:worker:init', payload: basePayload },
    { event: 'service:worker:starting', payload: basePayload },
    { event: 'service:worker:start:error', payload: errorPayload },
    { event: 'service:worker:init', payload: basePayload },
    { event: 'service:worker:starting', payload: basePayload },
    { event: 'service:worker:start:error', payload: errorPayload },
    { event: 'service:worker:init', payload: basePayload },
    { event: 'service:worker:starting', payload: basePayload },
    { event: 'service:worker:start:error', payload: errorPayload },
    { event: 'errored', message: 'boom' },
    { event: 'closing', payload: undefined },
    { event: 'stopping', payload: undefined },
    { event: 'service:stopping', payload: 'serviceThrowsOnStart' },
    { event: 'service:stopped', payload: 'serviceThrowsOnStart' },
    { event: 'stopped', payload: undefined },
    { event: 'closed', payload: undefined }
  ])
})
