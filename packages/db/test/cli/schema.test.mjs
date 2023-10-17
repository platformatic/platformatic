import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readFile, mkdtemp } from 'node:fs/promises'
import * as desm from 'desm'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import jsonLanguageService from 'vscode-json-languageservice'
import { getConnectionInfo } from '../helper.js'
import { cliPath } from './helper.js'

const pkg = JSON.parse(await readFile(desm.join(import.meta.url, '..', '..', 'package.json'), 'utf8'))

test('print the graphql schema to stdout', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  t.after(() => dropTestDB())

  const { stdout } = await execa('node', [cliPath, 'schema', 'graphql'], {
    cwd: desm.join(import.meta.url, '..', 'fixtures', 'sqlite'),
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  const snapshot = await import('../../snapshots/test/cli/schema1.test.mjs')
  assert.equal(stdout, snapshot.default)
})

test('print the openapi schema to stdout', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  t.after(() => dropTestDB())

  const { stdout } = await execa('node', [cliPath, 'schema', 'openapi'], {
    cwd: desm.join(import.meta.url, '..', 'fixtures', 'sqlite'),
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  const snapshot = await import('../../snapshots/test/cli/schema2.test.mjs')
  assert.equal(stdout, snapshot.default)
})

test('generates the json schema config', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'platformatic-schema-'))
  await execa('node', [cliPath, 'schema', 'config'], { cwd })

  const configSchema = await readFile(join(cwd, 'platformatic.db.schema.json'), 'utf8')
  const schema = JSON.parse(configSchema)
  const { $id, type } = schema
  assert.equal($id, `https://platformatic.dev/schemas/v${pkg.version}/db`)
  assert.equal(type, 'object')

  const languageservice = jsonLanguageService.getLanguageService({
    async schemaRequestService (uri) {
      return configSchema
    }
  })

  languageservice.configure({ allowComments: false, schemas: [{ fileMatch: ['*.data.json'], uri: $id }] })

  const jsonContent = `{
    "$schema": "https://schemas.platformatic.dev/db",
    "db": {
      "connectionString": "sqlite://::memory::"
    },
    "server": {
      "hostname": "127.0.0.1",
      "port": 3000
    }
  }`
  const jsonContentUri = 'foo://server/example.data.json'
  const textDocument = jsonLanguageService.TextDocument.create(jsonContentUri, 'json', 1, jsonContent)
  const jsonDocument = languageservice.parseJSONDocument(textDocument)
  const diagnostics = await languageservice.doValidation(textDocument, jsonDocument)
  assert.equal(diagnostics.length, 0)
})

test('print the help if schema type is missing', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'schema'], {})
  const sanitized = stripAnsi(stdout)
  assert.ok(sanitized.includes('Generate a schema from the database and prints it to standard output:'))
  assert.ok(sanitized.includes('`schema graphql` - generate the GraphQL schema'))
  assert.ok(sanitized.includes('`schema openapi` - generate the OpenAPI schema'))
})
