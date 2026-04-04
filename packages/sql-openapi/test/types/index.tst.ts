import fastify from 'fastify'
import { expect, test } from 'tstyche'
import plugin, { type SQLOpenApiPluginOptions } from '../../index.js'

const pluginOptions: SQLOpenApiPluginOptions = {}

test('plugin', () => {
  const instance = fastify()

  instance.register(plugin, pluginOptions)
})

test('SQLOpenApiPluginOptions', () => {
  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({})

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    exposeRoute: true
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    ignore: {
      testEntity1: true,
      testEntity2: {
        fieldName: true,
      },
    }
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    ignoreAllReverseRoutes: true
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    info: {
      title: 'Test swagger',
      description: 'testing the fastify swagger api',
      version: '0.1.0',
    }
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    servers: [
      {
        url: 'https://api.example.com',
        description: 'Production'
      }
    ]
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    tags: [
      {
        name: 'users',
        description: 'User operations'
      }
    ]
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    externalDocs: {
      description: 'Find more info here',
      url: 'https://swagger.io',
    }
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    info: {
      title: 'Test swagger',
      description: 'testing the fastify swagger api',
      version: '0.1.0',
    }
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    servers: [
      {
        url: 'http://localhost',
      },
    ]
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    tags: [
      { name: 'tag' },
    ]
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey' as const,
          name: 'apiKey',
          in: 'header',
        },
      },
    }
  })

  expect<SQLOpenApiPluginOptions>().type.toBeAssignableFrom({
    security: [{
      apiKey: [],
    }]
  })
})
