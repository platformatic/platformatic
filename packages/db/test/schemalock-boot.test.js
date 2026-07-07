import assert from 'node:assert/strict'
import { readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createBasicPages, createFromConfig, getConnectionInfo } from './helper.js'

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
