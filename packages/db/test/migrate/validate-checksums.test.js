import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Migrator } from '../../lib/migrator.js'
import { getConnectionInfo } from '../helper.js'

const nullLogger = { debug () {}, info () {}, warn () {}, error () {} }

async function makeMigrationsDir (files) {
  const dir = await mkdtemp(join(tmpdir(), 'plt-db-checksums-'))
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content)
  }
  return dir
}

const baseMigrations = {
  '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
  '001.undo.sql': 'DROP TABLE test1;'
}

test('validateChecksums defaults to true (no undefined leaks into Postgrator)', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  t.after(() => dropTestDB())

  const migrationDir = await makeMigrationsDir(baseMigrations)
  const migrator = new Migrator({ dir: migrationDir }, { connectionString: connectionInfo.connectionString }, nullLogger)
  t.after(() => migrator.close())

  await migrator.setupPostgrator()

  // Before the fix this was `undefined`, which overrode Postgrator's own
  // `true` default and silently disabled checksum validation.
  assert.equal(migrator.postgrator.config.validateChecksums, true)
})

test('validateChecksums: false is still honoured (escape hatch)', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  t.after(() => dropTestDB())

  const migrationDir = await makeMigrationsDir(baseMigrations)
  const migrator = new Migrator(
    { dir: migrationDir, validateChecksums: false },
    { connectionString: connectionInfo.connectionString },
    nullLogger
  )
  t.after(() => migrator.close())

  await migrator.setupPostgrator()

  assert.equal(migrator.postgrator.config.validateChecksums, false)
})

test('by default a changed already-applied migration fails with a checksum error', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  t.after(() => dropTestDB())
  const coreConfig = { connectionString: connectionInfo.connectionString }

  const migrationDir = await makeMigrationsDir(baseMigrations)

  // Apply migration 001.
  const first = new Migrator({ dir: migrationDir }, coreConfig, nullLogger)
  await first.applyMigrations()
  await first.close()

  // Tamper the already-applied file and add a later migration so that
  // Postgrator validates the applied history before running the new one.
  await writeFile(join(migrationDir, '001.do.sql'), 'CREATE TABLE test1 (id INTEGER, name TEXT);')
  await writeFile(join(migrationDir, '002.do.sql'), 'CREATE TABLE test2 (id INTEGER);')
  await writeFile(join(migrationDir, '002.undo.sql'), 'DROP TABLE test2;')

  const second = new Migrator({ dir: migrationDir }, coreConfig, nullLogger)
  t.after(() => second.close())

  await assert.rejects(second.applyMigrations(), /checksum/i)
})

test('with validateChecksums: false a changed already-applied migration is not flagged', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  t.after(() => dropTestDB())
  const coreConfig = { connectionString: connectionInfo.connectionString }

  const migrationDir = await makeMigrationsDir(baseMigrations)

  const first = new Migrator({ dir: migrationDir, validateChecksums: false }, coreConfig, nullLogger)
  await first.applyMigrations()
  await first.close()

  await writeFile(join(migrationDir, '001.do.sql'), 'CREATE TABLE test1 (id INTEGER, name TEXT);')
  await writeFile(join(migrationDir, '002.do.sql'), 'CREATE TABLE test2 (id INTEGER);')
  await writeFile(join(migrationDir, '002.undo.sql'), 'DROP TABLE test2;')

  const second = new Migrator({ dir: migrationDir, validateChecksums: false }, coreConfig, nullLogger)
  t.after(() => second.close())

  await assert.doesNotReject(second.applyMigrations())
})
