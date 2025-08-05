import assert from 'node:assert/strict'
import { test } from 'node:test'
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

function createThrowingLogger () {
  return {
    info: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    error: (msg) => {
      throw new Error(msg)
    },
    fatal: (msg) => {
      throw new Error(msg)
    }
  }
}

test('missing config', async t => {
  const logger = createThrowingLogger()
  const context = createTestContext()

  await assert.rejects(async () => {
    await applyMigrations(logger, undefined, [], context)
  })
})

test('missing connectionString', async t => {
  const logger = createThrowingLogger()
  const context = createTestContext()

  await assert.rejects(async () => {
    await applyMigrations(logger, getFixturesConfigFileLocation('no-connectionString.json'), [], context)
  })
})

test('missing migrations', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const logger = createThrowingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await assert.rejects(async () => {
    await applyMigrations(logger, getFixturesConfigFileLocation('no-migrations.json'), [], context)
  })
})

test('missing migrations.dir', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const logger = createThrowingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await assert.rejects(async () => {
    await applyMigrations(logger, getFixturesConfigFileLocation('no-migrations-dir.json'), [], context)
  })
})

test('not applied migrations', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  const logger = createThrowingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await assert.rejects(async () => {
    await applyMigrations(logger, getFixturesConfigFileLocation('bad-migrations.json'), [], context)
  })
})
