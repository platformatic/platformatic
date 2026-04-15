import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isPg } from './helper.js'

test('expose vector columns as arrays of numbers', { skip: !isPg }, async t => {
  const seedApp = fastify()
  t.after(async () => {
    try {
      await seedApp.close()
    } catch {}
  })

  seedApp.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await db.query(sql`DROP TABLE IF EXISTS embeddings`)
      await db.query(sql`CREATE TABLE embeddings (
        id SERIAL PRIMARY KEY,
        embedding TEXT NOT NULL
      );`)
    }
  })

  await seedApp.ready()

  const dbschema = structuredClone(seedApp.platformatic.dbschema)
  const embeddings = dbschema.find(table => table.table === 'embeddings')
  embeddings.columns.find(column => column.column_name === 'embedding').udt_name = 'vector'

  await seedApp.close()

  const app = fastify()
  t.after(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    dbschema
  })
  app.register(sqlOpenAPI)

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })

    equal(res.statusCode, 200)
    const json = res.json()
    same(json.components.schemas.Embedding.properties.embedding, {
      type: 'array',
      items: {
        type: 'number'
      },
      nullable: true
    })
    same(json.components.schemas.EmbeddingInput.properties.embedding, {
      type: 'array',
      items: {
        type: 'number'
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/embeddings',
      body: {
        embedding: [1, 2.5, 3]
      }
    })

    equal(res.statusCode, 200)
    same(res.json(), {
      id: 1,
      embedding: [1, 2.5, 3]
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/embeddings/1'
    })

    equal(res.statusCode, 200)
    same(res.json(), {
      id: 1,
      embedding: [1, 2.5, 3]
    })
  }
})
