'use strict'

const { test } = require('node:test')
const { equal, deepEqual, rejects } = require('node:assert')
const { getInstrumentations } = require('../lib/pluggable-instrumentations')

test('should load an instrumenter with just the package name and the constructor exported as default', async () => {
  const instrumenterConfig = '../test/instrumentations/instrumentation-with-default.mjs'
  const instrumenter = await getInstrumentations([instrumenterConfig])
  equal(instrumenter[0].constructor.name, 'TestInstrumentation')
})

test('should load an instrumenter with just the package name and the constructor specified', async () => {
  const instrumenterConfig = {
    package: '../test/instrumentations/instrumentation-with-named-export.mjs',
    exportName: 'Test2Instrumentation',
  }
  const instrumenters = await getInstrumentations([instrumenterConfig])
  equal(instrumenters[0].constructor.name, 'Test2Instrumentation')
})

test('should create the instrumentator passing the options', async () => {
  const instrumenterConfig = {
    package: '../test/instrumentations/instrumentation-with-default.mjs',
    options: { foo: 'bar' },
  }
  const instrumenters = await getInstrumentations([instrumenterConfig])
  equal(instrumenters[0].constructor.name, 'TestInstrumentation')
  deepEqual(instrumenters[0].config, { foo: 'bar' })
})

test('should throw if the package is missing', async () => {
  const instrumenterConfig = 'xxxyyyzzz'
  rejects(getInstrumentations([instrumenterConfig]), { message: 'Instrumentation package not found: xxxyyyzzz, please add it to your dependencies.' })
})

test('should throw if one of the packages is missing', async () => {
  const configs = [
    {
      package: '../test/instrumentations/instrumentation-with-default.mjs',
      options: { foo: 'bar' }
    },
    {
      package: 'xxxyyyzzz',
    }
  ]
  rejects(getInstrumentations(configs), { message: 'Instrumentation package not found: xxxyyyzzz, please add it to your dependencies.' })
})

test('should use the `*Instrumenter` constructor automatically', async () => {
  const instrumenterConfig = '../test/instrumentations/instrumentation-with-named-export.mjs'
  const instrumenters = await getInstrumentations([instrumenterConfig])
  equal(instrumenters[0].constructor.name, 'Test2Instrumentation')
})

test('should throw with multiple `*Instrumenter`', async () => {
  const instrumenterConfig = '../test/instrumentations/instrumentation-with-multiple-named-exports.mjs'
  rejects(getInstrumentations([instrumenterConfig]), { message: 'Multiple Instrumentation exports found: Test2Instrumentation,TestInstrumentation in ../test/instrumentations/instrumentation-with-multiple-named-exports.mjs. Please specify in config' })
})

test('should throw with no `*Instrumenter`', async () => {
  const instrumenterConfig = '../test/instrumentations/instrumentation-with-no-instrumentations-constructs.mjs'
  rejects(getInstrumentations([instrumenterConfig]), { message: 'Instrumentation export not found: default in ../test/instrumentations/instrumentation-with-no-instrumentations-constructs.mjs. Please specify in config' })
})

test('should throw with one of the default instrumentations', async () => {
  const instrumenterConfig = '@opentelemetry/instrumentation-http'
  rejects(getInstrumentations([instrumenterConfig]), { message: 'Instrumentation package @opentelemetry/instrumentation-http is already included by default, please remove it from your config.' })
})
