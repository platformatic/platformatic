import { test } from 'tap'
import fs from 'fs/promises'
import { generateJsonSchemaConfig } from '../../lib/gen-schema.js'

test('generateJsonSchemaConfig generates the file', async (t) => {
  process.chdir('./test/tmp')
  await generateJsonSchemaConfig()

  const configSchema = await fs.readFile('platformatic.service.schema.json', 'utf8')
  const { required, additionalProperties } = JSON.parse(configSchema)
  t.has(required, ['server'])
  t.has(additionalProperties, { watch: {} })
})
