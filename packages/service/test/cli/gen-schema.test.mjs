import { test, beforeEach, afterEach } from 'tap'
import fs from 'fs/promises'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { generateJsonSchemaConfig } from '../../lib/gen-schema.js'
import { join } from 'path'

let tmpDir
beforeEach(async () => {
  tmpDir = await mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  fs.rmdir(tmpDir, { recursive: true, force: true })
  process.env = {}
})

test('generateJsonSchemaConfig generates the file', async (t) => {
  process.chdir(tmpDir)
  await generateJsonSchemaConfig()

  const configSchema = await fs.readFile('platformatic.service.schema.json', 'utf8')
  const { required, additionalProperties } = JSON.parse(configSchema)
  t.has(required, ['server'])
  t.has(additionalProperties, { watch: {} })
})
