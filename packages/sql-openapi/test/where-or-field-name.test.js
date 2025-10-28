import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, deepEqual as same } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

test('where clause with field names starting with "or" should not be confused with where.or operator', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name VARCHAR(100),
          orange VARCHAR(50),
          order_code VARCHAR(50),
          organism VARCHAR(50),
          price INTEGER
        );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE products (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100),
          orange VARCHAR(50),
          order_code VARCHAR(50),
          organism VARCHAR(50),
          price INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          orange VARCHAR(50),
          order_code VARCHAR(50),
          organism VARCHAR(50),
          price INTEGER
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  // Insert test data
  const products = [
    {
      name: 'Apple',
      orange: 'sweet',
      orderCode: 'ORD001',
      organism: 'fruit',
      price: 100
    },
    {
      name: 'Orange',
      orange: 'citrus',
      orderCode: 'ORD002',
      organism: 'fruit',
      price: 150
    },
    {
      name: 'Carrot',
      orange: 'orange-color',
      orderCode: 'ORD003',
      organism: 'vegetable',
      price: 50
    },
    {
      name: 'Pumpkin',
      orange: 'orange-color',
      orderCode: 'ORD004',
      organism: 'vegetable',
      price: 200
    }
  ]

  for (const body of products) {
    const res = await app.inject({
      method: 'POST',
      url: '/products',
      body
    })
    equal(res.statusCode, 200, 'POST /products status code')
  }

  // Test 1: Query using where.orange (field starting with "or") with .eq operator
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.orange.eq=citrus&fields=id,name,orange'
    })
    equal(res.statusCode, 200, 'GET /products?where.orange.eq=citrus status code')
    same(
      res.json(),
      [{ id: 2, name: 'Orange', orange: 'citrus' }],
      'GET /products?where.orange.eq=citrus response'
    )
  }

  // Test 2: Query using where.orderCode (field starting with "or") with .eq operator
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.orderCode.eq=ORD001&fields=id,name,orderCode'
    })
    equal(res.statusCode, 200, 'GET /products?where.orderCode.eq=ORD001 status code')
    same(
      res.json(),
      [{ id: 1, name: 'Apple', orderCode: 'ORD001' }],
      'GET /products?where.orderCode.eq=ORD001 response'
    )
  }

  // Test 3: Query using where.organism (field starting with "or") with .eq operator
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.organism.eq=vegetable&fields=id,name,organism'
    })
    equal(res.statusCode, 200, 'GET /products?where.organism.eq=vegetable status code')
    same(
      res.json(),
      [
        { id: 3, name: 'Carrot', organism: 'vegetable' },
        { id: 4, name: 'Pumpkin', organism: 'vegetable' }
      ],
      'GET /products?where.organism.eq=vegetable response'
    )
  }

  // Test 4: Query using where.orange with .in operator
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.orange.in=orange-color,citrus&fields=id,name,orange'
    })
    equal(res.statusCode, 200, 'GET /products?where.orange.in=orange-color,citrus status code')
    same(
      res.json(),
      [
        { id: 2, name: 'Orange', orange: 'citrus' },
        { id: 3, name: 'Carrot', orange: 'orange-color' },
        { id: 4, name: 'Pumpkin', orange: 'orange-color' }
      ],
      'GET /products?where.orange.in=orange-color,citrus response'
    )
  }

  // Test 5: Ensure where.or (the actual OR operator) still works correctly
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.or=(name.eq=Apple|name.eq=Orange)&fields=id,name'
    })
    equal(res.statusCode, 200, 'GET /products?where.or=(name.eq=Apple|name.eq=Orange) status code')
    same(
      res.json(),
      [
        { id: 1, name: 'Apple' },
        { id: 2, name: 'Orange' }
      ],
      'GET /products?where.or=(name.eq=Apple|name.eq=Orange) response'
    )
  }

  // Test 6: Combine where.or with where.orange to ensure both work together
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.or=(price.eq=100|price.eq=150)&where.orange.eq=citrus&fields=id,name,orange,price'
    })
    equal(
      res.statusCode,
      200,
      'GET /products?where.or=(price.eq=100|price.eq=150)&where.orange.eq=citrus status code'
    )
    same(
      res.json(),
      [{ id: 2, name: 'Orange', orange: 'citrus', price: 150 }],
      'GET /products?where.or=(price.eq=100|price.eq=150)&where.orange.eq=citrus response'
    )
  }

  // Test 7: Multiple fields starting with "or" in the same query
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.orange.eq=orange-color&where.organism.eq=vegetable&fields=id,name,orange,organism'
    })
    equal(
      res.statusCode,
      200,
      'GET /products?where.orange.eq=orange-color&where.organism.eq=vegetable status code'
    )
    same(
      res.json(),
      [
        { id: 3, name: 'Carrot', orange: 'orange-color', organism: 'vegetable' },
        { id: 4, name: 'Pumpkin', orange: 'orange-color', organism: 'vegetable' }
      ],
      'GET /products?where.orange.eq=orange-color&where.organism.eq=vegetable response'
    )
  }

  // Test 8: Test with where.orderCode using different operators
  {
    const res = await app.inject({
      method: 'GET',
      url: '/products?where.orderCode.in=ORD001,ORD003&fields=id,name,orderCode'
    })
    equal(res.statusCode, 200, 'GET /products?where.orderCode.in=ORD001,ORD003 status code')
    same(
      res.json(),
      [
        { id: 1, name: 'Apple', orderCode: 'ORD001' },
        { id: 3, name: 'Carrot', orderCode: 'ORD003' }
      ],
      'GET /products?where.orderCode.in=ORD001,ORD003 response'
    )
  }
})
