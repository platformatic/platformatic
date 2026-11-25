import { createDirectory } from '@platformatic/foundation'
import assert from 'node:assert/strict'
import fsPromises, { mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pino } from 'pino'
import { createMigrations, createTimestampMigrationFiles } from '../../lib/commands/migrations-create.js'
import { Migrator } from '../../lib/migrator.js'
import { getConnectionInfo } from '../helper.js'

test('generates next file correctly with empty dir', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-migration-test-'))
  const configFilePath = join(cwd, 'gen-migration.json')
  const migrationsDirPath = join(cwd, 'migrations')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      connectionString: 'sqlite://db.sqlite'
    },
    migrations: {
      dir: migrationsDirPath
    }
  }

  await writeFile(configFilePath, JSON.stringify(config))
  await createDirectory(migrationsDirPath)

  const logger = pino({ level: 'fatal' })
  await createMigrations(logger, configFilePath, [], { colorette: { bold: (str) => str } })
  const newMigrations = await readdir(migrationsDirPath)

  assert.equal(newMigrations.length, 2)
  assert.equal(newMigrations[0], '001.do.sql')
  assert.equal(newMigrations[1], '001.undo.sql')
})

test('generates next file correctly with existing files', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-migration-test-'))
  const configFilePath = join(cwd, 'gen-migration.json')
  const migrationsDirPath = join(cwd, 'migrations')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      connectionString: 'sqlite://db.sqlite'
    },
    migrations: {
      dir: migrationsDirPath
    }
  }

  await writeFile(configFilePath, JSON.stringify(config))
  await createDirectory(migrationsDirPath)

  const logger = pino({ level: 'fatal' })
  await createMigrations(logger, configFilePath, [], { colorette: { bold: (str) => str } })
  await createMigrations(logger, configFilePath, [], { colorette: { bold: (str) => str } })
  const newMigrations = await readdir(migrationsDirPath)

  assert.equal(newMigrations.length, 4)
  assert.equal(newMigrations[0], '001.do.sql')
  assert.equal(newMigrations[1], '001.undo.sql')
  assert.equal(newMigrations[2], '002.do.sql')
  assert.equal(newMigrations[3], '002.undo.sql')
})

test('throws if there is no migrations in the config', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-migration-test-'))
  const configFilePath = join(cwd, 'gen-migration.json')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      connectionString: 'sqlite://db.sqlite'
    }
  }

  await writeFile(configFilePath, JSON.stringify(config))

  let errorMessage = ''
  const logger = {
    info: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    error: (msg) => {
      errorMessage += msg
    }
  }

  await createMigrations(logger, configFilePath, [], { colorette: { bold: (str) => str } })
  assert.match(errorMessage, /Missing "migrations" section in config file/)
})

test('creates the migrations directory if it does not exist', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-migration-test-'))
  const configFilePath = join(cwd, 'gen-migration.json')
  const migrationsDirPath = join(cwd, 'nested', 'migrations')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      connectionString: 'sqlite://db.sqlite'
    },
    migrations: {
      dir: migrationsDirPath
    }
  }

  await writeFile(configFilePath, JSON.stringify(config))

  let errorMessage = ''
  const logger = pino({ level: 'fatal' })
  logger.error = msg => {
    errorMessage += msg
  }

  await createMigrations(logger, configFilePath, [], { colorette: { bold: (str) => str } })
  const newMigrations = await readdir(migrationsDirPath)

  assert.equal(errorMessage, '')
  assert.equal(newMigrations.length, 2)
  assert.equal(newMigrations[0], '001.do.sql')
  assert.equal(newMigrations[1], '001.undo.sql')
})

const context = { colorette: { bold: str => str } }

async function setupTimestampNaming (t, db = { connectionString: 'sqlite://db.sqlite' }) {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-migration-test-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))

  const configFilePath = join(cwd, 'gen-migration.json')
  const migrationsDirPath = join(cwd, 'migrations')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db,
    migrations: {
      dir: migrationsDirPath,
      naming: 'timestamp'
    }
  }

  await writeFile(configFilePath, JSON.stringify(config))

  const errors = []
  const logger = pino({ level: 'fatal' })
  logger.error = message => {
    errors.push(message)
  }

  async function migrationFiles () {
    return (await readdir(migrationsDirPath)).sort()
  }

  return { configFilePath, migrationsDirPath, logger, errors, migrationFiles }
}

test('naming: "timestamp" names the files with the UTC date and time', async t => {
  const { configFilePath, logger, errors, migrationFiles } = await setupTimestampNaming(t)

  // A zone where this instant is already the next day, at another hour.
  const timeZone = process.env.TZ
  process.env.TZ = 'Pacific/Auckland'
  t.after(() => {
    process.env.TZ = timeZone
  })
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 15, 23, 4, 5) })
  assert.equal(new Date().getDate(), 16)

  await createMigrations(logger, configFilePath, [], context)

  assert.deepEqual(errors, [])
  assert.deepEqual(await migrationFiles(), ['20260115230405.do.sql', '20260115230405.undo.sql'])
})

