'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { deepEqual: same, equal, ok: pass } = require('node:assert/strict')
const Snap = require('@matteo.collina/snap')
const { test } = require('node:test')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

const snap = Snap(__filename)

test('nested routes', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

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
            long_text TEXT,
            counter INTEGER,
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
            long_text TEXT,
            counter INTEGER,
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
          long_text TEXT,
          counter INTEGER,
          owner_id INTEGER REFERENCES owners(id)
        );`)
      }
    },
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json',
    })
    const openapi = res.json()
    const snapshot = await snap(openapi)
    same(openapi, snapshot)
  }

  const owners = [{
    name: 'Matteo',
  }, {
    name: 'Luca',
  }, {
    name: 'Marco',
  }]

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10,
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20,
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30,
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40,
  }, {
    title: 'Jellyfish',
    longText: 'Jelly',
    counter: 50,
  }, {
    title: 'Snake',
    longText: 'Hiss',
    counter: 60,
  }, {
    title: 'Howl',
    longText: 'Hoot',
    counter: 70,
  }, {
    title: 'Rabbit',
    longText: 'Squeak',
    counter: 80,
  }, {
    title: 'Whale',
    longText: 'Sing',
    counter: 90,
  }, {
    title: 'Eagle',
    longText: 'Scream',
    counter: 100,
  }, {
    title: 'Donkey',
    longText: 'Bray',
    counter: 110,
  }, {
    title: 'Elephant',
    longText: 'Trumpet',
    counter: 120,
  }, {
    title: 'Gorilla',
    longText: 'Gibber',
    counter: 130,
  }, {
    title: 'Pork',
    longText: 'Oink',
    counter: 140,
  }]

  const ownerIds = []
  for (const body of owners) {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body,
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    ownerIds.push(res.json().id)
  }

  // Marco has no posts on purpose
  posts[0].ownerId = ownerIds[0]
  posts[1].ownerId = ownerIds[0]
  posts[2].ownerId = ownerIds[1]
  posts[3].ownerId = ownerIds[1]
  posts[4].ownerId = null
  posts[5].ownerId = ownerIds[0]
  posts[6].ownerId = ownerIds[0]
  posts[7].ownerId = ownerIds[0]
  posts[8].ownerId = ownerIds[0]
  posts[9].ownerId = ownerIds[0]
  posts[10].ownerId = ownerIds[0]
  posts[11].ownerId = ownerIds[0]
  posts[12].ownerId = ownerIds[0]
  posts[13].ownerId = ownerIds[0]

  for (const body of posts) {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body,
    })
    equal(res.statusCode, 200, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: `/owners/${ownerIds[0]}/posts?fields=title,longText,counter,ownerId&limit=100`,
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [
      posts[0],
      posts[1],
      posts[5],
      posts[6],
      posts[7],
      posts[8],
      posts[9],
      posts[10],
      posts[11],
      posts[12],
      posts[13],
    ], 'GET /owners/:id/posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: `/owners/${ownerIds[0]}/posts?fields=title,longText,counter,ownerId&totalCount=true`,
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [
      posts[0],
      posts[1],
      posts[5],
      posts[6],
      posts[7],
      posts[8],
      posts[9],
      posts[10],
      posts[11],
      posts[12],
    ], 'GET /owners/:id/posts response')

    equal(res.headers['x-total-count'], '11')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: `/owners/${ownerIds[0]}/posts?fields=title,longText,counter,ownerId&limit=2&totalCount=true`,
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [
      posts[0],
      posts[1],
    ], 'GET /owners/:id/posts response')

    equal(res.headers['x-total-count'], '11')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: `/owners/${ownerIds[0]}/posts?fields=title,longText,counter,ownerId&limit=2&offset=2&totalCount=true`,
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [
      posts[5],
      posts[6],
    ], 'GET /owners/:id/posts response')

    equal(res.headers['x-total-count'], '11')
  }

  {
    // Owner exists, but has no posts
    const res = await app.inject({
      method: 'GET',
      url: '/owners/3/posts',
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [], 'GET /owners/:id/posts response')
  }

  {
    // Owner does not exist
    const res = await app.inject({
      method: 'GET',
      url: '/owners/42/posts',
    })
    equal(res.statusCode, 404, 'GET /posts status code')
    same(res.json(), {
      message: 'Route GET:/owners/42/posts not found',
      error: 'Not Found',
      statusCode: 404,
    }, 'GET /owners/:id/posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts/3/owner',
    })
    equal(res.statusCode, 200, 'GET /posts/:id/owner status code')
    same(res.json().name, owners[1].name, 'GET /posts/:id/owner response')
  }

  {
    // Post does not exist
    const res = await app.inject({
      method: 'GET',
      url: '/posts/42/owner',
    })
    equal(res.statusCode, 404, 'GET /posts/:id/owner status code')
    same(res.json(), {
      message: 'Route GET:/posts/42/owner not found',
      error: 'Not Found',
      statusCode: 404,
    }, 'GET /posts/:id/owner response')
  }

  {
    // Post exists, owner does not
    const res = await app.inject({
      method: 'GET',
      url: '/posts/5/owner',
    })
    equal(res.statusCode, 404, 'GET /posts/:id/owner status code')
    same(res.json(), {
      message: 'Route GET:/posts/5/owner not found',
      error: 'Not Found',
      statusCode: 404,
    }, 'GET /posts/:id/owner response')
  }
})

// test('nested routes with recursive FK', async (t) => {
//   const app = fastify()
//   app.register(sqlMapper, {
//     ...connInfo,
//     async onDatabaseLoad (db, sql) {
//       pass('onDatabaseLoad called')

//       await clear(db, sql)

//       if (isMysql) {
//         await db.query(sql`
//           CREATE TABLE people (
//             id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
//             name VARCHAR(255) NOT NULL,
//             parent_id INT UNSIGNED,
//             FOREIGN KEY (parent_id) REFERENCES people(id)
//           );
//         `)
//       } else if (isSQLite) {
//         await db.query(sql`
//           CREATE TABLE people (
//             id INTEGER PRIMARY KEY,
//             name VARCHAR(255) NOT NULL,
//             parent_id INTEGER UNSIGNED,
//             FOREIGN KEY (parent_id) REFERENCES people(id)
//           );
//         `)
//       } else {
//         await db.query(sql`
//           CREATE TABLE people (
//             id SERIAL PRIMARY KEY,
//             name VARCHAR(255) NOT NULL,
//             parent_id INTEGER REFERENCES people(id)
//           );
//         `)
//       }
//     },
//   })
//   app.register(sqlOpenAPI)
//   t.after(() => app.close())

