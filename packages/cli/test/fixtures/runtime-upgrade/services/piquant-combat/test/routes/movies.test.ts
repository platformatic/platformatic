import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('movies', async (t) => {
  const server = await getServer(t)

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [])
  }

  let id : Number
  {
    const res = await server.inject({
      method: 'POST',
      url: '/movies',
      body: {
        title: 'The Matrix'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    const body = res.json()
    assert.strictEqual(body.title, 'The Matrix')
    assert.strictEqual(body.id !== undefined, true)
    id = body.id as Number
  }

  {
    const res = await server.inject({
      method: 'GET',
      url: '/movies'
    })

    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), [{
      id,
      title: 'The Matrix'
    }])
  }
})
