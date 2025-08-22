import { deepEqual, deepStrictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { schema } from '../lib/schema.js'

test('schema output', async t => {
  const { execa } = await import('execa')
  const { stdout } = await execa(process.execPath, [join(import.meta.dirname, '..', 'lib', 'schema.js')])

  deepStrictEqual(stdout, JSON.stringify(schema, null, 2))
})

test('root schema file', async t => {
  const schemaPath = join(import.meta.dirname, '..', 'schema.json')
  const schemaFile = await readFile(schemaPath, 'utf8')
  const rootSchema = JSON.parse(schemaFile)

  deepEqual(rootSchema, schema)
})
