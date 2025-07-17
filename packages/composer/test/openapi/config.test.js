import { mkdtemp, writeFile } from 'fs/promises'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig, createOpenApiService } from '../helper.js'

test('should throw an error if can not read openapi config file', async t => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')

  try {
    const stackable = await createFromConfig(t, {
      server: {
        logger: {
          level: 'fatal'
        }
      },
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
    })

    await stackable.start({ listen: true })
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.message, 'Could not read openapi config for "api1" service')
  }
})

test('should throw an error if openapi config is not valid', async t => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    wrong: 'config'
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  try {
    const stackable = await createFromConfig(t, {
      server: {
        logger: {
          level: 'fatal'
        }
      },
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
    })

    await stackable.start({ listen: true })
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.message, 'Could not read openapi config for "api1" service')
  }
})
