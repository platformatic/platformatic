import { createConnectionPool, connect } from '../index.js'
import { deepEqual as same, equal } from 'node:assert'
import { test } from 'node:test'
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

test('vector support (PG)', { skip: !isPg }, async t => {
  if (!(await ensureVectorExtension(t))) {
    return
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await db.query(sql`CREATE EXTENSION IF NOT EXISTS vector`)
      await db.query(sql`DROP TABLE IF EXISTS embeddings`)
      await db.query(sql`CREATE TABLE embeddings (
        id SERIAL PRIMARY KEY,
        embedding vector(3) NOT NULL
      )`)
    },
    ignore: {},
    hooks: {}
  })

  t.after(() => mapper.db.dispose())

  const embeddingEntity = mapper.entities.embedding
  equal(embeddingEntity.fields.embedding.sqlType, 'vector')
  equal(embeddingEntity.fields.embedding.vectorDimensions, 3)

  const saved = await embeddingEntity.save({
    fields: ['id', 'embedding'],
    input: {
      embedding: [1, 2.5, 3]
    }
  })

  same(saved, {
    id: '1',
    embedding: [1, 2.5, 3]
  })

  const found = await embeddingEntity.find({
    fields: ['id', 'embedding'],
    where: {
      embedding: {
        eq: [1, 2.5, 3]
      }
    }
  })

  same(found, [
    {
      id: '1',
      embedding: [1, 2.5, 3]
    }
  ])
})
