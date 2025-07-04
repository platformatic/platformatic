'use strict'

const { createDirectory } = require('@platformatic/utils')
const assert = require('node:assert/strict')
const { mkdtemp } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const pino = require('pino')
const pretty = require('pino-pretty')
const { Migrator } = require('../../lib/migrator.js')

test('should not throw error if setup migrator twice', async t => {
  const { default: Postgrator } = await import('postgrator')
  const cwd = await mkdtemp(join(tmpdir(), 'migrator-test-'))
  const migrationsDirPath = join(cwd, 'migrations')
  await createDirectory(migrationsDirPath)

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      connectionString: `sqlite://${join(cwd, 'db.sqlite')}`
    },
    migrations: {
      dir: migrationsDirPath
    }
  }

  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  const migrator = new Migrator(config.migrations, config.db, logger)

  t.after(() => migrator.close())
  await migrator.setupPostgrator()
  await migrator.setupPostgrator()

  assert.ok(migrator.postgrator instanceof Postgrator)
})
