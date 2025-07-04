'use strict'

const { execa } = require('execa')
const assert = require('node:assert/strict')
const { join } = require('node:path')
const { test } = require('node:test')
const { getConnectionInfo } = require('../helper.js')
const { cliPath } = require('./helper.js')

test('print the graphql schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(__dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  const { stdout } = await execa('node', [cliPath, 'printSchema', configFile, 'graphql'], {
    cwd: join(__dirname, '..', 'fixtures', 'sqlite'),
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.ok(stdout.includes('type Query'))
  assert.ok(stdout.includes('GraphOrderByArguments'))
})

test('print the openapi schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(__dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  const { stdout } = await execa('node', [cliPath, 'printSchema', configFile, 'openapi'], {
    cwd: join(__dirname, '..', 'fixtures', 'sqlite'),
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  assert.ok(stdout.includes('Exposing a SQL database as REST'))
})
