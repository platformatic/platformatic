'use strict'

const assert = require('assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile, readFile, mkdtemp, rm } = require('node:fs/promises')

const fastify = require('fastify')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')

const { cliPath } = require('./helper.js')
const { createOpenApiService } = require('../helper.js')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should fetch the available schemas', async (t) => {
  const { execa } = await import('execa')

  const cwd = await mkdtemp(join(tmpdir(), 'composer-test-'))
  t.after(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  const pathToConfig = join(cwd, 'platformatic.composer.json')
  const pathToSchema1 = join(cwd, 'api1.json')
  const pathToSchema2 = join(cwd, 'api2.json')

  const api1 = await createOpenApiService(t, ['users'])
  await api1.listen({ port: 0 })

  const api2 = fastify()
  await api2.listen({ port: 0 })
  t.after(async () => {
    await api2.close()
  })

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
            file: pathToSchema1
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            file: pathToSchema2
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

  const openApiSchemaFile = await readFile(pathToSchema1, 'utf-8')
  const openApiSchema = JSON.parse(openApiSchemaFile)
  openApiValidator.validate(openApiSchema)

  const pathToUsersSchema = join(__dirname, '..', 'openapi', 'fixtures', 'schemas', 'users.json')
  const usersOpenApiSchemaFile = await readFile(pathToUsersSchema, 'utf-8')
  const usersOpenApiSchema = JSON.parse(usersOpenApiSchemaFile)
  assert.deepEqual(openApiSchema, usersOpenApiSchema)
})
