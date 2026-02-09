import { execa } from 'execa'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { schema } from '../lib/schema.js'

test('schema output', async t => {
  const { stdout } = await execa(process.execPath, [join(import.meta.dirname, '..', 'lib', 'schema.js')])

  assert.deepEqual(stdout, JSON.stringify(schema, null, 2))
})

test('root schema file', async t => {
  const schemaPath = join(import.meta.dirname, '..', 'schema.json')
  const schemaFile = await readFile(schemaPath, 'utf8')
  const rootSchema = JSON.parse(schemaFile)

  assert.deepEqual(rootSchema, schema)
})