test('naming: "timestamp" takes the next free number when the version is taken', async t => {
  const { configFilePath, migrationsDirPath, logger, errors, migrationFiles } = await setupTimestampNaming(t)
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 15, 10, 30, 59) })

  // A migration with a name segment and the undo file of a JS one hold the
  // first two versions.
  // Files Postgrator does not run as migrations hold none: another extension,
  // the extension of a migration with another action, an action without it.
  await mkdir(migrationsDirPath)
  await writeFile(join(migrationsDirPath, '20260115103059.do.add-users.sql'), 'CREATE TABLE users (id INTEGER);')
  await writeFile(join(migrationsDirPath, '20260115103060.undo.mjs'), 'export function generateSql () {}')
  await writeFile(join(migrationsDirPath, '20260115103061.notes'), 'not a migration')
  await writeFile(join(migrationsDirPath, '20260115103061.scratch.sql'), 'SELECT 1; -- not a migration either')
  await writeFile(join(migrationsDirPath, '20260115103061.do.txt'), 'not a migration either')
  // A higher version in the directory does not move the new one above it.
  await writeFile(join(migrationsDirPath, '20270101000000.do.sql'), 'CREATE TABLE later (id INTEGER);')

  await createMigrations(logger, configFilePath, [], context)
  await createMigrations(logger, configFilePath, [], context)

  assert.deepEqual(errors, [])
  assert.deepEqual(await migrationFiles(), [
    '20260115103059.do.add-users.sql',
    '20260115103060.undo.mjs',
    '20260115103061.do.sql',
    '20260115103061.do.txt',
    '20260115103061.notes',
    '20260115103061.scratch.sql',
    '20260115103061.undo.sql',
    '20260115103062.do.sql',
    '20260115103062.undo.sql',
    '20270101000000.do.sql'
  ])
  assert.equal(
    await readFile(join(migrationsDirPath, '20260115103059.do.add-users.sql'), 'utf8'),
    'CREATE TABLE users (id INTEGER);'
  )
})

test('naming: "timestamp" creates that run at the same time do not share or overwrite a file', async t => {
  const { configFilePath, logger, errors, migrationFiles } = await setupTimestampNaming(t)
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 15, 10, 30, 0) })

  await Promise.all([
    createMigrations(logger, configFilePath, [], context),
    createMigrations(logger, configFilePath, [], context),
    createMigrations(logger, configFilePath, [], context)
  ])

  assert.deepEqual(errors, [])
  assert.deepEqual(await migrationFiles(), [
    '20260115103000.do.sql',
    '20260115103000.undo.sql',
    '20260115103001.do.sql',
    '20260115103001.undo.sql',
    '20260115103002.do.sql',
    '20260115103002.undo.sql'
  ])
})

test('naming: "timestamp" never overwrites a file that takes the name after the directory was read', async t => {
  const { migrationsDirPath } = await setupTimestampNaming(t)
  await mkdir(migrationsDirPath)
  await writeFile(join(migrationsDirPath, '20260115103000.do.sql'), 'taken first')
  await writeFile(join(migrationsDirPath, '20260115103001.undo.sql'), 'taken first')

  // The directory looks empty to the call, as it does when another create
  // writes these files right after the directory was read.
  t.mock.method(fsPromises, 'readdir', async () => [])
  syncBuiltinESMExports()
  const now = new Date(Date.UTC(2026, 0, 15, 10, 30, 0))
  let created
  try {
    created = await createTimestampMigrationFiles(migrationsDirPath, now)
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }

  assert.equal(created.doFile, join(migrationsDirPath, '20260115103002.do.sql'))
  assert.equal(created.undoFile, join(migrationsDirPath, '20260115103002.undo.sql'))
  assert.deepEqual((await readdir(migrationsDirPath)).sort(), [
    '20260115103000.do.sql',
    '20260115103001.undo.sql',
    '20260115103002.do.sql',
    '20260115103002.undo.sql'
  ])
  assert.equal(await readFile(join(migrationsDirPath, '20260115103000.do.sql'), 'utf8'), 'taken first')
  assert.equal(await readFile(join(migrationsDirPath, '20260115103001.undo.sql'), 'utf8'), 'taken first')
})

test('naming: "timestamp" does not leave a do file alone when the undo file cannot be written', async t => {
  const { migrationsDirPath } = await setupTimestampNaming(t)
  await mkdir(migrationsDirPath)

  const openOnDisk = fsPromises.open
  t.mock.method(fsPromises, 'open', async (file, ...args) => {
    if (file.endsWith('.undo.sql')) {
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' })
    }
    return openOnDisk(file, ...args)
  })
  syncBuiltinESMExports()
  const now = new Date(Date.UTC(2026, 0, 15, 10, 30, 0))
  try {
    await assert.rejects(createTimestampMigrationFiles(migrationsDirPath, now), { code: 'ENOSPC' })
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }

  assert.deepEqual(await readdir(migrationsDirPath), [])
})

