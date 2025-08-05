import { execa } from 'execa'
import assert from 'node:assert/strict'
import { readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import split from 'split2'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { getConnectionInfo } from '../helper.js'
import { connectDB, getFixturesConfigFileLocation, startPath } from './helper.js'
import { createCapturingLogger, createTestContext } from './test-utilities.js'

test('migrate creates a schema.lock file on a different path', { skip: true }, async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await unlink(expectedFile)
  } catch {}

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, configPath, [], context)

  t.after(async () => {
    await db.dispose()
    await dropTestDB()

    try {
      await unlink(expectedFile)
    } catch {}
  })

  const data = await readFile(expectedFile, 'utf-8')
  // Let's just validate this is a valid JSON file
  JSON.parse(data)
})

test('start creates schema.lock if it is missing', { skip: true }, async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  let found = false
  const configPathWithoutSchemaLock = getFixturesConfigFileLocation('no-auto-apply.json')
  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  await unlink(expectedFile).catch(() => {})

  const logger = createCapturingLogger()
  const context = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger, configPathWithoutSchemaLock, [], context)

  const child = execa('node', [startPath, configPath], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    child.catch(() => {})
    child.kill('SIGTERM')
    await db.dispose()
    await dropTestDB()
    await unlink(expectedFile).catch(() => {})
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    if (data.match(/(.*)created schema lock/)) {
      found = true
      break
    }
  }
  assert.equal(found, true)

  const data = await readFile(expectedFile, 'utf-8')
  // Let's just validate this is a valid JSON file
  JSON.parse(data)
})

test('start updates schema.lock with migrations autoApply', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation('platformatic.db.json', ['update-schema-lock'])
  const schemaLockPath = join(dirname(configPath), 'schema.lock')
  await writeFile(schemaLockPath, '[]')

  const child = execa('node', [startPath, configPath], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    child.catch(() => {})
    child.kill('SIGTERM')
    await db.dispose()
    await dropTestDB()
    await unlink(schemaLockPath).catch(() => {})
  })

  let found = false
  const splitter = split()
  child.stdout.pipe(splitter)
  for await (const data of splitter) {
    if (data.match(/(.*)running 001\.do\.sql/)) {
      found = true
    }
    if (data.match(/(.*)Server listening at/)) {
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

test('migrate does not update an existing schemalock file if no migrations have been applied', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  await unlink(expectedFile).catch(() => {})

  const logger1 = createCapturingLogger()
  const context1 = createTestContext()

  process.env.DATABASE_URL = connectionInfo.connectionString
  await applyMigrations(logger1, configPath, [], context1)

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
    await unlink(expectedFile).catch(() => {})
  })

  const stats1 = await stat(expectedFile)

  const logger2 = createCapturingLogger()
  const context2 = createTestContext()
  await applyMigrations(logger2, configPath, [], context2)

  const stats2 = await stat(expectedFile)

  assert.deepEqual(stats1.mtime, stats2.mtime)
})
