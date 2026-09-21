import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createBasicPages, createFromConfig, getConnectionInfo } from './helper.js'

const errorHandlerPath = join(import.meta.dirname, 'fixtures', 'error-handler', 'sanitizing-error-handler.js')

async function createApp (t, errorHandler) {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      errorHandler
    },
    db: {
      ...connectionInfo,
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

  // Make the auto-generated CRUD routes fail the same way a broken schema would.
  const { db, sql } = app.getApplication().platformatic
  await db.query(sql`DROP TABLE pages`)

  return app
}

test('server.errorHandler covers the auto-generated CRUD routes', async t => {
  const app = await createApp(t, errorHandlerPath)

  const res = await request(`${app.url}/pages`)
  assert.equal(res.statusCode, 500)
  assert.deepEqual(await res.body.json(), {
    envelope: true,
    statusCode: 500,
    message: 'Internal Server Error'
  })
})

test('without server.errorHandler the auto-generated CRUD routes leak the driver message', async t => {
  const app = await createApp(t, undefined)

  const res = await request(`${app.url}/pages`)
  assert.equal(res.statusCode, 500)

  const body = await res.body.json()
  assert.equal(body.statusCode, 500)
  assert.equal(body.error, 'Internal Server Error')
  assert.ok(body.message.includes('pages'), `expected the driver message, got ${body.message}`)
})
