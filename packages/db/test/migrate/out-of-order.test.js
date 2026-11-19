import { createConnectionPool } from '@platformatic/sql-mapper'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { Migrator } from '../../lib/migrator.js'
import { createCapturingLogger, createTestContext } from '../cli/test-utilities.js'
import { getConnectionInfo, isPg } from '../helper.js'

const nullLogger = { debug () {}, trace () {}, info () {}, warn () {}, error () {} }

async function makeMigrationsDir (t, files) {
  const dir = await mkdtemp(join(tmpdir(), 'plt-db-out-of-order-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content)
  }
  return dir
}

// The state a database is left in when a branch holding 001 and 003 is
// applied before the branch holding 002 arrives.
async function setup (t, migrationsConfig = {}) {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const coreConfig = { connectionString: connectionInfo.connectionString }

  // Every connection is closed before the test database is dropped.
  const migrators = []
  t.after(async () => {
    for (const migrator of migrators) {
      await migrator.close()
    }
    await dropTestDB()
  })

  const dir = await makeMigrationsDir(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '001.undo.sql': 'DROP TABLE test1;',
    '003.do.sql': 'CREATE TABLE test3 (id INTEGER);',
    '003.undo.sql': 'DROP TABLE test3;'
  })

  function createMigrator (config = {}) {
    const migrator = new Migrator({ dir, ...migrationsConfig, ...config }, coreConfig, nullLogger)
    migrators.push(migrator)
    return migrator
  }

  await createMigrator({ outOfOrder: 'ignore' }).applyMigrations()

  await writeFile(join(dir, '002.do.sql'), 'CREATE TABLE test2 (id INTEGER);')
  await writeFile(join(dir, '002.undo.sql'), 'DROP TABLE test2;')

  async function read (query) {
    const { db, sql } = await createConnectionPool({ ...coreConfig, log: nullLogger })
    try {
      return await db.query(sql`${sql.__dangerous__rawValue(query)}`)
    } finally {
      await db.dispose()
    }
  }

  async function appliedVersions (table = 'versions') {
    const rows = await read(`SELECT version FROM ${table} ORDER BY version`)
    return rows.map(row => Number(row.version)).filter(version => version > 0)
  }

  async function tableExists (name) {
    try {
      await read(`SELECT 1 FROM ${name} LIMIT 0`)
      return true
    } catch (err) {
      // Only a missing table means the migration did not run: PostgreSQL's
      // undefined_table, MySQL's and MariaDB's error, SQLite's message.
      if (err.code === '42P01' || err.code === 'ER_NO_SUCH_TABLE' || /no such table/i.test(err.message)) return false
      throw err
    }
  }

  return { dir, connectionInfo, createMigrator, appliedVersions, tableExists }
}

function isOutOfOrderError (databaseVersion, files) {
  return err => {
    assert.equal(err.code, 'PLT_DB_OUT_OF_ORDER_MIGRATIONS_ERROR')
    assert.deepEqual(err.appliedMigrations, [])
    assert.equal(
      err.message,
      `Found migrations below the current database version ${databaseVersion} that are not recorded as applied: ${files}. See the "migrations.outOfOrder" option.`
    )
    return true
  }
}

test('by default a migration below the database version is reported', async t => {
  const { createMigrator, appliedVersions, tableExists } = await setup(t)
  const migrator = createMigrator()

  assert.equal(migrator.outOfOrder, 'error')
  assert.equal(await migrator.hasMigrationsToApply(), true)
  await assert.rejects(migrator.applyMigrations(), isOutOfOrderError(3, '002.do.sql'))

  assert.equal(migrator.appliedMigrationsCount, 0)
  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test2'), false)
})

// The check scans the recorded versions through postgrator.runQuery(), which
// nothing else in the migrator or in Postgrator itself calls. The lookup of
// the database version goes through Postgrator's own client and is not
// counted here.
async function countHistoryScans (migrator, fn) {
  await migrator.setupPostgrator()
  const runQuery = migrator.postgrator.runQuery.bind(migrator.postgrator)
  let scans = 0
  migrator.postgrator.runQuery = query => {
    scans++
    return runQuery(query)
  }
  await fn()
  return scans
}

