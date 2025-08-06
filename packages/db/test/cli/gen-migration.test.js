import { createDirectory } from '@platformatic/foundation'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pino } from 'pino'
import { createMigrations } from '../../lib/commands/migrations-create.js'

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

test('throws if migrations directory does not exist', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'gen-migration-test-'))
  const configFilePath = join(cwd, 'gen-migration.json')
  const migrationsDirPath = join(cwd, 'migrations')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
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
  assert.match(errorMessage, /Migrations directory (.*) does not exist/)
})
