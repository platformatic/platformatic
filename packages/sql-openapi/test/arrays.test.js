import Snap from '@matteo.collina/snap'
import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isPg } from './helper.js'

const snap = Snap(import.meta.filename)

test('expose arrays', { skip: !isPg }, async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      tags VARCHAR(42)[] NOT NULL
    );`)
    }
  })
  app.register(sqlOpenAPI)
  t.after(async () => {
    await app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    equal(res.json().info.version, '1.0.0', 'GET /documentation/json info version default')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello',
        tags: ['foo', 'bar']
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/pages/1', 'POST /api/pages location')
    same(
      res.json(),
      {
        id: '1',
        title: 'Hello',
        tags: ['foo', 'bar']
      },
      'POST /pages response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(
      res.json(),
      {
        id: '1',
        title: 'Hello',
        tags: ['foo', 'bar']
      },
      'GET /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.any=foo'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(
      res.json(),
      [
        {
          id: '1',
          title: 'Hello',
          tags: ['foo', 'bar']
        }
      ],
      'GET /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.any=baz'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(res.json(), [], 'GET /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.all=foo'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(res.json(), [], 'GET /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.contains=foo'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(
      res.json(),
      [
        {
          id: '1',
          title: 'Hello',
          tags: ['foo', 'bar']
        }
      ],
      'GET /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.contained=foo,bar'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(
      res.json(),
      [
        {
          id: '1',
          title: 'Hello',
          tags: ['foo', 'bar']
        }
      ],
      'GET /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.overlaps=foo'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(
      res.json(),
      [
        {
          id: '1',
          title: 'Hello',
          tags: ['foo', 'bar']
        }
      ],
      'GET /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/pages/1',
      body: {
        title: 'Hello World',
        tags: ['foo', 'bar', 'baz']
      }
    })
    equal(res.statusCode, 200, 'PUT /pages/1 status code')
    same(
      res.json(),
      {
        id: '1',
        title: 'Hello World',
        tags: ['foo', 'bar', 'baz']
      },
      'PUT /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(
      res.json(),
      {
        id: '1',
        title: 'Hello World',
        tags: ['foo', 'bar', 'baz']
      },
      'GET /pages/1 response'
    )
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        tilte: 'Hello' // typo, wrong field
      }
    })
    equal(res.statusCode, 400, 'POST /pages status code')
    equal(res.headers.location, undefined, 'no location header')
    same(
      res.json(),
      {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: "body must have required property 'tags'"
      },
      'POST /pages response'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const json = res.json()
    const snapshot = await snap(json)
    same(json, snapshot)
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1?fields=title,tags'
    })
    same(
      res.json(),
      {
        title: 'Hello World',
        tags: ['foo', 'bar', 'baz']
      },
      'GET /pages/1?fields=title response'
    )
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/pages/1?fields=title,tags',
      body: {
        title: 'Hello fields',
        tags: []
      }
    })
    same(
      res.json(),
      {
        title: 'Hello fields',
        tags: []
      },
      'PUT /pages/1?fields=title response'
    )
  }
})

test('filter arrays with contains, contained and overlaps', { skip: !isPg }, async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      tags VARCHAR(42)[] NOT NULL
    );`)
    }
  })
  app.register(sqlOpenAPI)
  t.after(async () => {
    await app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const properties = res.json().paths['/pages/'].get.parameters.map(p => p.name)
    for (const modifier of ['contains', 'contained', 'overlaps']) {
      equal(properties.includes(`where.tags.${modifier}`), true, `where.tags.${modifier} is documented`)
    }
  }

  for (const page of [
    { title: 'First', tags: ['foo', 'bar'] },
    { title: 'Second', tags: ['bar', 'baz'] },
    { title: 'Third', tags: ['qux'] }
  ]) {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: page
    })
    equal(res.statusCode, 200, 'POST /pages status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.overlaps=foo'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.overlaps=foo status code')
    same(
      res.json().map(p => p.title),
      ['First'],
      'overlaps with a single value only matches pages containing it'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.overlaps=foo,baz&orderby.id=asc'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.overlaps=foo,baz status code')
    same(
      res.json().map(p => p.title),
      ['First', 'Second'],
      'overlaps with multiple values matches pages containing any of them'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.overlaps=nope'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.overlaps=nope status code')
    same(res.json(), [], 'overlaps with no matching value returns an empty list')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.contains=bar&orderby.id=asc'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.contains=bar status code')
    same(
      res.json().map(p => p.title),
      ['First', 'Second'],
      'contains with a single value matches pages containing it'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.contains=foo,bar'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.contains=foo,bar status code')
    same(
      res.json().map(p => p.title),
      ['First'],
      'contains with multiple values only matches pages containing all of them'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.contained=foo,bar,baz&orderby.id=asc'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.contained=foo,bar,baz status code')
    same(
      res.json().map(p => p.title),
      ['First', 'Second'],
      'contained matches pages whose tags are a subset of the values'
    )
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.tags.contained=qux'
    })
    equal(res.statusCode, 200, 'GET /pages?where.tags.contained=qux status code')
    same(
      res.json().map(p => p.title),
      ['Third'],
      'contained with a single value only matches pages with no other tags'
    )
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/pages?where.tags.overlaps=bar,qux&fields=title',
      body: {
        title: 'Updated',
        tags: ['updated']
      }
    })
    equal(res.statusCode, 200, 'PUT /pages?where.tags.overlaps=bar,qux status code')
    equal(res.json().length, 3, 'updateMany with overlaps updates all matching pages')
  }
})
