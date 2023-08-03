'use strict'

const { test } = require('tap')
const { PlatformaticTracerProvider } = require('../lib/platformatic-trace-provider')

test('should propagate forceFlush to all registered processors ', async ({ equal, same, teardown }) => {
  let called1 = false
  let called2 = false
  const mockSpanProcessor1 = {
    forceFlush: async () => { called1 = true }
  }
  const mockSpanProcessor2 = {
    forceFlush: async () => { called2 = true }
  }
  const provider = new PlatformaticTracerProvider()
  equal(provider._registeredSpanProcessors.length, 0)

  provider.addSpanProcessor(mockSpanProcessor1)
  provider.addSpanProcessor(mockSpanProcessor2)

  equal(provider._registeredSpanProcessors.length, 2)
  await provider.forceFlush()
  equal(called1, true)
  equal(called2, true)
})

test('should propagate shutdown to the active span processor, which should propagate to all the processors ', async ({ equal, same, teardown }) => {
  let called1 = false
  let called2 = false
  const mockSpanProcessor1 = {
    shutdown: async () => { called1 = true }
  }
  const mockSpanProcessor2 = {
    shutdown: async () => { called2 = true }
  }
  const provider = new PlatformaticTracerProvider()
  equal(provider._registeredSpanProcessors.length, 0)

  provider.addSpanProcessor(mockSpanProcessor1)
  provider.addSpanProcessor(mockSpanProcessor2)

  equal(provider._registeredSpanProcessors.length, 2)
  await provider.shutdown()
  equal(called1, true)
  equal(called2, true)
})
