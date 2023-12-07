'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { buildServer } = require('..')

test('support prefix option', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    service: {
      openapi: {
        path: join(__dirname, 'fixtures', 'openapi-spec-test.json'),
        prefix: 'my-prefix'
      }
    },
    watch: false,
    metrics: false
  }

  const app = await buildServer(config)
  t.after(async () => {
    await app.close()
  })
  await app.start()

  const res = await request(`${app.url}/my-prefix/json`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const body = await res.body.json()
  assert.deepEqual(body.paths['/hello'].post, {
    operationId: 'postHello',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                foo: {
                  type: 'string'
                },
                bar: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }
  })
})
test('provide openapi spec from a file', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    service: {
      openapi: {
        path: join(__dirname, 'fixtures', 'openapi-spec-test.json')
      }
    },
    watch: false,
    metrics: false
  }

  const app = await buildServer(config)
  t.after(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await request(`${app.url}/documentation/json`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.deepEqual(body.paths['/hello'].post, {
      operationId: 'postHello',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  foo: {
                    type: 'string'
                  },
                  bar: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      }
    })

    assert.deepEqual(body.paths['/hello'].get, {
      operationId: 'getHello',
      parameters: [],
      responses: {
        200: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  foo: {
                    type: 'string'
                  },
                  bar: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      }
    })
  }
})
