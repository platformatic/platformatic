'use strict'

const { test } = require('tap')
const { connect } = require('..')
const { clear, connInfo, isSQLite } = require('./helper')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('basic hooks', async ({ pass, teardown, same, equal, plan, fail }) => {
  plan(14)
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

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
          fail('noKey should never be called')
        },
        async save (original, { input, ctx, fields }) {
          pass('save  called')

          if (!input.id) {
            same(input, {
              title: 'Hello'
            })

            return original({
              input: {
                title: 'Hello from hook'
              },
              fields
            })
          } else {
            same(input, {
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
          pass('find called')

          same(args.where, {
            id: {
              eq: '1'
            }
          })
          args.where = {
            id: {
              eq: '2'
            }
          }
          same(args.fields, ['id', 'title'])
          return original(args)
        },
        async insert (original, args) {
          pass('insert called')

          same(args.inputs, [{
            title: 'hello'
          }, {
            title: 'world'
          }])
          same(args.fields, ['id', 'title'])
          return original(args)
        }
      }
    }
  })

  const entity = mapper.entities.page

  same(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  same(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  same(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})

test('addEntityHooks', async ({ pass, teardown, same, equal, plan, fail, throws }) => {
  plan(15)
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

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

  throws(() => mapper.addEntityHooks('user', {}), 'Cannot find entity user')

  mapper.addEntityHooks('page', {
    noKey () {
      fail('noKey should never be called')
    },
    async save (original, { input, ctx, fields }) {
      pass('save  called')

      if (!input.id) {
        same(input, {
          title: 'Hello'
        })

        return original({
          input: {
            title: 'Hello from hook'
          },
          fields
        })
      } else {
        same(input, {
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
      pass('find called')

      same(args.where, {
        id: {
          eq: '1'
        }
      })
      args.where = {
        id: {
          eq: '2'
        }
      }
      same(args.fields, ['id', 'title'])
      return original(args)
    },
    async insert (original, args) {
      pass('insert called')

      same(args.inputs, [{
        title: 'hello'
      }, {
        title: 'world'
      }])
      same(args.fields, ['id', 'title'])
      return original(args)
    }
  })

  const entity = mapper.entities.page

  same(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  same(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  same(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})

test('basic hooks with smaller cap name', async ({ pass, teardown, same, equal, plan, fail }) => {
  plan(14)
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      teardown(() => db.dispose())
      pass('onDatabaseLoad called')

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
          fail('noKey should never be called')
        },
        async save (original, { input, ctx, fields }) {
          pass('save  called')

          if (!input.id) {
            same(input, {
              title: 'Hello'
            })

            return original({
              input: {
                title: 'Hello from hook'
              },
              fields
            })
          } else {
            same(input, {
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
          pass('find called')

          same(args.where, {
            id: {
              eq: '1'
            }
          })
          args.where = {
            id: {
              eq: '2'
            }
          }
          same(args.fields, ['id', 'title'])
          return original(args)
        },
        async insert (original, args) {
          pass('insert called')

          same(args.inputs, [{
            title: 'hello'
          }, {
            title: 'world'
          }])
          same(args.fields, ['id', 'title'])
          return original(args)
        }
      }
    }
  })

  const entity = mapper.entities.page

  same(await entity.save({ input: { title: 'Hello' } }), {
    id: 1,
    title: 'Hello from hook'
  })

  same(await entity.find({ where: { id: { eq: 1 } }, fields: ['id', 'title'] }), [])

  same(await entity.save({ input: { id: 1, title: 'Hello World' } }), {
    id: 1,
    title: 'Hello from hook 2'
  })

  await entity.insert({ inputs: [{ title: 'hello' }, { title: 'world' }], fields: ['id', 'title'] })
})
