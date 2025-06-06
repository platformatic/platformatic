'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { schema } = require('../lib/schema')

test('schema output', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa(process.execPath, [join(__dirname, '..', 'lib', 'schema.js')])

  assert.deepEqual(stdout, JSON.stringify(schema, null, 2))
})

test('root schema file', async (t) => {
  const schemaPath = join(__dirname, '..', 'schema.json')
  const schemaFile = await readFile(schemaPath, 'utf8')
  const rootSchema = JSON.parse(schemaFile)

  assert.equal(JSON.stringify(rootSchema), JSON.stringify(schema))
})
