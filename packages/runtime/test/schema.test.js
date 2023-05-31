'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { schema } = require('../lib/schema')

test('schema output', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa(process.execPath, [join(__dirname, '..', 'lib', 'schema.js')])

  assert.deepStrictEqual(stdout, JSON.stringify(schema, null, 2))
})