test('outOfOrder: "ignore" skips the migration and does not scan the recorded versions', async t => {
  const { createMigrator, appliedVersions, tableExists } = await setup(t)
  const migrator = createMigrator({ outOfOrder: 'ignore' })

  const scans = await countHistoryScans(migrator, async () => {
    assert.equal(await migrator.hasMigrationsToApply(), false)
    await migrator.applyMigrations()
  })

  assert.equal(scans, 0)
  assert.equal(migrator.appliedMigrationsCount, 0)
  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test2'), false)
})

test('outOfOrder: "error" scans the recorded versions once per apply', async t => {
  const { dir, createMigrator } = await setup(t)
  await rm(join(dir, '002.do.sql'))
  const migrator = createMigrator({ outOfOrder: 'error' })

  assert.equal(await countHistoryScans(migrator, () => migrator.applyMigrations()), 1)
})

test('outOfOrder: "error" refuses to migrate and names the file', async t => {
  const { dir, createMigrator, appliedVersions, tableExists } = await setup(t)
  const migrator = createMigrator({ outOfOrder: 'error' })

  // Nothing is pending above the database version: only the skipped file.
  assert.equal(await migrator.hasMigrationsToApply(), true)
  await assert.rejects(migrator.applyMigrations(), isOutOfOrderError(3, '002.do.sql'))

  // A pending migration does not run either: the error comes first.
  await writeFile(join(dir, '004.do.sql'), 'CREATE TABLE test4 (id INTEGER);')
  await assert.rejects(createMigrator({ outOfOrder: 'error' }).applyMigrations(), isOutOfOrderError(3, '002.do.sql'))

  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test2'), false)
  assert.equal(await tableExists('test4'), false)
})

test('outOfOrder: "error" lists several files in version order', async t => {
  const { dir, createMigrator, appliedVersions } = await setup(t)

  await writeFile(join(dir, '11.do.sql'), 'CREATE TABLE test11 (id INTEGER);')
  await createMigrator({ outOfOrder: 'ignore' }).applyMigrations()
  assert.deepEqual(await appliedVersions(), [1, 3, 11])

  // Names whose alphabetical order is not their version order.
  await writeFile(join(dir, '9.do.sql'), 'CREATE TABLE test9 (id INTEGER);')
  await writeFile(join(dir, '10.do.sql'), 'CREATE TABLE test10 (id INTEGER);')
  await assert.rejects(
    createMigrator({ outOfOrder: 'error' }).applyMigrations(),
    isOutOfOrderError(11, '002.do.sql, 9.do.sql, 10.do.sql')
  )
})

test('outOfOrder: "error" reports a JS migration without generating its SQL', async t => {
  const { dir, createMigrator } = await setup(t)
  await rm(join(dir, '002.do.sql'))
  await writeFile(
    join(dir, '002.do.mjs'),
    "export function generateSql () { throw new Error('generateSql must not be called') }\n"
  )

  await assert.rejects(createMigrator({ outOfOrder: 'error' }).applyMigrations(), isOutOfOrderError(3, '002.do.mjs'))
})

test('outOfOrder: "error" leaves checksum validation to Postgrator when nothing is out of order', async t => {
  const { dir, createMigrator, appliedVersions } = await setup(t)
  await rm(join(dir, '002.do.sql'))
  await writeFile(join(dir, '001.do.sql'), 'CREATE TABLE test1 (id INTEGER, name TEXT);')
  await writeFile(join(dir, '004.do.sql'), 'CREATE TABLE test4 (id INTEGER);')

  await assert.rejects(createMigrator({ outOfOrder: 'error' }).applyMigrations(), /checksum/i)
  assert.deepEqual(await appliedVersions(), [1, 3])
})

