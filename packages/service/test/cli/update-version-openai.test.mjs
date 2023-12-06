import assert from 'assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join, dirname } from 'node:path'
import { readFile, mkdtemp, cp, rm, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import fastify from 'fastify'
import { execa } from 'execa'
import { request } from 'undici'
import { start, cliPath, safeKill } from './helper.mjs'

function urlDirname (url) {
  return dirname(fileURLToPath(url))
}

test('update openapi schema using openai', async (t) => {
  const openaiProxy = fastify()

  function mapInputData (inputs) {
    return {
      pathParams: {},
      queryParams: {},
      headers: {
        'x-bar': inputs.headers['x-foo']
      }
    }
  }

  function mapOutputData (outputs) {
    return {
      headers: {},
      responseBody: {
        foo: outputs.responseBody.bar
      }
    }
  }

  const userApiKey = 'api-key'

  openaiProxy.post('/openapi/mappers/request', async (request, reply) => {
    const receivedApiKey = request.headers['x-platformatic-user-api-key']
    assert.strictEqual(receivedApiKey, userApiKey)

    const { includeBody, sourceSchema, targetSchema } = request.body

    assert.strictEqual(includeBody, false)
    assert.deepStrictEqual(sourceSchema, {
      parameters: [
        {
          schema: {
            type: 'string'
          },
          in: 'header',
          name: 'x-foo',
          required: false
        }
      ],
      requestBody: {}
    })
    assert.deepStrictEqual(targetSchema, {
      parameters: [
        {
          schema: {
            type: 'string'
          },
          in: 'header',
          name: 'x-bar',
          required: false
        }
      ],
      requestBody: {}
    })

    return {
      statusCode: 200,
      code: mapInputData.toString()
    }
  })

  openaiProxy.post('/openapi/mappers/response', async (request, reply) => {
    const receivedApiKey = request.headers['x-platformatic-user-api-key']
    assert.strictEqual(receivedApiKey, userApiKey)

    const { sourceSchema, targetSchema } = request.body

    assert.deepStrictEqual(sourceSchema, {
      responseBody: {
        type: 'object',
        properties: {
          bar: {
            type: 'string'
          }
        }
      }
    })
    assert.deepStrictEqual(targetSchema, {
      responseBody: {
        type: 'object',
        properties: {
          foo: {
            type: 'string'
          }
        }
      }
    })

    return {
      statusCode: 200,
      code: mapOutputData.toString()
    }
  })

  const openaiProxyHost = await openaiProxy.listen({ port: 0 })
  t.after(async () => { await openaiProxy.close() })

  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'update-version-openai')
  const cwd = await mkdtemp(join(tmpdir(), 'test-update-version-openai-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const openapiPath = join(cwd, 'versions', 'v2', 'openapi.json')
  const beforeOpenapiFile = await readFile(openapiPath, 'utf8')
  const beforeOpenapi = JSON.parse(beforeOpenapiFile)

  const beforeRouteSchema = beforeOpenapi.paths['/v2/hello']
  assert.deepStrictEqual(beforeRouteSchema, {
    get: {
      parameters: [
        {
          name: 'x-foo',
          in: 'header',
          schema: {
            type: 'string'
          },
          required: false
        }
      ],
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  foo: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })

  await execa('node', [
    cliPath, 'versions', 'update', '--openai',
    '--openai-proxy-host', openaiProxyHost,
    '--user-api-key', userApiKey
  ], { cwd })

  const configPath = join(cwd, 'platformatic.service.json')
  const afterOpenapiFile = await readFile(openapiPath, 'utf8')
  const afterOpenapi = JSON.parse(afterOpenapiFile)

  const afterRouteSchema = afterOpenapi.paths['/v2/hello']
  assert.deepStrictEqual(afterRouteSchema, {
    get: {
      parameters: [
        {
          name: 'x-bar',
          in: 'header',
          schema: {
            type: 'string'
          },
          required: false
        }
      ],
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  bar: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })

  {
    const mappersPluginPath = join(cwd, 'versions', 'v1', 'mappers', 'get-hello.js')
    await access(mappersPluginPath)
  }

  const { child, url } = await start(['-c', configPath])
  t.after(() => safeKill(child))

  {
    const { statusCode, body } = await request(url + '/v2/hello', {
      headers: {
        'x-bar': '123'
      }
    })
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { bar: '123' })
  }

  {
    const { statusCode, body } = await request(url + '/v1/hello', {
      headers: {
        'x-foo': '123'
      }
    })
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { foo: '123' })
  }
})

test('generate default handler if openai fails', async (t) => {
  const openaiProxy = fastify()

  openaiProxy.post('/openapi/mappers/request', async (request, reply) => {
    reply.status(500)
    return { message: 'Internal Server Error' }
  })
  openaiProxy.post('/openapi/mappers/response', async (request, reply) => {
    reply.status(500)
    return { message: 'Internal Server Error' }
  })

  const openaiProxyHost = await openaiProxy.listen({ port: 0 })
  t.after(async () => { await openaiProxy.close() })

  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'update-version-openai')
  const cwd = await mkdtemp(join(tmpdir(), 'test-update-version-openai-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const openapiPath = join(cwd, 'versions', 'v2', 'openapi.json')
  const beforeOpenapiFile = await readFile(openapiPath, 'utf8')
  const beforeOpenapi = JSON.parse(beforeOpenapiFile)

  const beforeRouteSchema = beforeOpenapi.paths['/v2/hello']
  assert.deepStrictEqual(beforeRouteSchema, {
    get: {
      parameters: [
        {
          name: 'x-foo',
          in: 'header',
          schema: {
            type: 'string'
          },
          required: false
        }
      ],
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  foo: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })

  await execa('node', [
    cliPath, 'versions', 'update', '--openai',
    '--openai-proxy-host', openaiProxyHost,
    '--user-api-key', 'api-key'
  ], { cwd })

  const configPath = join(cwd, 'platformatic.service.json')
  const afterOpenapiFile = await readFile(openapiPath, 'utf8')
  const afterOpenapi = JSON.parse(afterOpenapiFile)

  const afterRouteSchema = afterOpenapi.paths['/v2/hello']
  assert.deepStrictEqual(afterRouteSchema, {
    get: {
      parameters: [
        {
          name: 'x-bar',
          in: 'header',
          schema: {
            type: 'string'
          },
          required: false
        }
      ],
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  bar: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })

  {
    const mappersPluginPath = join(cwd, 'versions', 'v1', 'mappers', 'get-hello.js')
    await access(mappersPluginPath)
  }

  const { child, url } = await start(['-c', configPath])
  t.after(() => safeKill(child))

  {
    const { statusCode, body } = await request(url + '/v2/hello', {
      headers: {
        'x-bar': '123'
      }
    })
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { bar: '123' })
  }

  {
    const { statusCode, body } = await request(url + '/v1/hello', {
      headers: {
        'x-foo': '123'
      }
    })
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, {})
  }
})
