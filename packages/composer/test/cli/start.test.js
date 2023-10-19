'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile } = require('node:fs/promises')

const { request } = require('undici')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')

const { start } = require('./helper.js')
const { createOpenApiService } = require('../helper.js')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should start the composer with the start command', async (t) => {
  t.test('with openapi services', async (t) => {
    const service1 = await createOpenApiService(t, ['users'])
    const service2 = await createOpenApiService(t, ['posts'])

    const origin1 = await service1.listen({ port: 0 })
    const origin2 = await service2.listen({ port: 0 })

    const config = {
      $schema: 'https://platformatic.dev/schemas/v0.23.2/composer',
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
            id: 'service1',
            origin: origin1,
            openapi: {
              url: '/documentation/json',
              prefix: '/api1'
            }
          },
          {
            id: 'service2',
            origin: origin2,
            openapi: {
              url: '/documentation/json',
              prefix: '/api2'
            }
          }
        ],
        refreshTimeout: 1000
      },
      watch: false
    }

    const configFilePath = join(tmpdir(), 'platformatic.composer.json')
    await writeFile(configFilePath, JSON.stringify(config))

    const { child, url } = await start('-c', configFilePath)

    const { statusCode, body } = await request(`${url}/documentation/json`)
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    child.kill('SIGINT')
  })

  t.test('with graphql services', async (t) => {

  })

  t.test('with graphql and openapi services', async (t) => {

  })
})

test('should get error on configuration error', async (t) => {

})

test('should get error on services conflicts', async (t) => {

})
