'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { schema } = require('../lib/schema')

test('schema output', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa(process.execPath, [join(__dirname, '..', 'lib', 'schema.js')])

  assert.deepEqual(stdout, JSON.stringify(schema, null, 2))
})
