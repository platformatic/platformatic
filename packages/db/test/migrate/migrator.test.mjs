import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, mkdir } from 'fs/promises'

import pino from 'pino'
import pretty from 'pino-pretty'
import Postgrator from 'postgrator'

import { test } from 'tap'
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

  t.teardown(() => migrator.close())
  await migrator.setupPostgrator()
  await migrator.setupPostgrator()

  t.ok(migrator.postgrator instanceof Postgrator)
})