// Postgrator's migrate() adds an appliedMigrations field to every error it
// throws. The check runs before it and keeps that shape.
test('outOfOrder: "error" keeps the shape of an error from reading the files', async t => {
  const { dir, createMigrator } = await setup(t)
  await writeFile(join(dir, '004.do.first.sql'), 'CREATE TABLE test4 (id INTEGER);')
  await writeFile(join(dir, '004.do.second.sql'), 'CREATE TABLE test4 (id INTEGER);')

  for (const outOfOrder of ['ignore', 'error']) {
    await assert.rejects(createMigrator({ outOfOrder }).applyMigrations(), err => {
      assert.match(err.message, /Two migrations found with version 4 and action do/)
      assert.deepEqual(err.appliedMigrations, [])
      return true
    })
  }
})

test('outOfOrder: "error" keeps the shape of an error from reading the database', async t => {
  const { createMigrator } = await setup(t)

  for (const method of ['getDatabaseVersion', 'runQuery']) {
    const migrator = createMigrator({ outOfOrder: 'error' })
    await migrator.setupPostgrator()
    migrator.postgrator[method] = async () => {
      throw new Error(`${method} failed`)
    }

    await assert.rejects(migrator.applyMigrations(), err => {
      assert.equal(err.message, `${method} failed`)
      assert.deepEqual(err.appliedMigrations, [])
      return true
    })
  }
})

test('outOfOrder: "error" decorates an error exactly as Postgrator does', async t => {
  const { createMigrator } = await setup(t)

  // A value the error already carries is kept, as in Postgrator's migrate().
  const decorated = Object.assign(new Error('already decorated'), { appliedMigrations: ['from elsewhere'] })
  // An error that cannot take the field reaches the caller unchanged.
  const frozen = Object.freeze(new Error('frozen'))

  for (const error of [decorated, frozen]) {
    const migrator = createMigrator({ outOfOrder: 'error' })
    await migrator.setupPostgrator()
    migrator.postgrator.getDatabaseVersion = async () => {
      throw error
    }

    await assert.rejects(migrator.applyMigrations(), err => {
      assert.equal(err, error)
      return true
    })
  }

  assert.deepEqual(decorated.appliedMigrations, ['from elsewhere'])
  assert.equal(frozen.appliedMigrations, undefined)
})

test('outOfOrder: "error" does not depend on checksum validation', async t => {
  const { createMigrator } = await setup(t, { validateChecksums: false })

  await assert.rejects(createMigrator({ outOfOrder: 'error' }).applyMigrations(), isOutOfOrderError(3, '002.do.sql'))
})

test('outOfOrder: "error" passes when every migration below the database version is applied', async t => {
  const { dir, createMigrator, appliedVersions } = await setup(t)

  // An undo file below the database version is not a missing migration.
  await rm(join(dir, '002.do.sql'))
  const migrator = createMigrator({ outOfOrder: 'error' })
  assert.equal(await migrator.hasMigrationsToApply(), false)

  await writeFile(join(dir, '004.do.sql'), 'CREATE TABLE test4 (id INTEGER);')
  assert.equal(await migrator.hasMigrationsToApply(), true)
  await migrator.applyMigrations()

  assert.equal(migrator.appliedMigrationsCount, 1)
  assert.deepEqual(await appliedVersions(), [1, 3, 4])
})

test('outOfOrder: "error" resolves the target as Postgrator does', async t => {
  const { createMigrator, appliedVersions } = await setup(t)

  for (const to of ['max', 'MAX', ' max ', ' ', '003', '3']) {
    await assert.rejects(
      createMigrator({ outOfOrder: 'error' }).applyMigrations(to),
      isOutOfOrderError(3, '002.do.sql'),
      `target ${JSON.stringify(to)}`
    )
  }

  // Postgrator runs nothing for a target that is not a number, and refuses
  // one that is not a string: neither is the check's to report.
  await createMigrator({ outOfOrder: 'error' }).applyMigrations('typo')
  await assert.rejects(createMigrator({ outOfOrder: 'error' }).applyMigrations(null), err => {
    assert.notEqual(err.code, 'PLT_DB_OUT_OF_ORDER_MIGRATIONS_ERROR')
    return true
  })

  assert.deepEqual(await appliedVersions(), [1, 3])
})

