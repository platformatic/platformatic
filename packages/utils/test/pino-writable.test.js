'use strict'

const pino = require('pino')
const pinoTest = require('pino-test')
const { test } = require('node:test')
const { createPinoWritable } = require('..')
const { Transform } = require('node:stream')
const { once } = require('node:events')

test('writes to pino', async () => {
  const sink = pinoTest.sink()
  const logger = pino(sink)

  const writable = createPinoWritable(logger, 'info', true)

  writable.write('hello')

  const expected = { raw: 'hello', level: 30 }
  await pinoTest.once(sink, expected)
})

test('is a transform to appease Yarn', async (t) => {
  const sink = pinoTest.sink()
  const logger = pino(sink)
  const writable = createPinoWritable(logger, 'info', true)
  t.assert.strictEqual(writable instanceof Transform, true)

  writable.resume()

  const [err] = await once(writable, 'error')
  t.assert.ok(err instanceof Error)
  t.assert.strictEqual(err.message, 'PinoWritable cannot be read')
})
