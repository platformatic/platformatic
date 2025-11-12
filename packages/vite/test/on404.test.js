import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, isCIOnWindows } from '../../basic/test/helper.js'

async function setupFixtureWithConfig (root, on404Config) {
  const frontendDir = resolve(root, 'services/frontend')
  await mkdir(frontendDir, { recursive: true })

  const appConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/vite/2.0.0.json'
  }

  if (on404Config !== undefined) {
    appConfig.on404 = on404Config
  }

  await writeFile(
    resolve(frontendDir, 'platformatic.application.json'),
    JSON.stringify(appConfig, null, 2)
  )
}

test('on404 disabled by default', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root)

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 404 without custom handler
  assert.strictEqual(response.statusCode, 404)

  // Should not be the index.html content
  const body = await response.body.text()
  assert.ok(!body.includes('Hello from Vite'))

  await runtime.close()
})

test('on404 with boolean true', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, true)

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 200 with the index.html content (default)
  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('Hello from Vite'))

  await runtime.close()
})

test('on404 with boolean false', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, false)

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 404 without custom handler
  assert.strictEqual(response.statusCode, 404)

  await runtime.close()
})

test('on404 with custom path string', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, '404.html')

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 200 with the 404.html content
  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('404 - Page Not Found'))

  await runtime.close()
})

test('on404 with object and enabled true', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, { enabled: true })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 200 with the index.html content (default)
  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('Hello from Vite'))

  await runtime.close()
})

test('on404 with object and enabled false', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, { enabled: false })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 404 without custom handler
  assert.strictEqual(response.statusCode, 404)

  await runtime.close()
})

test('on404 with custom path object', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, { path: '404.html' })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 200 with the 404.html content
  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('404 - Page Not Found'))

  await runtime.close()
})

test('on404 with custom code', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, {
    enabled: true,
    code: 404,
    path: '404.html'
  })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get a 404 status code with the custom 404.html content
  assert.strictEqual(response.statusCode, 404)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('404 - Page Not Found'))

  await runtime.close()
})

test('on404 with custom content type', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, {
    enabled: true,
    type: 'text/plain',
    path: '404.html'
  })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should get the custom content type
  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-type'], 'text/plain; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('404 - Page Not Found'))

  await runtime.close()
})

test('on404 with all custom options', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, {
    enabled: true,
    path: '404.html',
    code: 404,
    type: 'text/html'
  })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request a non-existent path
  const response = await request(`${url}/non-existent-path`)

  // Should use all custom options
  assert.strictEqual(response.statusCode, 404)
  assert.strictEqual(response.headers['content-type'], 'text/html; charset=UTF-8')

  const body = await response.body.text()
  assert.ok(body.includes('404 - Page Not Found'))

  await runtime.close()
})

test('on404 existing routes still work', { skip: isCIOnWindows }, async t => {
  const root = resolve(import.meta.dirname, './fixtures/on404')
  await setupFixtureWithConfig(root, {
    enabled: true,
    path: '404.html'
  })

  const { runtime, url } = await createRuntime({
    t,
    root,
    build: true,
    production: true
  })

  // Request the root path (should work normally)
  const response = await request(`${url}/`)

  // Should get a 200 with the normal index.html
  assert.strictEqual(response.statusCode, 200)

  const body = await response.body.text()
  assert.ok(body.includes('Hello from Vite'))

  await runtime.close()
})
