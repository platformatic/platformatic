import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createBasicPages, createFromConfig, getConnectionInfo, isMysql } from './helper.js'

test('creates the schema.lock file at boot when it does not exist', async t => {
  /* https://github.com/platformatic/platformatic/issues/4035 */
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const directory = await mkdtemp(join(tmpdir(), 'schemalock-boot-'))
  const schemaLockPath = join(directory, 'schema.lock')

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      schemalock: {
        path: schemaLockPath
      },
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const dbschema = JSON.parse(await readFile(schemaLockPath, 'utf-8'))
  assert.ok(Array.isArray(dbschema), 'schema.lock contains the database schema')
  assert.ok(
    dbschema.some(table => table.table === 'pages'),
    'schema.lock contains the pages table'
  )
})

function findCatalogKeys (value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      findCatalogKeys(item, found)
    }
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (/_catalog$/i.test(key)) {
        found.push(key)
      }
      findCatalogKeys(value[key], found)
    }
  }
  return found
}

async function startWithSchemaLock (t, schemaLockPath, connectionInfo) {
  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      schemalock: {
        path: schemaLockPath
      },
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  })

  await app.start({ listen: true })
  return app
}

test('schema.lock does not embed the database catalog name', async t => {
  /* https://github.com/platformatic/platformatic/issues/4969 */
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const directory = await mkdtemp(join(tmpdir(), 'schemalock-boot-'))
  const schemaLockPath = join(directory, 'schema.lock')

  const app = await startWithSchemaLock(t, schemaLockPath, connectionInfo)

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })

  const dbschema = JSON.parse(await readFile(schemaLockPath, 'utf-8'))
  assert.deepEqual(findCatalogKeys(dbschema), [], 'schema.lock contains no *_catalog fields')
})

test('schema.lock is deterministic across database names', { skip: isMysql }, async t => {
  /* https://github.com/platformatic/platformatic/issues/4969
     Skipped on MySQL/MariaDB because there the schema name is the database
     name, so the lock legitimately embeds it. */
  const first = await getConnectionInfo()
  const second = await getConnectionInfo()
  const directory = await mkdtemp(join(tmpdir(), 'schemalock-boot-'))
  const firstLockPath = join(directory, 'first.schema.lock')
  const secondLockPath = join(directory, 'second.schema.lock')

  t.after(async () => {
    await first.dropTestDB()
    await second.dropTestDB()
  })

  const firstApp = await startWithSchemaLock(t, firstLockPath, first.connectionInfo)
  await firstApp.stop()

  const secondApp = await startWithSchemaLock(t, secondLockPath, second.connectionInfo)
  await secondApp.stop()

  const firstLock = await readFile(firstLockPath, 'utf-8')
  const secondLock = await readFile(secondLockPath, 'utf-8')
  assert.equal(firstLock, secondLock, 'the same schema produces the same schema.lock on different databases')
})

test('does not create schema.lock at boot when the schema lock is read-only string', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const directory = await mkdtemp(join(tmpdir(), 'schemalock-boot-'))
  const schemaLockPath = join(directory, 'schema.lock')

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      schemalock: {
        path: schemaLockPath,
        readOnly: 'true'
      },
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  assert.equal(existsSync(schemaLockPath), false, 'schema.lock is not created in read-only mode')
})

test('does not rewrite schema.lock on migrations autoApply when the schema lock is read-only', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const directory = await mkdtemp(join(tmpdir(), 'schemalock-boot-'))
  const schemaLockPath = join(directory, 'schema.lock')
  const migrationsDir = join(directory, 'migrations')

  await mkdir(migrationsDir)
  await writeFile(
    join(migrationsDir, '001.do.sql'),
    'CREATE TABLE graphs (id INTEGER PRIMARY KEY, name VARCHAR(42));'
  )

  const sentinel = '[]'
  await writeFile(schemaLockPath, sentinel)

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      schemalock: {
        path: schemaLockPath,
        readOnly: true
      }
    },
    migrations: {
      dir: migrationsDir,
      autoApply: true
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const contents = await readFile(schemaLockPath, 'utf-8')
  assert.equal(contents, sentinel, 'schema.lock is not rewritten after applying migrations in read-only mode')
})
