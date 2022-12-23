import { test } from 'tap'
import fs from 'fs/promises'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { generateJsonSchemaConfig } from '../../lib/gen-schema.js'
import { join } from 'path'

test('generateJsonSchemaConfig generates the file', async (t) => {
  const tmpDir = await mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  process.chdir(tmpDir)
  await generateJsonSchemaConfig()

  const configSchema = await fs.readFile('platformatic.service.schema.json', 'utf8')
  const { required, additionalProperties } = JSON.parse(configSchema)
  t.has(required, ['server'])
  t.has(additionalProperties, { watch: {} })
})
