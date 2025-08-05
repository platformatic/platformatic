import assert from 'node:assert/strict'
import { statSync, utimesSync } from 'node:fs'
import test from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { getConnectionInfo } from '../helper.js'
import { getFixturesConfigFileLocation } from './helper.js'

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
      if (logger.fatal) logger.fatal(...args)
      return false
    }
  }
}

function createCapturingLogger () {
  let capturedOutput = ''
  const logger = {
    info: (msg) => { capturedOutput += msg + '\n' },
    warn: (msg) => { capturedOutput += msg + '\n' },
    debug: () => {},
    trace: () => {},
    error: (msg) => { capturedOutput += msg + '\n' }
  }
  logger.getCaptured = () => capturedOutput
  return logger
}

test('migrate up', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, getFixturesConfigFileLocation('simple.json'), [], context)

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
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('simple.json'), [], context)
    const output = logger.getCaptured()
    assert.ok(output.includes('001.do.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('simple.json'), ['-t', '000'], context)
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
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, getFixturesConfigFileLocation('simple.json'), [], context)

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
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('multiple-migrations.json'), [], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.do.sql'))
    assert.ok(output.includes('002.do.sql'))
    assert.ok(output.includes('003.do.sql'))
  }

  // Down to no migrations applied
  {
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('multiple-migrations.json'), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('003.undo.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('multiple-migrations.json'), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('002.undo.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('multiple-migrations.json'), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.undo.sql'))
  }

  {
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('multiple-migrations.json'), ['-r'], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('No migrations to rollback'))
  }

  // ...and back!
  {
    // apply all migrations
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('multiple-migrations.json'), [], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.do.sql'))
    assert.ok(output.includes('002.do.sql'))
    assert.ok(output.includes('003.do.sql'))
  }
})

test('after a migration, platformatic config is touched', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  utimesSync(getFixturesConfigFileLocation('simple.json'), d, d)
  const { mtime: mtimePrev } = statSync(getFixturesConfigFileLocation('simple.json'))

  process.env.DATABASE_URL = connectionInfo.connectionString

  {
    const logger = createCapturingLogger()
    const context = createTestContext()
    await applyMigrations(logger, getFixturesConfigFileLocation('simple.json'), [], context)
    const output = logger.getCaptured()

    assert.ok(output.includes('001.do.sql'))

    const { mtime: mtimeAfter } = statSync(getFixturesConfigFileLocation('simple.json'))
    assert.notDeepEqual(mtimePrev, mtimeAfter)
  }
})
