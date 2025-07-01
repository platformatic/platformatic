'use strict'

const { execa } = require('execa')
const assert = require('node:assert/strict')
const { readFile, stat, unlink, writeFile } = require('node:fs/promises')
const { dirname, join } = require('node:path')
const { test } = require('node:test')
const split = require('split2')
const { getConnectionInfo } = require('../helper.js')
const { cliPath, connectDB, getFixturesConfigFileLocation, startPath } = require('./helper.js')

test('migrate creates a schema.lock file on a different path', { skip: true }, async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  const configPath = getFixturesConfigFileLocation('schemalock.json')
  const expectedFile = join(dirname(configPath), 'schema.lock')

  try {
    await unlink(expectedFile)
  } catch {}

  await execa('node', [cliPath, 'applyMigrations', configPath], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

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

  await execa('node', [cliPath, 'applyMigrations', configPathWithoutSchemaLock], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

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

  await execa('node', [cliPath, 'applyMigrations', configPath], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
    await unlink(expectedFile).catch(() => {})
  })

  const stats1 = await stat(expectedFile)

  await execa('node', [cliPath, 'applyMigrations', configPath], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  const stats2 = await stat(expectedFile)

  assert.deepEqual(stats1.mtime, stats2.mtime)
})