test('outOfOrder: "error" reads a numeric target in its original spelling', async t => {
  const { dir, createMigrator, appliedVersions, tableExists } = await setup(t)
  await writeFile(join(dir, '004.do.sql'), 'CREATE TABLE test4 (id INTEGER);')

  // Postgrator turns the target into a number without lowering its case, so
  // "Infinity" moves forward to the highest file.
  await assert.rejects(
    createMigrator({ outOfOrder: 'error' }).applyMigrations('Infinity'),
    isOutOfOrderError(3, '002.do.sql')
  )

  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test4'), false)
})

test('outOfOrder: "error" reads the files again on a reused migrator', async t => {
  const { dir, createMigrator, appliedVersions, tableExists } = await setup(t)
  const migrator = createMigrator({ outOfOrder: 'error' })

  // The files end at 002 when the migrator first reads them.
  await rm(join(dir, '003.do.sql'))
  await rm(join(dir, '003.undo.sql'))
  assert.equal(await migrator.hasMigrationsToApply(), true)

  await writeFile(join(dir, '004.do.sql'), 'CREATE TABLE test4 (id INTEGER);')
  await assert.rejects(migrator.applyMigrations(), isOutOfOrderError(3, '002.do.sql'))

  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test4'), false)
})

test('outOfOrder: "error" does not block a rollback to a version', async t => {
  const { createMigrator, appliedVersions } = await setup(t)

  // The skipped 002 is below the database version and the target is lower.
  await createMigrator({ outOfOrder: 'error' }).applyMigrations('002')
  assert.deepEqual(await appliedVersions(), [1])
})

test('outOfOrder: "error" does not change a rollback that crosses the skipped migration', async t => {
  const { dir, createMigrator, appliedVersions, tableExists } = await setup(t)

  // Postgrator selects undo files by version: the undo of 002 runs although
  // 002 has no row, exactly as it does without the option.
  await writeFile(join(dir, '002.undo.sql'), 'CREATE TABLE undo2 (id INTEGER);')
  await createMigrator({ outOfOrder: 'error' }).applyMigrations('001')

  assert.deepEqual(await appliedVersions(), [1])
  assert.equal(await tableExists('undo2'), true)
})

test('outOfOrder: "error" does not block the rollback of one migration', async t => {
  const { createMigrator, appliedVersions } = await setup(t)

  await createMigrator({ outOfOrder: 'error' }).rollbackMigration()
  assert.deepEqual(await appliedVersions(), [1])
})

test('outOfOrder: "error" does not block when the files end below the database version', async t => {
  const { dir, createMigrator, appliedVersions } = await setup(t)

  // The highest file is now 002, below the database version: Postgrator
  // treats that as a rollback, so the skipped 002 is not reported.
  await rm(join(dir, '003.do.sql'))
  await rm(join(dir, '003.undo.sql'))
  await createMigrator({ outOfOrder: 'error' }).applyMigrations()
  assert.deepEqual(await appliedVersions(), [1, 3])

  // Applying to the current database version is not a rollback and reports it.
  await assert.rejects(
    createMigrator({ outOfOrder: 'error' }).applyMigrations('003'),
    isOutOfOrderError(3, '002.do.sql')
  )
  assert.deepEqual(await appliedVersions(), [1, 3])
})

test('outOfOrder: "error" reads a custom versions table', async t => {
  const { createMigrator, appliedVersions } = await setup(t, { table: 'custom_versions' })

  await assert.rejects(createMigrator({ outOfOrder: 'error' }).applyMigrations(), isOutOfOrderError(3, '002.do.sql'))
  assert.deepEqual(await appliedVersions('custom_versions'), [1, 3])
})

