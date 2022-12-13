import createDB from '../../src/db/create-db.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { isFileAccessible } from '../../src/utils.mjs'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

const moviesMigrationDo = `
-- Add SQL in this file to create the database tables for your API
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);
`

const moviesMigrationUndo = `
-- Add SQL in this file to drop the database tables 
DROP TABLE movies;
`

let tmpDir
let log = []
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  log = []
  rmSync(tmpDir, { recursive: true, force: true })
  process.env = {}
})

const fakeLogger = {
  debug: msg => log.push(msg),
  info: msg => log.push(msg)
}

test('creates project with no typescript', async ({ end, equal }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: true
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = readFileSync(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, core, migrations } = dbConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')
  equal(core.connectionString, '{DATABASE_URL}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')

  equal(core.graphql, true)
  equal(core.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFileSync(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFileSync(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  equal(await isFileAccessible(join(tmpDir, 'plugin.js')), true)
})

test('creates project with no typescript and no plugin', async ({ end, equal }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: false
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = readFileSync(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, core, migrations } = dbConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')
  equal(core.connectionString, '{DATABASE_URL}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')

  equal(core.graphql, true)
  equal(core.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFileSync(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFileSync(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  equal(await isFileAccessible(join(tmpDir, 'plugin.js')), false)
})

test('creates project with typescript', async ({ end, equal }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: true
  }

  await createDB(params, fakeLogger, tmpDir)

  const pathToDbConfigFile = join(tmpDir, 'platformatic.db.json')
  const pathToMigrationFolder = join(tmpDir, 'migrations')
  const pathToMigrationFileDo = join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = join(pathToMigrationFolder, '001.undo.sql')

  const dbConfigFile = readFileSync(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)
  const { server, core, migrations, plugin } = dbConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')
  equal(core.connectionString, '{DATABASE_URL}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.DATABASE_URL, 'sqlite://./db.sqlite')

  equal(core.graphql, true)
  equal(core.openapi, true)
  equal(migrations.dir, 'migrations')

  const migrationFileDo = await readFileSync(pathToMigrationFileDo, 'utf8')
  equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await readFileSync(pathToMigrationFileUndo, 'utf8')
  equal(migrationFileUndo, moviesMigrationUndo)

  equal(plugin.path, 'plugin.ts')
  equal(plugin.typescript.outDir, 'dist')
  equal(await isFileAccessible(join(tmpDir, 'plugin.ts')), true)
  equal(await isFileAccessible(join(tmpDir, 'tsconfig.json')), true)
})

test('creates project with configuration already present', async ({ end, equal, ok }) => {
  const pathToDbConfigFileOld = join(tmpDir, 'platformatic.db.json')
  writeFileSync(pathToDbConfigFileOld, JSON.stringify({ test: 'test' }))
  const params = {
    hostname: 'myhost',
    port: 6666
  }
  await createDB(params, fakeLogger, tmpDir)
  ok(log.includes('Configuration file platformatic.db.json found, skipping creation of configuration file.'))
})

test('creates project with migration folder already present', async ({ end, equal, ok }) => {
  const pathToMigrationsOld = join(tmpDir, 'migrations')
  mkdirSync(pathToMigrationsOld)
  const params = {
    hostname: 'myhost',
    port: 6666
  }
  await createDB(params, fakeLogger, tmpDir)
  equal(log.includes('Migrations folder migrations found, skipping creation of migrations folder.'), true)
})

test('creates project with "do" migration already present', async ({ end, equal, ok }) => {
  const pathToMigrationsOld = join(tmpDir, 'migrations')
  mkdirSync(pathToMigrationsOld)
  const pathToMigrationFileDo = join(pathToMigrationsOld, '001.do.sql')
  writeFileSync(pathToMigrationFileDo, 'test')
  const params = {
    hostname: 'myhost',
    port: 6666
  }
  await createDB(params, fakeLogger, tmpDir)
  ok(log.includes('Migration file 001.do.sql found, skipping creation of migration file.'))
})

test('creates project with tsconfig already present', async ({ end, equal, ok }) => {
  const pathToTsConfig = join(tmpDir, 'tsconfig.json')
  writeFileSync(pathToTsConfig, 'test')
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: true
  }
  await createDB(params, fakeLogger, tmpDir)
  ok(log.includes(`Typescript configuration file ${pathToTsConfig} found, skipping creation of typescript configuration file.`))
})

test('creates project with plugin already present', async ({ end, equal, ok }) => {
  const pathToPlugin = join(tmpDir, 'plugin.js')
  writeFileSync(pathToPlugin, 'test')
  const params = {
    hostname: 'myhost',
    port: 6666,
    plugin: true,
    types: true
  }
  await createDB(params, fakeLogger, tmpDir)
  ok(log.includes(`Plugin file ${pathToPlugin} found, skipping creation of plugin file.`))
})
