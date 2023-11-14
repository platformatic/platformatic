'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { MultiSpanProcessor } = require('../lib/multispan-processor')

test('should add multiple processors', async () => {
  const mockSpanProcessor = {
    onStart: () => {},
    onEnd: () => {},
    shutdown: async () => {},
    forceFlush: async () => {}
  }
  const processor = new MultiSpanProcessor()
  equal(processor._spanProcessors.length, 0)

  {
    const processor = new MultiSpanProcessor([mockSpanProcessor, mockSpanProcessor])
    equal(processor._spanProcessors.length, 2)
  }
})

test('should call onStart on every processor', async () => {
  let called1 = false
  let called2 = false
  const mockSpanProcessor1 = {
    onStart: () => { called1 = true }
  }
  const mockSpanProcessor2 = {
    called: false,
    onStart: () => { called2 = true }
  }
  const processor = new MultiSpanProcessor([mockSpanProcessor1, mockSpanProcessor2])
  processor.onStart()
  equal(called1, true)
  equal(called2, true)
})

test('should call onEnd on every processor', async () => {
  let called1 = false
  let called2 = false
  const mockSpanProcessor1 = {
    onEnd: () => { called1 = true }
  }
  const mockSpanProcessor2 = {
    onEnd: () => { called2 = true }
  }
  const processor = new MultiSpanProcessor([mockSpanProcessor1, mockSpanProcessor2])
  processor.onEnd()
  equal(called1, true)
  equal(called2, true)
})

test('should call shutdown on every processor', async () => {
  let called1 = false
  let called2 = false
  const mockSpanProcessor1 = {
    shutdown: async () => { called1 = true }
  }
  const mockSpanProcessor2 = {
    shutdown: async () => { called2 = true }
  }
  const processor = new MultiSpanProcessor([mockSpanProcessor1, mockSpanProcessor2])
  await processor.shutdown()
  equal(called1, true)
  equal(called2, true)
})

test('should call forceFlush on every processor', async () => {
  let called1 = false
  let called2 = false
  const mockSpanProcessor1 = {
    forceFlush: async () => { called1 = true }
  }
  const mockSpanProcessor2 = {
    forceFlush: async () => { called2 = true }
  }
  const processor = new MultiSpanProcessor([mockSpanProcessor1, mockSpanProcessor2])
  await processor.forceFlush()
  equal(called1, true)
  equal(called2, true)
})
