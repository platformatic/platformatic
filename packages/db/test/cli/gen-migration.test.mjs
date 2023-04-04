import { join } from 'path'
import { tmpdir } from 'os'
import { writeFile, mkdir, readdir, mkdtemp } from 'fs/promises'

import split from 'split2'
import { once } from 'events'
import { execa } from 'execa'
import { test } from 'tap'
import { cliPath } from './helper.js'

test('generates next file correctly with empty dir', async ({ equal }) => {
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
  await mkdir(migrationsDirPath)

  await execa('node', [cliPath, 'migrations', 'create', '-c', configFilePath], { cwd })
  const newMigrations = await readdir(migrationsDirPath)

  equal(newMigrations.length, 2)
  equal(newMigrations[0], '001.do.sql')
  equal(newMigrations[1], '001.undo.sql')
})

test('generates next file correctly with existing files', async ({ equal }) => {
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
  await mkdir(migrationsDirPath)

  await execa('node', [cliPath, 'migrations', 'create', '-c', configFilePath], { cwd })
  const child = execa('node', [cliPath, 'migrations', 'create', '-c', configFilePath], { cwd })
  child.stdout.pipe(process.stderr)
  child.stderr.pipe(process.stderr)

  await child
  const newMigrations = await readdir(migrationsDirPath)

  equal(newMigrations.length, 4)
  equal(newMigrations[0], '001.do.sql')
  equal(newMigrations[1], '001.undo.sql')
  equal(newMigrations[2], '002.do.sql')
  equal(newMigrations[3], '002.undo.sql')
})

test('throws if there is no migrations in the config', async ({ match }) => {
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

  const child = execa('node', [cliPath, 'migrations', 'create', '-c', configFilePath], { cwd })
  child.stderr.pipe(process.stderr)
  const output = child.stdout.pipe(split())
  const [data] = await once(output, 'data')
  match(data, /Missing "migrations" section in config file/)
})

test('throws if migrations directory does not exist', async ({ match }) => {
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

  const child = execa('node', [cliPath, 'migrations', 'create', '-c', configFilePath], { cwd })
  child.stderr.pipe(process.stderr)
  const output = child.stdout.pipe(split())
  const [data] = await once(output, 'data')
  match(data, /Migrations directory (.*) does not exist/)
})
