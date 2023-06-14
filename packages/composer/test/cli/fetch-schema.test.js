'use strict'

const { tmpdir } = require('os')
const { join } = require('path')
const { writeFile, readFile, mkdtemp, rm } = require('fs/promises')

const fastify = require('fastify')
const { test } = require('tap')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')

const { cliPath } = require('./helper.js')
const { createOpenApiService } = require('../helper.js')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should fetch openapi schemas', async (t) => {
  const { execa } = await import('execa')

  const cwd = await mkdtemp(join(tmpdir(), 'composer-test-'))
  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  const pathToConfig = join(cwd, 'platformatic.composer.json')
  const pathToSchema = join(cwd, 'api1.json')

  const api1 = await createOpenApiService(t, ['users'])
  await api1.listen({ port: 0 })

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'info'
      }
    },
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            file: pathToSchema
          }
        }
      ],
      refreshTimeout: 1000
    },
    types: {},
    watch: false
  }

  await writeFile(pathToConfig, JSON.stringify(config))
  await execa('node', [cliPath, 'openapi', 'schemas', 'fetch', '-c', pathToConfig])

  const openApiSchemaFile = await readFile(pathToSchema, 'utf-8')
  const openApiSchema = JSON.parse(openApiSchemaFile)
  openApiValidator.validate(openApiSchema)

  const pathToUsersSchema = join(__dirname, '..', 'openapi', 'fixtures', 'schemas', 'users.json')
  const usersOpenApiSchemaFile = await readFile(pathToUsersSchema, 'utf-8')
  const usersOpenApiSchema = JSON.parse(usersOpenApiSchemaFile)
  t.same(openApiSchema.paths, usersOpenApiSchema.paths)
  t.same(openApiSchema.components, usersOpenApiSchema.components)
})

test('should throw if api is not available', async (t) => {
  const { execa } = await import('execa')

  const cwd = await mkdtemp(join(tmpdir(), 'composer-test-'))
  t.teardown(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  const pathToConfig = join(cwd, 'platformatic.composer.json')
  const pathToSchema = join(cwd, 'api1.json')

  const api1 = fastify()
  await api1.listen({ port: 0 })

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'info'
      }
    },
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            file: pathToSchema
          }
        }
      ],
      refreshTimeout: 1000
    },
    types: {},
    watch: false
  }

  await writeFile(pathToConfig, JSON.stringify(config))

  try {
    await execa('node', [cliPath, 'openapi', 'schemas', 'fetch', '-c', pathToConfig])
    t.fail('should throw')
  } catch (err) {
    t.match(err.stdout, /Failed to fetch OpenAPI schema/)
  }
})
