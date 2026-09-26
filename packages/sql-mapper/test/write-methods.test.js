import { deepEqual, equal, ok, rejects } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace () {},
  error () {},
  warn () {}
}

async function setup (t) {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          inserted_at TIMESTAMP,
          updated_at TIMESTAMP
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          inserted_at TIMESTAMP,
          updated_at TIMESTAMP
        );`)
      }
      await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
    }
  })

  t.after(async () => {
    await clear(mapper.db, mapper.sql)
    await mapper.db.dispose()
  })

  return { mapper, entity: mapper.entities.page }
}

test('explicit single and bulk write methods have stable return cardinality', async t => {
  const { entity } = await setup(t)

  const inserted = await entity.insert({ input: { title: 'one' }, fields: ['id', 'title'] })
  equal(inserted.title, 'one')
  ok(inserted.id)

  const insertedMany = await entity.insertMany({
    inputs: [{ title: 'two' }, { title: 'three' }],
    fields: ['id', 'title']
  })
  equal(insertedMany.length, 2)
  deepEqual(insertedMany.map(row => row.title), ['two', 'three'])

  await rejects(entity.insert({}), { code: 'PLT_SQL_MAPPER_INPUT_NOT_PROVIDED' })
  await rejects(entity.insertMany({}), { code: 'PLT_SQL_MAPPER_INPUT_NOT_PROVIDED' })
})

test('update requires all primary keys, never inserts and returns null when absent', async t => {
  const { entity } = await setup(t)
  const inserted = await entity.insert({ input: { title: 'one' } })

  const updated = await entity.update({ input: { id: inserted.id, title: 'updated' }, fields: ['id', 'title'] })
  deepEqual(updated, { id: inserted.id, title: 'updated' })

  equal(await entity.update({ input: { id: 999, title: 'missing' } }), null)
  equal((await entity.find({})).length, 1)

  await rejects(entity.update({ input: { title: 'no key' } }), {
    code: 'PLT_SQL_MAPPER_MISSING_VALUE_FOR_PRIMARY_KEY'
  })
  await rejects(entity.update({}), { code: 'PLT_SQL_MAPPER_INPUT_NOT_PROVIDED' })
})

test('upsert and deprecated save compose their outer hook with insert and update hooks', async t => {
  const { mapper, entity } = await setup(t)
  const calls = []

  mapper.addEntityHooks('page', {
    async insert (original, args) {
      calls.push('insert')
      return original(args)
    },
    async update (original, args) {
      const result = await original(args)
      calls.push(result ? 'update' : 'update:null')
      return result
    },
    async upsert (original, args) {
      calls.push('upsert')
      return original(args)
    },
    async save (original, args) {
      calls.push('save')
      return original(args)
    }
  })

  const inserted = await entity.upsert({ input: { title: 'one' } })
  deepEqual(calls, ['upsert', 'insert'])

  calls.length = 0
  await entity.upsert({ input: { id: inserted.id, title: 'updated' } })
  deepEqual(calls, ['upsert', 'update'])

  calls.length = 0
  await entity.upsert({ input: { id: 999, title: 'fallback' } })
  deepEqual(calls, ['upsert', 'update:null', 'insert'])

  calls.length = 0
  await entity.save({ input: { title: 'legacy' } })
  deepEqual(calls, ['save', 'insert'])
})

test('insert and update forward transactions', async t => {
  const { mapper, entity } = await setup(t)

  await rejects(
    mapper.db.tx(async tx => {
      const inserted = await entity.insert({ input: { title: 'one' }, tx })
      await entity.update({ input: { id: inserted.id, title: 'updated' }, tx })
      throw new Error('rollback')
    }),
    { message: 'rollback' }
  )

  deepEqual(await entity.find({}), [])
})

test('insert and update apply the expected timestamps', async t => {
  const { entity } = await setup(t)
  const beforeInsert = Date.now() - 1000
  const inserted = await entity.insert({ input: { title: 'one' } })
  ok(new Date(inserted.insertedAt).getTime() >= beforeInsert)
  ok(new Date(inserted.updatedAt).getTime() >= beforeInsert)

  const insertedAt = new Date(inserted.insertedAt).getTime()
  await new Promise(resolve => setTimeout(resolve, 1010))
  const updated = await entity.update({ input: { id: inserted.id, title: 'updated' } })
  equal(new Date(updated.insertedAt).getTime(), insertedAt)
  ok(new Date(updated.updatedAt).getTime() > new Date(inserted.updatedAt).getTime())
})

test('views do not expose write methods', async t => {
  const { mapper } = await setup(t)
  const view = mapper.entities.pagesView

  equal(view.insert, undefined)
  equal(view.insertMany, undefined)
  equal(view.update, undefined)
  equal(view.updateMany, undefined)
  equal(view.upsert, undefined)
  equal(view.save, undefined)
})
