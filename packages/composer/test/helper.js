'use strict'

const why = require('why-is-node-running')
const path = require('path')
const fs = require('fs')
const assert = require('node:assert/strict')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { once } = require('node:events')
const { resolve } = require('node:path')
const { promisify } = require('node:util')
const { createServer } = require('node:http')
const { request, setGlobalDispatcher, Agent } = require('undici')
const fastify = require('fastify')
const Swagger = require('@fastify/swagger')
const mercurius = require('mercurius')
const WebSocket = require('ws')
const { getIntrospectionQuery } = require('graphql')
const { create: createDatabaseStackable } = require('@platformatic/db')
const { createDirectory, safeRemove, executeWithTimeout, kTimeout } = require('@platformatic/utils')

// This is to avoid a circular dependency
const { createTemporaryDirectory } = require('../../basic/test/helper')
const { create } = require('../')
const { buildServer: buildRuntime, symbols } = require('../../runtime')

if (process.env.WHY === 'true') {
  setInterval(() => {
    console.log(why())
  }, 60000).unref()
}

const agent = new Agent({
  keepAliveMaxTimeout: 10,
  keepAliveTimeout: 10
})

const tmpBaseDir = resolve(__dirname, '../tmp')

const REFRESH_TIMEOUT = 1_000

setGlobalDispatcher(agent)

async function createBasicService (t, options = {}) {
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
      },
      ...options.openapi
    }
  })

  /** Serve spec file in yaml and json */
  app.get('/documentation/json', { schema: { hide: true } }, async () => app.swagger())
  app.get('/documentation/yaml', { schema: { hide: true } }, async () => app.swagger({ yaml: true }))

  app.get('/text', async () => {
    return 'Some text'
  })

  app.get('/error', async () => {
    throw new Error('KA-BOOM!!!')
  })

  app.get(
    '/empty',
    {
      schema: {
        response: {
          204: {
            type: 'null'
          },
          302: {
            type: 'null'
          }
        }
      }
    },
    async () => {}
  )

  app.get(
    '/object',
    {
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
    },
    async () => {
      return { text: 'Some text' }
    }
  )

  app.get(
    '/nested',
    {
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
    },
    async () => {
      return { nested: { text: 'Some text' } }
    }
  )

  t.after(async () => {
    await app.close()
  })

  return app
}

async function createPlatformaticDatabaseService (t, { name, jsonFile }) {
  try {
    fs.unlinkSync(path.join(__dirname, 'graphql', 'fixtures', name, 'db0.sqlite'))
  } catch {}
  try {
    fs.unlinkSync(path.join(__dirname, 'graphql', 'fixtures', name, 'db1.sqlite'))
  } catch {}

  const service = await createDatabaseStackable(path.join(__dirname, 'graphql', 'fixtures', name, jsonFile))
  await service.init()

  service.getApplication().get('/.well-known/graphql-composition', async function (req, reply) {
    const res = await reply.graphql(getIntrospectionQuery())
    return res
  })

  t.after(async () => {
    try {
      await service.stop()
    } catch {}
  })

  return service
}

async function createOpenApiService (t, entitiesNames = [], options = {}) {
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

  if (options.addHeadersSchema) {
    // sample route to return headers
    app.get('/headers', async (req, res) => {
      return { ...req.headers }
    })
  }

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

    app.get(
      `/${entity}`,
      {
        schema: {
          response: {
            200: {
              type: 'array',
              items: { $ref: entity }
            }
          }
        }
      },
      async () => {
        return Array.from(storage.values())
      }
    )

    app.post(
      `/${entity}`,
      {
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
      },
      async req => {
        const entity = req.body
        return saveEntity(entity)
      }
    )

    app.put(
      `/${entity}`,
      {
        schema: {
          body: { $ref: entity },
          response: {
            200: { $ref: entity }
          }
        }
      },
      async req => {
        const entity = req.body
        return saveEntity(entity)
      }
    )

    app.get(
      `/${entity}/:id`,
      {
        schema: {
          response: {
            200: { $ref: entity }
          }
        }
      },
      async req => {
        return storage.get(parseInt(req.params.id))
      }
    )

    app.post(
      `/${entity}/:id`,
      {
        schema: {
          response: {
            200: { $ref: entity }
          }
        }
      },
      async req => {
        const id = req.params.id
        const entity = req.body
        return saveEntity({ ...entity, id })
      }
    )

    app.put(
      `/${entity}/:id`,
      {
        schema: {
          response: {
            200: { $ref: entity }
          }
        }
      },
      async req => {
        const id = req.params.id
        const entity = req.body
        return saveEntity({ ...entity, id })
      }
    )

    app.delete(
      `/${entity}/:id`,
      {
        schema: {
          response: {
            200: { $ref: entity }
          }
        }
      },
      async req => {
        return storage.delete(parseInt(req.params.id))
      }
    )
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

async function createWebsocketService (t, wsServerOptions = {}, port) {
  const service = createServer()
  const wsServer = new WebSocket.Server({ server: service, ...wsServerOptions })
  await promisify(service.listen.bind(service))({ port, host: '127.0.0.1' })

  t.after(() => {
    wsServer.close()
    service.close()
  })

  return { service, wsServer }
}

async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const defaultConfig = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 10,
      forceCloseConnections: true,
      logger: {
        level: 'info'
      }
    },
    composer: { services: [] },
    plugins: {
      paths: []
    },
    watch: false
  }

  const directory = await createTemporaryDirectory(t)

  const composer = await create(
    directory,
    Object.assign({}, defaultConfig, options),
    {},
    { applicationFactory, isStandalone: true, isEntrypoint: true, isProduction: creationOptions.production }
  )
  t.after(() => composer.stop())

  if (!creationOptions.skipInit) {
    await composer.init()
  }

  return composer
}

