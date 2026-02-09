import { safeRemove } from '@platformatic/foundation'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function startApplicationWithEntrypoint (t, fixture, entrypoint) {
  const configFile = join(fixturesDir, fixture, 'platformatic-with-entrypoint.json')
  const config = JSON.parse(await readFile(join(fixturesDir, fixture, 'platformatic.json'), 'utf8'))
  config.entrypoint = entrypoint
  await writeFile(configFile, JSON.stringify(config, null, 2))

  const app = await createRuntime(configFile)

  t.after(async () => {
    await safeRemove(configFile)
    await app.close()
  })

  await app.init()
  return app.start()
}

test('should strip the runtime base path for an application as an entrypoint', async t => {
  const entryUrl = await startApplicationWithEntrypoint(t, 'base-path', 'service')

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'service' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'service' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/base-path/hello')
  }

  {
    // Check the openapi base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/documentation/json'
    })
    strictEqual(statusCode, 200)

    const openapi = await body.json()
    deepStrictEqual(openapi.servers, [{ url: '/base-path' }])
  }
})

test('should strip the runtime base path for a gateway as an entrypoint', async t => {
  const entryUrl = await startApplicationWithEntrypoint(t, 'base-path', 'composer')

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/service/hello' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'service' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/service/hello'
    })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'service' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/service/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/service/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/service/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/base-path/service/hello')
  }

  {
    // Check the gateway openapi base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/documentation/json'
    })
    strictEqual(statusCode, 200)

    const openapi = await body.json()
    deepStrictEqual(openapi.servers, [{ url: '/base-path' }])
  }
})

test('should strip the runtime base path for a node as an entrypoint', async t => {
  const entryUrl = await startApplicationWithEntrypoint(t, 'base-path', 'node')

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'nodejs' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'nodejs' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/base-path/hello')
  }
})

test('should strip the runtime base path for an express as an entrypoint', async t => {
  const entryUrl = await startApplicationWithEntrypoint(t, 'base-path', 'express')

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'express' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'express' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/base-path/hello')
  }
})

test('should strip the runtime base path for a nodejs in a child process as an entrypoint', async t => {
  const entryUrl = await startApplicationWithEntrypoint(t, 'base-path', 'node-child')

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'node-child-process' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'node-child-process' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/base-path/hello')
  }
})

test('should not strip the runtime base path for a capability that opted-out', async t => {
  const entryUrl = await startApplicationWithEntrypoint(t, 'base-path', 'node-no-strip')

  {
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    strictEqual(statusCode, 200)

    const response = await body.json()
    deepStrictEqual(response, { capability: 'nodejs' })
  }

  {
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, '/base-path/hello')
  }
})
