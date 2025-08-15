'use strict'

const why = require('why-is-node-running')
const path = require('path')
const fs = require('fs')
const assert = require('node:assert/strict')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { platform } = require('node:os')
const { resolve } = require('node:path')
const { promisify } = require('node:util')
const { createServer } = require('node:http')
const { request, setGlobalDispatcher, Client, Agent } = require('undici')
const fastify = require('fastify')
const Swagger = require('@fastify/swagger')
const mercurius = require('mercurius')
const WebSocket = require('ws')
const { getIntrospectionQuery } = require('graphql')
const { buildServer: dbBuildServer } = require('@platformatic/db')
const { createDirectory, safeRemove } = require('@platformatic/utils')
const pinoTest = require('pino-test')
const pino = require('pino')

// This is to avoid a circular dependency
const { buildServer: buildRuntime, symbols } = require('../../runtime')
const { buildServer } = require('..')

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
const REFRESH_TIMEOUT_DELAY_FACTOR = 20

// GitHub actions are REALLY slow.
const LOGS_WRITE_DELAY = process.env.CI ? 10000 : 3000

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
    async () => { }
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

async function createComposer (t, composerConfig, loggerInstance = undefined) {
  const defaultConfig = {
    server: {
      loggerInstance,
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
        level: 'trace'
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

  // Disable profiling to avoid conflicts in tests
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = '1'

  const runtime = await buildRuntime(runtimeConfigPath, { production })

  // Restore original environment variable
  if (originalEnv !== undefined) {
    process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
  } else {
    delete process.env.PLT_DISABLE_FLAMEGRAPHS
  }

  t.after(async () => {
    await runtime.close()
    await safeRemove(tmpBaseDir)
  })

  return runtime
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
  if (statusCode !== 200) {
    console.log(statusCode, content)
  }

  return content.errors ? content.errors : content.data
}

async function createPlatformaticDbService (t, { name, jsonFile }) {
  try {
    fs.unlinkSync(path.join(__dirname, 'graphql', 'fixtures', name, 'db0.sqlite'))
  } catch { }
  try {
    fs.unlinkSync(path.join(__dirname, 'graphql', 'fixtures', name, 'db1.sqlite'))
  } catch { }

  const service = await dbBuildServer(path.join(__dirname, 'graphql', 'fixtures', name, jsonFile))
  service.get('/.well-known/graphql-composition', async function (req, reply) {
    const res = await reply.graphql(getIntrospectionQuery())
    return res
  })
  t.after(async () => {
    try {
      await service.close()
    } catch { }
  })

  return service
}

async function startServices (t, names) {
  return Promise.all(
    names.map(async ({ name, jsonFile }) => {
      const service = await createPlatformaticDbService(t, { name, jsonFile })
      return { name, host: await service.start() }
    })
  )
}

function createLoggerSpy () {
  const loggerSpy = pinoTest.sink()
  const logger = pino(loggerSpy)

  return {
    logger,
    loggerSpy
  }
}

function waitForLogMessage (loggerSpy, message, { max = 100, debug = false } = {}) {
  return new Promise((resolve, reject) => {
    let count = 0
    const fn = (received) => {
      if (debug) {
        console.log('received', received)
      }
      if (received.msg === message.msg && received.level === message.level) {
        loggerSpy.off('data', fn)
        resolve()
      }
      count++
      if (count > max) {
        loggerSpy.off('data', fn)
        reject(new Error(`Max message count reached on waitForLogMessage: level ${message.level} msg ${message.msg}`))
      }
    }
    loggerSpy.on('data', fn)
  })
}

async function waitForRestart (runtime, previousUrl) {
  const id = (await runtime.getEntrypointDetails()).id
  const socketPath = runtime.getManagementApiUrl()
  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  try {
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Service "${id}" has not been restarted`))
      }, REFRESH_TIMEOUT * REFRESH_TIMEOUT_DELAY_FACTOR)

      webSocket.on('error', err => {
        clearTimeout(timeout)
        reject(err)
      })

      webSocket.on('message', data => {
        if (data.toString().includes(`The service \\"${id}\\" has been successfully reloaded`)) {
          clearTimeout(timeout)

          setImmediate(async () => {
            try {
              const entrypoint = await runtime.getEntrypointDetails()

              if (previousUrl && entrypoint.url === previousUrl) {
                return
              }

              webSocket.terminate()
              resolve(entrypoint.url)
            } catch (e) {
              reject(e)
            }
          })
        }
      })
    })

    return url
  } finally {
    webSocket.close()
  }
}

async function checkSchema (runtime, schema) {
  const composer = await runtime.getService('composer')
  const sdl = await composer[symbols.kITC].send('getSchema')
  return sdl === schema
}

async function getRuntimeLogs (runtime) {
  const client = new Client({ hostname: 'localhost', protocol: 'http:' }, { socketPath: runtime.getManagementApiUrl() })

  // Wait for logs to be written
  await sleep(LOGS_WRITE_DELAY)

  const { statusCode, body } = await client.request({ method: 'GET', path: '/api/v1/logs/all' })
  assert.strictEqual(statusCode, 200)
  const messages = (await body.text()).trim().split('\n').map(JSON.parse)

  client.close()

  return messages.map(m => m.payload?.msg ?? m.msg)
}

module.exports = {
  REFRESH_TIMEOUT,
  createComposer,
  createComposerInRuntime,
  createOpenApiService,
  createGraphqlService,
  createBasicService,
  createWebsocketService,
  testEntityRoutes,
  graphqlRequest,
  createPlatformaticDbService,
  startServices,
  createLoggerSpy,
  waitForLogMessage,
  getRuntimeLogs,
  waitForRestart,
  checkSchema
}
