import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function startApplication (t, fixture, applicationId) {
  const configFile = join(fixturesDir, fixture, 'platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const { [`${applicationId}:0`]: entryUrl } = await app.start()
  return entryUrl
}

test('should strip the runtime base path for a service application', async t => {
  const entryUrl = await startApplication(t, 'base-path', 'service')

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
    // Redirect to an external absolute URL is not rewritten
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect-external'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, 'https://example.com/oauth/authorize?client_id=123')
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

test('should strip the runtime base path for a gateway application', async t => {
  const entryUrl = await startApplication(t, 'base-path', 'composer')

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
    // Redirect to an external absolute URL is not rewritten
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/service/redirect-external'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, 'https://example.com/oauth/authorize?client_id=123')
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

test('should strip the runtime base path for a node application', async t => {
  const entryUrl = await startApplication(t, 'base-path', 'node')

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

  {
    // Redirect to an external absolute URL is not rewritten
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect-external'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, 'https://example.com/oauth/authorize?client_id=123')
  }
})

test('should strip the runtime base path for an express application', async t => {
  const entryUrl = await startApplication(t, 'base-path', 'express')

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

  {
    // Redirect to an external absolute URL is not rewritten
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect-external'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, 'https://example.com/oauth/authorize?client_id=123')
  }
})

test('should strip the runtime base path for a nodejs application in a child process', async t => {
  const entryUrl = await startApplication(t, 'base-path', 'node-child')

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

  {
    // Redirect to an external absolute URL is not rewritten
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect-external'
    })
    strictEqual(statusCode, 302)

    const location = headers.location
    strictEqual(location, 'https://example.com/oauth/authorize?client_id=123')
  }
})

test('should not strip the runtime base path for a capability that opted-out', async t => {
  const entryUrl = await startApplication(t, 'base-path', 'node-no-strip')

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
