'use strict'

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

async function testEntityRoutes (t, service, entitiesRoutes) {
  for (const entityRoute of entitiesRoutes) {
    {
      const { statusCode } = await service.inject({
        method: 'POST',
        url: entityRoute,
        body: { name: 'test' }
      })
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await service.inject({
        method: 'GET',
        url: entityRoute
      })
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await service.inject({
        method: 'PUT',
        url: entityRoute,
        body: { name: 'test' }
      })
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await service.inject({
        method: 'GET',
        url: `${entityRoute}/1`
      })
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await service.inject({
        method: 'POST',
        url: `${entityRoute}/2`,
        body: { name: 'test' }
      })
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await service.inject({
        method: 'PUT',
        url: `${entityRoute}/3`,
        body: { name: 'test' }
      })
      t.equal(statusCode, 200)
    }

    {
      const { statusCode } = await service.inject({
        method: 'DELETE',
        url: `${entityRoute}/4`
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
