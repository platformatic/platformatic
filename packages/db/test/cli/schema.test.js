import { execa } from 'execa'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { getConnectionInfo } from '../helper.js'
import { cliPath } from './helper.js'

test('print the graphql schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  const { stdout } = await execa('node', [cliPath, 'printSchema', configFile, 'graphql'], {
    cwd: join(import.meta.dirname, '..', 'fixtures', 'sqlite'),
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.ok(stdout.includes('type Query'))
  assert.ok(stdout.includes('GraphOrderByArguments'))
})

test('print the openapi schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  const { stdout } = await execa('node', [cliPath, 'printSchema', configFile, 'openapi'], {
    cwd: join(import.meta.dirname, '..', 'fixtures', 'sqlite'),
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.ok(stdout.includes('Exposing a SQL database as REST'))
})
