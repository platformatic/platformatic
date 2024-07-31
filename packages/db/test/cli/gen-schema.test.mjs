import { safeRemove } from '@platformatic/utils'
import Ajv from 'ajv'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { schema } from '../../lib/schema.js'
import { cliPath } from './helper.js'

test('generateJsonSchemaConfig generates the file', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-schema-test-'))
  t.after(async () => {
    await safeRemove(cwd)
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
