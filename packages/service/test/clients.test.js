'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { rm } = require('node:fs/promises')
const { request } = require('undici')
const { compile } = require('../lib/compile')
const { buildServer } = require('..')

// require('./helper')

test('client is loaded', async (t) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  t.after(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await buildServer(join(__dirname, '..', 'fixtures', 'hello-client', 'platformatic.service.json'))

  t.after(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world' })
})

test('client is loaded (ts)', async (t) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  t.after(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const targetDir = join(__dirname, '..', 'fixtures', 'hello-client-ts')

  try {
    await rm(join(targetDir, 'dist'), { recursive: true })
  } catch {}

  console.time('compile')
  await compile(targetDir, { server: { logger: { level: 'warn' } } })
  console.timeEnd('compile')

  const app2 = await buildServer(join(targetDir, 'platformatic.service.json'))
  t.after(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world' })
})

test('client is loaded dependencyless', async (t) => {
  const app1 = await buildServer(join(__dirname, '..', 'fixtures', 'hello', 'warn-log.service.json'))

  t.after(async () => {
    await app1.close()
  })
  await app1.start()

  process.env.PLT_CLIENT_URL = app1.url

  const app2 = await buildServer(join(__dirname, '..', 'fixtures', 'hello-client-without-deps', 'platformatic.service.json'))

  t.after(async () => {
    await app2.close()
  })
  await app2.start()

  const res = await request(`${app2.url}/`)
  assert.strictEqual(res.statusCode, 200, 'status code')
  const data = await res.body.json()
  assert.deepStrictEqual(data, { hello: 'world' })
})
