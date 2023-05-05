
'use strict'

const { buildConfig, connInfo, clear, createBasicPages } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')

test('configure authorizations works even with empty object', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    authorization: {},
    db: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')
        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  // This must fail because authorization is configured
  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
      },
      body: JSON.stringify({
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `
      })
    })
    equal(res.statusCode, 200, 'savePage status code')

    same(await res.body.json(), {
      data: {
        savePage: null
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }
})
