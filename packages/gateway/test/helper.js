import Swagger from '@fastify/swagger'
import { createDirectory, executeWithTimeout, kTimeout, safeRemove } from '@platformatic/foundation'
import fastify from 'fastify'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { Agent, request, setGlobalDispatcher } from 'undici'
import why from 'why-is-node-running'
import WebSocket from 'ws'
import { createTemporaryDirectory } from '../../basic/test/helper.js'
import { create as createRuntime } from '../../runtime/index.js'
import { create } from '../index.js'

if (process.env.WHY === 'true') {
  setInterval(() => {
    console.log(why())
  }, 60000).unref()
}

const agent = new Agent({
  keepAliveMaxTimeout: 10,
  keepAliveTimeout: 10
})

setGlobalDispatcher(agent)

const tmpBaseDir = resolve(import.meta.dirname, '../tmp')

export const REFRESH_TIMEOUT = 1_000

export async function createBasicApplication (t, options = {}) {
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

export async function createOpenApiApplication (t, entitiesNames = [], options = {}) {
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

export async function createWebsocketApplication (t, wsServerOptions = {}, port) {
  const application = createServer()
  const wsServer = new WebSocket.Server({ server: application, ...wsServerOptions })
  await promisify(application.listen.bind(application))({ port, host: '127.0.0.1' })

  t.after(() => {
    wsServer.close()
    application.close()
  })

  return { application, wsServer }
}

export async function createApplication (t, routes = []) {
  const app = fastify({ logger: false, port: 0 })
  t.after(async () => {
    await app.close()
  })
  for (const route of routes) {
    app.route(route)
  }
  return app
}

export async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const defaultConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/gateway/2.0.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 10,
      forceCloseConnections: true,
      logger: {
        level: 'info'
      }
    },
    gateway: { applications: [] },
    plugins: {
      paths: []
    },
    watch: false
  }

  const directory = await createTemporaryDirectory(t)

  // Keep an explicit ephemeral listener when a caller overrides `server`
  // with only a few sub-fields (e.g. `server: { logger: { level: 'fatal' }}`).
  // Other defaults like `keepAliveTimeout` remain reset as expected by tests.
  const mergedConfig = Object.assign({}, defaultConfig, options)
  if (options?.server) {
    mergedConfig.server = {
      hostname: defaultConfig.server.hostname,
      port: defaultConfig.server.port,
      ...options.server
    }
  }

  const gateway = await create(directory, mergedConfig, {
    applicationFactory,
    isStandalone: true,
    isProduction: creationOptions.production
  })
  t.after(() => gateway.stop())

  if (!creationOptions.skipInit) {
    await gateway.init()
  }

  return gateway
}

export async function createGatewayInRuntime (
  t,
  prefix,
  gatewayConfig,
  applications,
  autoload,
  additionalRuntimeConfig,
  production = false,
  additionalSetup = null
) {
  await createDirectory(tmpBaseDir)
  const tmpDir = await mkdtemp(resolve(tmpBaseDir, prefix))
  await createDirectory(resolve(tmpDir, 'gateway'))

  const gatewayConfigPath = resolve(tmpDir, 'gateway/platformatic.gateway.json')
  const pluginConfigPath = resolve(tmpDir, 'gateway/plugin.js')
  const runtimeConfigPath = resolve(tmpDir, 'platformatic.runtime.json')

  await writeFile(
    runtimeConfigPath,
    JSON.stringify({
      $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.41.0.json',
      watch: false,
      services: (applications ?? []).concat([
        {
          id: 'composer',
          path: resolve(tmpDir, 'gateway'),
          config: gatewayConfigPath
        }
      ]),
      autoload: autoload ? { path: autoload } : undefined,
      logger: {
        level: process.env.PLT_TESTS_DEBUG === 'true' ? 'debug' : 'fatal'
      },
      gracefulShutdown: {
        runtime: 1000,
        application: 1000
      },
      ...additionalRuntimeConfig
    }),
    'utf-8'
  )

  await writeFile(
    gatewayConfigPath,
    JSON.stringify({
      module: resolve(import.meta.dirname, '../index.js'),
      plugins: {
        paths: [
          {
            path: './plugin.js'
          }
        ]
      },
      ...gatewayConfig,
      server: {
        hostname: '127.0.0.1',
        port: 0,
        ...gatewayConfig.server
      }
    }),
    'utf-8'
  )

  await writeFile(
    pluginConfigPath,
    'export default async function () {}',
    'utf-8'
  )

  await additionalSetup?.(runtimeConfigPath, gatewayConfigPath)

  if (process.env.PLT_TESTS_PRINT_TMP === 'true') {
    process._rawDebug(`Runtime root: ${tmpDir}`)
  }

  const runtime = await createRuntime(runtimeConfigPath, null, { isProduction: production })
  await runtime.init()

  t.after(async () => {
    await runtime.close()

    if (process.env.PLT_TESTS_KEEP_TMP !== 'true') {
      await safeRemove(tmpDir)
    }
  })

  return runtime
}

export async function waitForRestart (runtime) {
  const result = await executeWithTimeout(once(runtime, 'application:worker:reloaded'), REFRESH_TIMEOUT * 3)

  if (result === kTimeout) {
    return Promise.reject(new Error('Timeout while waiting for application to restart'))
  }

  const application = await runtime.getApplicationDetails('composer')
  return application.url
}

export async function testEntityRoutes (origin, entitiesRoutes) {
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
