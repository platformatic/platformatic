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
  const configFilePath = join(cwd, 'watt.config.mjs')
  const migrationsDirPath = join(cwd, 'migrations')

  const config = {
    module: '@platformatic/db',
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

  // The configuration is a program, so it is written as one.
  await writeFile(configFilePath, `export default ${JSON.stringify(config, null, 2)}\n`)
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
  const configFilePath = join(cwd, 'watt.config.mjs')
  const migrationsDirPath = join(cwd, 'migrations')

  const config = {
    module: '@platformatic/db',
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

  // The configuration is a program, so it is written as one.
  await writeFile(configFilePath, `export default ${JSON.stringify(config, null, 2)}\n`)
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
  const configFilePath = join(cwd, 'watt.config.mjs')

  const config = {
    module: '@platformatic/db',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      connectionString: 'sqlite://db.sqlite'
    }
  }

  // The configuration is a program, so it is written as one.
  await writeFile(configFilePath, `export default ${JSON.stringify(config, null, 2)}\n`)

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
  const configFilePath = join(cwd, 'watt.config.mjs')
  const migrationsDirPath = join(cwd, 'nested', 'migrations')

  const config = {
    module: '@platformatic/db',
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

  // The configuration is a program, so it is written as one.
  await writeFile(configFilePath, `export default ${JSON.stringify(config, null, 2)}\n`)

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
