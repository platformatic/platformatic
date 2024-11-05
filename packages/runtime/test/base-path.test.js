'use strict'

const assert = require('node:assert')
const { request } = require('undici')
const { test } = require('node:test')
const { join } = require('node:path')
const { readFile, writeFile } = require('node:fs/promises')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')
const { buildRuntime } = require('../lib/start')
const fixturesDir = join(__dirname, '..', 'fixtures')

test('should strip the runtime base path for a service as an entrypoint', async (t) => {
  const configFile = join(fixturesDir, 'base-path', 'platformatic.json')
  await setEntrypoint(configFile, 'service')

  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)

  t.after(async () => {
    await setEntrypoint(configFile, 'composer')
    await app.close()
  })

  const entryUrl = await app.start()

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'service' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'service' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/base-path/hello')
  }

  {
    // Check the openapi base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/documentation/json'
    })
    assert.strictEqual(statusCode, 200)

    const openapi = await body.json()
    assert.deepStrictEqual(openapi.servers, [{ url: '/base-path' }])
  }
})

test('should strip the runtime base path for a composer as an entrypoint', async (t) => {
  const configFile = join(fixturesDir, 'base-path', 'platformatic.json')
  await setEntrypoint(configFile, 'composer')

  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)

  t.after(async () => {
    await setEntrypoint(configFile, 'composer')
    await app.close()
  })

  const entryUrl = await app.start()

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/service/hello' })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'service' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/service/hello'
    })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'service' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/service/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/service/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/service/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/base-path/service/hello')
  }

  {
    // Check the composer openapi base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/documentation/json'
    })
    assert.strictEqual(statusCode, 200)

    const openapi = await body.json()
    assert.deepStrictEqual(openapi.servers, [{ url: '/base-path' }])
  }
})

test('should strip the runtime base path for a node as an entrypoint', async (t) => {
  const configFile = join(fixturesDir, 'base-path', 'platformatic.json')
  await setEntrypoint(configFile, 'node')

  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)

  t.after(async () => {
    await setEntrypoint(configFile, 'composer')
    await app.close()
  })

  const entryUrl = await app.start()

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'nodejs' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'nodejs' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/base-path/hello')
  }
})

test('should strip the runtime base path for an express as an entrypoint', async (t) => {
  const configFile = join(fixturesDir, 'base-path', 'platformatic.json')
  await setEntrypoint(configFile, 'express')

  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)

  t.after(async () => {
    await setEntrypoint(configFile, 'composer')
    await app.close()
  })

  const entryUrl = await app.start()

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'express' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'express' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/base-path/hello')
  }
})

test('should strip the runtime base path for a nodejs in a child process as an entrypoint', async (t) => {
  const configFile = join(fixturesDir, 'base-path', 'platformatic.json')
  await setEntrypoint(configFile, 'node-child')

  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)

  t.after(async () => {
    await setEntrypoint(configFile, 'composer')
    await app.close()
  })

  const entryUrl = await app.start()

  {
    // Send a request without the base path
    const { statusCode, body } = await request(entryUrl, { path: '/hello' })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'node-child-process' })
  }

  {
    // Send a request with the base path
    const { statusCode, body } = await request(entryUrl, {
      path: '/base-path/hello'
    })
    assert.strictEqual(statusCode, 200)

    const response = await body.json()
    assert.deepStrictEqual(response, { stackable: 'node-child-process' })
  }

  {
    // Redirect to a path without the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/hello')
  }

  {
    // Redirect to a path with the base path
    const { statusCode, headers } = await request(entryUrl, {
      path: '/base-path/redirect'
    })
    assert.strictEqual(statusCode, 302)

    const location = headers.location
    assert.strictEqual(location, '/base-path/hello')
  }
})

async function setEntrypoint (configPath, entrypoint) {
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)
  config.entrypoint = entrypoint
  await writeFile(configPath, JSON.stringify(config, null, 2))
}
