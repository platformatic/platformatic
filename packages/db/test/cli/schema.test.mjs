import { cliPath } from './helper.js'
import { test } from 'tap'
import { join } from 'desm'
import { execa } from 'execa'
import fs from 'fs/promises'
import stripAnsi from 'strip-ansi'
import jsonLanguageService from 'vscode-json-languageservice'

const pkg = JSON.parse(await fs.readFile(join(import.meta.url, '..', '..', 'package.json'), 'utf8'))

const dbLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'db')

test('print the graphql schema to stdout', async ({ matchSnapshot }) => {
  try {
    await fs.rm(dbLocation)
  } catch {
    // ignore
  }

  const { stdout } = await execa('node', [cliPath, 'schema', 'graphql'], {
    cwd: join(import.meta.url, '..', 'fixtures', 'sqlite')
  })

  matchSnapshot(stdout)
})

test('print the openapi schema to stdout', async ({ matchSnapshot }) => {
  try {
    await fs.rm(dbLocation)
  } catch {
    // ignore
  }

  const { stdout } = await execa('node', [cliPath, 'schema', 'openapi'], {
    cwd: join(import.meta.url, '..', 'fixtures', 'sqlite')
  })

  matchSnapshot(stdout)
})

test('generates the json schema config', async (t) => {
  process.chdir('./test/tmp')
  await execa('node', [cliPath, 'schema', 'config'])

  const configSchema = await fs.readFile('platformatic.db.schema.json', 'utf8')
  const schema = JSON.parse(configSchema)
  const { $id, type } = schema
  t.equal($id, `https://platformatic.dev/schemas/v${pkg.version}/db`)
  t.equal(type, 'object')

  const languageservice = jsonLanguageService.getLanguageService({
    async schemaRequestService (uri) {
      return configSchema
    }
  })

  languageservice.configure({ allowComments: false, schemas: [{ fileMatch: ['*.data.json'], uri: $id }] })

  const jsonContent = `{
    "$schema": "https://schemas.platformatic.dev/db",
    "core": {
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
  t.equal(diagnostics.length, 0)
})

test('print the help if schema type is missing', async ({ match }) => {
  try {
    await fs.rm(dbLocation)
  } catch {
    // ignore
  }

  const { stdout } = await execa('node', [cliPath, 'schema'], {
  })
  const sanitized = stripAnsi(stdout)
  match(sanitized, 'Generate a schema from the database and prints it to standard output:')
  match(sanitized, '`schema graphql` - generate the GraphQL schema')
  match(sanitized, '`schema openapi` - generate the OpenAPI schema')
})
