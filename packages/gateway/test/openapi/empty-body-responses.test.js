import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBasicApplication, createFromConfig } from '../helper.js'

async function composeBasicApplication (t, gatewayOptions = {}) {
  const api = await createBasicApplication(t)

  api.get(
    '/no-content',
    {
      schema: {
        response: {
          204: { type: 'null' }
        }
      }
    },
    async (req, reply) => reply.code(204).send()
  )

  api.get(
    '/mixed',
    {
      schema: {
        response: {
          200: { type: 'object', properties: { text: { type: 'string' } } },
          204: { type: 'null' }
        }
      }
    },
    async () => ({ text: 'Some text' })
  )

  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      ...gatewayOptions,
      applications: [
        {
          id: 'api',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        }
      ]
    }
  })

  await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  return { schema: JSON.parse(body), gateway }
}

test('should keep the status codes of responses which declare no body', async t => {
  const { schema } = await composeBasicApplication(t)

  const responses = schema.paths['/empty'].get.responses

  assert.deepEqual(Object.keys(responses).sort(), ['204', '302'])
  assert.equal(responses['204'].content, undefined)
  assert.equal(responses['302'].content, undefined)
})

test('should not alter responses which declare a body', async t => {
  const { schema } = await composeBasicApplication(t)

  const responses = schema.paths['/object'].get.responses

  assert.deepEqual(Object.keys(responses), ['200'])
  assert.deepEqual(responses['200'].content['application/json'].schema, {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text']
  })
})

test('should keep both the body-less and the described responses of an operation', async t => {
  const { schema } = await composeBasicApplication(t)

  const responses = schema.paths['/mixed'].get.responses

  assert.deepEqual(Object.keys(responses).sort(), ['200', '204'])
  assert.deepEqual(responses['200'].content['application/json'].schema, {
    type: 'object',
    properties: { text: { type: 'string' } }
  })
  assert.equal(responses['204'].content, undefined)
})

test('should reject the deprecated addEmptySchema option', async t => {
  await assert.rejects(
    () =>
      createFromConfig(t, {
        gateway: {
          applications: [],
          addEmptySchema: true
        }
      }),
    error => {
      assert.equal(error.code, 'PLT_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA')
      assert.equal(error.validationErrors[0].path, '/gateway')
      assert.equal(error.validationErrors[0].params.additionalProperty, 'addEmptySchema')
      return true
    }
  )
})

test('should proxy a body-less response as it is', async t => {
  const { gateway } = await composeBasicApplication(t)

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/no-content'
  })

  assert.equal(statusCode, 204)
  assert.equal(body, '')
})
