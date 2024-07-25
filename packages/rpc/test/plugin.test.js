'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')

test('should generate an openapi schema from a ts app', async (t) => {
  const fixtureDir = join(__dirname, 'fixtures', 'js-app-1')

  const app = require(join(fixtureDir, 'index.js'))
  await app.ready()

  t.after(() => app.close())

  {
    const { statusCode, body } = await app.inject({
      method: 'POST',
      url: '/rpc/getUsers',
      body: JSON.stringify({ maxAge: 30 }),
      headers: {
        'content-type': 'application/json'
      }
    })
    assert.strictEqual(statusCode, 200)

    const users = JSON.parse(body)
    assert.deepStrictEqual(users, [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 }
    ])
  }
})
