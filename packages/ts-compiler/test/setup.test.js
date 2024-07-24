'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const pino = require('pino')
const pinoTest = require('pino-test')
const setup = require('../lib/setup.js')

test('throw if cwd is not specified', async () => {
  await assert.rejects(setup({}), {
    name: 'Error',
    message: 'The cwd option is required.'
  })
})

test('reuse a logger', async () => {
  const stream = pinoTest.sink()
  const logger = pino(stream)

  const res = await setup({ cwd: __dirname, logger })
  assert.strictEqual(res.logger, logger)
})

test('creates a logger', async () => {
  const res = await setup({ cwd: __dirname })
  assert.strictEqual(typeof res.logger.info, 'function')
  assert.strictEqual(typeof res.logger.error, 'function')
  assert.strictEqual(typeof res.logger.warn, 'function')
})

test('returns execa', async () => {
  const res = await setup({ cwd: __dirname })
  const execa = (await import('execa')).execa
  assert.strictEqual(res.execa, execa)
})
