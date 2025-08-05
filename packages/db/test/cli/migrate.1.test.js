import { once } from 'events'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { readFile, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { parseArgs as nodeParseArgs } from 'node:util'
import split from 'split2'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { getConnectionInfo } from '../helper.js'
import { connectDB, getFixturesConfigFileLocation, safeKill, startPath } from './helper.js'

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

test('migrate on start', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let found = false
  const child = execa('node', [startPath, getFixturesConfigFileLocation('auto-apply.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(child)
    await db.dispose()
    await dropTestDB()
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    if (data.match(/(.*)running 001\.do\.sql/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)
})

test('validate migration checksums', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let firstFound = false

  const firstChild = execa('node', [startPath, getFixturesConfigFileLocation('validate-migrations-checksums.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  const splitter = split()
  firstChild.stdout.pipe(splitter)
  for await (const data of splitter) {
    if (data.match(/(.*)running 001\.do\.sql/)) {
      firstFound = true
      break
    }
  }
  assert.equal(firstFound, true)

  let secondFound = false
  const secondChild = execa('node', [startPath, getFixturesConfigFileLocation('validate-migrations-checksums.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(secondChild, 'SIGTERM')
    await safeKill(firstChild, 'SIGTERM')
    await db.dispose()
    await dropTestDB()
  })

  const secondSplitter = split()
  secondChild.stdout.pipe(secondSplitter)
  for await (const data of secondSplitter) {
    if (data.match(/(.*)verifying checksum of migration 001\.do\.sql/)) {
      secondFound = true
      break
    }
  }
  assert.equal(secondFound, true)
})

test('do not validate migration checksums if not configured', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const firstChild = execa('node', [startPath, getFixturesConfigFileLocation('auto-apply.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  const splitter = split()
  const firstOutput = firstChild.stdout.pipe(splitter)
  const [message] = await once(firstOutput, 'data')
  assert.match(message, /(.*)running(.*)(001\.do\.sql)/)

  const secondChild = execa('node', [startPath, getFixturesConfigFileLocation('auto-apply.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })
  secondChild.stderr.pipe(process.stderr)

  t.after(async () => {
    await safeKill(secondChild, 'SIGTERM')
    await safeKill(firstChild, 'SIGTERM')
    await db.dispose()
    await dropTestDB()
  })

  const secondOutput = secondChild.stdout.pipe(split(JSON.parse))
  // first output should be a "server listening" message
  // no migration logging is expected
  const [{ msg }] = await once(secondOutput, 'data')
  assert.ok(msg.includes('Server listening at http://127.0.0.1:'))
})

test('throws if migrations directory does not exist', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')

  const { stderr } = await execa(
    'node',
    [startPath, getFixturesConfigFileLocation('invalid-migrations-directory.json')],
    {
      reject: false,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    await dropTestDB()
  })

  assert.match(stderr, /Migrations directory (.*) does not exist/)
})

test('do not run migrations by default', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const firstChild = execa('node', [startPath, getFixturesConfigFileLocation('no-auto-apply.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await safeKill(firstChild, 'SIGTERM')
    await db.dispose()
    await dropTestDB()
  })

  const splitter = split()
  const output = firstChild.stdout.pipe(splitter)

  {
    const [out] = await once(output, 'data')
    const { msg } = JSON.parse(out)
    assert.equal(msg, 'Ignored table "versions" not found.')
  }

  {
    const [out] = await once(output, 'data')
    const { msg } = JSON.parse(out)
    assert.equal(
      msg,
      'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? This guide can help with debugging Platformatic DB: https://docs.platformatic.dev/docs/guides/debug-platformatic-db'
    )
  }

  const [{ exists }] = await db.query(
    db.sql(
      `SELECT EXISTS (
    SELECT FROM
        pg_tables
    WHERE
        schemaname = 'public' AND
        tablename  = 'graphs'
    );`
    )
  )
  assert.equal(exists, false)
})

test('migrate creates a schema.lock file', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let found = false
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await unlink(expectedFile)
  } catch {}

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, configPath, [], context)

  const data = await readFile(expectedFile, 'utf-8')
  // Let's just validate this is a valid JSON file
  JSON.parse(data)

  const child = execa('node', [startPath, configPath], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    safeKill(child, 'SIGTERM')
    await db.dispose()
    await dropTestDB()

    try {
      await unlink(expectedFile)
    } catch {}
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    if (data.match(/(.*)loaded schema lock/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)
})
