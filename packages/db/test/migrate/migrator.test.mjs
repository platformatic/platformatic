import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import { mkdtemp, mkdir } from 'node:fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import Postgrator from 'postgrator'
import { Migrator } from '../../lib/migrator.mjs'

test('should not throw error if setup migrator twice', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'migrator-test-'))
  const migrationsDirPath = join(cwd, 'migrations')
  await mkdir(migrationsDirPath)

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

  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const migrator = new Migrator(
    config.migrations,
    config.db,
    logger
  )

  t.after(() => migrator.close())
  await migrator.setupPostgrator()
  await migrator.setupPostgrator()

  assert.ok(migrator.postgrator instanceof Postgrator)
})
