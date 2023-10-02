'use strict'

const assert = require('node:assert/strict')
const { request, setGlobalDispatcher, Agent } = require('undici')
const fastify = require('fastify')
const Swagger = require('@fastify/swagger')
const SwaggerUI = require('@fastify/swagger-ui')

const { buildServer } = require('..')

const agent = new Agent({
  keepAliveMaxTimeout: 10,
  keepAliveTimeout: 10
})

setGlobalDispatcher(agent)

async function createBasicService (t) {
  const app = fastify({
    logger: false,
    keepAliveTimeout: 10,
    forceCloseConnections: true
  })

  await app.register(Swagger, {
    openapi: {
      info: {
        title: 'Test',
        version: '0.1.0'
      }
    }
  })
  await app.register(SwaggerUI)

  app.get('/text', async () => {
    return 'Some text'
  })

  app.get('/error', async () => {
    throw new Error('KA-BOOM!!!')
  })

  app.get('/object', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      }
    }
  }, async () => {
    return { text: 'Some text' }
  })

  app.get('/nested', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                text: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async () => {
    return { nested: { text: 'Some text' } }
  })

  t.after(async () => {
    await app.close()
  })

  return app
}

async function createOpenApiService (t, entitiesNames = []) {
  const app = fastify({
    logger: false,
    keepAliveTimeout: 10,
    forceCloseConnections: true
  })

  await app.register(Swagger, {
    openapi: {
      info: {
        title: 'Test',
        version: '0.1.0'
      }
    }
  })
  await app.register(SwaggerUI)

  app.decorate('getOpenApiSchema', async () => {
    const { body } = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    return JSON.parse(body)
  })

  for (const entity of entitiesNames) {
    const storage = new Map()
    app.decorate(entity, storage)

    let storageCounter = 1

    function saveEntity (entity) {
      const id = entity.id || storageCounter++
      const entityWithId = { ...entity, id }
      storage.set(id, entityWithId)
      return entityWithId
    }

    saveEntity({ name: 'test1' })
    saveEntity({ name: 'test2' })
    saveEntity({ name: 'test3' })
    saveEntity({ name: 'test4' })

    app.addSchema({
      $id: entity,
      title: entity,
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' }
      }
    })

    app.get(`/${entity}`, {
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: entity }
          }
        }
      }
    }, async () => {
      return Array.from(storage.values())
    })

    app.post(`/${entity}`, {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        },
        response: {
          200: { $ref: entity }
        }
      }
    }, async (req) => {
      const entity = req.body
      return saveEntity(entity)
    })

    app.put(`/${entity}`, {
      schema: {
        body: { $ref: entity },
        response: {
          200: { $ref: entity }
        }
      }
    }, async (req) => {
      const entity = req.body
      return saveEntity(entity)
    })

    app.get(`/${entity}/:id`, {
      schema: {
        response: {
          200: { $ref: entity }
        }
      }
    }, async (req) => {
      return storage.get(parseInt(req.params.id))
    })

    app.post(`/${entity}/:id`, {
      schema: {
        response: {
          200: { $ref: entity }
        }
      }
    }, async (req) => {
      const id = req.params.id
      const entity = req.body
      return saveEntity({ ...entity, id })
    })

    app.put(`/${entity}/:id`, {
      schema: {
        response: {
          200: { $ref: entity }
        }
      }
    }, async (req) => {
      const id = req.params.id
      const entity = req.body
      return saveEntity({ ...entity, id })
    })

    app.delete(`/${entity}/:id`, {
      schema: {
        response: {
          200: { $ref: entity }
        }
      }
    }, async (req) => {
      return storage.delete(parseInt(req.params.id))
    })
  }

  t.after(async () => {
    await app.close()
  })

  return app
}

async function createComposer (t, composerConfig) {
  const defaultConfig = {
    server: {
      logger: false,
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 10,
      forceCloseConnections: true
    },
    composer: { services: [] },
    plugins: {
      paths: []
    },
    watch: false
  }

  const config = Object.assign({}, defaultConfig, composerConfig)
  const app = await buildServer(config)

  t.after(async () => {
    await app.close()
  })

  return app
}

async function testEntityRoutes (origin, entitiesRoutes) {
  for (const entityRoute of entitiesRoutes) {
    {
      const { statusCode } = await request(origin, {
        method: 'POST',
        path: entityRoute,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'GET',
        path: entityRoute
      })
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'PUT',
        path: entityRoute,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'GET',
        path: `${entityRoute}/1`
      })
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'POST',
        path: `${entityRoute}/2`,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'PUT',
        path: `${entityRoute}/3`,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'DELETE',
        path: `${entityRoute}/4`
      })
      assert.equal(statusCode, 200)
    }
  }
}

module.exports = {
  createComposer,
  createOpenApiService,
  createBasicService,
  testEntityRoutes
}
