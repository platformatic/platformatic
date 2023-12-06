import assert from 'assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join, dirname } from 'node:path'
import { readFile, writeFile, mkdir, mkdtemp, cp, rm, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { request } from 'undici'
import { start, cliPath, safeKill } from './helper.mjs'

function urlDirname (url) {
  return dirname(fileURLToPath(url))
}

test('update openapi schema for v1 (first version)', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'update-version-v1')
  const cwd = await mkdtemp(join(tmpdir(), 'test-update-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const openapiPath = join(cwd, 'versions', 'v1', 'openapi.json')
  const beforeOpenapiFile = await readFile(openapiPath, 'utf8')
  const beforeOpenapi = JSON.parse(beforeOpenapiFile)

  const beforeRouteSchema = beforeOpenapi.paths['/v1/hello']
  assert.strictEqual(beforeRouteSchema, undefined)

  const child = await execa('node', [cliPath, 'versions', 'update'], { cwd })
  assert.ok(child.stdout.includes(
    'No previous versions found. Skipping mappers generation.'
  ))

  const afterOpenapiFile = await readFile(openapiPath, 'utf8')
  const afterOpenapi = JSON.parse(afterOpenapiFile)

  const afterRouteSchema = afterOpenapi.paths['/v1/hello']
  assert.deepStrictEqual(afterRouteSchema, {
    get: {
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  hello: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      }
    }
  })
})

test('update openapi schema for v2', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'update-version-v2')
  const cwd = await mkdtemp(join(tmpdir(), 'test-update-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const openapiPath = join(cwd, 'versions', 'v2', 'openapi.json')
  const beforeOpenapiFile = await readFile(openapiPath, 'utf8')
  const beforeOpenapi = JSON.parse(beforeOpenapiFile)

  const beforeRouteSchema = beforeOpenapi.paths['/v2/hello']
  assert.deepStrictEqual(beforeRouteSchema, {
    get: {
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  hello: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                hello: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  hello: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  })

  await execa('node', [cliPath, 'versions', 'update'], { cwd })

  const configPath = join(cwd, 'platformatic.service.json')
  const afterOpenapiFile = await readFile(openapiPath, 'utf8')
  const afterOpenapi = JSON.parse(afterOpenapiFile)

  const afterRouteSchema = afterOpenapi.paths['/v2/hello']
  assert.deepStrictEqual(afterRouteSchema, {
    get: {
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: { type: 'number' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Default Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'string' }
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

  {
    const mappersPluginPath = join(cwd, 'versions', 'v1', 'mappers', 'get-hello-{id}.js')
    await access(mappersPluginPath)
  }

  {
    const mappersPluginPath = join(cwd, 'versions', 'v1', 'mappers', 'get-old--hello.js')
    await access(mappersPluginPath)
  }

  const { child, url } = await start(['-c', configPath])
  t.after(() => safeKill(child))

  {
    const { statusCode, body } = await request(url + '/v1/hello')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, {})
  }

  {
    const { statusCode, body } = await request(url + '/v2/hello')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { data: 'world' })
  }

  {
    const { statusCode, body } = await request(url + '/v1/hello/123')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, {})
  }

  {
    const { statusCode, body } = await request(url + '/v2/hello/123')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { data: '123' })
  }

  {
    const { statusCode, body } = await request(url + '/v1/old-hello')
    assert.strictEqual(statusCode, 404)

    const data = await body.json()
    assert.deepStrictEqual(data, {
      code: 'PLT_ERR_DELETED_ROUTE',
      message: 'Route GET "/old-hello" was deleted in the "v2" API'
    })
  }

  {
    const { statusCode, body } = await request(url + '/v2/old-hello')
    assert.strictEqual(statusCode, 404)

    const data = await body.json()
    assert.deepStrictEqual(data, {
      error: 'Not Found',
      message: 'Route GET:/v2/old-hello not found',
      statusCode: 404
    })
  }
})

test('update openapi schema for v2', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'update-version-v2')
  const cwd = await mkdtemp(join(tmpdir(), 'test-update-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const v1MappersFolder = join(cwd, 'versions', 'v1', 'mappers')
  const outdatedMapperPluginPath = join(v1MappersFolder, 'get-outdated.js')
  await mkdir(v1MappersFolder, { recursive: true })
  await writeFile(outdatedMapperPluginPath, 'module.exports = () => ({})')

  const child = await execa('node', [cliPath, 'versions', 'update'], { cwd })
  assert.ok(child.stdout.includes(
    'Removing obsolete mappers plugin "get-outdated.js"'
  ))

  try {
    await access(outdatedMapperPluginPath)
    assert.fail('outdated mapper plugin should be deleted')
  } catch (err) {}
})

test('skip version update if there is no versions', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'update-version-no-versions')
  const cwd = await mkdtemp(join(tmpdir(), 'test-update-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const child = await execa('node', [cliPath, 'versions', 'update'], { cwd })
  assert.ok(child.stdout.includes(
    'No versions found. Skipping version update.'
  ))
})
