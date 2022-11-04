import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'
import t from 'tap'
import { execa } from 'execa'
import { cliPath } from './helper.js'

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

t.jobs = 10

t.test('run db init with default options', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-1'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run init with default options twice', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-3'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  const { stdout: firstRunStdout } = await execa('node', [cliPath, 'init'], { cwd: pathToFolder })
  const { stdout: secondRunStdout } = await execa('node', [cliPath, 'init'], { cwd: pathToFolder })

  const firstRunStdoutLines = firstRunStdout.split('\n')
  t.match(firstRunStdoutLines[0], /(.*)Configuration file platformatic.db.json successfully created./)
  t.match(firstRunStdoutLines[1], /(.*)Migrations folder migrations successfully created./)
  t.match(firstRunStdoutLines[2], /(.*)Migration file 001.do.sql successfully created./)
  t.match(firstRunStdoutLines[3], /(.*)Migration file 001.undo.sql successfully created./)
  t.match(firstRunStdoutLines[4], /(.*)Plugin file created at plugin.js/)
  t.match(firstRunStdoutLines[5], /(.*)Please run `npm i --save(.*)/)

  const secondRunStdoutLines = secondRunStdout.split('\n')
  t.match(secondRunStdoutLines[0], /(.*)Configuration file platformatic.db.json found, skipping creation of configuration file./)
  t.match(secondRunStdoutLines[1], /(.*)Migrations folder migrations found, skipping creation of migrations folder./)
  t.match(secondRunStdoutLines[2], /(.*)Migration file 001.do.sql found, skipping creation of migration file./)
  t.match(secondRunStdoutLines[3], /(.*)Please run `npm i --save(.*)/)

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --typescript', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-2'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--typescript'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations, plugin, types } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')
  t.equal(types.autogenerate, true)

  t.equal(plugin.path, 'plugin.ts')
  t.equal(plugin.typescript.outDir, 'dist')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --typescript twice', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-2'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--typescript'], { cwd: pathToFolder })
  await execa('node', [cliPath, 'init', '--typescript'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations, plugin, types } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')
  t.equal(types.autogenerate, true)

  t.equal(plugin.path, 'plugin.ts')
  t.equal(plugin.typescript.outDir, 'dist')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --database postgres', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-4'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--database', 'postgres'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'postgres://postgres:postgres@localhost:5432/postgres')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --database mysql', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-5'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--database', 'mysql'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'mysql://root@localhost:3306/graph')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --database mariadb', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-6'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--database', 'mariadb'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'mysql://root@localhost:3307/graph')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --database mysql8', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-7'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--database', 'mysql8'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'mysql://root@localhost:3308/graph')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --hostname 127.0.0.5', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-8'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--hostname', '127.0.0.5'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.5')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --port 3055', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-9'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, 'migrations')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--port', '3055'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3055)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'migrations')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})

t.test('run db init --migrations custom-migrations-folder', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-10'))
  const pathToDbConfigFile = path.join(pathToFolder, 'platformatic.db.json')
  const pathToMigrationFolder = path.join(pathToFolder, './custom-migrations-folder')
  const pathToMigrationFileDo = path.join(pathToMigrationFolder, '001.do.sql')
  const pathToMigrationFileUndo = path.join(pathToMigrationFolder, '001.undo.sql')

  await execa('node', [cliPath, 'init', '--migrations', 'custom-migrations-folder'], { cwd: pathToFolder })

  const dbConfigFile = await fs.readFile(pathToDbConfigFile, 'utf8')
  const dbConfig = JSON.parse(dbConfigFile)

  const { server, core, migrations } = dbConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.equal(core.connectionString, 'sqlite://db.sqlite')
  t.equal(core.graphql, true)

  t.equal(migrations.dir, 'custom-migrations-folder')

  const migrationFileDo = await fs.readFile(pathToMigrationFileDo, 'utf8')
  t.equal(migrationFileDo, moviesMigrationDo)
  const migrationFileUndo = await fs.readFile(pathToMigrationFileUndo, 'utf8')
  t.equal(migrationFileUndo, moviesMigrationUndo)
})
