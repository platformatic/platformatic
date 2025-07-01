'use strict'

const { createDirectory } = require('@platformatic/utils')
const { once } = require('events')
const { execa } = require('execa')
const assert = require('node:assert/strict')
const { mkdtemp, readdir, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const split = require('split2')
const { cliPath } = require('./helper.js')

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

  await execa('node', [cliPath, 'createMigrations', configFilePath], { cwd })
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

  await execa('node', [cliPath, 'createMigrations', configFilePath], { cwd })
  const child = execa('node', [cliPath, 'createMigrations', configFilePath], { cwd })
  child.stdout.pipe(process.stderr)
  child.stderr.pipe(process.stderr)

  await child
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

  const child = execa('node', [cliPath, 'createMigrations', configFilePath], { cwd })
  child.stderr.pipe(process.stderr)
  const output = child.stdout.pipe(split())
  const [data] = await once(output, 'data')
  assert.match(data, /Missing "migrations" section in config file/)
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

  const child = execa('node', [cliPath, 'createMigrations', configFilePath], { cwd })
  child.stderr.pipe(process.stderr)
  const output = child.stdout.pipe(split())
  const [data] = await once(output, 'data')
  assert.match(data, /Migrations directory (.*) does not exist/)
})
