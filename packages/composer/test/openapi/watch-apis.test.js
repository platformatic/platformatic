'use strict'

const { join } = require('node:path')
// const { tmpdir } = require('node:os')
const { setTimeout } = require('node:timers/promises')
// const { writeFile, mkdtemp } = require('node:fs/promises')
const { test } = require('tap')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
  testEntityRoutes
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should restart composer if api has been changed', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: 500
    }
  })

  const composerOrigin = await composer.start()

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api1/users', '/api2/posts'])
  }

  await api1.close()
  await setTimeout(1000)

  t.equal(composer.restarted, true)

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api2/posts'])

    const { statusCode: statusCode2 } = await composer.inject({
      method: 'GET',
      url: '/api1/users'
    })
    t.equal(statusCode2, 404)
  }
})

test('should watch api only if it has a url', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            file: join(__dirname, 'fixtures', 'schemas', 'posts.json'),
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: 500
    }
  })

  const composerOrigin = await composer.start()

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api1/users', '/api2/posts'])
  }

  await api2.close()
  await setTimeout(1000)

  t.equal(composer.restarted, false)

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api1/users'])

    const { statusCode: statusCode2 } = await composer.inject({
      method: 'GET',
      url: '/api2/posts'
    })
    t.equal(statusCode2, 500)
  }
})

test('should compose schema after service restart', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const api1Port = api1.server.address().port
  const api2Port = api2.server.address().port

  const composer = await createComposer(t, {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1Port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2Port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: 500
    }
  })

  const composerOrigin = await composer.start()

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api1/users', '/api2/posts'])
  }

  await api1.close()
  await setTimeout(1000)

  t.equal(composer.restarted, true)

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api2/posts'])

    const { statusCode: statusCode2 } = await composer.inject({
      method: 'GET',
      url: '/api1/users'
    })
    t.equal(statusCode2, 404)
  }

  const newApi1 = await createOpenApiService(t, ['users'])
  await newApi1.listen({ port: api1Port })
  await setTimeout(1000)

  {
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/api1/users', '/api2/posts'])
  }
})

test('should not watch an api if refreshTimeout equals 0', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: 0
    }
  })

  await composer.start()

  t.equal(composer.restarted, false)

  await api1.close()
  await api2.close()
  await setTimeout(1000)

  t.equal(composer.restarted, false)
})

test('should not restart composer if schema has been changed', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        alias: '/customers/{id}'
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t, {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json',
            config: openapiConfigFile
          }
        }
      ],
      refreshTimeout: 500
    }
  })

  await composer.start()
  await setTimeout(1000)

  t.equal(composer.restarted, false)
})
