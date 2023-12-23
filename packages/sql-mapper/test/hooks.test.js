'use strict'

const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { connect } = require('..')
const { clear, connInfo, isSQLite } = require('./helper')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('basic hooks', async (t) => {
  const { ok, ifError, deepEqual } = tspl(t, { plan: 14 })
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(async () => {
        await clear(db, sql)
        db.dispose()
      })
      ok('onDatabaseLoad called')

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
    },
    hooks: {
      Page: {
        noKey () {
          ifError('noKey should never be called')
        },
        async save (original, { input, ctx, fields }) {
          ok('save  called')

          if (!input.id) {
            deepEqual(input, {
              title: 'Hello'
            })

            return original({
              input: {
                title: 'Hello from hook'
              },
              fields
            })
          } else {
            deepEqual(input, {
              id: 1,
              title: 'Hello World'
            })

            return original({
              input: {
                id: 1,
                title: 'Hello from hook 2'
              },
              fields
            })
          }
        },
        async find (original, args) {
          ok('find called')

          deepEqual(args.where, {
            id: {
              eq: '1'
            }
          })
          args.where = {
            id: {
              eq: '2'
            }
          }
          deepEqual(args.fields, ['id', 'title'])
          return original(args)
        },
        async insert (original, args) {
          ok('insert called')

          deepEqual(args.inputs, [{
            title: 'hello'
          }, {
            title: 'world'
          }])
          deepEqual(args.fields, ['id', 'title'])
          return original(args)
        }
      }
    }
  })

  const entity = mapper.entities.page

  deepEqual(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  deepEqual(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  deepEqual(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})

test('addEntityHooks', async (t) => {
  const { ok, ifError, deepEqual, throws } = tspl(t, { plan: 15 })
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(async () => {
        await clear(db, sql)
        db.dispose()
      })
      ok('onDatabaseLoad called')

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
    }
  })

  throws(() => mapper.addEntityHooks('user', {}), { message: 'Cannot find entity user' })

  mapper.addEntityHooks('page', {
    noKey () {
      ifError('noKey should never be called')
    },
    async save (original, { input, ctx, fields }) {
      ok('save  called')

      if (!input.id) {
        deepEqual(input, {
          title: 'Hello'
        })

        return original({
          input: {
            title: 'Hello from hook'
          },
          fields
        })
      } else {
        deepEqual(input, {
          id: 1,
          title: 'Hello World'
        })

        return original({
          input: {
            id: 1,
            title: 'Hello from hook 2'
          },
          fields
        })
      }
    },
    async find (original, args) {
      ok('find called')

      deepEqual(args.where, {
        id: {
          eq: '1'
        }
      })
      args.where = {
        id: {
          eq: '2'
        }
      }
      deepEqual(args.fields, ['id', 'title'])
      return original(args)
    },
    async insert (original, args) {
      ok('insert called')

      deepEqual(args.inputs, [{
        title: 'hello'
      }, {
        title: 'world'
      }])
      deepEqual(args.fields, ['id', 'title'])
      return original(args)
    }
  })

  const entity = mapper.entities.page

  deepEqual(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  deepEqual(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  deepEqual(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})

test('basic hooks with smaller cap name', async (t) => {
  const { ok, ifError, deepEqual } = tspl(t, { plan: 14 })
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(async () => {
        await clear(db, sql)
        db.dispose()
      })
      ok('onDatabaseLoad called')

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
    },
    hooks: {
      page: {
        noKey () {
          ifError('noKey should never be called')
        },
        async save (original, { input, ctx, fields }) {
          ok('save  called')

          if (!input.id) {
            deepEqual(input, {
              title: 'Hello'
            })

            return original({
              input: {
                title: 'Hello from hook'
              },
              fields
            })
          } else {
            deepEqual(input, {
              id: 1,
              title: 'Hello World'
            })

            return original({
              input: {
                id: 1,
                title: 'Hello from hook 2'
              },
              fields
            })
          }
        },
        async find (original, args) {
          ok('find called')

          deepEqual(args.where, {
            id: {
              eq: '1'
            }
          })
          args.where = {
            id: {
              eq: '2'
            }
          }
          deepEqual(args.fields, ['id', 'title'])
          return original(args)
        },
        async insert (original, args) {
          ok('insert called')

          deepEqual(args.inputs, [{
            title: 'hello'
          }, {
            title: 'world'
          }])
          deepEqual(args.fields, ['id', 'title'])
          return original(args)
        }
      }
    }
  })

  const entity = mapper.entities.page

  deepEqual(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  deepEqual(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  deepEqual(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})