test('outOfOrder: "error" reads a schema qualified versions table', { skip: !isPg }, async t => {
  const dir = await makeMigrationsDir(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '003.do.sql': 'CREATE TABLE test3 (id INTEGER);'
  })
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const coreConfig = { connectionString: connectionInfo.connectionString }

  const migrators = []
  t.after(async () => {
    for (const migrator of migrators) {
      await migrator.close()
    }
    await dropTestDB()
  })
  function createMigrator (outOfOrder) {
    const migrator = new Migrator({ dir, table: 'Audit.Versions', outOfOrder }, coreConfig, nullLogger)
    migrators.push(migrator)
    return migrator
  }

  const { db, sql } = await createConnectionPool({ ...coreConfig, log: nullLogger })
  try {
    await db.query(sql`CREATE SCHEMA "Audit"`)
  } finally {
    await db.dispose()
  }

  await createMigrator('ignore').applyMigrations()
  await writeFile(join(dir, '002.do.sql'), 'CREATE TABLE test2 (id INTEGER);')

  await assert.rejects(createMigrator('error').applyMigrations(), isOutOfOrderError(3, '002.do.sql'))
})

test('outOfOrder: "error" reads the versions table through currentSchema', { skip: !isPg }, async t => {
  const dir = await makeMigrationsDir(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '003.do.sql': 'CREATE TABLE test3 (id INTEGER);'
  })
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const coreConfig = { connectionString: connectionInfo.connectionString }

  const migrators = []
  t.after(async () => {
    for (const migrator of migrators) {
      await migrator.close()
    }
    await dropTestDB()
  })
  function createMigrator (outOfOrder) {
    const migrator = new Migrator({ dir, currentSchema: 'audit', outOfOrder }, coreConfig, nullLogger)
    migrators.push(migrator)
    return migrator
  }

  const { db, sql } = await createConnectionPool({ ...coreConfig, log: nullLogger })
  try {
    await db.query(sql`CREATE SCHEMA audit`)
    await createMigrator('ignore').applyMigrations()
    const rows = await db.query(sql`SELECT version FROM audit.versions WHERE version > 0 ORDER BY version`)
    assert.deepEqual(rows.map(row => Number(row.version)), [1, 3])
  } finally {
    await db.dispose()
  }

  await writeFile(join(dir, '002.do.sql'), 'CREATE TABLE test2 (id INTEGER);')
  await assert.rejects(createMigrator('error').applyMigrations(), isOutOfOrderError(3, '002.do.sql'))
})

test('outOfOrder: "error" on a database with no migrations applied yet', async t => {
  const dir = await makeMigrationsDir(t, {
    '001.do.sql': 'CREATE TABLE test1 (id INTEGER);',
    '002.do.sql': 'CREATE TABLE test2 (id INTEGER);'
  })
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const migrator = new Migrator(
    { dir, outOfOrder: 'error' },
    { connectionString: connectionInfo.connectionString },
    nullLogger
  )
  t.after(async () => {
    await migrator.close()
    await dropTestDB()
  })

  assert.equal(await migrator.hasMigrationsToApply(), true)
  await migrator.applyMigrations()
  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.equal(await migrator.hasMigrationsToApply(), false)
})

test('the migrations apply command reports the files and applies nothing', async t => {
  const { dir, connectionInfo, appliedVersions, tableExists } = await setup(t)

  const root = await mkdtemp(join(tmpdir(), 'plt-db-out-of-order-config-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const configFile = join(root, 'platformatic.json')
  await writeFile(
    configFile,
    JSON.stringify({
      server: { hostname: '127.0.0.1', port: 0 },
      db: { connectionString: connectionInfo.connectionString },
      migrations: { dir, outOfOrder: 'error' }
    })
  )
  await writeFile(join(dir, '004.do.sql'), 'CREATE TABLE test4 (id INTEGER);')

  const logger = createCapturingLogger()
  const context = createTestContext()
  const fatalErrors = []
  context.logFatalError = (_, message) => {
    fatalErrors.push(message)
    return false
  }
  await applyMigrations(logger, configFile, [], context)

  // The command reports it through the fatal error path, which is the one
  // that sets a failing exit code.
  assert.equal(fatalErrors.length, 1)
  assert.match(
    fatalErrors[0],
    /Found migrations below the current database version 3 that are not recorded as applied: 002\.do\.sql/
  )
  assert.deepEqual(await appliedVersions(), [1, 3])
  assert.equal(await tableExists('test4'), false)
})
