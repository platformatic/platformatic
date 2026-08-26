import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createConnectionPool } from '@platformatic/sql-mapper'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { splitSQLiteStatements } from '../../lib/split-sqlite-statements.js'
import { createCapturingLogger, createTestContext } from '../cli/test-utilities.js'
import { createDirectory } from '@platformatic/foundation'

test('splitSQLiteStatements', () => {
  // Plain statements
  assert.deepEqual(splitSQLiteStatements('CREATE TABLE a (id INTEGER);\nCREATE TABLE b (id INTEGER);'), [
    'CREATE TABLE a (id INTEGER)',
    'CREATE TABLE b (id INTEGER)'
  ])

  // Semicolons inside strings
  assert.deepEqual(splitSQLiteStatements("INSERT INTO a (name) VALUES ('foo;bar');"), [
    "INSERT INTO a (name) VALUES ('foo;bar')"
  ])

  // Semicolons inside comments, including commented out statements
  assert.deepEqual(
    splitSQLiteStatements(`-- A comment that contains a ;
-- CREATE TABLE IF NOT EXISTS movies (
--   id INTEGER PRIMARY KEY,
--   title TEXT NOT NULL
-- );
CREATE TABLE movies (id INTEGER PRIMARY KEY);`),
    [
      `-- A comment that contains a ;
-- CREATE TABLE IF NOT EXISTS movies (
--   id INTEGER PRIMARY KEY,
--   title TEXT NOT NULL
-- );
CREATE TABLE movies (id INTEGER PRIMARY KEY)`
    ]
  )

  // Comment only scripts produce no statements
  assert.deepEqual(splitSQLiteStatements('-- only a comment with a ;\n/* and a block; comment */'), [])

  // Triggers keep their BEGIN ... END body together
  const trigger = `CREATE TRIGGER tg_users_updated_at AFTER UPDATE ON users FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END`
  assert.deepEqual(splitSQLiteStatements(`CREATE TABLE users (id INTEGER PRIMARY KEY);\n${trigger};`), [
    'CREATE TABLE users (id INTEGER PRIMARY KEY)',
    trigger
  ])

  // CASE ... END does not confuse the nesting
  assert.deepEqual(
    splitSQLiteStatements("SELECT CASE WHEN a = 1 THEN 'one' ELSE 'other' END FROM t; SELECT 2;"),
    ["SELECT CASE WHEN a = 1 THEN 'one' ELSE 'other' END FROM t", 'SELECT 2']
  )

  // BEGIN as transaction start does not open a block
  assert.deepEqual(splitSQLiteStatements('BEGIN;\nCREATE TABLE a (id INTEGER);\nCOMMIT;'), [
    'BEGIN',
    'CREATE TABLE a (id INTEGER)',
    'COMMIT'
  ])
  assert.deepEqual(splitSQLiteStatements('BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER);\nCOMMIT;'), [
    'BEGIN TRANSACTION',
    'CREATE TABLE a (id INTEGER)',
    'COMMIT'
  ])
})

test('migrations with triggers and comments apply on SQLite', async t => {
  /*
   * https://github.com/platformatic/platformatic/issues/932
   * https://github.com/platformatic/platformatic/issues/125
   */
  const cwd = await mkdtemp(join(tmpdir(), 'sqlite-trigger-migration-'))
  const configFilePath = join(cwd, 'platformatic.db.json')
  const migrationsDirPath = join(cwd, 'migrations')
  const dbPath = join(cwd, 'db.sqlite')

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      connectionString: `sqlite://${dbPath}`
    },
    migrations: {
      dir: migrationsDirPath
    }
  }

  await writeFile(configFilePath, JSON.stringify(config))
  await createDirectory(migrationsDirPath)
  await writeFile(
    join(migrationsDirPath, '001.do.sql'),
    `-- A comment that contains a ;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  firstname TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER tg_users_updated_at AFTER UPDATE ON users FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
`
  )
  await writeFile(join(migrationsDirPath, '001.undo.sql'), 'DROP TRIGGER tg_users_updated_at;\nDROP TABLE users;\n')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await applyMigrations(logger, configFilePath, [], context)

  const output = logger.getCaptured()
  assert.match(output, /running 001\.do\.sql/)
  assert.doesNotMatch(output, /incomplete input/)

  // The trigger is in place and works
  const { db, sql } = await createConnectionPool({
    connectionString: `sqlite://${dbPath}`,
    log: logger
  })
  t.after(() => db.dispose())

  await db.query(sql`INSERT INTO users (firstname, updated_at) VALUES ('foo', '2020-01-01 00:00:00')`)
  await db.query(sql`UPDATE users SET firstname = 'bar' WHERE id = 1`)
  const [user] = await db.query(sql`SELECT firstname, updated_at FROM users`)
  assert.equal(user.firstname, 'bar')
  assert.notEqual(user.updated_at, '2020-01-01 00:00:00', 'the trigger updated updated_at')

  // The migration was recorded exactly once
  const versions = await db.query(sql`SELECT version FROM versions ORDER BY version DESC`)
  assert.equal(versions[0].version, 1)

  await readFile(join(migrationsDirPath, '001.do.sql'))
})
