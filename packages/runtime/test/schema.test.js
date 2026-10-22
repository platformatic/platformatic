import { validate } from '@platformatic/foundation'
import { schemaComponents } from '@platformatic/foundation/schema'
import { deepEqual, deepStrictEqual, throws } from 'node:assert'
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

test('capability server accepts keepAliveTimeout and headersTimeout, but runtime has no server', () => {
  const server = { port: 3000, keepAliveTimeout: 65000, headersTimeout: 66000 }

  validate(schemaComponents.server, server)
  deepStrictEqual(server, { port: 3000, keepAliveTimeout: 65000, headersTimeout: 66000 })

  throws(() => validate(schemaComponents.server, { keepAliveTimeout: -1 }), /must be >= 0/)
  throws(() => validate(schemaComponents.server, { headersTimeout: -1 }), /must be >= 0/)
  throws(() => validate(schema, { applications: [], server }), /must NOT have additional properties/)
})
