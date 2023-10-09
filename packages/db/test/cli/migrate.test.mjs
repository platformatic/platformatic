import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join, dirname } from 'node:path'
import { readFile, writeFile, unlink, stat } from 'node:fs/promises'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { once } from 'events'
import { getConnectionInfo } from '../helper.js'
import { cliPath, connectDB, getFixturesConfigFileLocation } from './helper.js'

test('migrate on start', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let found = false
  const child = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('auto-apply.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    child.kill('SIGINT')
    await db.dispose()
    await dropTestDB()
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)running 001\.do\.sql/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)
})

test('validate migration checksums', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let firstFound = false

  const firstChild = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('validate-migrations-checksums.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const splitter = split()
  firstChild.stdout.pipe(splitter)
  for await (const data of splitter) {
    console.log(data)
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)running 001\.do\.sql/)) {
      firstFound = true
      break
    }
  }
  assert.equal(firstFound, true)

  let secondFound = false
  const secondChild = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('validate-migrations-checksums.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    secondChild.kill('SIGINT')
    firstChild.kill('SIGINT')
    await db.dispose()
    await dropTestDB()
  })

  const secondSplitter = split()
  secondChild.stdout.pipe(secondSplitter)
  for await (const data of secondSplitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)verifying checksum of migration 001\.do\.sql/)) {
      secondFound = true
      break
    }
  }
  assert.equal(secondFound, true)
})

test('do not validate migration checksums if not configured', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const firstChild = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('auto-apply.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const splitter = split()
  const firstOutput = firstChild.stdout.pipe(splitter)
  const [message] = await once(firstOutput, 'data')
  assert.match(stripAnsi(message), /(.*)running(.*)(001\.do\.sql)/)

  const secondChild = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('auto-apply.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )
  secondChild.stderr.pipe(process.stderr)

  t.after(async () => {
    secondChild.kill('SIGINT')
    firstChild.kill('SIGINT')
    await db.dispose()
    await dropTestDB()
  })

  const secondOutput = secondChild.stdout.pipe(split(JSON.parse))
  // first output should be a "server listening" message
  // no migration logging is expected
  const [{ msg }] = await once(secondOutput, 'data')
  assert.ok(msg.includes('Server listening at http://127.0.0.1:'))
})

test('throws if migrations directory does not exist', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')

  const child = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('invalid-migrations-directory.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const output = child.stderr.pipe(split())
  const [data] = await once(output, 'data')

  t.after(async () => {
    await dropTestDB()
  })

  assert.match(data, /Migrations directory (.*) does not exist/)
})

test('do not run migrations by default', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const firstChild = execa(
    'node', [cliPath, 'start', '-c', getFixturesConfigFileLocation('no-auto-apply.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    firstChild.kill('SIGINT')
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
    assert.equal(msg, 'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? This guide can help with debugging Platformatic DB: https://docs.platformatic.dev/docs/guides/debug-platformatic-db')
  }

  const [{ exists }] = await db.query(db.sql(
    `SELECT EXISTS (
    SELECT FROM
        pg_tables
    WHERE
        schemaname = 'public' AND
        tablename  = 'graphs'
    );`
  ))
  assert.equal(exists, false)
})

test('migrate creates a schema.lock file', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let found = false
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await unlink(expectedFile)
  } catch {}

  await execa(
    'node', [cliPath, 'migrations', 'apply', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const data = await readFile(expectedFile)
  // Let's just validate this is a valid JSON file
  JSON.parse(data)

  const child = execa(
    'node', [cliPath, 'start', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    child.kill('SIGINT')
    await db.dispose()
    await dropTestDB()

    try {
      await unlink(expectedFile)
    } catch {}
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)loaded schema lock/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)
})

test('migrate creates a schema.lock file on a different path', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await unlink(expectedFile)
  } catch {}

  await execa(
    'node', [cliPath, 'migrations', 'apply', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    await db.dispose()
    await dropTestDB()

    try {
      await unlink(expectedFile)
    } catch {}
  })

  const data = await readFile(expectedFile)
  // Let's just validate this is a valid JSON file
  JSON.parse(data)
})

test('start creates schema.lock if it is missing', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let found = false
  const configPathWithoutSchemaLock = getFixturesConfigFileLocation('no-auto-apply.json')
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  await unlink(expectedFile).catch(() => {})

  await execa(
    'node', [cliPath, 'migrations', 'apply', '-c', configPathWithoutSchemaLock],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const child = execa(
    'node', [cliPath, 'start', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    child.kill('SIGINT')
    await db.dispose()
    await dropTestDB()
    await unlink(expectedFile).catch(() => {})
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)created schema lock/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  const data = await readFile(expectedFile)
  // Let's just validate this is a valid JSON file
  JSON.parse(data)
})

test('start updates schema.lock with migrations autoApply', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation(
    'platformatic.db.json', ['update-schema-lock']
  )
  const schemaLockPath = join(dirname(configPath), 'schema.lock')
  await writeFile(schemaLockPath, '[]')

  const child = execa(
    'node', [cliPath, 'start', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    child.kill('SIGINT')
    await db.dispose()
    await dropTestDB()
    await unlink(schemaLockPath).catch(() => {})
  })

  let found = false
  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)running 001\.do\.sql/)) {
      found = true
    }
    if (sanitized.match(/(.*)Server listening at/)) {
      break
    }
  }

  assert.equal(found, true)

  const schemaLockFile = await readFile(schemaLockPath, 'utf8')
  const schemaLock = JSON.parse(schemaLockFile)

  const versionsTableSchema = schemaLock.find(s => s.table === 'versions')
  assert.ok(versionsTableSchema)

  const graphsTableSchema = schemaLock.find(s => s.table === 'graphs')
  assert.ok(graphsTableSchema)
})

test('migrate does not update an existing schemalock file if no migrations have been applied', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  await unlink(expectedFile).catch(() => {})

  await execa(
    'node', [cliPath, 'migrations', 'apply', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
    await unlink(expectedFile).catch(() => {})
  })

  const stats1 = await stat(expectedFile)

  await execa(
    'node', [cliPath, 'migrations', 'apply', '-c', configPath],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  const stats2 = await stat(expectedFile)

  assert.deepEqual(stats1, stats2)
})
