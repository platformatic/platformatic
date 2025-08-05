import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import { request } from 'undici'
import { printSchema } from '../../lib/commands/print-schema.js'
import { snapshot } from '../fixtures/snapshots/env.js'
import { getConnectionInfo } from '../helper.js'
import { connectDB, safeKill, start } from './helper.js'

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

test('env white list', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start([resolve(import.meta.dirname, '..', 'fixtures', 'env-whitelist.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString,
      HOSTNAME: '127.0.0.1'
    }
  })

  {
    // should connect to db and query it.
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { title: "Hello" }) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'savePage status code')
    const body = await res.body.json()
    assert.equal(body.data.savePage.title, 'Hello')
  }

  await safeKill(child)
})

test('env white list default values', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start([resolve(import.meta.dirname, '..', 'fixtures', 'env-whitelist-default.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString,
      PORT: 10555
    }
  })

  assert.equal(url, 'http://127.0.0.1:10555')
  {
    // should connect to db and query it.
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { title: "Hello" }) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'savePage status code')
    const body = await res.body.json()
    assert.equal(body.data.savePage.title, 'Hello')
  }

  await safeKill(child)
})

test('env white list schema', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const logger = createCapturingLogger()
  const context = createTestContext()

  // Capture console.log output
  let capturedOutput = ''
  const originalConsoleLog = console.log
  console.log = (msg) => { capturedOutput += msg }

  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    HOSTNAME: process.env.HOSTNAME
  }

  try {
    process.env.DATABASE_URL = connectionInfo.connectionString
    process.env.HOSTNAME = '127.0.0.1'

    await printSchema(logger, resolve(import.meta.dirname, '..', 'fixtures', 'env-whitelist.json'), ['graphql'], context)

    assert.equal(capturedOutput.trim(), snapshot)
  } finally {
    console.log = originalConsoleLog
    if (originalEnv.DATABASE_URL) {
      process.env.DATABASE_URL = originalEnv.DATABASE_URL
    } else {
      delete process.env.DATABASE_URL
    }
    if (originalEnv.HOSTNAME) {
      process.env.HOSTNAME = originalEnv.HOSTNAME
    } else {
      delete process.env.HOSTNAME
    }
  }
})
