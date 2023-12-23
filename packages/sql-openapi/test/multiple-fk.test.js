'use strict'

const { clear, connInfo, isPg, isSQLite } = require('./helper')
const { test } = require('node:test')
const { deepEqual: same, equal } = require('node:assert/strict')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlOpenAPI = require('..')

test('multiple foreign keys pointing the same table', { skip: isSQLite }, async (t) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    if (isPg) {
      await db.query(sql`CREATE TABLE IF NOT EXISTS owners (
        id VARCHAR(42) PRIMARY KEY
      );`)

      await db.query(sql`CREATE TABLE IF NOT EXISTS editors (
        id VARCHAR(42) NOT NULL,
        fk_id VARCHAR(42) NOT NULL,
        custom_id VARCHAR(42) NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (custom_id) REFERENCES owners (id),
        FOREIGN KEY (fk_id) REFERENCES owners (id)
      );`)
    } else {
      await db.query(sql`CREATE TABLE IF NOT EXISTS owners (
        id VARCHAR(42) PRIMARY KEY
      );`)

      await db.query(sql`CREATE TABLE IF NOT EXISTS editors (
        id varchar(42) NOT NULL,
        fk_id varchar(42) NOT NULL,
        custom_id varchar(42) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT editors_custom_id_foreign_idx FOREIGN KEY (custom_id) REFERENCES owners (id),
        CONSTRAINT editors_fk_id_foreign_idx FOREIGN KEY (fk_id) REFERENCES owners (id)
      );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    onDatabaseLoad
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: {
        id: 'maccio'
      }
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    same(res.json(), {
      id: 'maccio'
    }, 'POST /owners response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: {
        id: 'pino'
      }
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    same(res.json(), {
      id: 'pino'
    }, 'POST /owners response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: {
        id: 'herbert'
      }
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    same(res.json(), {
      id: 'herbert'
    }, 'POST /owners response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 'IL LIBRO',
        fkId: 'maccio',
        customId: 'pino'
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 'IL LIBRO',
      fkId: 'maccio',
      customId: 'pino'
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 'IL LIBRO 2!',
        fkId: 'herbert',
        customId: 'maccio'
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 'IL LIBRO 2!',
      fkId: 'herbert',
      customId: 'maccio'
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 'capatonda',
        fkId: 'maccio',
        customId: 'maccio'
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 'capatonda',
      fkId: 'maccio',
      customId: 'maccio'
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 'cammino',
        fkId: 'pino',
        customId: 'pino'
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 'cammino',
      fkId: 'pino',
      customId: 'pino'
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 'ballerina',
        fkId: 'herbert',
        customId: 'herbert'
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 'ballerina',
      fkId: 'herbert',
      customId: 'herbert'
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 'following-not-existing-fk-id',
        fkId: 'ERROREEEEE!',
        customId: 'maccio'
      }
    })
    equal(res.statusCode, 500, 'POST /editors status code')
  }
})
