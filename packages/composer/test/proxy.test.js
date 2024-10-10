'use strict'

const assert = require('assert/strict')
const { resolve } = require('node:path')
const { symlink } = require('node:fs/promises')
const { test } = require('node:test')
const { request } = require('undici')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
  testEntityRoutes,
  createComposerInRuntime,
  REFRESH_TIMEOUT
} = require('./helper')
const { safeRemove, createDirectory } = require('@platformatic/utils')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should proxy openapi requests', async t => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })
  const service2 = await createOpenApiService(t, ['posts'])
  const service3 = await createOpenApiService(t, ['comments'])

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })
  const origin3 = await service3.listen({ port: 0 })

  const config = {
    composer: {
      services: [
        {
          id: 'service1',
          origin: origin1,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service1'
          }
        },
        {
          id: 'service2',
          origin: origin2,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service2'
          }
        },
        {
          id: 'service3',
          origin: origin3,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createComposer(t, config)
  const composerOrigin = await composer.start()

  const { statusCode, body } = await request(composerOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = await body.json()
  openApiValidator.validate(openApiSchema)

  for (const path in openApiSchema.paths) {
    for (const service of config.composer.services) {
      const proxyPrefix = service.proxy.prefix.at(-1) === '/' ? service.proxy.prefix.slice(0, -1) : service.proxy.prefix

      if (path === proxyPrefix + '/' || path === proxyPrefix + '/*') {
        assert.fail('proxy routes should be removed from openapi schema')
      }
    }
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/users'])
    await testEntityRoutes(composerOrigin, ['/internal/service1/users'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service2/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/posts'])
    await testEntityRoutes(composerOrigin, ['/internal/service2/posts'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/headers'
    })
    assert.equal(statusCode, 200)

    const returnedHeaders = await body.json()

    const expectedForwardedHost = composerOrigin.replace('http://', '')
    const [expectedForwardedFor] = expectedForwardedHost.split(':')
    assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
    assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
  }
})

test('should proxy openapi requests', async t => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })
  const service2 = await createOpenApiService(t, ['posts'])
  const service3 = await createOpenApiService(t, ['comments'])

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })
  const origin3 = await service3.listen({ port: 0 })

  const config = {
    composer: {
      services: [
        {
          id: 'service1',
          origin: origin1,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service1'
          }
        },
        {
          id: 'service2',
          origin: origin2,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service2'
          }
        },
        {
          id: 'service3',
          origin: origin3,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createComposer(t, config)
  const composerOrigin = await composer.start()

  const { statusCode, body } = await request(composerOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = await body.json()
  openApiValidator.validate(openApiSchema)

  for (const path in openApiSchema.paths) {
    for (const service of config.composer.services) {
      const proxyPrefix = service.proxy.prefix.at(-1) === '/' ? service.proxy.prefix.slice(0, -1) : service.proxy.prefix

      if (path === proxyPrefix + '/' || path === proxyPrefix + '/*') {
        assert.fail('proxy routes should be removed from openapi schema')
      }
    }
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/users'])
    await testEntityRoutes(composerOrigin, ['/internal/service1/users'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service2/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/posts'])
    await testEntityRoutes(composerOrigin, ['/internal/service2/posts'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/headers'
    })
    assert.equal(statusCode, 200)

    const returnedHeaders = await body.json()

    const expectedForwardedHost = composerOrigin.replace('http://', '')
    const [expectedForwardedFor] = expectedForwardedHost.split(':')
    assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
    assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
  }
})

test('should proxy a @platformatic/service to its prefix by default', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-default-prefix',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {}
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service')
      }
    ]
  )

  t.after(() => {
    runtime.close()
  })

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/main/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      path: '/main/echo',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ ok: true })
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should proxy a @platformatic/service to the chosen prefix by the user in the configuration', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-conf',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {}
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic-prefix-in-conf.json'
      }
    ]
  )

  t.after(() => {
    runtime.close()
  })

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/whatever/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should proxy a @platformatic/service to the chosen prefix by the user in the code', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-code',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {}
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic-prefix-in-code.json'
      }
    ]
  )

  t.after(() => {
    runtime.close()
  })

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/from-code/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should proxy all services if none are defined', async t => {
  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  t.after(() => safeRemove(nodeModulesRoot))

  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-code',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'second',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'third',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  t.after(() => {
    runtime.close()
  })

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/first/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/second/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/third/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should fix the path using the referer only if asked to', async t => {
  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  // Make sure there is @platformatic/node available in the astro service.
  // We can't simply specify it in the package.json due to circular dependencies.
  const astroModulesRoot = resolve(__dirname, './proxy/fixtures/astro/node_modules')
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  t.after(() => Promise.all([safeRemove(nodeModulesRoot), safeRemove(astroModulesRoot)]))

  const runtime = await createComposerInRuntime(
    t,
    'referer-redirect',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'astro',
        path: resolve(__dirname, './proxy/fixtures/astro'),
        config: 'platformatic.json'
      },
      {
        id: 'third',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  t.after(() => {
    runtime.close()
  })

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/first/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, headers } = await request(address, {
      method: 'GET',
      path: '/third/hello',
      headers: {
        referer: `${address}/astro`
      }
    })
    assert.equal(statusCode, 308)
    assert.equal(headers.location, '/astro/third/hello')
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/third/hello',
      headers: {
        referer: `${address}/first`
      }
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})
