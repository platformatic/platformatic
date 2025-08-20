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

  const basePayload = { application: 'serviceThrowsOnStart', worker: 0, workersCount: 1 }
  const errorPayload = {
    application: 'serviceThrowsOnStart',
    worker: 0,
    workersCount: 1,
    error: 'boom'
  }

  assert.deepStrictEqual(events, [
    { event: 'starting', payload: undefined },
    { event: 'application:starting', payload: 'serviceThrowsOnStart' },
    { event: 'application:worker:starting', payload: basePayload },
    { event: 'application:worker:start:error', payload: errorPayload },
    { event: 'application:worker:init', payload: basePayload },
    { event: 'application:worker:starting', payload: basePayload },
    { event: 'application:worker:start:error', payload: errorPayload },
    { event: 'application:worker:init', payload: basePayload },
    { event: 'application:worker:starting', payload: basePayload },
    { event: 'application:worker:start:error', payload: errorPayload },
    { event: 'application:worker:init', payload: basePayload },
    { event: 'application:worker:starting', payload: basePayload },
    { event: 'application:worker:start:error', payload: errorPayload },
    { event: 'application:worker:init', payload: basePayload },
    { event: 'application:worker:starting', payload: basePayload },
    { event: 'application:worker:start:error', payload: errorPayload },
    { event: 'application:worker:init', payload: basePayload },
    { event: 'application:worker:starting', payload: basePayload },
    { event: 'application:worker:start:error', payload: errorPayload },
    { event: 'errored', message: 'boom' },
    { event: 'stopping', payload: undefined },
    { event: 'application:stopping', payload: 'serviceThrowsOnStart' },
    { event: 'application:stopped', payload: 'serviceThrowsOnStart' },
    { event: 'stopped', payload: undefined },
    { event: 'closing', payload: undefined },
    { event: 'closed', payload: undefined }
  ])
})
