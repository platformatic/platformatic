import assert from 'assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { generateJsonSchemaConfig } from '../../lib/gen-schema.js'
import jsonLanguageService from 'vscode-json-languageservice'

const pkg = JSON.parse(await fs.readFile('../../package.json', 'utf8'))

test('generateJsonSchemaConfig generates the file', async (t) => {
  const tmpDir = await mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  process.chdir(tmpDir)
  await generateJsonSchemaConfig()

  const configSchema = await fs.readFile('platformatic.service.schema.json', 'utf8')
  const schema = JSON.parse(configSchema)
  const { required } = schema
  assert.strictEqual(required, undefined)
  const { $id, type } = schema
  assert.strictEqual($id, `https://platformatic.dev/schemas/v${pkg.version}/service`)
  assert.strictEqual(type, 'object')

  const languageservice = jsonLanguageService.getLanguageService({
    async schemaRequestService (uri) {
      return configSchema
    }
  })

  languageservice.configure({ allowComments: false, schemas: [{ fileMatch: ['*.data.json'], uri: $id }] })

  const jsonContent = `{
    "$schema": "https://platformatic.dev/schemas/v${pkg.version}/service",
    "server": {
      "hostname": "127.0.0.1",
      "port": 3000
    }
  }`
  const jsonContentUri = 'foo://server/example.data.json'
  const textDocument = jsonLanguageService.TextDocument.create(jsonContentUri, 'json', 1, jsonContent)
  const jsonDocument = languageservice.parseJSONDocument(textDocument)
  const diagnostics = await languageservice.doValidation(textDocument, jsonDocument)
  assert.strictEqual(diagnostics.length, 0)
})
