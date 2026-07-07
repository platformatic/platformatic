import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isPg, isSQLite } from './helper.js'

test('multiple foreign keys pointing the same table', { skip: isSQLite }, async t => {
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
    same(
      res.json(),
      {
        id: 'maccio'
      },
      'POST /owners response'
    )
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
    same(
      res.json(),
      {
        id: 'pino'
      },
      'POST /owners response'
    )
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
    same(
      res.json(),
      {
        id: 'herbert'
      },
      'POST /owners response'
    )
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
    same(
      res.json(),
      {
        id: 'IL LIBRO',
        fkId: 'maccio',
        customId: 'pino'
      },
      'POST /editors response'
    )
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
    same(
      res.json(),
      {
        id: 'IL LIBRO 2!',
        fkId: 'herbert',
        customId: 'maccio'
      },
      'POST /editors response'
    )
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
    same(
      res.json(),
      {
        id: 'capatonda',
        fkId: 'maccio',
        customId: 'maccio'
      },
      'POST /editors response'
    )
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
    same(
      res.json(),
      {
        id: 'cammino',
        fkId: 'pino',
        customId: 'pino'
      },
      'POST /editors response'
    )
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
    same(
      res.json(),
      {
        id: 'ballerina',
        fkId: 'herbert',
        customId: 'herbert'
      },
      'POST /editors response'
    )
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

test('foreign keys pointing to different tables do not change the route name', async t => {
  /* https://github.com/platformatic/platformatic/issues/1491 */
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    await db.query(sql`DROP TABLE IF EXISTS translations`)
    await db.query(sql`DROP TABLE IF EXISTS text_content`)
    await db.query(sql`DROP TABLE IF EXISTS languages`)

    if (isSQLite) {
      await db.query(sql`CREATE TABLE languages (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );`)
      await db.query(sql`CREATE TABLE text_content (
        id INTEGER PRIMARY KEY,
        content_key TEXT NOT NULL
      );`)
      await db.query(sql`CREATE TABLE translations (
        id INTEGER PRIMARY KEY,
        text TEXT NOT NULL,
        language_id INTEGER NOT NULL,
        text_content_id INTEGER NOT NULL,
        CONSTRAINT fk_translations_language FOREIGN KEY (language_id) REFERENCES languages(id),
        CONSTRAINT fk_translations_text_content FOREIGN KEY (text_content_id) REFERENCES text_content(id)
      );`)
    } else if (isMysql) {
      await db.query(sql`CREATE TABLE languages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );`)
      await db.query(sql`CREATE TABLE text_content (
        id SERIAL PRIMARY KEY,
        content_key TEXT NOT NULL
      );`)
      await db.query(sql`CREATE TABLE translations (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        language_id BIGINT UNSIGNED NOT NULL,
        text_content_id BIGINT UNSIGNED NOT NULL,
        CONSTRAINT fk_translations_language FOREIGN KEY (language_id) REFERENCES languages(id),
        CONSTRAINT fk_translations_text_content FOREIGN KEY (text_content_id) REFERENCES text_content(id)
      );`)
    } else {
      await db.query(sql`CREATE TABLE languages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );`)
      await db.query(sql`CREATE TABLE text_content (
        id SERIAL PRIMARY KEY,
        content_key TEXT NOT NULL
      );`)
      await db.query(sql`CREATE TABLE translations (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        language_id INTEGER NOT NULL,
        text_content_id INTEGER NOT NULL,
        CONSTRAINT fk_translations_language FOREIGN KEY (language_id) REFERENCES languages(id),
        CONSTRAINT fk_translations_text_content FOREIGN KEY (text_content_id) REFERENCES text_content(id)
      );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    onDatabaseLoad
  })
  app.register(sqlOpenAPI)
  t.after(async () => {
    const { db, sql } = app.platformatic
    await db.query(sql`DROP TABLE IF EXISTS translations`)
    await db.query(sql`DROP TABLE IF EXISTS text_content`)
    await db.query(sql`DROP TABLE IF EXISTS languages`)
    await app.close()
  })

  await app.ready()

  const res = await app.inject({ method: 'GET', url: '/documentation/json' })
  const openapi = res.json()

  // Each entity has a single relation per target table, so the plural
  // route names must be used
  equal(openapi.paths['/textContent/{id}/translations'] !== undefined, true, '/textContent/{id}/translations exists')
  equal(openapi.paths['/languages/{id}/translations'] !== undefined, true, '/languages/{id}/translations exists')
  equal(openapi.paths['/textContent/{id}/translationTextContentId'], undefined, 'no disambiguated route')
})
