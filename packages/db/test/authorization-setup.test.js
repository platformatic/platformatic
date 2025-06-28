'use strict'

const assert = require('node:assert/strict')
const { join } = require('node:path')
const { test } = require('node:test')
const { createFromConfig, getConnectionInfo, createBasicPages } = require('./helper')

test('configure authorizations works even with empty object', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    authorization: {},
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

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

    assert.deepEqual(
      JSON.parse(res.body),
      {
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
            path: ['savePage']
          }
        ]
      },
      'savePage response'
    )
  }
})

test('addCustomRule', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    authorization: {},
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    },
    plugins: {
      paths: [join(__dirname, 'fixtures', 'auth-in-code.js')]
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })
})
