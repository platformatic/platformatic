import { strict as assert } from 'node:assert'
import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

test('should have notFoundHandler disabled by default', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 404)

  const body = await response.body.text()
  assert.ok(!body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with the default not found handler when notFoundHandler is set to false', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: root => {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: false }
        return config
      })
    }
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 404)

  const body = await response.body.text()
  assert.ok(!body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with 200 with index.html as text/html when notFoundHandler is set to true', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: root => {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: true }
        return config
      })
    }
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8')

  const body = await response.body.text()
  assert.ok(body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with the default not found handler when notFoundHandler is set to an object with enabled=false', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: root => {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: { enabled: false } }
        return config
      })
    }
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 404)

  const body = await response.body.text()
  assert.ok(!body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with 200 with index.html as text/html when notFoundHandler is set to an object with enabled=true', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: root => {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: { enabled: true } }
        return config
      })
    }
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8')

  const body = await response.body.text()
  assert.ok(body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with 200 with index.html as text/html when notFoundHandler has status set', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: root => {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: { enabled: true, statusCode: 202 } }
        return config
      })
    }
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 202)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8')

  const body = await response.body.text()
  assert.ok(body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with 200 with index.html as text/whatever when notFoundHandler has contentType set', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: root => {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: { enabled: true, contentType: 'text/whatever' } }
        return config
      })
    }
  })

  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/whatever')

  const body = await response.body.text()
  assert.ok(body.includes('Vite Index'))

  await runtime.close()
})

test('should reply with 200 with 404.html as when notFoundHandler has path set', async t => {
  const { root, runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    async additionalSetup (root) {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = { notFoundHandler: { enabled: true, path: '404.html' } }
        return config
      })
    }
  })

  await cp(resolve(root, 'services/frontend/404.html'), resolve(root, 'services/frontend/dist/404.html'))
  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8')

  const body = await response.body.text()
  assert.ok(body.includes('Vite Not Found'))

  await runtime.close()
})

test('should reply with all parameters combined when notFoundHandler is configured', async t => {
  const { root, runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    async additionalSetup (root) {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = {
          notFoundHandler: { enabled: true, statusCode: 201, contentType: 'text/another', path: '404.html' }
        }
        return config
      })
    }
  })

  await cp(resolve(root, 'services/frontend/404.html'), resolve(root, 'services/frontend/dist/404.html'))
  const response = await request(`${url}/non-existent-path`)

  assert.strictEqual(response.statusCode, 201)
  assert.strictEqual(response.headers['content-type'], 'text/another')

  const body = await response.body.text()
  assert.ok(body.includes('Vite Not Found'))

  await runtime.close()
})

test('should still serve existing routes', async t => {
  const { runtime, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    async additionalSetup (root) {
      return updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
        config.vite = {
          notFoundHandler: { enabled: true, statusCode: 201, contentType: 'text/another', path: '404.html' }
        }
        return config
      })
    }
  })

  const response = await request(`${url}/`)

  assert.strictEqual(response.statusCode, 200)

  const body = await response.body.text()
  assert.ok(body.includes('Vite Index'))

  await runtime.close()
})
