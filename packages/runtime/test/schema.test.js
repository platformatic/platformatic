'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { readFile } = require('node:fs/promises')
const { schema } = require('../lib/schema')

test('schema output', async (t) => {
  const { execa } = await import('execa')
  const { stdout } = await execa(process.execPath, [join(__dirname, '..', 'lib', 'schema.js')])

  assert.deepStrictEqual(stdout, JSON.stringify(schema, null, 2))
})

test('root schema file', async (t) => {
  const schemaPath = join(__dirname, '..', 'schema.json')
  const schemaFile = await readFile(schemaPath, 'utf8')
  const rootSchema = JSON.parse(schemaFile)

  // We need the JSON cycle to remove some undefined values used to override
  // some services defaults over runtime defaults.
  assert.deepEqual(rootSchema, JSON.parse(JSON.stringify(schema, null, 2)))
})
