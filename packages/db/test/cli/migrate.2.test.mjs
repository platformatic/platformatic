import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join, dirname } from 'node:path'
import { readFile, writeFile, unlink, stat } from 'node:fs/promises'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { getConnectionInfo } from '../helper.js'
import { cliPath, connectDB, getFixturesConfigFileLocation } from './helper.js'

test('migrate creates a schema.lock file on a different path', { skip: true }, async (t) => {
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

test('start creates schema.lock if it is missing', { skip: true }, async (t) => {
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
    child.kill('SIGTERM')
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
    child.kill('SIGTERM')
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
