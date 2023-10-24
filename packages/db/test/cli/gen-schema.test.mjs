import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import Ajv from 'ajv'
import { execa } from 'execa'
import { schema } from '../../lib/schema.js'
import { cliPath } from './helper.js'

test('generateJsonSchemaConfig generates the file', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-schema-test-'))
  t.after(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  await execa('node', [cliPath, 'schema', 'config'], { cwd })

  const configSchema = JSON.parse(await readFile(join(cwd, 'platformatic.db.schema.json'), 'utf8'))
  const ajv = new Ajv()
  ajv.addKeyword('resolvePath')
  ajv.addKeyword('resolveModule')
  // this should not throw
  ajv.compile(schema)
  assert.deepEqual(configSchema, schema)
})
