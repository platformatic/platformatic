import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(42)
    );`)
  }
}

test('ignore a root entity route', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignoreRoutes: [
      { path: '/pages', method: 'GET' },
      { path: '/pages', method: 'PUT' }
    ]
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({ method: 'GET', url: '/pages' })
    strictEqual(res.statusCode, 404)
  }
  {
    const res = await app.inject({ method: 'PUT', url: '/pages' })
    strictEqual(res.statusCode, 404)
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: { title: 'hello' }
    })
    strictEqual(res.statusCode, 200, res.body)
  }
})

test('ignoreAllReverseRoutes disables all relationship routes', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE owners (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE posts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(42),
            owner_id INT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE owners (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)
        await db.query(sql`
          CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            owner_id BIGINT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE owners (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            owner_id INTEGER REFERENCES owners(id)
          );
        `)
      }
    }
  })
  app.register(sqlOpenAPI, {
    ignoreAllReverseRoutes: true
  })
  t.after(() => app.close())

  await app.ready()

  // Create an owner
  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: { name: 'John' }
    })
    strictEqual(res.statusCode, 200, res.body)
  }

  // Create a post linked to the owner
  {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body: { title: 'Hello', ownerId: 1 }
    })
    strictEqual(res.statusCode, 200, res.body)
  }

  // Regular CRUD routes should still work
  {
    const res = await app.inject({ method: 'GET', url: '/owners' })
    strictEqual(res.statusCode, 200)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/owners/1' })
    strictEqual(res.statusCode, 200)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/posts' })
    strictEqual(res.statusCode, 200)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/posts/1' })
    strictEqual(res.statusCode, 200)
  }

  // Reverse relationship route: GET /owners/1/posts should be 404
  {
    const res = await app.inject({ method: 'GET', url: '/owners/1/posts' })
    strictEqual(res.statusCode, 404)
  }

  // FK-navigation route: GET /posts/1/owner should be 404
  {
    const res = await app.inject({ method: 'GET', url: '/posts/1/owner' })
    strictEqual(res.statusCode, 404)
  }
})

test('ignore a parametric entity route', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignoreRoutes: [
      { path: '/pages/{id}', method: 'GET' },
      { path: '/pages/{id}', method: 'PUT' }
    ]
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: { title: 'hello' }
    })
    strictEqual(res.statusCode, 200, res.body)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/pages' })
    strictEqual(res.statusCode, 200)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/pages/1' })
    strictEqual(res.statusCode, 404)
  }
})
