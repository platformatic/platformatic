import { cliPath } from './helper.js'
import { test } from 'tap'
import { join } from 'desm'
import { execa } from 'execa'
import { rm } from 'fs/promises'
import stripAnsi from 'strip-ansi'

const dbLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'db')

test('print the graphql schema to stdout', async ({ matchSnapshot }) => {
  try {
    await rm(dbLocation)
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
    await rm(dbLocation)
  } catch {
    // ignore
  }

  const { stdout } = await execa('node', [cliPath, 'schema', 'openapi'], {
    cwd: join(import.meta.url, '..', 'fixtures', 'sqlite')
  })

  matchSnapshot(stdout)
})

test('print the help if schema type is missing', async ({ match }) => {
  try {
    await rm(dbLocation)
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
