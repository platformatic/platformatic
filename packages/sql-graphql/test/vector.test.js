import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same, ok } from 'node:assert'
import { test } from 'node:test'
import { printSchema } from 'graphql'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isPg } from './helper.js'

test('[PG] vector fields are exposed as float lists', { skip: !isPg }, async t => {
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
  app.register(sqlGraphQL)

  await app.ready()

  ok(printSchema(app.graphql.schema).includes('embedding: [Float]'))

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveEmbedding(input: { embedding: [1, 2.5, 3] }) {
              id
              embedding
            }
          }
        `
      }
    })

    equal(res.statusCode, 200)
    same(res.json(), {
      data: {
        saveEmbedding: {
          id: 1,
          embedding: [1, 2.5, 3]
        }
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getEmbeddingById(id: 1) {
              id
              embedding
            }
          }
        `
      }
    })

    equal(res.statusCode, 200)
    same(res.json(), {
      data: {
        getEmbeddingById: {
          id: 1,
          embedding: [1, 2.5, 3]
        }
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            embeddings(where: { embedding: { eq: [1, 2.5, 3] } }) {
              id
              embedding
            }
          }
        `
      }
    })

    equal(res.statusCode, 200)
    same(res.json(), {
      data: {
        embeddings: [
          {
            id: 1,
            embedding: [1, 2.5, 3]
          }
        ]
      }
    })
  }
})