test('naming: "timestamp" removes a file it created when closing it fails', async t => {
  const { migrationsDirPath } = await setupTimestampNaming(t)
  await mkdir(migrationsDirPath)

  // The undo file exists on disk when its close reports an error.
  const openOnDisk = fsPromises.open
  t.mock.method(fsPromises, 'open', async (file, ...args) => {
    const handle = await openOnDisk(file, ...args)
    if (!file.endsWith('.undo.sql')) return handle
    await handle.close()
    return {
      async close () {
        throw Object.assign(new Error('input/output error'), { code: 'EIO' })
      }
    }
  })
  syncBuiltinESMExports()
  const now = new Date(Date.UTC(2026, 0, 15, 10, 30, 0))
  try {
    await assert.rejects(createTimestampMigrationFiles(migrationsDirPath, now), { code: 'EIO' })
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }

  assert.deepEqual(await readdir(migrationsDirPath), [])
})

test('naming: "timestamp" reports the original error when the do file cannot be removed', async t => {
  const { migrationsDirPath } = await setupTimestampNaming(t)
  await mkdir(migrationsDirPath)

  const openOnDisk = fsPromises.open
  t.mock.method(fsPromises, 'open', async (file, ...args) => {
    if (file.endsWith('.undo.sql')) {
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' })
    }
    return openOnDisk(file, ...args)
  })
  const removed = []
  t.mock.method(fsPromises, 'rm', async file => {
    removed.push(file)
    throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
  })
  syncBuiltinESMExports()
  const now = new Date(Date.UTC(2026, 0, 15, 10, 30, 0))
  try {
    await assert.rejects(createTimestampMigrationFiles(migrationsDirPath, now), { code: 'ENOSPC' })
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }

  assert.deepEqual(removed, [join(migrationsDirPath, '20260115103000.do.sql')])
})

test('naming: "timestamp" keeps fourteen digits for a year below 1000', async t => {
  const { migrationsDirPath } = await setupTimestampNaming(t)
  await mkdir(migrationsDirPath)

  const now = new Date('0999-01-15T10:30:59Z')
  const { doFile, undoFile } = await createTimestampMigrationFiles(migrationsDirPath, now)

  assert.equal(doFile, join(migrationsDirPath, '09990115103059.do.sql'))
  assert.equal(undoFile, join(migrationsDirPath, '09990115103059.undo.sql'))
})

test('naming: "timestamp" does not connect to the database', async t => {
  // Nothing listens on this port: the default naming reads the database
  // version here, and fails.
  const unreachable = { connectionString: 'postgres://postgres:postgres@127.0.0.1:9/unreachable' }
  const { configFilePath, logger, errors, migrationFiles } = await setupTimestampNaming(t, unreachable)
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 15, 10, 30, 0) })

  await createMigrations(logger, configFilePath, [], context)

  assert.deepEqual(errors, [])
  assert.deepEqual(await migrationFiles(), ['20260115103000.do.sql', '20260115103000.undo.sql'])
})

test('naming: "timestamp" files are applied in version order after the numbered ones', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const { configFilePath, migrationsDirPath, logger, errors } = await setupTimestampNaming(t, connectionInfo)
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 15, 10, 30, 0) })

  await mkdir(migrationsDirPath)
  await writeFile(join(migrationsDirPath, '001.do.sql'), 'CREATE TABLE test1 (id INTEGER);')
  await createMigrations(logger, configFilePath, [], context)

  // Fails if the command did not create this file.
  const created = await open(join(migrationsDirPath, '20260115103000.do.sql'), 'r+')
  await created.writeFile('ALTER TABLE test1 ADD COLUMN name TEXT;')
  await created.close()

  const applied = []
  const migratorLogger = { debug () {}, warn () {}, error () {}, info: message => applied.push(message) }
  const migrator = new Migrator({ dir: migrationsDirPath }, connectionInfo, migratorLogger)
  t.after(async () => {
    await migrator.close()
    await dropTestDB()
  })

  await migrator.applyMigrations()

  assert.deepEqual(errors, [])
  assert.equal(migrator.appliedMigrationsCount, 2)
  assert.deepEqual(
    applied.filter(message => message.startsWith('running')),
    ['running 001.do.sql', 'running 20260115103000.do.sql']
  )
})

test('the default naming does not change', async t => {
  const { configFilePath, logger, errors, migrationFiles } = await setupTimestampNaming(t)
  const config = JSON.parse(await readFile(configFilePath, 'utf8'))

  for (const naming of [undefined, 'sequence']) {
    config.migrations.naming = naming
    await writeFile(configFilePath, JSON.stringify(config))
    await createMigrations(logger, configFilePath, [], context)
  }

  assert.deepEqual(errors, [])
  assert.deepEqual(await migrationFiles(), ['001.do.sql', '001.undo.sql', '002.do.sql', '002.undo.sql'])
})

test('an unknown naming is refused by the configuration schema', async t => {
  const { configFilePath, logger, errors } = await setupTimestampNaming(t)
  const config = JSON.parse(await readFile(configFilePath, 'utf8'))
  config.migrations.naming = 'date'
  await writeFile(configFilePath, JSON.stringify(config))

  await assert.rejects(createMigrations(logger, configFilePath, [], context), /naming/)
  assert.deepEqual(errors, [])
})