async function createComposerInRuntime (
  t,
  prefix,
  composerConfig,
  services,
  autoload,
  additionalRuntimeConfig,
  production = false,
  additionalSetup = null
) {
  await createDirectory(tmpBaseDir)
  const tmpDir = await mkdtemp(resolve(tmpBaseDir, prefix))
  await createDirectory(resolve(tmpDir, 'composer'))

  const composerConfigPath = resolve(tmpDir, 'composer/platformatic.composer.json')
  const pluginConfigPath = resolve(tmpDir, 'composer/plugin.js')
  const runtimeConfigPath = resolve(tmpDir, 'platformatic.runtime.json')

  await writeFile(
    runtimeConfigPath,
    JSON.stringify({
      $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.41.0.json',
      entrypoint: 'composer',
      watch: false,
      services: (services ?? []).concat([
        {
          id: 'composer',
          path: resolve(tmpDir, 'composer'),
          config: composerConfigPath
        }
      ]),
      autoload: autoload ? { path: autoload } : undefined,
      logger: {
        level: 'fatal'
      },
      gracefulShutdown: {
        runtime: 1000,
        service: 1000
      },
      ...additionalRuntimeConfig
    }),
    'utf-8'
  )

  await writeFile(
    composerConfigPath,
    JSON.stringify({
      module: resolve(__dirname, '../index.js'),
      plugins: {
        paths: [
          {
            path: './plugin.js'
          }
        ]
      },
      ...composerConfig
    }),
    'utf-8'
  )

  await writeFile(
    pluginConfigPath,
    `
      module.exports = async function (app) {
        globalThis[Symbol.for('plt.runtime.itc')].handle('getSchema', () => {
          return app.graphqlSupergraph.sdl
        })
      }
    `,
    'utf-8'
  )

  await additionalSetup?.(runtimeConfigPath, composerConfigPath)
  const runtime = await buildRuntime(runtimeConfigPath, { production })

  t.after(async () => {
    await runtime.close()
    await safeRemove(tmpDir)
  })

  return runtime
}

async function startDatabaseServices (t, names) {
  return Promise.all(
    names.map(async ({ name, jsonFile }) => {
      const service = await createPlatformaticDatabaseService(t, { name, jsonFile })
      return { name, host: await service.start() }
    })
  )
}

async function waitForRestart (runtime) {
  const result = await executeWithTimeout(once(runtime, 'service:worker:reloaded'), REFRESH_TIMEOUT * 3)

  if (result === kTimeout) {
    return Promise.reject(new Error('Timeout while waiting for service to restart'))
  }

  const entrypoint = await runtime.getEntrypointDetails()
  return entrypoint.url
}

async function checkSchema (runtime, schema) {
  const composer = await runtime.getService('composer')
  const sdl = await composer[symbols.kITC].send('getSchema')
  return sdl === schema
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
  if (statusCode !== 200) {
    console.log(statusCode, content)
  }

  return content.errors ? content.errors : content.data
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

module.exports = {
  REFRESH_TIMEOUT,
  createBasicService,
  createPlatformaticDatabaseService,
  createOpenApiService,
  createGraphqlService,
  createWebsocketService,
  createFromConfig,
  createComposerInRuntime,
  startDatabaseServices,
  checkSchema,
  waitForRestart,
  graphqlRequest,
  testEntityRoutes
}
