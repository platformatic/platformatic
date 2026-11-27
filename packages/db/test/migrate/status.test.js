import { logFatalError, parseArgs } from '@platformatic/foundation'
import { createConnectionPool } from '@platformatic/sql-mapper'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import Postgrator from 'postgrator'
import { migrationsStatus } from '../../lib/commands/migrations-status.js'
import { Migrator } from '../../lib/migrator.js'
import { createCapturingLogger, createTestContext } from '../cli/test-utilities.js'
import { getConnectionInfo } from '../helper.js'

const nullLogger = { debug () {}, trace () {}, info () {}, warn () {}, error () {} }

// A database and an empty migrations directory. `apply` runs the files that
// are in the directory at that moment, without the out of order check.
async function setup (t) {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const coreConfig = { connectionString: connectionInfo.connectionString }

  const dir = await mkdtemp(join(tmpdir(), 'plt-db-status-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  // Every connection is closed before the test database is dropped.
  const migrators = []
  t.after(async () => {
    for (const migrator of migrators) {
      await migrator.close()
    }
    await dropTestDB()
  })

  function createMigrator (config = {}) {
    const migrator = new Migrator({ dir, ...config }, coreConfig, nullLogger)
    migrators.push(migrator)
    return migrator
  }

  async function addMigration (version, extension = 'sql') {
    const table = `test${Number(version)}`
    await writeFile(
      join(dir, `${version}.do.${extension}`),
      extension === 'sql'
        ? `CREATE TABLE ${table} (id INTEGER);`
        : `export function generateSql () { return 'CREATE TABLE ${table} (id INTEGER);' }\n`
    )
    await writeFile(join(dir, `${version}.undo.sql`), `DROP TABLE ${table};`)
  }

  async function apply (to) {
    await createMigrator({ outOfOrder: 'ignore' }).applyMigrations(to)
  }

  async function read (query) {
    const { db, sql } = await createConnectionPool({ ...coreConfig, log: nullLogger })
    try {
      return await db.query(sql`${sql.__dangerous__rawValue(query)}`)
    } finally {
      await db.dispose()
    }
  }

  async function tableExists (name) {
    try {
      await read(`SELECT 1 FROM ${name} LIMIT 0`)
      return true
    } catch (err) {
      // Only a missing table counts: PostgreSQL's undefined_table, MySQL's
      // and MariaDB's error, SQLite's message.
      if (err.code === '42P01' || err.code === 'ER_NO_SUCH_TABLE' || /no such table/i.test(err.message)) return false
      throw err
    }
  }

  async function writeConfig (migrationsConfig = {}) {
    const root = await mkdtemp(join(tmpdir(), 'plt-db-status-config-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    const configFile = join(root, 'platformatic.json')
    await writeFile(
      configFile,
      JSON.stringify({
        server: { hostname: '127.0.0.1', port: 0 },
        db: { connectionString: connectionInfo.connectionString },
        migrations: { dir, ...migrationsConfig }
      })
    )
    return configFile
  }

  return { dir, createMigrator, addMigration, apply, read, tableExists, writeConfig }
}

// Runs the command and returns what it printed, what it reported as a fatal
// error and the exit code it asked for.
async function runCommand (t, configFile, args = []) {
  const previousExitCode = process.exitCode
  const log = console.log
  const lines = []
  const fatalErrors = []
  console.log = line => lines.push(line)
  process.exitCode = undefined

  // The fatal error handler of the CLI, which is the one that sets the exit code.
  const logger = createCapturingLogger()
  logger.fatal = message => fatalErrors.push(message)
  const context = { ...createTestContext(), parseArgs, logFatalError }

  try {
    await migrationsStatus(logger, configFile, args, context)
    return { output: lines.join('\n'), fatalErrors, exitCode: process.exitCode }
  } finally {
    console.log = log
    process.exitCode = previousExitCode
  }
}

test('a database without a versions table reports every migration as pending and creates nothing', async t => {
  const { createMigrator, addMigration, tableExists } = await setup(t)
  await addMigration('001')
  await addMigration('002')

  assert.deepEqual(await createMigrator().getStatus(), {
    databaseVersion: 0,
    upToDate: false,
    migrations: [
      { version: 1, file: '001.do.sql', status: 'pending' },
      { version: 2, file: '002.do.sql', status: 'pending' }
    ]
  })

  assert.equal(await tableExists('versions'), false)
  assert.equal(await tableExists('test1'), false)
})

test('an empty migrations directory is up to date', async t => {
  const { createMigrator } = await setup(t)

  assert.deepEqual(await createMigrator().getStatus(), { databaseVersion: 0, upToDate: true, migrations: [] })
})

test('applied migrations are up to date and a new file is pending', async t => {
  const { createMigrator, addMigration, apply } = await setup(t)
  await addMigration('001')
  await addMigration('002')
  await apply()

  assert.deepEqual(await createMigrator().getStatus(), {
    databaseVersion: 2,
    upToDate: true,
    migrations: [
      { version: 1, file: '001.do.sql', status: 'applied' },
      { version: 2, file: '002.do.sql', status: 'applied' }
    ]
  })

  await addMigration('003')

  const migrator = createMigrator()
  const status = await migrator.getStatus()
  assert.equal(status.upToDate, false)
  assert.deepEqual(status.migrations[2], { version: 3, file: '003.do.sql', status: 'pending' })
  assert.equal(await migrator.hasMigrationsToApply(), true)
})

test('a migration rolled back is pending again', async t => {
  const { createMigrator, addMigration, apply } = await setup(t)
  await addMigration('001')
  await addMigration('002')
  await apply()
  await apply('001')

  assert.deepEqual(await createMigrator().getStatus(), {
    databaseVersion: 1,
    upToDate: false,
    migrations: [
      { version: 1, file: '001.do.sql', status: 'applied' },
      { version: 2, file: '002.do.sql', status: 'pending' }
    ]
  })

  await apply('000')

  const status = await createMigrator().getStatus()
  assert.equal(status.databaseVersion, 0)
  assert.deepEqual(
    status.migrations.map(migration => migration.status),
    ['pending', 'pending']
  )
})

test('a file below the database version with no row is out of order', async t => {
  const { createMigrator, addMigration, apply } = await setup(t)
  await addMigration('001')
  await addMigration('003')
  await apply()
  await addMigration('002')

  const expected = [
    { version: 1, file: '001.do.sql', status: 'applied' },
    { version: 2, file: '002.do.sql', status: 'out-of-order' },
    { version: 3, file: '003.do.sql', status: 'applied' }
  ]

  // Whether it counts follows the option, as it does when applying.
  for (const [outOfOrder, upToDate] of [
    [undefined, false],
    ['error', false],
    ['ignore', true]
  ]) {
    const migrator = createMigrator({ outOfOrder })
    assert.deepEqual(await migrator.getStatus(), { databaseVersion: 3, upToDate, migrations: expected })
    assert.equal(await migrator.hasMigrationsToApply(), !upToDate)
  }
})

test('a recorded version with no file is reported and does not count', async t => {
  const { dir, createMigrator, addMigration, apply } = await setup(t)
  await addMigration('001')
  await addMigration('002')
  await apply()
  await rm(join(dir, '001.do.sql'))

  // The undo file of version 1 is still there: only a `do` file counts.
  const migrator = createMigrator()
  assert.deepEqual(await migrator.getStatus(), {
    databaseVersion: 2,
    upToDate: true,
    migrations: [
      { version: 1, file: null, status: 'missing-file' },
      { version: 2, file: '002.do.sql', status: 'applied' }
    ]
  })
  assert.equal(await migrator.hasMigrationsToApply(), false)
})

// hasMigrationsToApply() counts every file above the database version,
// whatever its action. The list has `do` files only, and the answer agrees.
test('an undo file above the database version counts as it does for hasMigrationsToApply()', async t => {
  const { dir, createMigrator, addMigration, apply } = await setup(t)
  await addMigration('001')
  await apply()
  await writeFile(join(dir, '002.undo.sql'), 'DROP TABLE test2;')

  const migrator = createMigrator()
  assert.deepEqual(await migrator.getStatus(), {
    databaseVersion: 1,
    upToDate: false,
    migrations: [{ version: 1, file: '001.do.sql', status: 'applied' }]
  })
  assert.equal(await migrator.hasMigrationsToApply(), true)
})

// Between the read of the database version and the read of the rows another
// run can end. The version reported is the one of the rows.
test('the database version is the highest of the rows the files are compared with', async t => {
  const { createMigrator, addMigration, apply } = await setup(t)
  await addMigration('001')
  await addMigration('002')
  await apply()

  // The first read answers as if it came before the end of the other run.
  const firstRead = t.mock.method(Postgrator.prototype, 'getDatabaseVersion', async () => 1)

  assert.deepEqual(await createMigrator().getStatus(), {
    databaseVersion: 2,
    upToDate: true,
    migrations: [
      { version: 1, file: '001.do.sql', status: 'applied' },
      { version: 2, file: '002.do.sql', status: 'applied' }
    ]
  })
  assert.equal(firstRead.mock.callCount(), 1)
})

// Postgrator never runs a file of version 0, and writes a row of version 0
// when it creates the versions table.
test('version 0 is not a migration, as a file or as a row', async t => {
  const { createMigrator, addMigration, apply } = await setup(t)
  await addMigration('000')

  const migrator = createMigrator()
  assert.deepEqual(await migrator.getStatus(), { databaseVersion: 0, upToDate: true, migrations: [] })
  assert.equal(await migrator.hasMigrationsToApply(), false)

  await addMigration('001')
  await apply()

  assert.deepEqual(await createMigrator().getStatus(), {
    databaseVersion: 1,
    upToDate: true,
    migrations: [{ version: 1, file: '001.do.sql', status: 'applied' }]
  })
})

test('migrations are listed in version order, whatever their names', async t => {
  const { dir, createMigrator, addMigration, apply } = await setup(t)
  await addMigration('9')
  await addMigration('10')
  await apply()
  await addMigration('2')
  await addMigration('11', 'mjs')
  // A JS migration is listed without its SQL being generated.
  await writeFile(join(dir, '11.do.mjs'), "export function generateSql () { throw new Error('not called') }\n")

  const status = await createMigrator().getStatus()
  assert.deepEqual(status.migrations, [
    { version: 2, file: '2.do.sql', status: 'out-of-order' },
    { version: 9, file: '9.do.sql', status: 'applied' },
    { version: 10, file: '10.do.sql', status: 'applied' },
    { version: 11, file: '11.do.mjs', status: 'pending' }
  ])
})

test('the status reads a versions table with another name', async t => {
  const { createMigrator, addMigration, tableExists } = await setup(t)
  await addMigration('001')
  await createMigrator({ table: 'my_versions' }).applyMigrations()
  await addMigration('002')

  assert.deepEqual(await createMigrator({ table: 'my_versions' }).getStatus(), {
    databaseVersion: 1,
    upToDate: false,
    migrations: [
      { version: 1, file: '001.do.sql', status: 'applied' },
      { version: 2, file: '002.do.sql', status: 'pending' }
    ]
  })
  assert.equal(await tableExists('versions'), false)
})

test('the status changes nothing in the database', async t => {
  const { createMigrator, addMigration, apply, read, tableExists } = await setup(t)
  await addMigration('001')
  await addMigration('003')
  await apply()
  await addMigration('002')
  await addMigration('004')

  const before = await read('SELECT version, md5 FROM versions ORDER BY version')
  await createMigrator().getStatus()

  assert.deepEqual(await read('SELECT version, md5 FROM versions ORDER BY version'), before)
  assert.equal(await tableExists('test2'), false)
  assert.equal(await tableExists('test4'), false)
})

test('the migrations status command prints a table and asks for exit code 1 when not up to date', async t => {
  const { dir, addMigration, apply, writeConfig } = await setup(t)
  await addMigration('001')
  await addMigration('003')
  await addMigration('005')
  await apply()
  await addMigration('002')
  await addMigration('006')
  await rm(join(dir, '005.do.sql'))

  const { output, fatalErrors, exitCode } = await runCommand(t, await writeConfig())

  assert.equal(
    output,
    [
      'Database version: 5',
      '',
      'Version  File        Status',
      '1        001.do.sql  applied',
      '2        002.do.sql  out of order',
      '3        003.do.sql  applied',
      '5                    applied, file missing',
      '6        006.do.sql  pending'
    ].join('\n')
  )
  assert.deepEqual(fatalErrors, [])
  assert.equal(exitCode, 1)
})

test('the migrations status command leaves the exit code alone when up to date', async t => {
  const { addMigration, apply, writeConfig } = await setup(t)
  await addMigration('001')
  await addMigration('003')
  await apply()

  const upToDate = await runCommand(t, await writeConfig())
  assert.match(upToDate.output, /^Database version: 3\n/)
  assert.equal(upToDate.exitCode, undefined)

  await addMigration('002')

  assert.equal((await runCommand(t, await writeConfig())).exitCode, 1)
  assert.equal((await runCommand(t, await writeConfig({ outOfOrder: 'ignore' }))).exitCode, undefined)
})

test('the migrations status command prints JSON with --json', async t => {
  const { addMigration, apply, writeConfig } = await setup(t)
  await addMigration('001')
  await apply()
  await addMigration('002')
  const configFile = await writeConfig()

  for (const flag of ['--json', '-j']) {
    const { output, exitCode } = await runCommand(t, configFile, [flag])

    assert.deepEqual(JSON.parse(output), {
      databaseVersion: 1,
      upToDate: false,
      migrations: [
        { version: 1, file: '001.do.sql', status: 'applied' },
        { version: 2, file: '002.do.sql', status: 'pending' }
      ]
    })
    assert.equal(exitCode, 1)
  }
})

test('the migrations status command reports a missing migrations directory as a fatal error', async t => {
  const { dir, writeConfig } = await setup(t)
  const configFile = await writeConfig({ dir: join(dir, 'nowhere') })

  const { output, fatalErrors, exitCode } = await runCommand(t, configFile)

  assert.equal(output, '')
  assert.equal(exitCode, 1)
  assert.equal(fatalErrors.length, 1)
  assert.match(fatalErrors[0], /Migrations directory .*nowhere does not exist/)
})

// A SQLite file in a new folder, whatever database the suite runs on.
async function setupSQLiteFile (t) {
  const root = await mkdtemp(join(tmpdir(), 'plt-db-status-sqlite-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  const dir = join(root, 'migrations')
  await mkdir(dir)
  await writeFile(join(dir, '001.do.sql'), 'CREATE TABLE test1 (id INTEGER);')

  const connectionString = `sqlite://${join(root, 'db.sqlite')}`

  async function withMigrator (migrationsDir, fn) {
    const migrator = new Migrator({ dir: migrationsDir }, { connectionString }, nullLogger)
    try {
      return await fn(migrator)
    } finally {
      await migrator.close()
    }
  }

  return { root, dir, connectionString, withMigrator }
}

test('a SQLite database file is not written to when the status is read', async t => {
  const { root, dir, withMigrator } = await setupSQLiteFile(t)
  await withMigrator(dir, migrator => migrator.applyMigrations())
  await writeFile(join(dir, '002.do.sql'), 'CREATE TABLE test2 (id INTEGER);')

  const file = join(root, 'db.sqlite')
  const before = await readFile(file)
  const status = await withMigrator(dir, migrator => migrator.getStatus())

  assert.deepEqual(status.migrations, [
    { version: 1, file: '001.do.sql', status: 'applied' },
    { version: 2, file: '002.do.sql', status: 'pending' }
  ])
  assert.deepEqual(await readFile(file), before)
  assert.deepEqual((await readdir(root)).sort(), ['db.sqlite', 'migrations'])
})

test('a SQLite database file is read on a connection of its own by the migrator that migrated it', async t => {
  const { dir, withMigrator } = await setupSQLiteFile(t)

  await withMigrator(dir, async migrator => {
    await migrator.applyMigrations()

    // The writable connection of the apply is not the one the status reads.
    migrator.sqliteDb.prepare = () => {
      throw new Error('not called')
    }

    assert.deepEqual((await migrator.getStatus()).migrations, [
      { version: 1, file: '001.do.sql', status: 'applied' }
    ])
    assert.equal(migrator.appliedMigrationsCount, 1)
  })
})

test('an in-memory SQLite database is read through the connection that migrated it', async t => {
  const { dir } = await setupSQLiteFile(t)
  const pending = [{ version: 1, file: '001.do.sql', status: 'pending' }]
  const applied = [{ version: 1, file: '001.do.sql', status: 'applied' }]

  const migrator = new Migrator({ dir }, { connectionString: 'sqlite://:memory:' }, nullLogger)
  t.after(() => migrator.close())

  // It starts empty every time it is opened.
  assert.deepEqual((await migrator.getStatus()).migrations, pending)

  await migrator.applyMigrations()
  assert.deepEqual((await migrator.getStatus()).migrations, applied)
  assert.equal(migrator.appliedMigrationsCount, 1)
  assert.equal(await migrator.hasMigrationsToApply(), false)
})

test('a SQLite database file that does not exist is read as nothing applied and is not created', async t => {
  const { root, dir, withMigrator } = await setupSQLiteFile(t)

  assert.deepEqual(await withMigrator(dir, migrator => migrator.getStatus()), {
    databaseVersion: 0,
    upToDate: false,
    migrations: [{ version: 1, file: '001.do.sql', status: 'pending' }]
  })
  assert.deepEqual(await readdir(root), ['migrations'])

  // The migrations directory is checked as it is with a database.
  await assert.rejects(
    withMigrator(join(root, 'nowhere'), migrator => migrator.getStatus()),
    /Migrations directory .*nowhere does not exist/
  )
  assert.deepEqual(await readdir(root), ['migrations'])

  // Once the file is there it is read like any other database.
  await withMigrator(dir, migrator => migrator.applyMigrations())
  assert.deepEqual(await withMigrator(dir, migrator => migrator.getStatus()), {
    databaseVersion: 1,
    upToDate: true,
    migrations: [{ version: 1, file: '001.do.sql', status: 'applied' }]
  })
})

test('the migrations status command does not create a SQLite database file that does not exist', async t => {
  const { root, dir, connectionString } = await setupSQLiteFile(t)
  const configFile = join(root, 'platformatic.json')
  await writeFile(
    configFile,
    JSON.stringify({
      server: { hostname: '127.0.0.1', port: 0 },
      db: { connectionString },
      migrations: { dir }
    })
  )

  const { output, fatalErrors, exitCode } = await runCommand(t, configFile)

  assert.deepEqual(fatalErrors, [])
  assert.match(output, /Database version: 0/)
  assert.match(output, /001\.do\.sql\s+pending/)
  assert.equal(exitCode, 1)
  assert.deepEqual((await readdir(root)).sort(), ['migrations', 'platformatic.json'])
})
