import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import { printSchema } from '../../lib/commands/print-schema.js'
import { getConnectionInfo } from '../helper.js'

function createCapturingLogger () {
  let capturedOutput = ''
  const logger = {
    info: (msg) => { capturedOutput += msg + '\n' },
    warn: (msg) => { capturedOutput += msg + '\n' },
    debug: () => {},
    trace: () => {},
    error: (msg) => { capturedOutput += msg + '\n' },
    fatal: (msg) => { capturedOutput += msg + '\n' }
  }
  logger.getCaptured = () => capturedOutput
  return logger
}

function createTestContext () {
  return {
    parseArgs (args, options) {
      return nodeParseArgs({ args, options, allowPositionals: true, allowNegative: true, strict: false })
    },
    colorette: {
      bold (str) {
        return str
      }
    },
    logFatalError (logger, ...args) {
      logger.fatal(...args)
      return false
    }
  }
}

test('print the graphql schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  const logger = createCapturingLogger()
  const context = createTestContext()

  // Capture console.log output
  let capturedOutput = ''
  const originalConsoleLog = console.log
  console.log = (msg) => { capturedOutput += msg }

  const originalCwd = process.cwd()
  const originalEnv = process.env.DATABASE_URL

  try {
    process.chdir(join(import.meta.dirname, '..', 'fixtures', 'sqlite'))
    process.env.DATABASE_URL = connectionInfo.connectionString

    await printSchema(logger, configFile, ['graphql'], context)

    assert.ok(capturedOutput.includes('type Query'))
    assert.ok(capturedOutput.includes('GraphOrderByArguments'))
  } finally {
    console.log = originalConsoleLog
    process.chdir(originalCwd)
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv
    } else {
      delete process.env.DATABASE_URL
    }
  }
})

test('print the openapi schema to stdout', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const configFile = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')
  t.after(() => dropTestDB())

  const logger = createCapturingLogger()
  const context = createTestContext()

  // Capture console.log output
  let capturedOutput = ''
  const originalConsoleLog = console.log
  console.log = (msg) => { capturedOutput += msg }

  const originalCwd = process.cwd()
  const originalEnv = process.env.DATABASE_URL

  try {
    process.chdir(join(import.meta.dirname, '..', 'fixtures', 'sqlite'))
    process.env.DATABASE_URL = connectionInfo.connectionString

    await printSchema(logger, configFile, ['openapi'], context)

    assert.ok(capturedOutput.includes('Exposing a SQL database as REST'))
  } finally {
    console.log = originalConsoleLog
    process.chdir(originalCwd)
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv
    } else {
      delete process.env.DATABASE_URL
    }
  }
})
