'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { writeFile, mkdtemp } = require('fs/promises')
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
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.message, 'Could not read openapi config for "api1" service')
  }
})

test('should throw an error if openapi config is not valid', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    wrong: 'config'
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

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
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.message, 'Could not read openapi config for "api1" service')
  }
})
