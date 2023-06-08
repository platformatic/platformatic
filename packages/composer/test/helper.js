'use strict'

const { request } = require('undici')
const fastify = require('fastify')
const Swagger = require('@fastify/swagger')
const SwaggerUI = require('@fastify/swagger-ui')

const { buildServer } = require('..')

async function createOpenApiService (t, entitiesNames = []) {
  const app = fastify({
    keepAliveTimeout: 10
  })

  await app.register(Swagger, {
    exposeRoute: true,
    openapi: {
      specification: {
        openapi: '3.0.0',
        info: {
          title: 'Test',
          version: '0.1.0'
        }
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

    app.get(`/${entity}`, async () => {
      return Array.from(storage.values())
    })

    app.post(`/${entity}`, async (req) => {
      const entity = req.body
      return saveEntity(entity)
    })

    app.put(`/${entity}`, async (req) => {
      const entity = req.body
      return saveEntity(entity)
    })

    app.get(`/${entity}/:id`, async (req) => {
      return storage.get(req.params.id)
    })

    app.post(`/${entity}/:id`, async (req) => {
      const id = req.params.id
      const entity = req.body
      return saveEntity({ ...entity, id })
    })

    app.put(`/${entity}/:id`, async (req) => {
      const id = req.params.id
      const entity = req.body
      return saveEntity({ ...entity, id })
    })

    app.delete(`/${entity}/:id`, async (req) => {
      return storage.delete(req.params.id)
    })
  }

  t.teardown(async () => {
    await app.close()
  })

  return app
}

async function createComposer (t, composerConfig) {
  const defaultConfig = {
    server: {
      logger: false,
      hostname: '127.0.0.1',
      port: 0
    },
    composer: { services: [] },
    plugins: {
      paths: [],
      hotReload: false
    },
    watch: false
  }

  const config = Object.assign({}, defaultConfig, composerConfig)
  const app = await buildServer(config)

  t.teardown(async () => {
    await app.close()
  })

  return app
}

async function testEntityRoutes (t, origin, entitiesRoutes) {
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
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'GET',
        path: entityRoute
      })
      t.equal(statusCode, 200)
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
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'GET',
        path: `${entityRoute}/1`
      })
      t.equal(statusCode, 200)
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
      t.equal(statusCode, 200)
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
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await request(origin, {
        method: 'DELETE',
        path: `${entityRoute}/4`
      })
      t.equal(statusCode, 200)
    }
  }
}

module.exports = {
  createComposer,
  createOpenApiService,
  testEntityRoutes
}
