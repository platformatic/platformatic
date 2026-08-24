import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass } from 'node:assert'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

// The API reference UI is pulled in through a dynamic import, so whether it is
// present in the module graph is the observable for "it was never loaded" -
// which is the point of the option, the 404 being only its side effect.
// These tests live in their own file because the check is process-wide: any
// application started with the default configuration loads the UI for good.
const require = createRequire(import.meta.url)

function apiReferenceIsLoaded () {
  // Normalise separators: on Windows the cache keys use backslashes.
  return Object.keys(require.cache).some(key => key.replace(/\\/g, '/').includes('@scalar/fastify-api-reference'))
}

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  } else if (isMysql) {
    await db.query(sql`CREATE TABLE pages (
      id INT NOT NULL AUTO_INCREMENT UNIQUE PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  }
}

function createApp (t, opts) {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, opts)
  t.after(() => app.close())
  return app
}

test('ui: false keeps the spec routes and never loads the API reference UI', async t => {
  const app = createApp(t, { ui: false })
  await app.ready()

  {
    const res = await app.inject({ method: 'GET', url: '/documentation/json' })
    equal(res.statusCode, 200, 'GET /documentation/json is served')
  }
  {
    const res = await app.inject({ method: 'GET', url: '/documentation/yaml' })
    equal(res.statusCode, 200, 'GET /documentation/yaml is served')
  }
  {
    const res = await app.inject({ method: 'GET', url: '/documentation/' })
    equal(res.statusCode, 404, 'GET /documentation/ has no UI')
  }

  equal(apiReferenceIsLoaded(), false, 'the API reference UI is not loaded')
})

// Positive control for the assertion above: it also proves the module graph
// check can observe the UI at all, so it cannot quietly stop measuring.
test('ui defaults to true: the API reference UI is served and loaded', async t => {
  const app = createApp(t, {})
  await app.ready()

  const res = await app.inject({ method: 'GET', url: '/documentation/' })
  equal(res.statusCode, 200, 'GET /documentation/ serves the UI')

  equal(apiReferenceIsLoaded(), true, 'the API reference UI is loaded')
})
