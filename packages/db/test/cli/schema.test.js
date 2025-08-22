import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { printSchema } from '../../lib/commands/print-schema.js'
import { getConnectionInfo } from '../helper.js'
import { createCapturingLogger, createTestContext, withTestEnvironment } from './test-utilities.js'

test('print the graphql schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  await withTestEnvironment({
    workingDirectory: join(import.meta.dirname, '..', 'fixtures', 'sqlite'),
    envVars: { DATABASE_URL: connectionInfo.connectionString },
    captureConsole: true
  }, async (captureObj) => {
    const logger = createCapturingLogger()
    const context = createTestContext()

    await printSchema(logger, configFile, ['graphql'], context)

    const capturedOutput = captureObj.get()
    assert.ok(capturedOutput.includes('type Query'))
    assert.ok(capturedOutput.includes('GraphOrderByArguments'))
  })()
})

test('print the openapi schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  await withTestEnvironment({
    workingDirectory: join(import.meta.dirname, '..', 'fixtures', 'sqlite'),
    envVars: { DATABASE_URL: connectionInfo.connectionString },
    captureConsole: true
  }, async (captureObj) => {
    const logger = createCapturingLogger()
    const context = createTestContext()

    await printSchema(logger, configFile, ['openapi'], context)

    const capturedOutput = captureObj.get()
    assert.ok(capturedOutput.includes('Exposing a SQL database as REST'))
  })()
})
