'use strict'

const { clear, connInfo, isPg, isSQLite } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlOpenAPI = require('..')

test('multiple foreign keys pointing the same table', { skip: isSQLite }, async ({ equal, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    if (isPg) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS test1 (
        id VARCHAR(42) PRIMARY KEY
      );`)

      await db.query(sql`CREATE TABLE IF NOT EXISTS test2 (
        id VARCHAR(42) NOT NULL,
        fk_id VARCHAR(42) NOT NULL,
        custom_id VARCHAR(42) NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (custom_id) REFERENCES test1 (id),
        FOREIGN KEY (fk_id) REFERENCES test1 (id)
      );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS test1 (
        id VARCHAR(42) PRIMARY KEY
      );`)

      await db.query(sql`CREATE TABLE IF NOT EXISTS test2 (
        id varchar(42) NOT NULL,
        fk_id varchar(42) NOT NULL,
        custom_id varchar(42) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT test2_custom_id_foreign_idx FOREIGN KEY (custom_id) REFERENCES test1 (id),
        CONSTRAINT test2_fk_id_foreign_idx FOREIGN KEY (fk_id) REFERENCES test1 (id)
      );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    onDatabaseLoad
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1',
      body: {
        id: 'maccio'
      }
    })
    equal(res.statusCode, 200, 'POST /test1 status code')
    same(res.json(), {
      id: 'maccio'
    }, 'POST /test1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1',
      body: {
        id: 'pino'
      }
    })
    equal(res.statusCode, 200, 'POST /test1 status code')
    same(res.json(), {
      id: 'pino'
    }, 'POST /test1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1',
      body: {
        id: 'herbert'
      }
    })
    equal(res.statusCode, 200, 'POST /test1 status code')
    same(res.json(), {
      id: 'herbert'
    }, 'POST /test1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2',
      body: {
        id: 'IL LIBRO',
        fkId: 'maccio',
        customId: 'pino'
      }
    })
    equal(res.statusCode, 200, 'POST /test2 status code')
    same(res.json(), {
      id: 'IL LIBRO',
      fkId: 'maccio',
      customId: 'pino'
    }, 'POST /test2 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2',
      body: {
        id: 'IL LIBRO 2!',
        fkId: 'herbert',
        customId: 'maccio'
      }
    })
    equal(res.statusCode, 200, 'POST /test2 status code')
    same(res.json(), {
      id: 'IL LIBRO 2!',
      fkId: 'herbert',
      customId: 'maccio'
    }, 'POST /test2 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2',
      body: {
        id: 'capatonda',
        fkId: 'maccio',
        customId: 'maccio'
      }
    })
    equal(res.statusCode, 200, 'POST /test2 status code')
    same(res.json(), {
      id: 'capatonda',
      fkId: 'maccio',
      customId: 'maccio'
    }, 'POST /test2 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2',
      body: {
        id: 'cammino',
        fkId: 'pino',
        customId: 'pino'
      }
    })
    equal(res.statusCode, 200, 'POST /test2 status code')
    same(res.json(), {
      id: 'cammino',
      fkId: 'pino',
      customId: 'pino'
    }, 'POST /test2 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2',
      body: {
        id: 'ballerina',
        fkId: 'herbert',
        customId: 'herbert'
      }
    })
    equal(res.statusCode, 200, 'POST /test2 status code')
    same(res.json(), {
      id: 'ballerina',
      fkId: 'herbert',
      customId: 'herbert'
    }, 'POST /test2 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2',
      body: {
        id: 'following-not-existing-fk-id',
        fkId: 'ERROREEEEE!',
        customId: 'maccio'
      }
    })
    equal(res.statusCode, 500, 'POST /test2 status code')
  }
})
