import { test } from 'tap'
import fs from 'fs/promises'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { generateJsonSchemaConfig } from '../../lib/gen-schema.js'
import { join } from 'path'
import jsonLanguageService from 'vscode-json-languageservice'

test('generateJsonSchemaConfig generates the file', async (t) => {
  const tmpDir = await mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  process.chdir(tmpDir)
  await generateJsonSchemaConfig()

  const configSchema = await fs.readFile('platformatic.service.schema.json', 'utf8')
  const schema = JSON.parse(configSchema)
  const { required, additionalProperties } = schema
  t.has(required, ['server'])
  t.has(additionalProperties, { watch: {} })
  const { $id, type } = schema
  t.equal($id, 'https://schemas.platformatic.dev/service')
  t.equal(type, 'object')

  const languageservice = jsonLanguageService.getLanguageService({
    async schemaRequestService (uri) {
      return configSchema
    }
  })

  languageservice.configure({ allowComments: false, schemas: [{ fileMatch: ['*.data.json'], uri: $id }] })

  const jsonContent = `{
    "$schema": "https://schemas.platformatic.dev/service",
    "server": {
      "hostname": "127.0.0.1",
      "port": 3000
    }
  }`
  const jsonContentUri = 'foo://server/example.data.json'
  const textDocument = jsonLanguageService.TextDocument.create(jsonContentUri, 'json', 1, jsonContent)
  const jsonDocument = languageservice.parseJSONDocument(textDocument)
  const diagnostics = await languageservice.doValidation(textDocument, jsonDocument)
  t.equal(diagnostics.length, 0)
})
