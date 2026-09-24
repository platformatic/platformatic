import { deepEqual, equal, ok, rejects } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

async function setup (t, saveDispatch, opts = {}) {
  const mapper = await connect({
    ...connInfo,
    ...opts,
    saveDispatch,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42)
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42)
        );`)
      }
      await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
    }
  })

  t.after(async () => {
    await clear(mapper.db, mapper.sql)
    await mapper.db.dispose()
  })

  const calls = []
  mapper.addEntityHooks('page', {
    async save (original, args) {
      calls.push('save')
      return original(args)
    },
    async update (original, args) {
      const res = await original(args)
      calls.push(res ? 'update' : 'update:null')
      return res
    },
    async insert (original, args) {
      calls.push('insert')
      return original(args)
    }
  })

  return { mapper, entity: mapper.entities.page, calls }
}

for (const saveDispatch of [false, true]) {
  const mode = `saveDispatch: ${saveDispatch}`

  test(`${mode} - saveDispatch is exposed on the mapper`, async t => {
    const { mapper } = await setup(t, saveDispatch)
    equal(mapper.saveDispatch, saveDispatch)
  })

  test(`${mode} - entity.update updates an existing row and fires the update hook`, async t => {
    const { entity, calls } = await setup(t, saveDispatch)
    const created = await entity.insert({ inputs: [{ title: 'Hello' }] })
    calls.length = 0

    const res = await entity.update({ input: { id: created[0].id, title: 'Updated' }, fields: ['id', 'title'] })
    deepEqual(res, { id: created[0].id, title: 'Updated' })
    deepEqual(calls, ['update'])
  })

  test(`${mode} - entity.update on a missing row returns null and inserts nothing`, async t => {
    const { entity, calls } = await setup(t, saveDispatch)

    const res = await entity.update({ input: { id: 42, title: 'Ghost' } })
    equal(res, null)
    deepEqual(calls, ['update:null'])
    deepEqual(await entity.find({}), [])
  })

  test(`${mode} - entity.update without a primary key throws`, async t => {
    const { entity } = await setup(t, saveDispatch)

    await rejects(entity.update({ input: { title: 'No PK' } }), {
      code: 'PLT_SQL_MAPPER_MISSING_VALUE_FOR_PRIMARY_KEY'
    })
    await rejects(entity.update({}), { code: 'PLT_SQL_MAPPER_INPUT_NOT_PROVIDED' })
  })

  test(`${mode} - entity.update forwards the transaction`, async t => {
    const { mapper, entity } = await setup(t, saveDispatch)
    const [created] = await entity.insert({ inputs: [{ title: 'Hello' }] })

    await rejects(
      mapper.db.tx(async tx => {
        const res = await entity.update({ input: { id: created.id, title: 'In tx' }, tx })
        equal(res.title, 'In tx')
        throw new Error('rollback')
      }),
      { message: 'rollback' }
    )

    const [row] = await entity.find({ where: { id: { eq: created.id } } })
    equal(row.title, 'Hello')
  })

  test(`${mode} - save forwards the transaction`, async t => {
    const { mapper, entity } = await setup(t, saveDispatch)

    await rejects(
      mapper.db.tx(async tx => {
        await entity.save({ input: { title: 'In tx' }, tx })
        throw new Error('rollback')
      }),
      { message: 'rollback' }
    )

    deepEqual(await entity.find({}), [])
  })

  test(`${mode} - views have no update`, async t => {
    const { mapper } = await setup(t, saveDispatch)
    equal(mapper.entities.pagesView.update, undefined)
  })

  test(`${mode} - update hooks passed to connect are applied`, async t => {
    let called = 0
    const { entity } = await setup(t, saveDispatch, {
      hooks: {
        Page: {
          async update (original, args) {
            called++
            return original(args)
          }
        }
      }
    })
    const [created] = await entity.insert({ inputs: [{ title: 'Hello' }] })
    await entity.update({ input: { id: created.id, title: 'Updated' } })
    equal(called, 1)
  })
}

test('saveDispatch defaults to false', async t => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
    }
  })
  t.after(() => mapper.db.dispose())
  equal(mapper.saveDispatch, false)
})

test('saveDispatch: false - save never fires update or insert hooks', async t => {
  const { entity, calls } = await setup(t, false)

  const created = await entity.save({ input: { title: 'Hello' } })
  const updated = await entity.save({ input: { id: created.id, title: 'Updated' } })
  const upserted = await entity.save({ input: { id: 42, title: 'Upserted' } })

  equal(updated.title, 'Updated')
  equal(upserted.id, '42')
  deepEqual(calls, ['save', 'save', 'save'])
})

test('saveDispatch: true - save with an existing PK fires update, not insert', async t => {
  const { entity, calls } = await setup(t, true)
  const [created] = await entity.insert({ inputs: [{ title: 'Hello' }] })
  calls.length = 0

  const res = await entity.save({ input: { id: created.id, title: 'Updated' }, fields: ['id', 'title'] })
  deepEqual(res, { id: created.id, title: 'Updated' })
  deepEqual(calls, ['save', 'update'])
})

test('saveDispatch: true - save without PKs fires insert, not update', async t => {
  const { entity, calls } = await setup(t, true)

  const res = await entity.save({ input: { title: 'Hello' }, fields: ['id', 'title'] })
  ok(res.id)
  equal(res.title, 'Hello')
  deepEqual(calls, ['save', 'insert'])
})

test('saveDispatch: true - save with a PK for a missing row falls back to insert', async t => {
  const { entity, calls } = await setup(t, true)

  const res = await entity.save({ input: { id: 42, title: 'Upserted' } })
  equal(res.id, '42')
  equal(res.title, 'Upserted')
  deepEqual(calls, ['save', 'update:null', 'insert'])

  const rows = await entity.find({ where: { id: { eq: 42 } } })
  equal(rows.length, 1)
})

test('saveDispatch: true - save hooks wrap the whole call', async t => {
  const { entity } = await setup(t, true)
  const order = []
  // wrap again, outermost
  const inner = entity.save
  entity.save = async args => {
    order.push('save:before')
    const res = await inner(args)
    order.push('save:after')
    return res
  }
  const innerInsert = entity.insert
  entity.insert = async args => {
    order.push('insert')
    return innerInsert(args)
  }

  await entity.save({ input: { title: 'Hello' } })
  deepEqual(order, ['save:before', 'insert', 'save:after'])
})

test('saveDispatch: true - save hooks can rewrite the input', async t => {
  const { mapper, entity } = await setup(t, true)
  mapper.addEntityHooks('page', {
    async save (original, args) {
      return original({ ...args, input: { ...args.input, title: 'From hook' } })
    }
  })

  const res = await entity.save({ input: { title: 'Hello' } })
  equal(res.title, 'From hook')
})

test('saveDispatch: true - save without input throws', async t => {
  const { entity } = await setup(t, true)
  await rejects(entity.save({}), { code: 'PLT_SQL_MAPPER_INPUT_NOT_PROVIDED' })
})

for (const saveDispatch of [false, true]) {
  test(`saveDispatch: ${saveDispatch} - save create ignores user-provided autoTimestamp fields`, async t => {
    const mapper = await connect({
      ...connInfo,
      saveDispatch,
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
        } else if (isMysql) {
          await db.query(sql`CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            inserted_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP NULL DEFAULT NULL
          );`)
        } else {
          await db.query(sql`CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            inserted_at TIMESTAMP,
            updated_at TIMESTAMP
          );`)
        }
      }
    })
    t.after(async () => {
      await clear(mapper.db, mapper.sql)
      await mapper.db.dispose()
    })

    const before = Date.now() - 60_000
    const res = await mapper.entities.page.save({
      input: { title: 'Hello', insertedAt: 1000, updatedAt: 1000 }
    })
    ok(new Date(res.insertedAt).getTime() > before)
    ok(new Date(res.updatedAt).getTime() > before)
  })
}
