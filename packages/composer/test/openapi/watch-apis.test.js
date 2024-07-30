'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
const { writeFile, mkdtemp } = require('node:fs/promises')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  checkRestarted,
  createComposerInRuntime,
  createOpenApiService,
  testEntityRoutes,
} = require('../helper')

const REFRESH_TIMEOUT = 1000

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should restart composer if api has been changed', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const runtime = await createComposerInRuntime(t, 'openapi-watch', {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1',
          },
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2',
          },
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  let composerOrigin = await runtime.start()

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api1/users', '/api2/posts'])
  }

  await api1.close()
  await sleep(REFRESH_TIMEOUT * 2)
  composerOrigin = (await runtime.getEntrypointDetails()).url

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api2/posts'])

    const { statusCode: statusCode2 } = await runtime.inject('composer', {
      method: 'GET',
      url: '/api1/users',
    })
    assert.equal(statusCode2, 404)
  }

  assert.ok(await checkRestarted(runtime, 'composer'))
})

test('should watch api only if it has a url', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const runtime = await createComposerInRuntime(t, 'openapi-watch', {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1',
          },
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            file: join(__dirname, 'fixtures', 'schemas', 'posts.json'),
            prefix: '/api2',
          },
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  let composerOrigin = await runtime.start()

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api1/users', '/api2/posts'])
  }

  await api2.close()
  await sleep(REFRESH_TIMEOUT * 2)
  composerOrigin = (await runtime.getEntrypointDetails()).url

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api1/users'])

    const { statusCode: statusCode2 } = await runtime.inject('composer', {
      method: 'GET',
      url: '/api2/posts',
    })
    assert.equal(statusCode2, 500)
  }

  assert.ok(!(await checkRestarted(runtime, 'composer')))
})

test('should compose schema after service restart', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const api1Port = api1.server.address().port
  const api2Port = api2.server.address().port

  const runtime = await createComposerInRuntime(t, 'openapi-watch', {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1Port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1',
          },
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2Port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2',
          },
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  let composerOrigin = await runtime.start()

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api1/users', '/api2/posts'])
  }

  await api1.close()
  await sleep(REFRESH_TIMEOUT * 2)
  composerOrigin = (await runtime.getEntrypointDetails()).url

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api2/posts'])

    const { statusCode: statusCode2 } = await runtime.inject('composer', {
      method: 'GET',
      url: '/api1/users',
    })
    assert.equal(statusCode2, 404)
  }

  const newApi1 = await createOpenApiService(t, ['users'])
  await newApi1.listen({ port: api1Port })
  await sleep(REFRESH_TIMEOUT * 2)
  composerOrigin = (await runtime.getEntrypointDetails()).url

  {
    const { statusCode, body } = await runtime.inject('composer', {
      method: 'GET',
      url: '/documentation/json',
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/api1/users', '/api2/posts'])
  }

  assert.ok(await checkRestarted(runtime, 'composer'))
})

test('should not watch an api if refreshTimeout equals 0', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const runtime = await createComposerInRuntime(t, 'openapi-watch', {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1',
          },
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2',
          },
        },
      ],
      refreshTimeout: 0,
    },
  })

  await runtime.start()

  await api1.close()
  await api2.close()

  await sleep(REFRESH_TIMEOUT * 2)
  assert.ok(!(await checkRestarted(runtime, 'composer')))
})

test('should not restart composer if schema has been changed', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        alias: '/customers/{id}',
      },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const runtime = await createComposerInRuntime(t, 'openapi-watch', {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json',
            config: openapiConfigFile,
          },
        },
      ],
      refreshTimeout: REFRESH_TIMEOUT,
    },
  })

  await runtime.start()
  await sleep(3000)

  assert.ok(!(await checkRestarted(runtime, 'composer')))
})
