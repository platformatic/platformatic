'use strict'

const { clear, connInfo, isSQLite } = require('./helper')
const { test } = require('node:test')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const tspl = require('@matteo.collina/tspl')

test('basic hooks', async (t) => {
  const { deepEqual: same, strictEqual: equal, notStrictEqual: not } = tspl(t, { plan: 15 })
  const app = fastify()
  t.after(() => {
    return app.close()
  })

  app.register(sqlMapper, {
    ...connInfo,
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
    },
    hooks: {
      Page: {
        noKey () {
          // This should never be called
        },
        async save (original, { input, ctx, fields }) {
          not(ctx.reply, undefined, 'ctx.reply is defined')
          not(ctx.app, undefined, 'ctx.app is defined')
          if (!input.id) {
            same(input, {
              title: 'Hello',
            })

            return original({
              input: {
                title: 'Hello from hook',
              },
              fields,
            })
          } else {
            same(input, {
              id: 1,
              title: 'Hello World',
            })

            return original({
              input: {
                id: 1,
                title: 'Hello from hook 2',
              },
              fields,
            })
          }
        },
        async find (original, args) {
          not(args.ctx.reply, undefined, 'ctx.reply is defined')
          not(args.ctx.app, undefined, 'ctx.app is defined')
          same(args.where, {
            id: {
              eq: 1,
            },
          })
          args.where = {
            id: {
              in: ['2'],
            },
          }
          same(args.fields, ['id', 'title'])
          return original(args)
        },
      },
    },
  })
  app.register(sqlOpenAPI)

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello',
      },
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello from hook',
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1?fields=id,title',
    })
    equal(res.statusCode, 404, 'GET /pages/1 status code')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/pages/1',
      body: {
        title: 'Hello World',
      },
    })
    equal(res.statusCode, 200, 'PUT /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello from hook 2',
    }, 'PUT /pages/1 response')
  }
})

test('delete hook', async (t) => {
  const app = fastify()
  t.after(() => app.close())

  const { deepEqual: same, strictEqual: equal, notStrictEqual: not } = tspl(t, { plan: 8 })
  app.register(sqlMapper, {
    ...connInfo,
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
    },
    hooks: {
      Page: {
        async delete (original, args) {
          not(args.ctx.app, undefined, 'ctx.app is defined')
          same(args.where, {
            id: {
              eq: 1,
            },
          })
          same(args.fields, ['id', 'title'])
          return original(args)
        },
      },
    },
  })
  app.register(sqlOpenAPI)

  await app.ready()
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello',
      },
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/pages/1?fields=id,title',
    })
    equal(res.statusCode, 200, 'DELETE /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
    }, 'DELETE /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1',
    })
    equal(res.statusCode, 404, 'GET /pages/1 status code')
  }
})
