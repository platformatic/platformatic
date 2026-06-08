import sqlMapper, { createConnectionPool } from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
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

test('expose vector columns as arrays of numbers', { skip: !isPg }, async t => {
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
      minItems: 3,
      maxItems: 3,
      nullable: true
    })
    same(json.components.schemas.EmbeddingInput.properties.embedding, {
      type: 'array',
      items: {
        type: 'number'
      },
      minItems: 3,
      maxItems: 3
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
      method: 'POST',
      url: '/embeddings',
      body: {
        embedding: [1, 2.5]
      }
    })

    equal(res.statusCode, 400)
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
