import assert from 'node:assert/strict'
import test from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { getConnectionInfo } from '../helper.js'
import { getFixturesConfigFileLocation } from './helper.js'
import { createCapturingLogger, createTestContext } from '../cli/test-utilities.js'

// Helper to create test context with parseArgs for this specific file
function createTestContextWithParseArgs () {
  const baseContext = createTestContext()
  return {
    ...baseContext,
    parseArgs (args, options) {
      return nodeParseArgs({ args, options, allowPositionals: true, allowNegative: true, strict: false })
    }
  }
}

test('migrate up', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const logger = createCapturingLogger()
  const context = createTestContextWithParseArgs()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['simple']), [], context)

  const output = logger.getCaptured()
  assert.ok(output.includes('001.do.sql'))
})

test('migrate up & down specifying a version with "to"', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  process.env.DATABASE_URL = connectionInfo.connectionString

  {
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['simple']), [], context)
    const output = logger.getCaptured()
    assert.ok(output.includes('001.do.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['simple']), ['-t', '000'], context)
    const output = logger.getCaptured()
    assert.ok(output.includes('001.undo.sql'))
  }
})

test('ignore versions', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const logger = createCapturingLogger()
  const context = createTestContextWithParseArgs()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['simple']), [], context)

  const output = logger.getCaptured()
  assert.ok(output.includes('001.do.sql'))
})

test('migrations rollback', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  process.env.DATABASE_URL = connectionInfo.connectionString

  {
    // apply all migrations
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['multiple-migrations-config']), [], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.do.sql'))
    assert.ok(output.includes('002.do.sql'))
    assert.ok(output.includes('003.do.sql'))
  }

  // Down to no migrations applied
  {
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['multiple-migrations-config']), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('003.undo.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['multiple-migrations-config']), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('002.undo.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['multiple-migrations-config']), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.undo.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['multiple-migrations-config']), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('No migrations to rollback'))
  }

  // ...and back!
  {
    // apply all migrations
    const logger = createCapturingLogger()
    const context = createTestContextWithParseArgs()
    await applyMigrations(logger, getFixturesConfigFileLocation('watt.config.js', ['multiple-migrations-config']), [], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.do.sql'))
    assert.ok(output.includes('002.do.sql'))
    assert.ok(output.includes('003.do.sql'))
  }
})
