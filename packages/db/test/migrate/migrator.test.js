import { createDirectory } from '@platformatic/utils'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import pino from 'pino'
import pretty from 'pino-pretty'
import { Migrator } from '../../lib/migrator.js'

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
