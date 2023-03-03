'use strict'

const { test } = require('tap')
const { join } = require('path')
const { schema } = require('../lib/schema')

test('schema output', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa('node', [join(__dirname, '..', 'lib', 'schema.js')])

  t.same(stdout, JSON.stringify(schema, null, 2))
})
