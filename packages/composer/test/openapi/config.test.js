'use strict'

const { tmpdir } = require('os')
const { join } = require('path')
const { mkdtemp } = require('fs/promises')
const { test } = require('tap')
const {
  createComposer,
  createOpenApiService
} = require('../helper')

test('should throw an error if can not read openapi config file', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')

  try {
    await createComposer(t,
      {
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
          ]
        }
      }
    )
    t.fail('should throw error')
  } catch (err) {
    t.equal(err.message, 'Could not read openapi config for "api1" service')
  }
})