//   await app.ready()

//   {
//     const res = await app.inject({
//       method: 'GET',
//       url: '/documentation/json',
//     })
//     const openapi = res.json()
//     const snapshot = await snap(openapi)
//     same(openapi, snapshot)
//   }

//   const res = await app.inject({
//     method: 'POST',
//     url: '/people',
//     body: {
//       name: 'Dad',
//     },
//   })
//   equal(res.statusCode, 200, 'POST /people status code')
//   const dad = res.json()

//   const res2 = await app.inject({
//     method: 'POST',
//     url: '/people',
//     body: {
//       name: 'Child',
//       parentId: dad.id,
//     },
//   })
//   equal(res.statusCode, 200, 'POST /people status code')
//   const child = res2.json()

//   {
//     const res = await app.inject({
//       method: 'GET',
//       url: '/people',
//     })
//     equal(res.statusCode, 200, 'GET /people status code')
//     same(res.json(), [{
//       id: 1,
//       name: 'Dad',
//       parentId: null,
//     }, {
//       id: 2,
//       name: 'Child',
//       parentId: 1,
//     }], 'GET /people response')
//   }

//   {
//     const res = await app.inject({
//       method: 'GET',
//       url: `/people/${child.id}/parent`,
//     })
//     equal(res.statusCode, 200, 'GET /people/:id/parent status code')
//     same(res.json(), {
//       id: 1,
//       name: 'Dad',
//       parentId: null,
//     }, 'GET /people/:id/parent response')
//   }
// })
