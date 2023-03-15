import { test } from 'tap'
import fs from 'fs/promises'
import { generateJsonSchemaConfig } from '../../lib/gen-schema.mjs'
import Ajv from 'ajv'
import { schema } from '../../lib/schema.js'

test('generateJsonSchemaConfig generates the file', async (t) => {
  process.chdir('./test/tmp')
  await generateJsonSchemaConfig()

  const configSchema = JSON.parse(await fs.readFile('platformatic.db.schema.json', 'utf8'))
  const ajv = new Ajv()
  // this should not throw
  ajv.compile(schema)
  t.same(configSchema, schema)
})
