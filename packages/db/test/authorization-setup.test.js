'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo, createBasicPages } = require('./helper')

test('configure authorizations works even with empty object', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    authorization: {},
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  // This must fail because authorization is configured
  {
    const res = await app.inject({
      url: '/graphql',
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
    assert.equal(res.statusCode, 200, 'savePage status code')

    assert.deepEqual(await res.json(), {
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
