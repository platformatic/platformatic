import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import split from 'split2'
import { setTimeout } from 'timers/promises'
import { request } from 'undici'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { getConnectionInfo } from '../helper.js'
import { safeKill, start } from './helper.js'

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

test('migrate and start', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, join(cwd, 'platformatic.db.json'), [], context)

  const output = logger.getCaptured()
  assert.match(output, /001\.do\.sql/)

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(child)
    await dropTestDB()
  })

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          saveGraph: {
            id: '1',
            name: 'Hello'
          }
        }
      },
      'saveGraph response'
    )
  }
})

test('no cwd', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const config = join(import.meta.dirname, '..', 'fixtures', 'sqlite', 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, config, [], context)

  const output = logger.getCaptured()
  assert.ok(output.includes('001.do.sql'))

  const { child, url } = await start(['-c', config], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(child)
    await dropTestDB()
  })

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          saveGraph: {
            id: '1',
            name: 'Hello'
          }
        }
      },
      'saveGraph response'
    )
  }
})

test('do not restart on save', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const cwd = join(import.meta.dirname, '..', 'fixtures', 'sqlite')

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, join(cwd, 'platformatic.db.json'), [], context)

  const output = logger.getCaptured()
  assert.match(output, /001\.do\.sql/)

  const { child, url } = await start([], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await dropTestDB()
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                saveGraph(input: { name: "Hello" }) {
                  id
                  name
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'saveGraph status code')
    const body = await res.body.json()
    assert.deepEqual(
      body,
      {
        data: {
          saveGraph: {
            id: '1',
            name: 'Hello'
          }
        }
      },
      'saveGraph response'
    )
  }

  // We need this timer to allow the debounce logic to run its course
  await setTimeout(1000)

  await safeKill(child)

  for await (const data of splitter) {
    const parsed = JSON.parse(data)
    assert.ok(!parsed.msg.includes('restarted'))
  }
})
