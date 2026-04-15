import sqlMapper, { createConnectionPool } from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same, ok } from 'node:assert'
import { test } from 'node:test'
import { printSchema } from 'graphql'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isPg } from './helper.js'

const fakeLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {}
}

async function ensureVectorExtension (t) {
  const { db, sql } = await createConnectionPool({
    log: fakeLogger,
    connectionString: connInfo.connectionString,
    poolSize: 1
  })

  try {
    const rows = await db.query(sql`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`)
    if (rows.length === 0) {
      t.skip('pgvector extension not available')
      return false
    }

    return true
  } finally {
    await db.dispose()
  }
}

test('[PG] vector fields are exposed as float lists', { skip: !isPg }, async t => {
  if (!(await ensureVectorExtension(t))) {
    return
  }

  const app = fastify()
  t.after(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await db.query(sql`CREATE EXTENSION IF NOT EXISTS vector`)
      await db.query(sql`DROP TABLE IF EXISTS embeddings`)
      await db.query(sql`CREATE TABLE embeddings (
        id SERIAL PRIMARY KEY,
        embedding vector(3) NOT NULL
      )`)
    }
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
