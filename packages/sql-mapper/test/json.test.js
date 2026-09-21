import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import { clear, connInfo, isPg, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

// Postgres returns JSON fields as parsed objects, the other databases as strings
function parseJSONField (value) {
  return typeof value === 'string' ? JSON.parse(value) : value
}

test('insert, save and updateMany support JSON fields', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

    if (isPg) {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        metadata JSONB DEFAULT '{}'::jsonb
      );`)
    } else if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        metadata JSON
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        metadata JSON
      );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page

  // insert
  const [inserted] = await pageEntity.insert({
    inputs: [{ metadata: { foo: 'bar' } }]
  })
  deepEqual(parseJSONField(inserted.metadata), { foo: 'bar' })

  // save on an existing record (update path)
  const updated = await pageEntity.save({
    input: { id: inserted.id, metadata: { baz: 'buz' } }
  })
  deepEqual(parseJSONField(updated.metadata), { baz: 'buz' })

  // save without a primary key (insert path)
  const saved = await pageEntity.save({
    input: { metadata: { hello: 'world' } }
  })
  deepEqual(parseJSONField(saved.metadata), { hello: 'world' })

  // updateMany
  const [updatedMany] = await pageEntity.updateMany({
    where: { id: { eq: inserted.id } },
    input: { metadata: { updated: true } }
  })
  deepEqual(parseJSONField(updatedMany.metadata), { updated: true })

  // the stored values are correct
  const rows = await pageEntity.find({ orderBy: [{ field: 'id', direction: 'asc' }] })
  deepEqual(
    rows.map(r => parseJSONField(r.metadata)),
    [{ updated: true }, { hello: 'world' }]
  )
})
