'use strict'

const path = require('path')
const fs = require('fs')
const assert = require('node:assert/strict')
const { request, setGlobalDispatcher, Agent } = require('undici')
const fastify = require('fastify')
const Swagger = require('@fastify/swagger')
const mercurius = require('mercurius')
const { getIntrospectionQuery } = require('graphql')
const { buildServer: dbBuildServer } = require('@platformatic/db')
const ScalarApiReference = require('@scalar/fastify-api-reference')

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

  /** Serve spec file in yaml and json */
  app.get('/documentation/json', { schema: { hide: true } }, async () => app.swagger())
  app.get('/documentation/yaml', { schema: { hide: true } }, async () => app.swagger({ yaml: true }))

  await app.register(ScalarApiReference)

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
  await app.register(ScalarApiReference)

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

async function createGraphqlService (t, { schema, resolvers, extend, file, exposeIntrospection = true }) {
  const app = fastify({ logger: false, port: 0 })
  t.after(async () => {
    await app.close()
  })

  if (file) {
    await app.register(mercurius, require(file))
  } else {
    await app.register(mercurius, { schema, resolvers })
  }

  if (extend) {
    if (extend.file) {
      const { schema, resolvers } = require(extend.file)
      if (schema) {
        app.graphql.extendSchema(schema)
      }
      if (resolvers) {
        app.graphql.defineResolvers(resolvers)
      }
    }
    if (extend.schema) {
      app.graphql.extendSchema(extend.schema)
    }
    if (extend.resolvers) {
      app.graphql.defineResolvers(extend.resolvers)
    }
  }

  if (exposeIntrospection) {
    app.get('/.well-known/graphql-composition', async function (req, reply) {
      return reply.graphql(getIntrospectionQuery())
    })
  }

  return app
}

async function createComposer (t, composerConfig, logger = false) {
  const defaultConfig = {
    server: {
      logger,
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
      const { statusCode, body } = await request(origin, {
        method: 'POST',
        path: entityRoute,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      await body.text()
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode, body } = await request(origin, {
        method: 'GET',
        path: entityRoute
      })
      await body.text()
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode, body } = await request(origin, {
        method: 'PUT',
        path: entityRoute,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      await body.text()
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode, body } = await request(origin, {
        method: 'GET',
        path: `${entityRoute}/1`
      })
      await body.text()
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode, body } = await request(origin, {
        method: 'POST',
        path: `${entityRoute}/2`,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      await body.text()
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode, body } = await request(origin, {
        method: 'PUT',
        path: `${entityRoute}/3`,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'test' })
      })
      await body.text()
      assert.equal(statusCode, 200)
    }

    {
      const { statusCode, body } = await request(origin, {
        method: 'DELETE',
        path: `${entityRoute}/4`
      })
      await body.text()
      assert.equal(statusCode, 200)
    }
  }
}

async function graphqlRequest ({ query, variables, url, host }) {
  const { body, statusCode } = await request(url || host + '/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })

  const content = await body.json()
  if (statusCode !== 200) { console.log(statusCode, content) }

  return content.errors ? content.errors : content.data
}

async function createPlatformaticDbService (t, { name, jsonFile }) {
  try { fs.unlinkSync(path.join(__dirname, 'graphql', 'fixtures', name, 'db0.sqlite')) } catch { }
  try { fs.unlinkSync(path.join(__dirname, 'graphql', 'fixtures', name, 'db1.sqlite')) } catch { }

  const service = await dbBuildServer(path.join(__dirname, 'graphql', 'fixtures', name, jsonFile))
  service.get('/.well-known/graphql-composition', async function (req, reply) {
    return reply.graphql(getIntrospectionQuery())
  })
  t.after(async () => {
    try { await service.close() } catch { }
  })

  return service
}

async function startServices (t, names) {
  return Promise.all(names.map(async ({ name, jsonFile }) => {
    const service = await createPlatformaticDbService(t, { name, jsonFile })
    return { name, host: await service.start() }
  }))
}

function createLoggerSpy () {
  return {
    _trace: [],
    _debug: [],
    _info: [],
    _warn: [],
    _error: [],
    _fatal: [],

    trace: function (...args) { this._trace.push(args) },
    debug: function (...args) { this._debug.push(args) },
    info: function (...args) { this._info.push(args) },
    warn: function (...args) { this._warn.push(args) },
    error: function (...args) { this._error.push(args) },
    fatal: function (...args) { this._fatal.push(args) },
    child: function () { return this },

    reset: function () {
      this._trace = []
      this._debug = []
      this._info = []
      this._warn = []
      this._error = []
      this._fatal = []
    }
  }
}

/**
 * on timeout resolve
 */
function eventToPromise (fn, timeout = 60_000) {
  return new Promise((resolve, reject) => {
    let resolved
    let t = setTimeout(() => {
      if (resolved) { return }
      resolve()
    }, timeout)
    try {
      fn(async () => {
        if (t) {
          clearTimeout(t)
          t = null
        }
        if (resolved) { return }
        resolved = true
        resolve()
      })
    } catch (err) {
      if (t) {
        clearTimeout(t)
        t = null
      }
      if (resolved) { return }
      resolved = true
      reject(err)
    }
  })
}

module.exports = {
  createComposer,
  createOpenApiService,
  createGraphqlService,
  createBasicService,
  testEntityRoutes,
  graphqlRequest,
  createPlatformaticDbService,
  startServices,
  createLoggerSpy,
  eventToPromise
}
